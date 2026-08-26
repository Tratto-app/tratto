/* ============================================================
   LAPELUQUERIE — suite end-to-end
   ------------------------------------------------------------
   Cubre: carga y consola, SEO y structured data, semántica,
   navegación, menú mobile, acordeón de servicios, diagnóstico,
   galería y lightbox, antes/después, reservas y mensajes
   contextuales, accesibilidad, responsive en 5 viewports,
   reduced-motion y contraste WCAG AA.

   Uso:
     npx http-server -p 8123 -s .        (en otra terminal)
     npm i -D playwright && npx playwright install chromium
     node tests/e2e.mjs

   Variables opcionales:
     BASE_URL  origen a testear (default http://127.0.0.1:8123/)
     PW        ruta al paquete playwright, si no está instalado local
   ============================================================ */

const { chromium } = await import(process.env.PW || 'playwright');

const BASE = process.env.BASE_URL || 'http://127.0.0.1:8123/';
const V={ mobileS:{width:375,height:667}, mobile:{width:390,height:844},
  tablet:{width:768,height:1024}, laptop:{width:1440,height:900}, desktop:{width:1920,height:1080} };
let pass=0, fail=0; const errores=[];
const ok=(n,c,extra='')=>{ c?pass++:(fail++,errores.push(n+(extra?' → '+extra:''))); 
  console.log(`${c?'✓':'✗'} ${n}${c||!extra?'':' → '+extra}`); };

const browser=await chromium.launch();

async function nueva(vp){
  const ctx=await browser.newContext({viewport:vp, deviceScaleFactor:1});
  const page=await ctx.newPage();
  const errs=[]; 
  page.on('console',m=>{ if(m.type()==='error') errs.push(m.text()); });
  page.on('pageerror',e=>errs.push(String(e)));
  const fallos=[];
  page.on('response',r=>{ if(r.status()>=400) fallos.push(r.status()+' '+r.url()); });
  await page.goto(BASE,{waitUntil:'load'}); await page.waitForTimeout(450);
  return {ctx,page,errs,fallos};
}

// ══════════ 1. CARGA + CONSOLA + RECURSOS ══════════
{
  const {ctx,page,errs,fallos}=await nueva(V.laptop);
  ok('Sin errores de consola/JS', errs.length===0, errs.join(' | '));
  ok('Sin recursos 4xx/5xx', fallos.length===0, fallos.join(' | '));
  ok('Título SEO presente', (await page.title()).includes('Lapeluquerie'));
  ok('Meta description', !!await page.getAttribute('meta[name=description]','content'));
  ok('OG image', !!await page.getAttribute('meta[property="og:image"]','content'));
  const ld=await page.$$eval('script[type="application/ld+json"]',s=>s.map(x=>JSON.parse(x.textContent)['@type']));
  ok('JSON-LD BeautySalon + FAQPage', ld.includes('BeautySalon')&&ld.includes('FAQPage'), ld.join(','));
  // headings
  const h1=await page.$$('h1'); ok('Exactamente un h1', h1.length===1, 'hay '+h1.length);
  const orden=await page.$$eval('h1,h2,h3,h4',hs=>hs.map(h=>+h.tagName[1]));
  let saltos=0; for(let i=1;i<orden.length;i++) if(orden[i]-orden[i-1]>1) saltos++;
  ok('Jerarquía de headings sin saltos', saltos===0, saltos+' saltos');
  const sinAlt=await page.$$eval('img',is=>is.filter(i=>i.getAttribute('alt')===null).length);
  ok('Todas las imágenes con alt', sinAlt===0, sinAlt+' sin alt');
  const rotas=await page.$$eval('img',is=>is.filter(i=>i.getAttribute('src')&&i.complete&&i.naturalWidth===0).map(i=>i.currentSrc||i.src));
  ok('Ninguna imagen rota', rotas.length===0, rotas.join(','));
  // render de secciones dinámicas
  for(const [sel,min] of [['.serv',8],['.pilar',3],['.paso',6],['.gitem',6],['.ad__item',2],['.pro',3],['.resena',3],['.faq__item',8],['.horarios li',3],['.ticker__grupo',2],['.filtro',5]])
    ok(`Render ${sel} (≥${min})`, (await page.$$(sel)).length>=min, 'encontrados '+(await page.$$(sel)).length);
  await ctx.close();
}

