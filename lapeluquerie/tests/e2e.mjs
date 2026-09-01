/* ============================================================
   LAPELUQUERIE — suite end-to-end
   Uso:  npx http-server -p 8123 -s .
         node tests/e2e.mjs
   Variables: BASE_URL, PW (ruta a playwright si no está local)
   ============================================================ */
const { chromium } = await import(process.env.PW || 'playwright');
const BASE = process.env.BASE_URL || 'http://127.0.0.1:8123/';
const V = { mobileS:{width:375,height:667}, mobile:{width:390,height:844},
  tablet:{width:768,height:1024}, laptop:{width:1440,height:900}, desktop:{width:1920,height:1080} };
let pass=0, fail=0; const errores=[];
const ok=(n,c,extra='')=>{ c?pass++:(fail++,errores.push(n+(extra?' → '+extra:'')));
  console.log(`${c?'✓':'✗'} ${n}${c||!extra?'':' → '+extra}`); };

const browser = await chromium.launch();
async function nueva(vp){
  const ctx = await browser.newContext({viewport:vp});
  const page = await ctx.newPage();
  const errs=[], fallos=[];
  page.on('console',m=>{ if(m.type()==='error') errs.push(m.text()); });
  page.on('pageerror',e=>errs.push(String(e)));
  page.on('response',r=>{ if(r.status()>=400) fallos.push(r.status()+' '+r.url()); });
  await page.goto(BASE,{waitUntil:'load'}); await page.waitForTimeout(450);
  return {ctx,page,errs,fallos};
}

// ── 1. Carga, SEO, semántica ──
{
  const {ctx,page,errs,fallos}=await nueva(V.laptop);
  ok('Sin errores de consola/JS', errs.length===0, errs.join(' | '));
  ok('Sin recursos 4xx/5xx', fallos.length===0, fallos.join(' | '));
  ok('Título con "Pilar"', (await page.title()).includes('Pilar'));
  ok('Meta description', !!await page.getAttribute('meta[name=description]','content'));
  const ld=await page.$$eval('script[type="application/ld+json"]',s=>s.map(x=>JSON.parse(x.textContent)['@type']));
  ok('JSON-LD HairSalon + FAQPage', ld.includes('HairSalon')&&ld.includes('FAQPage'), ld.join(','));
  ok('Un solo h1', (await page.$$('h1')).length===1);
  const orden=await page.$$eval('h1,h2,h3,h4',hs=>hs.map(h=>+h.tagName[1]));
  let saltos=0; for(let i=1;i<orden.length;i++) if(orden[i]-orden[i-1]>1) saltos++;
  ok('Jerarquía de headings sin saltos', saltos===0, saltos+' saltos');
  ok('Todas las imágenes con alt',
    (await page.$$eval('img',is=>is.filter(i=>i.getAttribute('alt')===null).length))===0);
  const rotas=await page.$$eval('img',is=>is.filter(i=>i.getAttribute('src')&&i.complete&&i.naturalWidth===0).map(i=>i.src));
  ok('Ninguna imagen rota', rotas.length===0, rotas.join(','));
  for(const [sel,min] of [['.serv',8],['.gitem',6],['.ad__item',2],['.paso',6],
      ['.motivo',3],['.consejo',6],['.resena',3],['.faq__item',8],['.horarios li',6],['.filtro',4]])
    ok(`Render ${sel} (≥${min})`, (await page.$$(sel)).length>=min,
       'hay '+(await page.$$(sel)).length);
  await ctx.close();
}

// ── 2. Sin reservas online ──
{
  const {ctx,page}=await nueva(V.laptop);
  const txt=(await page.textContent('body')).toLowerCase();
  for(const t of ['reservar turno','reservá tu turno','agendar','booking','elegí un horario','calendario'])
    ok(`Sin "${t}" en la página`, !txt.includes(t));
  ok('Sin inputs de fecha/hora', (await page.$$('input[type=date],input[type=time],form')).length===0);
  ok('Todos los CTA son de WhatsApp', (await page.$$('[data-wa]')).length>=8,
     (await page.$$('[data-wa]')).length+' CTA');
  await ctx.close();
}

