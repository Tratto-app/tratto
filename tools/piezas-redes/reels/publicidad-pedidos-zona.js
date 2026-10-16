// Reel "¿Y si los pedidos de tu zona te llegaran al celular?" (23 s, sin voz,
// quienes ofrecen servicios). Todo lo que dice es lo que hace la app hoy: aviso
// al celular cuando alguien de la zona pide en su rubro, presupuesto y chat
// dentro de la app sin dar el número, cobro por Mercado Pago, registro gratis,
// sin abono y 3 % solo cuando se cobra por la app. Sin cifras de pedidos (no
// hay volumen para prometer). La pantalla es la captura de las tiendas
// (app-2) recortada abajo del encabezado.
// La URL en pantalla la pone cada versión en window.RED.url.
const $ = (r, s) => r.querySelector(s), $$ = (r, s) => [...r.querySelectorAll(s)];
const URL_RED = (window.RED && window.RED.url) || 'trattoapp.com.ar';
document.head.insertAdjacentHTML('beforeend', '<style>#link-fijo{font-size:35px}</style>');
const tel = (img, extra = '') => `<div class="escenario"><div class="tel" ${extra}><div class="isla"></div><div class="pantalla">${img}</div></div></div>`;
const pop = (el, t, t0, d = .35) => { const q = U.P(t, t0, t0 + d); el.style.opacity = q > 0 ? 1 : 0; el.style.transform = `scale(${.6 + .4 * U.back(q)})`; return q; };
const paso = (ico, n, txt) => `<div class="fila"><span class="ico">${icono(ico, 76)}</span><div><div class="mono oro" style="font-size:34px">Paso ${n}</div><div class="t-m" style="font-size:66px;margin-top:8px">${txt}</div></div></div>`;

