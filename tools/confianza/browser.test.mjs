// Ejercita la app y el módulo reales con el backend simulado. Ninguna llamada
// externa sale del navegador: no hay correos, pagos, avisos ni cuentas reales.
import {test, before, after} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createServer} from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const {chromium} = await import(process.env.TRATTO_PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const customer='11111111-1111-4111-8111-111111111111';
const provider='22222222-2222-4222-8222-222222222222';
let browser,server,origin;

before(async()=>{
  server=createServer(async(req,res)=>{
    const pathname=new URL(req.url,'http://localhost').pathname;
    if(pathname==='/__confianza-fixture.html'){
      res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});
      res.end('<!doctype html><html lang="es-AR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Acuerdos simulados</title><link rel="stylesheet" href="/servicio-acuerdos.css"><style>body{font-family:system-ui;margin:0;padding:12px}main{max-width:620px;margin:auto}button,input,textarea{box-sizing:border-box}</style><main id="fixture"></main><script src="/servicio-acuerdos.js"></script></html>');return;
    }
    const relative=pathname==='/'?'index.html':decodeURIComponent(pathname.slice(1));
    const file=path.resolve(root,relative);
    if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
    try{
      const body=await readFile(file);
      const mime=file.endsWith('.html')?'text/html; charset=utf-8':file.endsWith('.js')||file.endsWith('.mjs')?'application/javascript':file.endsWith('.css')?'text/css':'application/octet-stream';
      res.writeHead(200,{'Content-Type':mime});res.end(body);
    }catch{res.writeHead(404);res.end();}
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  origin='http://127.0.0.1:'+server.address().port;
  browser=await chromium.launch({headless:true});
});
after(async()=>{await browser?.close();await new Promise(resolve=>server?.close(resolve));});

async function app({width=390,ia=false,handler=()=>({status:200,json:{}})}={}){
  const context=await browser.newContext({viewport:{width,height:844}});
  const page=await context.newPage(),calls=[],errors=[];
  page.setDefaultTimeout(8000);
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',async route=>{
    const req=route.request(),url=new URL(req.url());
    if(url.origin===origin)return route.continue();
    // El SDK Realtime no es necesario para estas interacciones: no se abre
    // ninguna conexión ni se requiere descargar código externo en la prueba.
    if(req.resourceType()==='script')return route.fulfill({status:200,contentType:'application/javascript',body:''});
    if(req.resourceType()==='stylesheet')return route.fulfill({status:200,contentType:'text/css',body:''});
    if(req.method()==='OPTIONS')return route.fulfill({status:204,headers:{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'*','Access-Control-Allow-Methods':'GET,POST,PUT,PATCH'}});
    let body=null;try{body=req.postDataJSON();}catch{}
    const call={url:url.href,path:url.pathname,method:req.method(),body,contentType:req.headers()['content-type'],bytes:req.postDataBuffer()?.length||0};
    calls.push(call);
    const result=await handler(call);
    return route.fulfill({status:result.status||200,contentType:'application/json',body:JSON.stringify(result.json??[]),headers:{'Access-Control-Allow-Origin':origin}});
  });
  await page.goto(origin);
  await page.waitForSelector('#arranque',{state:'detached'});
  await page.evaluate(({customer,provider,ia})=>{
    sesion={access_token:'token-simulado-no-real',user:{id:customer,email:'cliente@example.invalid',user_metadata:{rol:'cliente',nombre:'Cliente de prueba',ia_permiso:ia}}};
    modo='cliente';miRol='cliente';
    chatActual={id:17,estado:'aceptado',proveedores:{user_id:provider,nombre:'Prestador de prueba',rubro:'Pintura'},solicitudes:{user_id:customer,nombre_cliente:'Cliente de prueba'}};
    ir('chat');mostrarCalificar();
  },{customer,provider,ia});
  return {page,context,calls,errors,async close(){await context.close();assert.deepEqual(errors,[],'La app no debe lanzar errores JavaScript');}};
}