// ══════════ 2. NAVEGACIÓN ══════════
{
  const {ctx,page}=await nueva(V.laptop);
  const hrefs=await page.$$eval('a[href^="#"]',as=>as.map(a=>a.getAttribute('href')));
  const rotos=[];
  for(const h of new Set(hrefs)) if(h!=='#'&&!(await page.$(h))) rotos.push(h);
  ok('Todos los anchors resuelven', rotos.length===0, rotos.join(','));
  const externos=await page.$$eval('a[target=_blank]',as=>as.filter(a=>!/noopener/.test(a.rel)).length);
  ok('Links externos con rel=noopener', externos===0, externos+' sin rel');
  // nav transparente → sólida
  ok('Nav arranca transparente', !(await page.$eval('.nav',n=>n.classList.contains('fija'))));
  await page.evaluate(()=>window.scrollTo(0,1200)); await page.waitForTimeout(500);
  ok('Nav se vuelve sólida al scrollear', await page.$eval('.nav',n=>n.classList.contains('fija')));
  ok('Sticky CTA aparece tras el hero', await page.$eval('.sticky',n=>n.classList.contains('visible')));
  // anchor real
  await page.evaluate(()=>window.scrollTo(0,0)); await page.waitForTimeout(200);
  await page.click('.nav__link[href="#servicios"]'); await page.waitForTimeout(900);
  const y=await page.evaluate(()=>document.getElementById('servicios').getBoundingClientRect().top);
  ok('Anchor navega a #servicios', Math.abs(y)<180, 'top='+Math.round(y));
  await ctx.close();
}

// ══════════ 3. MENÚ MOBILE ══════════
{
  const {ctx,page}=await nueva(V.mobile);
  ok('Menú oculto al inicio', !(await page.$eval('.panel',p=>p.classList.contains('abierto'))));
  await page.click('.hamburguesa'); await page.waitForTimeout(400);
  ok('Menú abre', await page.$eval('.panel',p=>p.classList.contains('abierto')));
  ok('aria-expanded=true', await page.getAttribute('.hamburguesa','aria-expanded')==='true');
  ok('Scroll bloqueado con menú abierto', await page.$eval('body',b=>b.classList.contains('bloqueado')));
  await page.keyboard.press('Escape'); await page.waitForTimeout(400);
  ok('Escape cierra el menú', !(await page.$eval('.panel',p=>p.classList.contains('abierto'))));
  await page.click('.hamburguesa'); await page.waitForTimeout(300);
  await page.click('.panel__lista a[href="#trabajos"]'); await page.waitForTimeout(700);
  ok('Click en item cierra el menú', !(await page.$eval('.panel',p=>p.classList.contains('abierto'))));
  await ctx.close();
}

// ══════════ 4. SERVICIOS ══════════
{
  const {ctx,page}=await nueva(V.laptop);
  const primero=page.locator('.serv').first();
  ok('Servicio cerrado por defecto', await primero.locator('.serv__cab').getAttribute('aria-expanded')==='false');
  await primero.locator('.serv__cab').click(); await page.waitForTimeout(700);
  ok('Servicio abre', await primero.locator('.serv__cab').getAttribute('aria-expanded')==='true');
  ok('Panel visible', (await primero.locator('.serv__panel').boundingBox()).height>60);
  ok('CTA de servicio presente', await primero.locator('[data-reservar=servicio]').isVisible());
  await page.locator('.serv').nth(1).locator('.serv__cab').click(); await page.waitForTimeout(700);
  ok('Sólo un servicio abierto a la vez', (await page.$$('.serv.abierto')).length===1);
  await ctx.close();
}

// ══════════ 5. DIAGNÓSTICO ══════════
{
  const {ctx,page}=await nueva(V.laptop);
  await page.locator('#diagnostico').scrollIntoViewIfNeeded(); await page.waitForTimeout(400);
  ok('Diagnóstico arranca en 01/04', (await page.textContent('.diag__paso')).includes('01'));
  for(let i=0;i<4;i++){
    await page.locator('.diag__op').first().click();
    await page.waitForTimeout(320);
  }
  ok('Muestra resultado tras 4 respuestas', await page.locator('.diag__result').isVisible());
  const recos=await page.$$('.reco'); ok('Recomienda 1-2 servicios', recos.length>=1&&recos.length<=2, recos.length+'');
  ok('Barra de progreso al 100%', (await page.$eval('.diag__avance',e=>e.style.transform)).includes('scaleX(1)'));
  ok('CTA de diagnóstico visible', await page.locator('#diag-cta').isVisible());
  await page.click('#diag-reiniciar'); await page.waitForTimeout(500);
  ok('Reinicia el diagnóstico', (await page.textContent('.diag__paso')).includes('01'));
  await ctx.close();
}