window.PUBLI = { cierre: 20.4, url: [URL_RED, 1.0], escenas: [
// 0–2,2 s · gancho
{ a: 0, b: 2.25, html: () => `
  <div class="abs centro" style="top:400px" id="g0"><span class="chip" style="font-size:40px"><span style="color:#2B7E62;display:flex">${icono('campana', 50)}</span>Pedido nuevo cerca tuyo</span></div>
  <div class="abs centro t-l" style="top:640px;font-size:104px" id="h1a">¿Y si los pedidos</div>
  <div class="abs centro t-l" style="top:748px;font-size:104px" id="h1b">de tu zona</div>
  <div class="abs centro t-l acento" style="top:856px;font-size:104px" id="h1c">te llegaran al celular?</div>`,
  animar(t, r) {
    const g = $(r, '#g0'), q = U.P(t, 0, .35);
    g.style.opacity = 1; g.style.transform = `translateY(${(1 - U.back(q)) * -80 + Math.sin(t * 2) * 4}px)`;
    entra($(r, '#h1a'), t, .1, .45); entra($(r, '#h1b'), t, .35, .45); entra($(r, '#h1c'), t, .6, .5);
    ['#g0', '#h1a', '#h1b', '#h1c'].forEach(id => sale($(r, id), t, 1.9));
  } },
// 2,2–5 s · para quién
{ a: 2.15, b: 5.05, html: () => `
  <div class="abs centro t-l" style="top:640px" id="h2a">Si sos</div>
  <div class="pila centro" style="position:absolute;top:770px;left:60px;right:60px;height:130px" id="h2p">
    <div class="t-l oro" style="font-size:96px">profe de inglés,</div>
    <div class="t-l oro" style="font-size:96px">manicura,</div>
    <div class="t-l oro" style="font-size:96px">paseador de perros,</div>
    <div class="t-l oro" style="font-size:96px">DJ o fletero.</div>
  </div>
  <div class="abs centro mono" style="top:960px;font-size:34px;color:#3A4A43" id="h2m">Y más de 40 rubros</div>`,
  animar(t, r) {
    entra($(r, '#h2a'), t, 2.2);
    cambia($$(r, '#h2p > div'), t, [2.35, 3.0, 3.65, 4.3, 5.0]);
    entra($(r, '#h2m'), t, 2.6, .5, { y: 16 });
    sale($(r, '#h2a'), t, 4.75); sale($(r, '#h2m'), t, 4.75);
  } },
// 5–7,2 s · tensión
{ a: 4.95, b: 7.25, html: () => `
  <div class="abs centro t-l" style="top:680px;font-size:108px" id="h3a">Sin esperar</div>
  <div class="abs centro t-l oro" style="top:790px;font-size:108px" id="h3b">que suene el teléfono.</div>`,
  animar(t, r) {
    entra($(r, '#h3a'), t, 5.05); entra($(r, '#h3b'), t, 5.3);
    sale($(r, '#h3a'), t, 6.9); sale($(r, '#h3b'), t, 6.92);
  } },
// 7,2–15,5 s · cómo funciona
{ a: 7.15, b: 15.55, html: () => `
  <div class="abs t-m" style="top:330px;left:110px" id="h4">Así funciona Tratto</div>
  <div class="abs mono oro" style="top:425px;left:112px;font-size:34px" id="h4m">Para quien ofrece un servicio</div>
  <div class="pila" style="position:absolute;top:640px;left:110px;right:120px;height:300px" id="h4p">
    ${paso('campana', 1, 'Alguien de tu zona<br>pide y te avisa<br>al celular.')}
    ${paso('presupuesto', 2, 'Mandás tu<br>presupuesto<br>por la app.')}
    ${paso('chat', 3, 'Chateás sin dar<br>tu número.')}
    ${paso('plata', 4, 'Cobrás por<br>Mercado Pago.')}
  </div>`,
  animar(t, r) {
    entra($(r, '#h4'), t, 7.25); entra($(r, '#h4m'), t, 7.4);
    cambia($$(r, '#h4p > div'), t, [7.55, 9.55, 11.55, 13.55, 15.5]);
    ['#h4', '#h4m'].forEach(id => sale($(r, id), t, 15.2));
  } },
// 15,5–18,4 s · la app de verdad
{ a: 15.45, b: 18.45, html: () => tel('<img src="img/app-chat-presupuesto.jpg">', 'id="t5" style="top:430px"') + `
  <div style="position:absolute;left:60px;top:300px" id="c5"><span class="chip" style="flex-direction:column;align-items:flex-start;gap:8px;padding:22px 30px">
    <span style="font:600 28px 'IBM Plex Mono';letter-spacing:.06em;color:#3A4A43;text-transform:uppercase">Registrarte es gratis</span>
    <span style="font:600 46px 'IBM Plex Sans';color:#1E5D49">Sin abono · 3% solo si cobrás</span></span></div>`,
  animar(t, r) {
    const tl = $(r, '#t5');
    const k = U.eo(U.P(t, 15.45, 16.4)), f = U.eio(U.P(t, 16.4, 18.1)), sl = U.eo(U.P(t, 18.05, 18.4));
    tl.style.transform = `translateY(${(1 - k) * 760 + sl * 120}px) rotateX(${14 - 9 * k}deg) rotateY(${-26 + 16 * k + 6 * f}deg) scale(${.86 - sl * .12})`;
    tl.style.opacity = 1 - sl;
    const c = $(r, '#c5'), q = U.P(t, 16.3, 16.65);
    c.style.opacity = q > 0 ? 1 - sl : 0; c.style.transform = `scale(${.6 + .4 * U.back(q)})`;
  } },
// 18,4–20,4 s · pregunta para comentarios
{ a: 18.35, b: 20.5, html: () => `
  <div class="abs centro t-l" style="top:600px;font-size:100px" id="h6a">¿Cuánto tardás hoy</div>
  <div class="abs centro t-l" style="top:705px;font-size:100px" id="h6b">en conseguir</div>
  <div class="abs centro t-l oro" style="top:810px;font-size:100px" id="h6c">un cliente nuevo?</div>`,
  animar(t, r) {
    entra($(r, '#h6a'), t, 18.45); entra($(r, '#h6b'), t, 18.6); entra($(r, '#h6c'), t, 18.75);
    ['#h6a', '#h6b', '#h6c'].forEach(id => sale($(r, id), t, 20.1));
  } },
// 20,4–23 s · cierre
{ a: 20.4, b: 23.1, html: () => `
  <div class="cierre">
    <div class="icono-app" id="c7i">${LOGO(190, 'g7')}</div>
    <div class="t-m" style="margin-top:70px;color:#FCFBF8" id="c7a">Registrate gratis y elegí</div>
    <div class="t-l" style="margin-top:6px;color:#8FD9BC;font-size:96px" id="c7b">«Ofrezco un servicio»</div>
    <div class="url" style="margin-top:44px;font-size:44px" id="c7c">${URL_RED}</div>
    <div class="mono" style="margin-top:50px;color:#C9A227;font-size:32px" id="c7d">Sin abono · más de 40 rubros</div>
  </div>`,
  animar(t, r) {
    const i = $(r, '#c7i'), q = U.P(t, 20.75, 21.2);
    i.style.opacity = q > 0 ? 1 : 0; i.style.transform = `scale(${.4 + .6 * U.back(q)})`;
    entra($(r, '#c7a'), t, 21.15); entra($(r, '#c7b'), t, 21.35); entra($(r, '#c7c'), t, 21.6); entra($(r, '#c7d'), t, 21.85);
  } },
]};
