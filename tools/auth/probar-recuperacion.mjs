// Prueba la app real con las llamadas Auth interceptadas: no envía mails ni
// cambia contraseñas de personas. Usa Playwright fijado en growth/web.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';

const { chromium } = await import(process.env.TRATTO_PLAYWRIGHT_MODULE || '../../growth/web/node_modules/playwright/index.mjs');
const html = await readFile(new URL('../../index.html', import.meta.url), 'utf8');
const bundle = process.env.TRATTO_SUPABASE_BUNDLE ? await readFile(process.env.TRATTO_SUPABASE_BUNDLE) : null;
let browser, server, origen;
const usuario = { id:'11111111-1111-4111-8111-111111111111', email:'cliente@example.com', created_at:'2026-10-01T12:00:00Z', user_metadata:{rol:'cliente',nombre:'Cliente de prueba'} };
const respuesta = (status, json) => ({status, json});

before(async () => {
  server = createServer((req,res) => {
    if(new URL(req.url,'http://localhost').pathname === '/'){
      res.writeHead(200, {'Content-Type':'text/html; charset=utf-8'}); res.end(html);
    }else{ res.writeHead(204); res.end(); }
  });
  await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
  origen = 'http://127.0.0.1:' + server.address().port;
  browser = await chromium.launch({headless:true});
});
after(async () => { await browser?.close(); await new Promise(resolve => server?.close(resolve)); });

async function pagina(handler, {width=390, guardada=false}={}){
  const context = await browser.newContext({viewport:{width,height:844}});
  const page = await context.newPage(), llamadas=[], errores=[];
  page.on('pageerror', e => errores.push(e.message));
  if(guardada) await context.addInitScript(() => localStorage.setItem('mkt_sesion',JSON.stringify({access_token:'cuenta-anterior-de-prueba',refresh_token:'anterior',modo:'cliente'})));
  await page.route('**/*', async route => {
    const req=route.request(), url=new URL(req.url());
    if(url.origin === origen) return route.continue();
    if(url.hostname === 'cdn.jsdelivr.net'){
      if(bundle) return route.fulfill({status:200,contentType:'application/javascript',body:bundle});
      return route.continue();
    }
    if(url.pathname.startsWith('/auth/v1/')){
      if(req.method() === 'OPTIONS') return route.fulfill({status:204,headers:{'Access-Control-Allow-Origin':origen,'Access-Control-Allow-Headers':'*','Access-Control-Allow-Methods':'GET,POST,PUT'}});
      const llamada={path:url.pathname,search:url.search,method:req.method(),authorization:req.headers().authorization,body:req.postDataJSON()};
      llamadas.push(llamada);
      const r=await handler(llamada);
      return route.fulfill({status:r.status,contentType:'application/json',body:JSON.stringify(r.json ?? {}),headers:{'Access-Control-Allow-Origin':origen}});
    }
    // Aislar también los avisos, métricas y datos del resto de la app.
    return route.fulfill({status:200,contentType:url.hostname.includes('fonts.')?'text/css':'application/json',body:url.hostname.includes('fonts.')?'':'[]',headers:{'Access-Control-Allow-Origin':origen}});
  });
  return {page,context,llamadas,errores,close:async()=>{
    assert.deepEqual(errores,[],'La app no debe lanzar errores JS'); await context.close();
  }};
}
async function abrir(page, hash=''){ await page.goto(origen + '/' + hash); await page.waitForSelector('#arranque',{state:'detached'}); }
async function olvido(page){ await page.locator('#a-olvido').click(); await page.locator('#a-recuperar-email').fill(usuario.email); }
const enlace='?recuperar=1&utm_source=prueba#type=recovery&access_token=recuperacion-de-prueba&refresh_token=refresh-de-prueba';

test('solicitud por email, validación y respuesta sin revelar cuentas',async()=>{
  const p=await pagina(async()=>respuesta(200,{}));
  await abrir(p.page); await olvido(p.page);
  await p.page.locator('#a-recuperar-email').fill('email-invalido');
  await p.page.locator('#a-enviar').click();
  assert.equal(p.llamadas.length,0);
  assert.equal(await p.page.locator('#e-a-recuperar-email').isVisible(),true);
  await p.page.locator('#a-recuperar-email').fill(usuario.email);
  await p.page.locator('#a-enviar').click();
  await p.page.waitForFunction(()=>document.getElementById('a-aviso').textContent.includes('Si existe una cuenta'));
  const primera=await p.page.locator('#a-aviso').textContent();
  assert.equal(p.llamadas[0].method,'POST'); assert.equal(p.llamadas[0].path,'/auth/v1/recover');
  assert.deepEqual(p.llamadas[0].body,{email:usuario.email});
  assert.equal(new URLSearchParams(p.llamadas[0].search).get('redirect_to'),origen+'/?recuperar=1');
  await p.page.locator('#a-enviar').click(); assert.equal(p.llamadas.length,1,'Frena el pedido repetido');
  await p.close();
  const desconocida=await pagina(async()=>respuesta(404,{error_code:'user_not_found'}));
  await abrir(desconocida.page); await olvido(desconocida.page); await desconocida.page.locator('#a-enviar').click();
  await desconocida.page.waitForFunction(()=>document.getElementById('a-aviso').textContent.includes('Si existe una cuenta'));
  assert.equal(await desconocida.page.locator('#a-aviso').textContent(),primera);
  await desconocida.close();
});