// ══════════ 6. GALERÍA + LIGHTBOX ══════════
{
  const {ctx,page}=await nueva(V.laptop);
  await page.locator('#trabajos').scrollIntoViewIfNeeded(); await page.waitForTimeout(400);
  const total=(await page.$$('.gitem')).length;
  await page.click('.filtro[data-cat=color]'); await page.waitForTimeout(400);
  const filtrados=(await page.$$('.gitem')).length;
  ok('El filtro reduce resultados', filtrados<total && filtrados>1, `${total}→${filtrados}`);
  ok('Filtro activo con aria-pressed', await page.getAttribute('.filtro[data-cat=color]','aria-pressed')==='true');
  ok('Estado anunciado a lectores', (await page.textContent('#galeria-estado')).length>0);
  await page.click('.filtro[data-cat=todos]'); await page.waitForTimeout(400);
  ok('Vuelve a mostrar todo', (await page.$$('.gitem')).length===total);

  await page.locator('.gitem .gitem__btn').first().click(); await page.waitForTimeout(400);
  ok('Lightbox abre', await page.$eval('.lb',l=>l.classList.contains('abierto')));
  ok('aria-hidden=false', await page.getAttribute('.lb','aria-hidden')==='false');
  ok('Imagen del lightbox carga', await page.$eval('.lb__foto img',i=>i.complete&&i.naturalWidth>0));
  ok('CTA "Quiero este look"', await page.locator('.lb [data-reservar=galeria]').isVisible());
  const t1=await page.textContent('#lb-titulo');
  await page.click('.lb__nav--next'); await page.waitForTimeout(300);
  ok('Flecha siguiente cambia de trabajo', (await page.textContent('#lb-titulo'))!==t1);
  await page.keyboard.press('ArrowLeft'); await page.waitForTimeout(300);
  ok('Teclado ← vuelve al anterior', (await page.textContent('#lb-titulo'))===t1);
  await page.keyboard.press('Escape'); await page.waitForTimeout(400);
  ok('Escape cierra el lightbox', !(await page.$eval('.lb',l=>l.classList.contains('abierto'))));
  ok('Scroll desbloqueado al cerrar', !(await page.$eval('body',b=>b.classList.contains('bloqueado'))));
  await ctx.close();
}

// ══════════ 7. ANTES / DESPUÉS ══════════
{
  const {ctx,page}=await nueva(V.laptop);
  await page.locator('#transformaciones').scrollIntoViewIfNeeded(); await page.waitForTimeout(500);
  const marco=page.locator('.ad__marco').first();
  const b=await marco.boundingBox();
  await page.mouse.move(b.x+b.width*0.5,b.y+b.height*0.5);
  await page.mouse.down();
  await page.mouse.move(b.x+b.width*0.2,b.y+b.height*0.5,{steps:8});
  await page.mouse.up(); await page.waitForTimeout(250);
  const pos=await marco.evaluate(e=>e.style.getPropertyValue('--pos'));
  ok('Slider responde al arrastre', parseFloat(pos)<35, 'pos='+pos);
  // teclado
  await marco.locator('.ad__rango').focus();
  await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(200);
  ok('Slider accesible por teclado', parseFloat(await marco.evaluate(e=>e.style.getPropertyValue('--pos')))>parseFloat(pos));
  ok('CTA de transformación', await page.locator('[data-reservar=transformacion]').first().isVisible());
  await ctx.close();
}

// ══════════ 8. RESERVAS / WHATSAPP ══════════
{
  const {ctx,page}=await nueva(V.laptop);
  const urls=[];
  await page.exposeFunction('_capturar',u=>urls.push(u));
  await page.evaluate(()=>{ window.open=(u)=>{ window._capturar(u); return null; }; });
  const cantidad=(await page.$$('[data-reservar]')).length;
  ok('Hay múltiples caminos a reservar (≥12)', cantidad>=12, cantidad+' CTA');
  await page.click('.hero__acciones [data-reservar=general]'); await page.waitForTimeout(200);
  ok('CTA hero dispara reserva', urls.length===1, JSON.stringify(urls));
  await page.locator('#servicios').scrollIntoViewIfNeeded();
  await page.locator('.serv').first().locator('.serv__cab').click(); await page.waitForTimeout(600);
  await page.locator('.serv').first().locator('[data-reservar=servicio]').click(); await page.waitForTimeout(200);
  ok('Mensaje contextual por servicio', /balayage/i.test(decodeURIComponent(urls[1]||'')) || /ig\.me/.test(urls[1]||''), urls[1]);
  await ctx.close();
}

