// Reel "¿Y cómo se cobra un trabajo en Tratto?" (13,8 s, voz clonada del
// fundador en el gancho, quienes ofrecen servicios). Formato producto, corto.
// Todo es lo que hace la app hoy: los dos avisos son los textos reales de
// notificar_evento_push (presupuesto aceptado y "Te pagaron"), el trabajo se
// marca terminado desde el chat («Marcar trabajo terminado»), el cliente paga
// ahí mismo con Mercado Pago y la plata va directo a la cuenta de Mercado Pago
// que se conecta una sola vez. Comisión: 3 % con mínimo de $1.500, solo cuando
// se cobra por la app (FAQ de index.html). La pantalla es la captura real del
// presupuesto de $68.000 en el chat (app-chat-presupuesto).
// Cada versión (-tt / -ig / -fb) pone la URL en window.RED.url; la de
// Instagram agrega en el cierre dónde tocar (window.RED.ig).
const $ = (r, s) => r.querySelector(s), $$ = (r, s) => [...r.querySelectorAll(s)];
const URL_RED = (window.RED && window.RED.url) || 'trattoapp.com.ar';
const ES_IG = !!(window.RED && window.RED.ig);
document.head.insertAdjacentHTML('beforeend', '<style>#link-fijo{font-size:35px}</style>');
const tel = (img, extra = '') => `<div class="escenario"><div class="tel" ${extra}><div class="isla"></div><div class="pantalla">${img}</div></div></div>`;
// Aviso al celular como llega de verdad: título y texto de la notificación.
const aviso = (id, titulo, texto, top) => `<div style="position:absolute;left:70px;right:70px;top:${top}px;opacity:0" id="${id}">
  <div class="chip" style="display:flex;align-items:flex-start;gap:26px;padding:28px 32px;white-space:normal;border-radius:36px">
    <span style="flex:none;width:92px;height:92px;border-radius:24px;background:linear-gradient(150deg,#1B4B40,#0C2620);display:flex;align-items:center;justify-content:center">${LOGO(60, id + 'l')}</span>
    <span style="display:flex;flex-direction:column;gap:8px">
      <span style="font:600 26px 'IBM Plex Mono';letter-spacing:.06em;color:#6B7A73;text-transform:uppercase">Tratto · ahora</span>
      <span style="font:700 50px/1.1 'IBM Plex Sans';color:#0E1815">${titulo}</span>
      <span style="font:400 40px/1.25 'IBM Plex Sans';color:#3A4A43">${texto}</span>
    </span></div></div>`;
const paso = (ico, n, txt) => `<div class="fila"><span class="ico">${icono(ico, 76)}</span><div><div class="mono oro" style="font-size:34px">Paso ${n}</div><div class="t-m" style="font-size:70px;margin-top:8px">${txt}</div></div></div>`;
const baja = (el, t, t0, d = .45) => { const q = U.P(t, t0, t0 + d); el.style.opacity = q > 0 ? 1 : 0; el.style.transform = `translateY(${(1 - U.back(q)) * -90}px)`; return q; };