for(const width of [320,390])test('calificar sin IA ni transferencia al webhook ('+width+'px)',async()=>{
  const p=await app({width,handler:call=>call.path.endsWith('/rpc/servicio_calificar')?{json:{id:1,match_id:17,puntaje:5,atributos:[],comentario:'Muy buen trabajo'}}:{json:[]}});
  try{
    await p.page.locator('[data-estrella="5"]').click();
    await p.page.locator('#cal-comentario').fill('Muy buen trabajo');
    await p.page.locator('#cal-enviar').click();
    await p.page.waitForFunction(()=>document.getElementById('caja-calificar').textContent.includes('Gracias'));
    const writes=p.calls.filter(x=>x.method==='POST');
    assert.equal(writes.length,1);
    assert.equal(writes[0].path,'/rest/v1/rpc/servicio_calificar');
    assert.deepEqual(writes[0].body,{p_match_id:17,p_puntaje:5,p_comentario:'Muy buen trabajo'});
    assert.equal(await p.page.locator('#telon-ia').evaluate(e=>e.classList.contains('abierto')),false);
    assert.equal(p.calls.some(x=>x.url.includes('/webhook/calificar')),false);
    assert.equal(await p.page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  }finally{await p.close();}
});

test('permiso global de IA no activa etiquetas sin elección para esa calificación',async()=>{
  const p=await app({ia:true,handler:()=>({json:{id:2,puntaje:4,atributos:[]}})});
  try{
    assert.equal(await p.page.locator('#cal-usar-ia').isChecked(),false);
    await p.page.locator('[data-estrella="4"]').click();
    await p.page.locator('#cal-enviar').click();
    await p.page.waitForFunction(()=>document.getElementById('caja-calificar').textContent.includes('Gracias'));
    assert.equal(p.calls.filter(x=>x.path.endsWith('/rpc/servicio_calificar')).length,1);
    assert.equal(p.calls.some(x=>x.url.includes('/webhook/calificar')),false);
  }finally{await p.close();}
});

test('sin estrellas no guarda y un rechazo del backend no aparenta éxito',async()=>{
  const p=await app({handler:()=>({status:403,json:{message:'No podés calificar este trabajo'}})});
  try{
    await p.page.locator('#cal-enviar').click();
    assert.equal(p.calls.filter(x=>x.method==='POST').length,0);
    await p.page.locator('[data-estrella="3"]').click();
    await p.page.locator('#cal-enviar').click();
    await p.page.waitForFunction(()=>!document.getElementById('cal-enviar')?.disabled);
    assert.equal(await p.page.locator('#caja-calificar').textContent().then(x=>x.includes('¡Gracias!')),false);
  }finally{await p.close();}
});

test('resumen de IA requiere la elección por calificación y el permiso; cancelar no envía',async()=>{
  const p=await app({handler:()=>({json:{ok:true,atributos:['Puntual']}})});
  try{
    await p.page.locator('[data-estrella="5"]').click();await p.page.locator('#cal-usar-ia').check();await p.page.locator('#cal-enviar').click();
    assert.equal(await p.page.locator('#telon-ia').evaluate(e=>e.classList.contains('abierto')),true);
    assert.equal(p.calls.filter(x=>x.method==='POST').length,0);
    await p.page.locator('#ia-ahora-no').click();
    assert.equal(p.calls.filter(x=>x.method==='POST').length,0);
    await p.page.evaluate(()=>{sesion.user.user_metadata.ia_permiso=true;});
    await p.page.locator('#cal-enviar').click();await p.page.waitForFunction(()=>document.getElementById('caja-calificar').textContent.includes('Gracias'));
    const writes=p.calls.filter(x=>x.method==='POST');assert.equal(writes.length,1);assert.match(writes[0].url,/\/calificar$/);assert.equal(writes[0].body.permiso_ia,true);assert.equal(writes[0].body.matchId,17);
    assert.equal(p.calls.some(x=>x.path.endsWith('/rpc/servicio_calificar')),false);
  }finally{await p.close();}
});

test('la respuesta tardía de calificación no cambia otro chat',async()=>{
  let release;const gate=new Promise(resolve=>{release=resolve;});
  const p=await app({handler:async call=>{if(call.path.endsWith('/rpc/servicio_calificar')){await gate;return {json:{id:1}};}return {json:[]};}});
  try{
    await p.page.locator('[data-estrella="5"]').click();await p.page.locator('#cal-enviar').click();
    await p.page.waitForFunction(()=>document.getElementById('cal-enviar').disabled);
    await p.page.evaluate(()=>{document.getElementById('caja-calificar').remove();chatActual.id=18;mostrarCalificar();});
    release();await p.page.waitForTimeout(100);
    assert.equal(await p.page.locator('#caja-calificar').textContent().then(x=>x.includes('Gracias')),false);
    assert.equal(await p.page.locator('#cal-enviar').isEnabled(),true);
    assert.equal(p.calls.find(x=>x.path.endsWith('/rpc/servicio_calificar')).body.p_match_id,17);
  }finally{release();await p.close();}
});

test('adaptador real carga JPEG privado y corrige la ruta firmada de Storage',async()=>{
  const ref=customer+'/17/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.jpg';
  const signed='/object/sign/servicio-evidencias/'+ref+'?token=simulado';
  const p=await app({handler:call=>call.path.includes('/object/sign/')?{json:{signedURL:signed}}:{json:{Key:'privado'}}});
  try{
    const result=await p.page.evaluate(async({ref})=>{
      let adapter;const mount=TrattoAcuerdos.mount;TrattoAcuerdos.mount=(_container,options)=>{adapter=options;return {};};
      montarAcuerdos();TrattoAcuerdos.mount=mount;
      const canvas=document.createElement('canvas');canvas.width=2;canvas.height=2;
      const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
      const uploaded=await adapter.uploadImage(new File([blob],'foto.png',{type:'image/png'}));
      const url=await adapter.resolveImage(ref);
      let rejected=false;try{await adapter.uploadImage(new File(['<svg/>'],'foto.svg',{type:'image/svg+xml'}));}catch{rejected=true;}
      return {uploaded,url,rejected};
    },{ref});
    assert.match(result.uploaded,new RegExp('^'+customer+'/17/[0-9a-f-]{36}\\.jpg$'));
    assert.equal(result.url,'https://qglsonbcsncgekzbfafk.supabase.co/storage/v1'+signed);assert.equal(result.rejected,true);
    const uploads=p.calls.filter(x=>x.path.startsWith('/storage/v1/object/servicio-evidencias/'));
    assert.equal(uploads.length,1);assert.equal(uploads[0].contentType,'image/jpeg');assert.ok(uploads[0].bytes>0);
  }finally{await p.close();}
});

// El contrato del backend se prueba por separado en backend.test.mjs.
// Este servidor simulado solo permite observar las decisiones de la interfaz.
async function agreements({width=390,role='proveedor',rows=[],complaints=[],events=[],imageResult='javascript:alert(1)'}={}){
  const context=await browser.newContext({viewport:{width,height:844}});
  const page=await context.newPage(),errors=[],external=[];
  page.setDefaultTimeout(8000);page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',async route=>{
    if(new URL(route.request().url()).origin===origin)return route.continue();
    external.push(route.request().url());return route.fulfill({status:200,body:''});
  });
  await page.goto(origin+'/__confianza-fixture.html');
  await page.evaluate(async({role,rows,complaints,events,customer,provider,imageResult})=>{
    const uid=n=>'aaaaaaaa-aaaa-4aaa-8aaa-'+String(n).padStart(12,'0');
    const copy=x=>JSON.parse(JSON.stringify(x));
    const f=window.fixture={rows:copy(rows),complaints:copy(complaints),events:copy(events),calls:[],role,next:10,failNext:null,userId:role==='cliente'?customer:provider};
    f.request=async(path,options={})=>{
      f.calls.push({path,method:options.method||'GET',body:copy(options.body||{})});
      if(f.failNext&&(options.method==='POST'||f.failNext==='read')){const message=f.failNext;f.failNext=null;throw new Error(message);}
      if(options.method!=='POST'){
        if(path.startsWith('/rest/v1/servicio_acuerdos?'))return copy(f.rows);
        if(path.startsWith('/rest/v1/servicio_reclamos?'))return copy(f.complaints);
        if(path.startsWith('/rest/v1/servicio_reclamo_eventos?'))return copy(f.events);
        if(path.startsWith('/rest/v1/mensajes?'))return [{id:77}];
        throw new Error('Lectura inesperada: '+path);
      }
      const d=options.body;
      if(path.endsWith('/servicio_proponer')){
        if(d.p_reemplaza_id)f.rows.find(r=>r.id===d.p_reemplaza_id).estado='reemplazado';
        const row={id:uid(f.next++),match_id:17,tipo:d.p_tipo,datos:copy(d.p_datos),estado:'propuesta',version:1,created_at:new Date().toISOString()};f.rows.push(row);return copy(row);
      }
      if(path.endsWith('/servicio_responder')||path.endsWith('/servicio_cambiar_estado')){
        const r=f.rows.find(r=>r.id===d.p_id);if(r.version!==d.p_version)throw new Error('Versión desactualizada');
        r.estado=d.p_estado||(d.p_aceptar?'aceptado':'rechazado');r.version++;return copy(r);
      }
      if(path.endsWith('/servicio_abrir_reclamo')){
        const row={id:uid(f.next++),match_id:17,motivo:d.p_motivo,detalle:d.p_detalle,fotos:d.p_fotos,estado:'recibido',reportante:f.userId,created_at:new Date().toISOString()};f.complaints.push(row);return copy(row);
      }
      if(path.endsWith('/servicio_comentar_reclamo')){
        f.events.push({id:uid(f.next++),reclamo_id:d.p_id,texto:d.p_texto,fotos:d.p_fotos,autor:f.userId,created_at:new Date().toISOString()});return {ok:true};
      }
      throw new Error('Escritura inesperada: '+path);
    };
    f.mount=async(newRole)=>{
      f.role=newRole;f.userId=newRole==='cliente'?customer:provider;
      f.controller=TrattoAcuerdos.mount(document.getElementById('fixture'),{matchId:17,role:f.role,userId:f.userId,request:f.request,baseBudgetId:77,resolveImage:async()=>imageResult});
      await f.controller.ready;
    };
    await f.mount(role);
  },{role,rows,complaints,events,customer,provider,imageResult});
  return {page,context,errors,external,async close(){await context.close();assert.deepEqual(errors,[]);assert.deepEqual(external,[],'La prueba no debe solicitar recursos externos');}};
}
async function remount(p,role){await p.page.evaluate(role=>fixture.mount(role),role);}
const agreement=(type='visita',status='propuesta',data={})=>({id:'aaaaaaaa-aaaa-4aaa-8aaa-000000000001',match_id:17,tipo:type,estado:status,version:1,created_at:'2026-10-28T12:00:00Z',datos:type==='visita'?{nombre_visitante:'Persona que visita',dia:'2026-11-02',franja:'De14 a16',...data}:data});