// ══════════ 9. ACCESIBILIDAD ══════════
{
  const {ctx,page}=await nueva(V.laptop);
  await page.keyboard.press('Tab');
  ok('Primer tab = saltar al contenido', await page.evaluate(()=>document.activeElement.classList.contains('saltar')));
  const sinNombre=await page.$$eval('button',bs=>bs.filter(b=>
    !(b.textContent.trim()||b.getAttribute('aria-label')||b.getAttribute('title'))).length);
  ok('Todos los botones con nombre accesible', sinNombre===0, sinNombre+' sin nombre');
  const chicos=await page.$$eval('button,a[href]',els=>els.filter(e=>{
    const r=e.getBoundingClientRect();
    return r.width>0 && r.height>0 && r.height<24 && !e.classList.contains('saltar');
  }).map(e=>(e.textContent||'').trim().slice(0,24)));
  ok('Sin targets de menos de 24px de alto', chicos.length===0, chicos.join(' | '));
  const focoInvisible=await page.evaluate(()=>{
    const b=document.querySelector('.nav__cta'); b.focus();
    const s=getComputedStyle(b,':focus-visible');
    return s.outlineStyle==='none';
  });
  ok('Focus visible en CTA', !focoInvisible);
  const langOk=await page.getAttribute('html','lang'); ok('lang=es-AR', langOk==='es-AR');
  ok('Landmarks main/header/footer/nav', await page.evaluate(()=>
    !!document.querySelector('main')&&!!document.querySelector('header')&&
    !!document.querySelector('footer')&&!!document.querySelector('nav')));
  ok('Diálogo con role/aria-modal', await page.evaluate(()=>{
    const l=document.querySelector('.lb');
    return l.getAttribute('role')==='dialog'&&l.getAttribute('aria-modal')==='true';}));
  await ctx.close();
}

// ══════════ 10. RESPONSIVE — sin overflow ══════════
for(const [nombre,vp] of Object.entries(V)){
  const {ctx,page,errs}=await nueva(vp);
  const ancho=await page.evaluate(()=>({doc:document.documentElement.scrollWidth,win:innerWidth}));
  ok(`[${nombre}] sin scroll horizontal`, ancho.doc<=ancho.win+1, `${ancho.doc}>${ancho.win}`);
  const desborda=await page.$$eval('*',els=>els.filter(e=>{
    const r=e.getBoundingClientRect();
    return r.width>0 && (r.right>innerWidth+2||r.left<-2) &&
      getComputedStyle(e).position!=='fixed' && !e.closest('.ticker');
  }).slice(0,4).map(e=>e.className||e.tagName));
  ok(`[${nombre}] sin elementos fuera del viewport`, desborda.length===0, desborda.join(' | '));
  const stickyVis=await page.$eval('.sticky',s=>getComputedStyle(s).display!=='none');
  ok(`[${nombre}] sticky CTA ${vp.width<1060?'presente':'oculto'}`, stickyVis===(vp.width<1060));
  await page.evaluate(()=>window.scrollTo(0,document.body.scrollHeight));
  await page.waitForTimeout(600);
  ok(`[${nombre}] sin errores tras recorrer la página`, errs.length===0, errs.join('|'));
  await ctx.close();
}

// ══════════ 11. REDUCED MOTION ══════════
{
  const ctx=await browser.newContext({viewport:V.laptop, reducedMotion:'reduce'});
  const page=await ctx.newPage(); const errs=[];
  page.on('pageerror',e=>errs.push(String(e)));
  await page.goto(BASE,{waitUntil:'load'}); await page.waitForTimeout(450);
  ok('Reveals visibles con reduced-motion', await page.$eval('.pilar',e=>getComputedStyle(e).opacity==='1'));
  ok('Ticker sin animación', await page.$eval('.ticker__pista',e=>getComputedStyle(e).animationName==='none'));
  const t=await page.$eval('.hero__foto img',e=>e.style.transform);
  await page.evaluate(()=>window.scrollTo(0,600)); await page.waitForTimeout(400);
  ok('Sin parallax con reduced-motion', (await page.$eval('.hero__foto img',e=>e.style.transform))===t);
  ok('Sin errores con reduced-motion', errs.length===0, errs.join('|'));
  await ctx.close();
}