for(const width of [390,1280]) test('cambio desde enlace válido y sesión anterior aislada ('+width+'px)',async()=>{
  const p=await pagina(async r=>{
    if(r.method==='GET' && r.path==='/auth/v1/user') return respuesta(200,usuario);
    if(r.method==='PUT') return respuesta(200,usuario);
    if(r.path==='/auth/v1/logout') return respuesta(204,{});
    throw new Error('Llamada inesperada: '+r.path);
  },{width,guardada:true});
  await abrir(p.page,enlace);
  await p.page.waitForSelector('#a-nueva-clave-caja:not(.oculto)');
  assert.equal(new URL(p.page.url()).hash,'');
  assert.equal(new URL(p.page.url()).searchParams.get('recuperar'),null);
  assert.equal(new URL(p.page.url()).searchParams.get('utm_source'),'prueba');
  assert.equal(p.llamadas[0].authorization,'Bearer recuperacion-de-prueba');
  assert.equal(await p.page.evaluate(()=>localStorage.getItem('mkt_sesion').includes('recuperacion-de-prueba')),false);
  await p.page.locator('#a-nueva-pass').fill('corta'); await p.page.locator('#a-repetir-pass').fill('corta');
  await p.page.locator('#a-enviar').click(); assert.equal(p.llamadas.filter(r=>r.method==='PUT').length,0);
  await p.page.locator('#a-nueva-pass').fill('Nueva-contraseña-de-prueba');
  await p.page.locator('#a-repetir-pass').fill('otra-contraseña'); await p.page.locator('#a-enviar').click();
  assert.equal(await p.page.locator('#e-a-repetir-pass').isVisible(),true);
  assert.equal(p.llamadas.filter(r=>r.method==='PUT').length,0);
  await p.page.locator('#ver-nueva-pass').click(); assert.equal(await p.page.locator('#a-nueva-pass').getAttribute('type'),'text');
  await p.page.locator('#ver-nueva-pass').click();
  await p.page.locator('#a-repetir-pass').fill('Nueva-contraseña-de-prueba');
  await p.page.locator('#a-repetir-pass').press('Enter');
  await p.page.waitForFunction(()=>document.getElementById('a-aviso').textContent.includes('cambiaste tu contraseña'));
  const cambio=p.llamadas.find(r=>r.method==='PUT');
  assert.equal(cambio.authorization,'Bearer recuperacion-de-prueba');
  assert.deepEqual(cambio.body,{password:'Nueva-contraseña-de-prueba'});
  assert.equal(p.llamadas.filter(r=>r.path==='/auth/v1/logout').length,1);
  assert.equal(await p.page.evaluate(()=>localStorage.getItem('mkt_sesion')),null);
  assert.equal(await p.page.locator('#a-email').inputValue(),usuario.email);
  assert.equal(await p.page.locator('#a-pass').inputValue(),'');
  assert.equal(await p.page.locator('#a-nueva-pass').inputValue(),'');
  assert.equal(await p.page.locator('#a-nueva-clave-caja').isVisible(),false);
  await p.close();
});

test('enlace inválido o vencido no permite cambiar la contraseña',async()=>{
  const p=await pagina(async()=>respuesta(401,{message:'JWT expired'}));
  await abrir(p.page,enlace);
  await p.page.waitForFunction(()=>document.getElementById('a-aviso').textContent.includes('ya venció'));
  assert.equal(await p.page.locator('#a-nueva-clave-caja').isVisible(),false);
  assert.equal(p.llamadas.filter(r=>r.method==='PUT').length,0);
  await p.close();
  const error=await pagina(async()=>{throw new Error('No debe llamar Auth sin token');});
  await abrir(error.page,'?recuperar=1#error=access_denied&error_code=otp_expired');
  assert.equal(await error.page.locator('#a-recuperar-caja').isVisible(),true);
  assert.equal(await error.page.locator('#a-nueva-clave-caja').isVisible(),false);
  assert.equal(new URL(error.page.url()).hash,'');
  await error.close();
  const sinMarcador=await pagina(async()=>{throw new Error('No debe llamar Auth con un enlace vencido');});
  await abrir(sinMarcador.page,'#error=access_denied&error_code=otp_expired');
  assert.equal(await sinMarcador.page.locator('#a-recuperar-caja').isVisible(),true);
  assert.equal(await sinMarcador.page.locator('#a-nueva-clave-caja').isVisible(),false);
  assert.equal(new URL(sinMarcador.page.url()).hash,'');
  await sinMarcador.close();
});