// ── 3. Navegación ──
{
  const {ctx,page}=await nueva(V.laptop);
  const hrefs=await page.$$eval('a[href^="#"]',as=>as.map(a=>a.getAttribute('href')));
  const rotos=[]; for(const h of new Set(hrefs)) if(h!=='#'&&!(await page.$(h))) rotos.push(h);
  ok('Todos los anchors resuelven', rotos.length===0, rotos.join(','));
  ok('Links externos con rel=noopener',
    (await page.$$eval('a[target=_blank]',as=>as.filter(a=>!/noopener/.test(a.rel)).length))===0);
  await page.click('.nav__link[href="#trabajos"]'); await page.waitForTimeout(900);
  const y=await page.evaluate(()=>document.getElementById('trabajos').getBoundingClientRect().top);
  ok('Anchor navega a #trabajos', Math.abs(y)<180, 'top='+Math.round(y));
  await page.evaluate(()=>window.scrollTo(0,900)); await page.waitForTimeout(400);
  ok('Nav marca borde al scrollear', await page.$eval('.nav',n=>n.classList.contains('fija')));
  await ctx.close();
}

// ── 4. Menú mobile ──
{
  const {ctx,page}=await nueva(V.mobile);
  await page.click('.hamburguesa'); await page.waitForTimeout(400);
  ok('Menú abre', await page.$eval('.panel',p=>p.classList.contains('abierto')));
  ok('aria-expanded=true', await page.getAttribute('.hamburguesa','aria-expanded')==='true');
  ok('Scroll bloqueado', await page.$eval('body',b=>b.classList.contains('bloqueado')));
  await page.keyboard.press('Escape'); await page.waitForTimeout(400);
  ok('Escape cierra', !(await page.$eval('.panel',p=>p.classList.contains('abierto'))));
  await page.click('.hamburguesa'); await page.waitForTimeout(300);
  await page.click('.panel__lista a[href="#consejos"]'); await page.waitForTimeout(600);
  ok('Click en item cierra el menú', !(await page.$eval('.panel',p=>p.classList.contains('abierto'))));
  await ctx.close();
}

// ── 5. Galería + lightbox ──
{
  const {ctx,page}=await nueva(V.laptop);
  await page.locator('#trabajos').scrollIntoViewIfNeeded(); await page.waitForTimeout(400);
  const total=(await page.$$('.gitem')).length;
  await page.click('.filtro[data-cat=color]'); await page.waitForTimeout(400);
  const f=(await page.$$('.gitem')).length;
  ok('El filtro reduce resultados', f<total&&f>1, `${total}→${f}`);
  ok('Filtro activo con aria-pressed', await page.getAttribute('.filtro[data-cat=color]','aria-pressed')==='true');
  ok('Estado anunciado', (await page.textContent('#galeria-estado')).length>0);
  await page.click('.filtro[data-cat=todos]'); await page.waitForTimeout(400);
  ok('Vuelve a mostrar todo', (await page.$$('.gitem')).length===total);
  await page.locator('.gitem .gitem__btn').first().click(); await page.waitForTimeout(400);
  ok('Lightbox abre', await page.$eval('.lb',l=>l.classList.contains('abierto')));
  ok('Imagen del lightbox carga', await page.$eval('.lb__foto img',i=>i.complete&&i.naturalWidth>0));
  ok('CTA de WhatsApp en el lightbox', await page.locator('.lb [data-wa=galeria]').isVisible());
  const t1=await page.textContent('#lb-titulo');
  await page.click('.lb__nav--next'); await page.waitForTimeout(300);
  ok('Flecha siguiente cambia de trabajo', (await page.textContent('#lb-titulo'))!==t1);
  await page.keyboard.press('ArrowLeft'); await page.waitForTimeout(300);
  ok('Teclado ← vuelve', (await page.textContent('#lb-titulo'))===t1);
  await page.keyboard.press('Escape'); await page.waitForTimeout(400);
  ok('Escape cierra el lightbox', !(await page.$eval('.lb',l=>l.classList.contains('abierto'))));
  ok('Scroll desbloqueado', !(await page.$eval('body',b=>b.classList.contains('bloqueado'))));
  await ctx.close();
}

// ── 6. Antes / después ──
{
  const {ctx,page}=await nueva(V.laptop);
  await page.locator('#cambios').scrollIntoViewIfNeeded(); await page.waitForTimeout(500);
  const marco=page.locator('.ad__marco').first();
  const b=await marco.boundingBox();
  await page.mouse.move(b.x+b.width*0.5,b.y+b.height*0.5);
  await page.mouse.down();
  await page.mouse.move(b.x+b.width*0.2,b.y+b.height*0.5,{steps:8});
  await page.mouse.up(); await page.waitForTimeout(250);
  const pos=await marco.evaluate(e=>e.style.getPropertyValue('--pos'));
  ok('Slider responde al arrastre', parseFloat(pos)<35, 'pos='+pos);
  await marco.locator('.ad__rango').focus();
  await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(200);
  ok('Slider accesible por teclado',
     parseFloat(await marco.evaluate(e=>e.style.getPropertyValue('--pos')))>parseFloat(pos));
  await ctx.close();
}