window.PUBLI = { cierre: 11.2, duracion: 13.8, url: [URL_RED, 1.0], escenas: [
// 0–2,7 s · gancho (lo dice la voz)
{ a: 0, b: 2.75, html: () => `
  <div class="abs centro" style="top:420px" id="g0"><span class="chip" style="font-size:40px"><span style="color:#2B7E62;display:flex">${icono('plata', 50)}</span>Si ofrecés un servicio</span></div>
  <div class="abs centro t-l" style="top:640px;font-size:110px" id="h1a">¿Y cómo se cobra</div>
  <div class="abs centro t-l" style="top:754px;font-size:110px" id="h1b">un trabajo</div>
  <div class="abs centro t-l acento" style="top:868px;font-size:110px" id="h1c">en Tratto?</div>`,
  animar(t, r) {
    const g = $(r, '#g0'), q = U.P(t, 0, .35);
    g.style.opacity = 1; g.style.transform = `translateY(${(1 - U.back(q)) * -80 + Math.sin(t * 2) * 4}px)`;
    entra($(r, '#h1a'), t, .1, .45); entra($(r, '#h1b'), t, .4, .45); entra($(r, '#h1c'), t, .7, .5);
    ['#g0', '#h1a', '#h1b', '#h1c'].forEach(id => sale($(r, id), t, 2.45));
  } },
// 2,7–5,6 s · el presupuesto en el chat y el aviso de que lo aceptaron
{ a: 2.7, b: 5.65, html: () => tel('<img src="img/app-chat-presupuesto.jpg">', 'id="t1" style="top:560px"') +
  aviso('a1', 'Te aceptaron un presupuesto', 'Te aceptaron el de 68.000 pesos. Ya podés arrancar.', 250),
  animar(t, r) {
    const tl = $(r, '#t1');
    const k = U.eo(U.P(t, 2.7, 3.5)), f = U.eio(U.P(t, 3.5, 5.3)), sl = U.eo(U.P(t, 5.3, 5.65));
    tl.style.transform = `translateY(${(1 - k) * 760 - f * 60 + sl * 120}px) rotateX(${14 - 9 * k}deg) rotateY(${-24 + 16 * k + 5 * f}deg) scale(${.84 - sl * .12})`;
    tl.style.opacity = 1 - sl;
    const a = $(r, '#a1'); baja(a, t, 3.35);
    if (t > 5.3) a.style.opacity = 1 - sl;
  } },
// 5,6–8,5 s · qué pasa después
{ a: 5.6, b: 8.55, html: () => `
  <div class="abs t-m" style="top:360px;left:110px" id="h3">Después:</div>
  <div class="pila" style="position:absolute;top:620px;left:110px;right:110px;height:300px" id="h3p">
    ${paso('llave', 1, 'Hacés<br>el trabajo.')}
    ${paso('check', 2, 'Lo marcás<br>terminado<br>en el chat.')}
    ${paso('celular', 3, 'El cliente<br>te paga desde<br>la app.')}
  </div>`,
  animar(t, r) {
    entra($(r, '#h3'), t, 5.65);
    cambia($$(r, '#h3p > div'), t, [5.75, 6.6, 7.55, 8.5]);
    sale($(r, '#h3'), t, 8.2);
  } },
// 8,5–11,2 s · el aviso de que te pagaron
{ a: 8.45, b: 11.25, html: () =>
  aviso('a4', 'Te pagaron', 'Se acreditaron 68.000 pesos por tu trabajo.', 420) + `
  <div class="abs centro t-l" style="top:820px;font-size:100px" id="h4a">Directo a tu</div>
  <div class="abs centro t-l oro" style="top:925px;font-size:100px" id="h4b">Mercado Pago.</div>
  <div class="abs centro mono" style="top:1090px;font-size:34px;color:#3A4A43;text-transform:none;letter-spacing:.02em" id="h4m">Lo conectás una sola vez</div>`,
  animar(t, r) {
    baja($(r, '#a4'), t, 8.55);
    entra($(r, '#h4a'), t, 9.0); entra($(r, '#h4b'), t, 9.2); entra($(r, '#h4m'), t, 9.5, .5, { y: 16 });
    ['#a4', '#h4a', '#h4b', '#h4m'].forEach(id => sale($(r, id), t, 10.9));
  } },
// 11,2–13,8 s · cierre
{ a: 11.2, b: 13.9, html: () => `
  <div class="cierre">
    <div class="icono-app" id="c5i">${LOGO(190, 'g5')}</div>
    <div class="t-m" style="margin-top:70px;color:#FCFBF8" id="c5a">Publicá tu servicio gratis</div>
    <div class="t-l" style="margin-top:6px;color:#8FD9BC;font-size:96px" id="c5b">«Ofrezco un servicio»</div>
    <div class="url" style="margin-top:44px;font-size:44px" id="c5c">${URL_RED}</div>
    ${ES_IG ? `<div class="mono" style="margin-top:34px;color:#FCFBF8;font-size:32px;text-transform:none;letter-spacing:.02em" id="c5e">Tocá @trattoapp_ → «Ofrezco un servicio»</div>` : ''}
    <div class="mono" style="margin-top:${ES_IG ? 30 : 50}px;color:#C9A227;font-size:32px" id="c5d">Sin abono · 3% solo si cobrás</div>
  </div>`,
  animar(t, r) {
    const i = $(r, '#c5i'), q = U.P(t, 11.5, 11.95);
    i.style.opacity = q > 0 ? 1 : 0; i.style.transform = `scale(${.4 + .6 * U.back(q)})`;
    entra($(r, '#c5a'), t, 11.85); entra($(r, '#c5b'), t, 12.0); entra($(r, '#c5c'), t, 12.2);
    if (ES_IG) entra($(r, '#c5e'), t, 12.35);
    entra($(r, '#c5d'), t, 12.5);
  } },
]};