// ══════════ 12. CONTRASTE (WCAG 2.2 AA) ══════════
{
  const {ctx,page}=await nueva(V.laptop);
  await page.evaluate(()=>document.querySelectorAll('.rv').forEach(e=>e.classList.add('visible')));
  await page.waitForTimeout(300);
  const malos=await page.evaluate(()=>{
    const lum=c=>{const [r,g,b]=c.map(v=>{v/=255;return v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4)});
      return .2126*r+.7152*g+.0722*b;};
    const parse=s=>{const m=s.match(/[\d.]+/g); return m?m.slice(0,3).map(Number):null;};
    const alpha=s=>{const m=s.match(/[\d.]+/g); return m&&m.length>3?Number(m[3]):1;};
    const mezcla=(f,b,a)=>f.map((v,i)=>v*a+b[i]*(1-a));
    const fondo=el=>{ let n=el;
      while(n&&n!==document.documentElement){
        const cs=getComputedStyle(n);
        if(cs.backgroundImage!=='none') return null;      // gradiente/foto: no medible
        const c=parse(cs.backgroundColor), a=alpha(cs.backgroundColor);
        if(c&&a>=1) return c;
        if(c&&a>0){ const p=fondo(n.parentElement); return p?mezcla(c,p,a):null; }
        n=n.parentElement;
      }
      return [255,255,255];
    };
    const fuera=['.hero','.gitem','.lb','.ticker','.saltar','.nav','.panel'];
    const res=[];
    document.querySelectorAll('p,span,a,li,h1,h2,h3,h4,button,summary,blockquote,cite,strong').forEach(el=>{
      if(fuera.some(s=>el.closest(s))) return;
      const txt=[...el.childNodes].filter(n=>n.nodeType===3&&n.textContent.trim()).map(n=>n.textContent.trim()).join('');
      if(!txt) return;
      const r=el.getBoundingClientRect(); if(!r.width||!r.height) return;
      const cs=getComputedStyle(el);
      if(cs.visibility==='hidden'||cs.opacity==='0') return;
      const fg=parse(cs.color), a=alpha(cs.color);
      const bg=fondo(el); if(!bg||!fg) return;
      const f=a<1?mezcla(fg,bg,a):fg;
      const l1=lum(f), l2=lum(bg);
      const ratio=(Math.max(l1,l2)+.05)/(Math.min(l1,l2)+.05);
      const px=parseFloat(cs.fontSize), grande=px>=24||(px>=18.66&&parseInt(cs.fontWeight)>=700);
      const min=grande?3:4.5;
      if(ratio<min) res.push(`${el.className||el.tagName} "${txt.slice(0,26)}" ${ratio.toFixed(2)}:1 (min ${min})`);
    });
    return [...new Set(res)];
  });
  ok('Contraste AA en todo el texto medible', malos.length===0, malos.slice(0,6).join(' | '));

  // La nav transparente va sobre foto: se mide en su estado sólido y en el panel mobile.
  await page.evaluate(()=>window.scrollTo(0,1400)); await page.waitForTimeout(500);
  const navRatio=await page.evaluate(()=>{
    const lum=c=>{const [r,g,b]=c.map(v=>{v/=255;return v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4)});
      return .2126*r+.7152*g+.0722*b;};
    const p=s=>s.match(/[\d.]+/g).slice(0,3).map(Number);
    const a=s=>{const m=s.match(/[\d.]+/g);return m.length>3?Number(m[3]):1;};
    const nav=document.querySelector('.nav'), link=document.querySelector('.nav__link');
    const bgN=p(getComputedStyle(nav).backgroundColor), aN=a(getComputedStyle(nav).backgroundColor);
    const base=[14,13,12];
    const bg=bgN.map((v,i)=>v*aN+base[i]*(1-aN));
    const fg=p(getComputedStyle(link).color), aF=a(getComputedStyle(link).color);
    const f=fg.map((v,i)=>v*aF+bg[i]*(1-aF));
    const l1=lum(f), l2=lum(bg);
    return (Math.max(l1,l2)+.05)/(Math.min(l1,l2)+.05);
  });
  ok('Contraste AA en la nav sólida', navRatio>=4.5, navRatio.toFixed(2)+':1');
  await ctx.close();
}

await browser.close();
console.log(`\n──────────────\n${pass} OK · ${fail} fallos`);
if(fail) { console.log('\nFallos:'); errores.forEach(e=>console.log(' ✗ '+e)); }
process.exit(fail?1:0);