// ── 7. WhatsApp ──
{
  const {ctx,page}=await nueva(V.laptop);
  const urls=[];
  await page.exposeFunction('_cap',u=>urls.push(u));
  await page.evaluate(()=>{ window.open=u=>{ window._cap(u); return null; }; });
  await page.locator('.intro__acciones [data-wa=general]').click(); await page.waitForTimeout(200);
  ok('CTA principal abre wa.me', /wa\.me\/5492304356392/.test(urls[0]||''), urls[0]);
  ok('Mensaje prearmado', /text=/.test(urls[0]||''));
  await page.locator('#servicios').scrollIntoViewIfNeeded();
  await page.locator('[data-wa=servicio]').first().click(); await page.waitForTimeout(200);
  ok('Mensaje contextual por servicio',
     /color/i.test(decodeURIComponent(urls[1]||'')), decodeURIComponent(urls[1]||'').slice(0,70));
  ok('Links de Instagram correctos',
    (await page.$$eval('[data-href=instagram]',as=>as.every(a=>a.href.includes('instagram.com/lapeluquerie')))));
  ok('Links de Maps correctos',
    (await page.$$eval('[data-href=maps]',as=>as.every(a=>a.href.includes('maps.app.goo.gl')))));
  ok('Teléfono como tel:',
    (await page.$$eval('[data-href=tel]',as=>as.every(a=>a.href.startsWith('tel:+549')))));
  await ctx.close();
}