for(const width of [320,390])test('propone visita, cliente revisa y confirma; estados por rol ('+width+'px)',async()=>{
  const p=await agreements({width});
  try{
    const summary=p.page.locator('summary').filter({hasText:/^Proponer una visita$/});await summary.focus();await p.page.keyboard.press('Enter');
    const form=p.page.locator('form').filter({has:p.page.locator('[name="nombre_visitante"]')});
    await form.locator('[name="nombre_visitante"]').fill('Raúl de prueba');await form.locator('[name="dia"]').fill('2026-11-02');await form.locator('[name="franja"]').fill('De14 a16');
    await form.getByRole('button',{name:'Enviar propuesta al cliente',exact:true}).click();
    await p.page.waitForFunction(()=>fixture.rows.length===1&&document.querySelector('.sa-feedback').textContent.includes('Propuesta guardada'));
    assert.equal(await p.page.getByText('Esperando al cliente',{exact:true}).isVisible(),true);
    assert.equal(await p.page.getByRole('button',{name:'Aceptar visita',exact:true}).count(),0,'El proveedor no ve autoaceptación');
    await remount(p,'cliente');
    assert.equal(await p.page.locator('.sa-agreement a[href="/confianza.html"]').isVisible(),true);
    assert.equal(await p.page.locator('.sa-agreement a[href="/privacidad.html#baja-y-conservacion"]').isVisible(),true);
    await p.page.getByRole('button',{name:'Aceptar visita',exact:true}).click();
    assert.equal(await p.page.locator('.sa-check input').evaluate(e=>e===document.activeElement),true,'La falta de confirmación lleva el foco a la casilla');
    assert.equal(await p.page.evaluate(()=>fixture.rows[0].estado),'propuesta');
    await p.page.locator('.sa-check input').check();await p.page.getByRole('button',{name:'Aceptar visita',exact:true}).click();
    await p.page.waitForFunction(()=>fixture.rows[0].estado==='aceptado'&&!document.querySelector('.sa-panel').hasAttribute('aria-busy'));
    await remount(p,'proveedor');await p.page.getByRole('button',{name:'Avisar que estoy en camino'}).click();
    await p.page.waitForFunction(()=>fixture.rows[0].estado==='en_camino'&&!document.querySelector('.sa-panel').hasAttribute('aria-busy'));
    await p.page.getByRole('button',{name:'Avisar que llegué',exact:true}).click();
    await p.page.waitForFunction(()=>fixture.rows[0].estado==='llego'&&!document.querySelector('.sa-panel').hasAttribute('aria-busy'));
    await remount(p,'cliente');await p.page.getByRole('button',{name:'Confirmar que llegó la persona acordada'}).click();
    await p.page.waitForFunction(()=>fixture.rows[0].estado==='visita_confirmada'&&!document.querySelector('.sa-panel').hasAttribute('aria-busy'));
    assert.equal(await p.page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    if(process.env.TRATTO_QA_SCREENSHOTS)await p.page.screenshot({path:path.join(process.env.TRATTO_QA_SCREENSHOTS,'visita-'+width+'.png'),fullPage:true});
    assert.equal(await p.page.evaluate(()=>fixture.calls.some(c=>/pago|mercadopago|gps/.test(c.path))),false);
  }finally{await p.close();}
});

test('adicional queda separado del original y no se cobra por aceptarlo',async()=>{
  const p=await agreements();
  try{
    await p.page.locator('summary').filter({hasText:/^Proponer un trabajo adicional$/}).click();
    const form=p.page.locator('form').filter({has:p.page.locator('[name="descripcion"]')});
    await form.locator('[name="descripcion"]').fill('Cambiar una pieza adicional');await form.locator('[name="monto"]').fill('25000');await form.locator('[name="incluye"]').fill('Incluye mano de obra. No incluye repuesto.');await form.locator('[name="plazo"]').fill('Una hora');
    await form.getByRole('button',{name:'Enviar propuesta al cliente',exact:true}).click();
    await p.page.waitForFunction(()=>fixture.rows.length===1&&!document.querySelector('.sa-panel').hasAttribute('aria-busy'));
    const data=await p.page.evaluate(()=>fixture.rows[0].datos);assert.equal(data.presupuesto_base_id,77);assert.equal(data.monto,25000);
    await remount(p,'cliente');await p.page.locator('.sa-check input').check();await p.page.getByRole('button',{name:'Aceptar adicional',exact:true}).click();
    await p.page.waitForFunction(()=>fixture.rows[0].estado==='aceptado'&&!document.querySelector('.sa-panel').hasAttribute('aria-busy'));
    assert.equal(await p.page.evaluate(()=>fixture.calls.some(c=>/pago|mercadopago/.test(c.path))),false);
    assert.match(await p.page.locator('.sa-panel').textContent(),/Aceptarlo no cobra dinero/);
  }finally{await p.close();}
});

test('retiro genera constancia descargable y devolución confirmada por cliente',async()=>{
  const p=await agreements();
  try{
    await p.page.locator('summary').filter({hasText:/^Preparar una constancia de retiro$/}).click();
    const form=p.page.locator('form').filter({has:p.page.locator('[name="equipo"]')});
    await form.locator('[name="equipo"]').fill('Computadora de prueba');await form.locator('[name="serie"]').fill('SERIE-PRUEBA');await form.locator('[name="estado_equipo"]').fill('Pantalla marcada, no enciende');await form.locator('[name="devolucion_prevista"]').fill('2026-11-03');
    await form.getByRole('button',{name:'Enviar propuesta al cliente',exact:true}).click();
    await p.page.waitForFunction(()=>fixture.rows.length===1&&!document.querySelector('.sa-panel').hasAttribute('aria-busy'));
    const download=p.page.waitForEvent('download');await p.page.getByRole('button',{name:'Guardar constancia de retiro'}).click();
    const saved=await download;assert.match(saved.suggestedFilename(),/^tratto-retiro-.*\.txt$/);
    const stream=await saved.createReadStream();let body='';for await(const chunk of stream)body+=chunk.toString();assert.match(body,/SERIE-PRUEBA/);assert.match(body,/no acredita por sí sola un pago/);
    await remount(p,'cliente');await p.page.locator('.sa-check input').check();await p.page.getByRole('button',{name:'Aceptar constancia',exact:true}).click();
    await p.page.waitForFunction(()=>fixture.rows[0].estado==='aceptado'&&!document.querySelector('.sa-panel').hasAttribute('aria-busy'));
    await remount(p,'proveedor');await p.page.getByRole('button',{name:'Informar que retiré el equipo'}).click();
    await p.page.waitForFunction(()=>fixture.rows[0].estado==='retiro_realizado'&&!document.querySelector('.sa-panel').hasAttribute('aria-busy'));
    await p.page.getByRole('button',{name:'Informar que devolví el equipo'}).click();
    await p.page.waitForFunction(()=>fixture.rows[0].estado==='devolucion_informada'&&!document.querySelector('.sa-panel').hasAttribute('aria-busy'));
    assert.equal(await p.page.getByRole('button',{name:'Confirmar que recibí el equipo'}).count(),0);
    await remount(p,'cliente');await p.page.getByRole('button',{name:'Confirmar que recibí el equipo'}).click();
    await p.page.waitForFunction(()=>fixture.rows[0].estado==='devuelto'&&!document.querySelector('.sa-panel').hasAttribute('aria-busy'));
  }finally{await p.close();}
});

test('reclamo muestra estado recibido, comentarios y pruebas como texto seguro',async()=>{
  const p=await agreements({role:'cliente'});
  try{
    await p.page.locator('summary').filter({hasText:/^Problemas y reclamos/}).click();await p.page.locator('summary').filter({hasText:/^Registrar un problema$/}).click();
    const form=p.page.locator('form').filter({has:p.page.locator('[name="motivo"]')});
    await form.locator('[name="motivo"]').fill('Equipo no devuelto');await form.locator('[name="detalle"]').fill('El plazo acordado venció y no recibí el equipo.');
    await form.getByRole('button',{name:'Registrar reclamo',exact:true}).click();
    await p.page.waitForFunction(()=>fixture.complaints.length===1&&!document.querySelector('.sa-panel').hasAttribute('aria-busy'));
    await p.page.locator('summary').filter({hasText:/^Problemas y reclamos/}).click();assert.equal(await p.page.getByText('Reclamo recibido',{exact:true}).isVisible(),true);
    await p.page.locator('summary').filter({hasText:/^Agregar información al reclamo$/}).click();
    const add=p.page.locator('form').filter({has:p.page.locator('[name="texto"]')});await add.locator('[name="texto"]').fill('<img src=x onerror="window.pwned=1"> Fue retirado el lunes.');await add.getByRole('button',{name:'Agregar al reclamo'}).click();
    await p.page.waitForFunction(()=>fixture.events.length===1&&!document.querySelector('.sa-panel').hasAttribute('aria-busy'));
    await p.page.locator('summary').filter({hasText:/^Problemas y reclamos/}).click();
    assert.match(await p.page.locator('.sa-events').textContent(),/<img src=x/);assert.equal(await p.page.evaluate(()=>window.pwned),undefined);assert.equal(await p.page.locator('.sa-events img').count(),0);
  }finally{await p.close();}
});

test('XSS en visitante y fotos ajenas no ejecutan código ni salen a otra web',async()=>{
  const ref=provider+'/17/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.jpg';
  const p=await agreements({role:'cliente',rows:[agreement('visita','propuesta',{nombre_visitante:'<img src=x onerror="window.pwned=1">',foto_ref:ref})]});
  try{
    await p.page.waitForFunction(()=>document.querySelector('.sa-panel').textContent.includes('Foto no disponible'));
    assert.match(await p.page.locator('.sa-panel').textContent(),/<img src=x/);assert.equal(await p.page.locator('.sa-panel img').count(),0);assert.equal(await p.page.evaluate(()=>window.pwned),undefined);
  }finally{await p.close();}
});

test('conflicto de versión y fallo de conexión no se presentan como aceptación',async()=>{
  for(const failure of ['Versión desactualizada','Network fetch failed']){
    const p=await agreements({role:'cliente',rows:[agreement()]});
    try{
      await p.page.evaluate(message=>fixture.failNext=message,failure);await p.page.locator('.sa-check input').check();await p.page.getByRole('button',{name:'Aceptar visita',exact:true}).click();
      await p.page.waitForFunction(()=>document.querySelector('.sa-feedback').classList.contains('sa-feedback-error')&&!document.querySelector('.sa-panel').hasAttribute('aria-busy'));
      assert.equal(await p.page.evaluate(()=>fixture.rows[0].estado),'propuesta');assert.doesNotMatch(await p.page.locator('.sa-feedback').textContent(),/Aceptación guardada/);
    }finally{await p.close();}
  }
});

test('cerrar el chat durante una lectura impide repintar datos del trabajo anterior',async()=>{
  const p=await agreements({rows:[agreement()]});
  try{
    await p.page.evaluate(async()=>{
      fixture.controller.unmount();
      fixture.controller=TrattoAcuerdos.mount(document.getElementById('fixture'),{matchId:17,role:'cliente',userId:fixture.userId,request:()=>new Promise(resolve=>setTimeout(()=>resolve(fixture.rows),100))});
      fixture.controller.unmount();await fixture.controller.ready;
    });
    assert.equal(await p.page.locator('#fixture').textContent(),'');
  }finally{await p.close();}
});