test('un enlace que vence al guardar exige pedir uno nuevo',async()=>{
  const p=await pagina(async r=>respuesta(r.method==='GET'?200:401,r.method==='GET'?usuario:{message:'JWT expired'}));
  await abrir(p.page,enlace); await p.page.waitForSelector('#a-nueva-clave-caja:not(.oculto)');
  await p.page.locator('#a-nueva-pass').fill('Nueva-contraseña-de-prueba'); await p.page.locator('#a-repetir-pass').fill('Nueva-contraseña-de-prueba');
  await p.page.locator('#a-enviar').click(); await p.page.waitForFunction(()=>document.getElementById('a-aviso').textContent.includes('El enlace venció'));
  assert.equal(await p.page.locator('#a-recuperar-email').inputValue(),usuario.email);
  assert.equal(await p.page.locator('#a-enviar').isEnabled(),true);
  await p.close();
});

test('rate limit y contraseña rechazada muestran errores útiles',async()=>{
  const p=await pagina(async()=>respuesta(429,{error_code:'over_email_send_rate_limit'}));
  await abrir(p.page); await olvido(p.page); await p.page.locator('#a-enviar').click();
  await p.page.waitForFunction(()=>document.getElementById('a-aviso').textContent.includes('Esperá un minuto'));
  assert.equal(await p.page.locator('#a-enviar').isEnabled(),true); await p.close();
  const repetida=await pagina(async r=>respuesta(r.method==='GET'?200:422,r.method==='GET'?usuario:{error_code:'same_password'}));
  await abrir(repetida.page,enlace); await repetida.page.waitForSelector('#a-nueva-clave-caja:not(.oculto)');
  await repetida.page.locator('#a-nueva-pass').fill('Nueva-contraseña-de-prueba'); await repetida.page.locator('#a-repetir-pass').fill('Nueva-contraseña-de-prueba'); await repetida.page.locator('#a-enviar').click();
  await repetida.page.waitForFunction(()=>document.getElementById('a-aviso').textContent.includes('distinta de la anterior'));
  assert.equal(await repetida.page.locator('#a-nueva-clave-caja').isVisible(),true); await repetida.close();
});

test('cancelar un enlace lento no abre el cambio de contraseña después',async()=>{
  let liberar; const respuestaLenta=new Promise(resolve=>liberar=resolve);
  const p=await pagina(async()=>{await respuestaLenta; return respuesta(200,usuario);});
  await p.page.goto(origen+'/'+enlace); await p.page.waitForFunction(()=>document.getElementById('a-txt').textContent==='Verificando enlace…');
  await p.page.locator('#a-recuperar-volver').click(); liberar();
  await p.page.waitForSelector('#arranque',{state:'detached'});
  assert.equal(await p.page.locator('#a-datos').isVisible(),true);
  assert.equal(await p.page.locator('#a-nueva-clave-caja').isVisible(),false); await p.close();
});

test('inicio de sesión y confirmación por código conservan su flujo',async()=>{
  const sesion={access_token:'sesion-login-de-prueba',refresh_token:'refresh-de-prueba',user:usuario};
  const p=await pagina(async()=>respuesta(200,sesion));
  await abrir(p.page); await p.page.locator('#tab-crear').click();
  assert.equal(await p.page.locator('#a-olvido').isVisible(),false); await p.page.locator('#tab-entrar').click();
  await p.page.locator('#a-email').fill(usuario.email); await p.page.locator('#a-pass').fill('Contraseña-login-de-prueba'); await p.page.locator('#a-enviar').click();
  await p.page.waitForSelector('#p-inicio.activa');
  assert.equal(p.llamadas[0].path,'/auth/v1/token'); await p.close();
  const codigo=await pagina(async()=>respuesta(200,sesion));
  await abrir(codigo.page); await codigo.page.evaluate(email=>irAPasoCodigo(email),usuario.email);
  await codigo.page.locator('#a-codigo').fill('123456'); await codigo.page.waitForSelector('#p-inicio.activa');
  assert.deepEqual(codigo.llamadas[0].body,{type:'signup',email:usuario.email,token:'123456'});
  await codigo.close();
});