// ── 8. Datos del negocio ──
{
  const {ctx,page}=await nueva(V.laptop);
  const txt=await page.textContent('body');
  for(const d of ['Luis Bataglia 572','Pilar','@lapeluquerie','+54 9 2304 35-6392'])
    ok(`Muestra "${d}"`, txt.includes(d));
  ok('Sin placeholders sin completar', !/\[(NOMBRE|CALLE|LOCALIDAD|CIUDAD|BARRIO|CP)/.test(txt));
  ok('Indicador de horario poblado', (await page.textContent('.estado')).trim().length>5);
  await ctx.close();
}

// ── 9. Accesibilidad ──
{
  const {ctx,page}=await nueva(V.laptop);
  await page.keyboard.press('Tab');
  ok('Primer tab = saltar al contenido',
     await page.evaluate(()=>document.activeElement.classList.contains('saltar')));
  ok('Botones con nombre accesible',
    (await page.$$eval('button',bs=>bs.filter(b=>
      !(b.textContent.trim()||b.getAttribute('aria-label'))).length))===0);
  const chicos=await page.$$eval('button,a[href]',els=>els.filter(e=>{
    const r=e.getBoundingClientRect();
    return r.width>0&&r.height>0&&r.height<24&&!e.classList.contains('saltar');
  }).map(e=>(e.textContent||'').trim().slice(0,22)));
  ok('Sin targets de menos de 24px', chicos.length===0, chicos.join(' | '));
  ok('lang=es-AR', await page.getAttribute('html','lang')==='es-AR');
  ok('Landmarks', await page.evaluate(()=>
    !!document.querySelector('main')&&!!document.querySelector('header')&&
    !!document.querySelector('footer')&&!!document.querySelector('nav')));
  ok('Diálogo con role/aria-modal', await page.evaluate(()=>{
    const l=document.querySelector('.lb');
    return l.getAttribute('role')==='dialog'&&l.getAttribute('aria-modal')==='true';}));
  await ctx.close();
}

// ── 10. Responsive ──
for(const [nombre,vp] of Object.entries(V)){
  const {ctx,page,errs}=await nueva(vp);
  const a=await page.evaluate(()=>({doc:document.documentElement.scrollWidth,win:innerWidth}));
  ok(`[${nombre}] sin scroll horizontal`, a.doc<=a.win+1, `${a.doc}>${a.win}`);
  const desborda=await page.$$eval('*',els=>els.filter(e=>{
    const r=e.getBoundingClientRect();
    return r.width>0&&(r.right>innerWidth+2||r.left<-2)&&getComputedStyle(e).position!=='fixed';
  }).slice(0,4).map(e=>e.className||e.tagName));
  ok(`[${nombre}] nada fuera del viewport`, desborda.length===0, desborda.join(' | '));
  ok(`[${nombre}] WhatsApp sticky ${vp.width<940?'presente':'oculto'}`,
    (await page.$eval('.sticky',s=>getComputedStyle(s).display!=='none'))===(vp.width<940));
  await page.evaluate(()=>window.scrollTo(0,document.body.scrollHeight));
  await page.waitForTimeout(600);
  ok(`[${nombre}] sin errores al recorrer`, errs.length===0, errs.join('|'));
  await ctx.close();
}

// ── 11. Reduced motion ──
{
  const ctx=await browser.newContext({viewport:V.laptop, reducedMotion:'reduce'});
  const page=await ctx.newPage(); const errs=[];
  page.on('pageerror',e=>errs.push(String(e)));
  await page.goto(BASE,{waitUntil:'load'}); await page.waitForTimeout(600);
  ok('Contenido visible con reduced-motion',
     await page.$eval('.motivo',e=>getComputedStyle(e).opacity==='1'));
  // La animación de entrada deja una matriz identidad: lo que importa es
  // que no haya componente de rotación (b y c del matrix en cero).
  ok('Sin rotaciones decorativas', await page.$eval('.gitem', e => {
    const t = getComputedStyle(e).transform;
    if (t === 'none') return true;
    const [, b, c] = t.match(/[-\d.e]+/g).map(Number);  // matrix(a,b,c,d,e,f)
    return Math.abs(b) < 1e-6 && Math.abs(c) < 1e-6;
  }));
  ok('Sin errores con reduced-motion', errs.length===0, errs.join('|'));
  await ctx.close();
}

// ── 12. Contraste WCAG AA ──
{
  const {ctx,page}=await nueva(V.laptop);
  await page.evaluate(()=>document.querySelectorAll('.rv').forEach(e=>e.classList.add('visible')));
  await page.waitForTimeout(300);
  const malos=await page.evaluate(()=>{
    const lum=c=>{const [r,g,b]=c.map(v=>{v/=255;return v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4)});
      return .2126*r+.7152*g+.0722*b;};
    const p=s=>{const m=s.match(/[\d.]+/g); return m?m.slice(0,3).map(Number):null;};
    const al=s=>{const m=s.match(/[\d.]+/g); return m&&m.length>3?Number(m[3]):1;};
    const mez=(f,b,a)=>f.map((v,i)=>v*a+b[i]*(1-a));
    const fondo=el=>{ let n=el;
      while(n&&n!==document.documentElement){
        const cs=getComputedStyle(n);
        if(cs.backgroundImage!=='none') return null;
        const c=p(cs.backgroundColor), a=al(cs.backgroundColor);
        if(c&&a>=1) return c;
        if(c&&a>0){ const q=fondo(n.parentElement); return q?mez(c,q,a):null; }
        n=n.parentElement;
      }
      return [255,255,255];
    };
    const fuera=['.gitem','.lb','.saltar','.nav','.panel'];
    const res=[];
    document.querySelectorAll('p,span,a,li,h1,h2,h3,h4,button,summary,blockquote,b').forEach(el=>{
      if(fuera.some(s=>el.closest(s))) return;
      const txt=[...el.childNodes].filter(n=>n.nodeType===3&&n.textContent.trim())
        .map(n=>n.textContent.trim()).join('');
      if(!txt) return;
      const r=el.getBoundingClientRect(); if(!r.width||!r.height) return;
      const cs=getComputedStyle(el);
      if(cs.visibility==='hidden'||cs.opacity==='0') return;
      const fg=p(cs.color), a=al(cs.color), bg=fondo(el);
      if(!bg||!fg) return;
      const f=a<1?mez(fg,bg,a):fg;
      const l1=lum(f), l2=lum(bg);
      const ratio=(Math.max(l1,l2)+.05)/(Math.min(l1,l2)+.05);
      const px=parseFloat(cs.fontSize);
      const min=(px>=24||(px>=18.66&&parseInt(cs.fontWeight)>=700))?3:4.5;
      if(ratio<min) res.push(`${el.className||el.tagName} "${txt.slice(0,24)}" ${ratio.toFixed(2)}:1`);
    });
    return [...new Set(res)];
  });
  ok('Contraste AA en todo el texto medible', malos.length===0, malos.slice(0,6).join(' | '));
  await ctx.close();
}

await browser.close();
console.log(`\n──────────────\n${pass} OK · ${fail} fallos`);
if(fail){ console.log('\nFallos:'); errores.forEach(e=>console.log(' ✗ '+e)); }
process.exit(fail?1:0);
