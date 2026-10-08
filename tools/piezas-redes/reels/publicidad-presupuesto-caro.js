// Reel "¿Y si no perdiste ese trabajo por caro?" (24 s, sin voz, proveedores de todos los rubros).
// Cola: growth_mkt_items f4f7b191 · memoria c-20261007-ab1894. Sin precios de servicios.
// Modelo: registro gratis, sin abono, 3 % solo si cobra por la app (config/marca.json).
// Pantalla real: comparador de presupuestos de la app (ficha de las tiendas, cuentas demo).
// La URL en pantalla la pone cada versión (-tt / -ig) en window.RED.url.
const $ = (r, s) => r.querySelector(s), $$ = (r, s) => [...r.querySelectorAll(s)];
const URL_RED = (window.RED && window.RED.url) || 'trattoapp.com.ar';
document.head.insertAdjacentHTML('beforeend', `<style>#link-fijo{font-size:33px}
  .raya{position:absolute;left:-12px;top:52%;height:12px;border-radius:6px;background:#C2452A;width:0}</style>`);
const tel = (img, extra = '') => `<div class="escenario"><div class="tel" ${extra}><div class="isla"></div><div class="pantalla">${img}</div></div></div>`;
const tildes = '<svg width="40" height="24" viewBox="0 0 40 24" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"><path d="M3 13l6 6L21 5M17 17l2 2L31 5"/></svg>';
const item = (ico, txt, extra) => `<div class="fila" style="align-items:flex-start"><span class="ico">${icono(ico, 76)}</span><div style="padding-top:6px"><div class="t-m" style="font-size:66px">${txt}</div>${extra}</div></div>`;
const ej = (txt, rubro) => `<div class="t-s" style="margin-top:14px">“${txt}”</div><div class="mono oro" style="font-size:28px;margin-top:14px">${rubro}</div>`;

window.PUBLI = { cierre: 21.6, url: [URL_RED, 1.0], escenas: [
// 0–2 s · gancho
{ a: 0, b: 2.05, html: () => `
  <div class="chat-card" style="left:110px;top:280px;width:820px" id="k1">
    <div class="grupo-cab"><span class="av">${icono('chat', 46)}</span><span>Cliente</span></div>
    <div class="globo yo">Te paso el presupuesto.<span class="hora">18:40 <span class="tilde">${tildes}</span></span></div>
    <div class="globo">Gracias, elegimos otro presupuesto.</div>
  </div>
  <div class="abs centro t-l" style="top:820px;font-size:96px" id="h1a">¿Y si no perdiste</div>
  <div class="abs centro t-l" style="top:918px;font-size:96px" id="h1b">ese trabajo</div>
  <div class="abs centro t-l oro" style="top:1025px;font-size:124px" id="h1c">por caro?</div>`,
  animar(t, r) {
    const k = $(r, '#k1');
    k.style.opacity = 1; k.style.filter = 'none'; k.style.transform = `translateY(${Math.sin(t * 2) * 4}px)`;
    entra($(r, '#h1a'), t, .05, .45); entra($(r, '#h1b'), t, .3, .45); entra($(r, '#h1c'), t, .6, .5);
    ['#h1a', '#h1b', '#h1c'].forEach(id => sale($(r, id), t, 1.72));
    sale(k, t, 1.7);
  } },
// 2–5 s · tensión + giro
{ a: 1.95, b: 5.05, html: () => `
  <div class="abs centro t-l" style="top:450px;font-size:100px" id="h2a">Eligieron uno</div>
  <div class="abs centro t-l" style="top:552px;font-size:100px" id="h2b"><span style="position:relative;display:inline-block" id="h2m">más caro<i class="raya" id="h2r"></i></span></div>
  <div class="abs centro t-l" style="top:654px;font-size:100px" id="h2c">que el tuyo.</div>
  <div class="abs centro t-m" style="top:830px;color:#3A4A43" id="h2d">A veces</div>
  <div class="pila centro" style="position:absolute;top:925px;left:60px;right:60px;height:220px" id="h2p">
    <div class="t-l oro" style="font-size:96px">no es el precio:</div>
    <div class="t-l acento" style="font-size:96px">el otro<br>explicó mejor.</div>
  </div>`,
  animar(t, r) {
    entra($(r, '#h2a'), t, 2.0); entra($(r, '#h2b'), t, 2.2); entra($(r, '#h2c'), t, 2.4);
    $(r, '#h2r').style.width = `calc(${U.eo(U.P(t, 2.85, 3.1)) * 100}% + 24px)`;
    $(r, '#h2r').style.opacity = t < 2.85 ? 0 : 1;
    const q = U.P(t, 3.05, 3.4);
    $(r, '#h2m').style.transform = `scale(${1 + .14 * Math.sin(q * Math.PI) })`;
    entra($(r, '#h2d'), t, 3.3);
    cambia($$(r, '#h2p > div'), t, [3.5, 4.25, 5.0]);
    ['#h2a', '#h2b', '#h2c', '#h2d'].forEach(id => sale($(r, id), t, 4.75));
  } },
// 5–7 s · loop
{ a: 4.95, b: 7.1, html: () => `
  <div class="abs centro t-l" style="top:450px" id="h3a">Tenía</div>
  <div class="abs centro oro" style="top:545px;font:700 300px/1 'IBM Plex Sans Condensed'" id="h3b">4</div>
  <div class="abs centro t-l" style="top:850px;font-size:100px" id="h3c">cosas que</div>
  <div class="abs centro t-l" style="top:950px;font-size:100px" id="h3d">el tuyo no.</div>
  <div class="abs centro t-m" style="top:1110px" id="h3e">La <span class="oro">4</span> es la que<br>te cuida a vos.</div>`,
  animar(t, r) {
    entra($(r, '#h3a'), t, 5.05, .4);
    const n = $(r, '#h3b'), q = U.P(t, 5.2, 5.55);
    n.style.opacity = q > 0 ? 1 : 0; n.style.transform = `scale(${.3 + .7 * U.back(q)})`;
    entra($(r, '#h3c'), t, 5.45, .4); entra($(r, '#h3d'), t, 5.6, .4); entra($(r, '#h3e'), t, 5.9, .45);
    ['#h3a', '#h3b', '#h3c', '#h3d', '#h3e'].forEach(id => sale($(r, id), t, 6.8));
  } },
// 7–13,5 s · un buen presupuesto dice
{ a: 7.0, b: 13.6, html: () => `
  <div class="abs t-m" style="top:320px;left:110px;font-size:68px" id="h4">Un buen presupuesto dice:</div>
  <div class="pila" style="position:absolute;top:480px;left:110px;right:165px;height:620px" id="h4p">
    ${item('check', '1. Qué incluye', ej('Clase de 60 minutos, con material', 'Clases'))}
    ${item('cruz', '2. Qué no incluye', ej('Traslado aparte', 'Fotos y video'))}
    ${item('reloj', '3. Cuánto dura', ej('DJ: 5 horas', 'Eventos'))}
    ${item('calendario', '4. Hasta cuándo vale el precio', ej('Válido hasta el 31/10', 'Cualquier rubro') +
      '<div class="t-s" style="margin-top:18px;color:#0E1815">Si los precios suben, no perdés vos.</div><div style="margin-top:24px" id="s4"><span class="sello oro" style="font-size:46px;padding:12px 28px;border-width:6px">te cuida a vos</span></div>')}
  </div>`,
  animar(t, r) {
    entra($(r, '#h4'), t, 7.1);
    cambia($$(r, '#h4p > div'), t, [7.35, 8.85, 10.35, 11.85, 13.45]);
    const s = $(r, '#s4'), q = U.P(t, 12.55, 12.9);
    s.style.opacity = q > 0 ? 1 : 0; s.style.transformOrigin = 'left center';
    s.style.transform = `scale(${1.5 - .5 * U.back(q)}) rotate(${-5 * (1 - q) - 2}deg)`;
    sale($(r, '#h4'), t, 13.2);
  } },
// 13,5–16,3 s · producto (comparador real de la app)
{ a: 13.5, b: 16.3, html: () => tel('<img src="img/app-3.jpg">', 'id="t5" style="top:410px"') + `
  <div class="abs centro mono oro" style="top:246px;font-size:32px" id="h5m">En Tratto</div>
  <div class="abs centro t-m" style="top:292px;font-size:58px" id="h5a">El cliente ve tu presupuesto</div>
  <div class="abs centro t-m acento" style="top:356px;font-size:58px" id="h5b">al lado de otros,</div>
  <div class="abs centro t-m" style="top:420px;font-size:58px" id="h5c">con qué incluye cada uno.</div>
  <div style="position:absolute;left:60px;top:640px" id="n5"><span class="chip"><span class="icono-app" style="width:84px;height:84px;border-radius:22px">${LOGO(54, 'g5')}</span><span>Presupuesto nuevo</span></span></div>
  <div style="position:absolute;left:150px;top:1180px" id="s5"><span class="sello oro">Más de 40 rubros</span></div>`,
  animar(t, r) {
    const tl = $(r, '#t5');
    const k = U.eo(U.P(t, 13.5, 14.4)), f = U.eio(U.P(t, 14.4, 16.0)), s = U.eo(U.P(t, 15.95, 16.3));
    tl.style.transform = `translateY(${(1 - k) * 800 + s * 120}px) rotateY(${-20 + 12 * k + 4 * f}deg) rotateX(${10 - 6 * k}deg) scale(${.8 - s * .12})`;
    tl.style.opacity = 1 - s;
    entra($(r, '#h5m'), t, 13.55, .4, { y: 16 }); entra($(r, '#h5a'), t, 13.65); entra($(r, '#h5b'), t, 13.85); entra($(r, '#h5c'), t, 14.05);
    const n = $(r, '#n5'), q = U.P(t, 14.55, 14.9);
    n.style.opacity = q > 0 ? 1 - s : 0; n.style.transform = `translateY(${(1 - U.eo(q)) * -80}px) scale(${.85 + .15 * U.back(q)})`;
    const w = $(r, '#s5'), p = U.P(t, 15.15, 15.5);
    w.style.opacity = p > 0 ? 1 - s : 0; w.style.transform = `scale(${1.7 - .7 * U.back(p)}) rotate(${-6 * (1 - p) - 3}deg)`;
    ['#h5m', '#h5a', '#h5b', '#h5c'].forEach(id => sale($(r, id), t, 15.95));
  } },
// 16,3–17,9 s · registrarte es gratis
{ a: 16.2, b: 17.95, html: () => `
  <div class="abs centro t-l" style="top:590px" id="h6a">Registrarte es</div>
  <div class="abs centro t-xl acento" style="top:705px" id="h6b">gratis.</div>
  <div class="abs centro t-s" style="top:900px;left:150px;right:150px;color:#0E1815" id="h6c">Sin abono: <b>3% solo si cobrás<br>por la app.</b></div>`,
  animar(t, r) {
    entra($(r, '#h6a'), t, 16.3); entra($(r, '#h6b'), t, 16.5); entra($(r, '#h6c'), t, 16.85);
    ['#h6a', '#h6b', '#h6c'].forEach(id => sale($(r, id), t, 17.6));
  } },
// 17,9–19,4 s · remate
{ a: 17.8, b: 19.45, html: () => `
  <div class="abs centro t-l" style="top:600px;font-size:96px" id="h7a">Ser el más barato</div>
  <div class="abs centro t-l" style="top:700px;font-size:96px" id="h7b">no es la única</div>
  <div class="abs centro t-l acento" style="top:800px;font-size:96px" id="h7c">forma de ganar.</div>`,
  animar(t, r) {
    entra($(r, '#h7a'), t, 17.9); entra($(r, '#h7b'), t, 18.05); entra($(r, '#h7c'), t, 18.25);
    ['#h7a', '#h7b', '#h7c'].forEach(id => sale($(r, id), t, 19.1));
  } },
// 19,4–21,6 s · pregunta + compartir
{ a: 19.3, b: 21.75, html: () => `
  <div class="abs centro t-l" style="top:320px;font-size:96px" id="h8a">¿Cuál de las 4</div>
  <div class="abs centro t-l oro" style="top:418px;font-size:96px" id="h8b">no ponés nunca?</div>
  <div style="position:absolute;top:580px;left:250px" id="h8l">
    ${['Qué incluye', 'Qué no incluye', 'Cuánto dura', 'Hasta cuándo vale'].map(x => `<div class="fila" style="gap:26px;height:88px"><span class="casilla"></span><span class="t-s" style="color:#0E1815;font-weight:600">${x}</span></div>`).join('')}
  </div>
  <div class="abs centro" style="top:1000px;left:150px;right:150px" id="h8c"><div class="chip" style="white-space:normal;text-align:center;font-size:42px;line-height:1.25;padding:24px 34px">Mandáselo al que todavía presupuesta por audio de WhatsApp.</div></div>`,
  animar(t, r) {
    entra($(r, '#h8a'), t, 19.4); entra($(r, '#h8b'), t, 19.55);
    $$(r, '#h8l > div').forEach((el, i) => entra(el, t, 19.75 + i * .15, .35, { y: 20, blur: 10 }));
    entra($(r, '#h8c'), t, 20.4, .45, { y: 24 });
    ['#h8a', '#h8b', '#h8l', '#h8c'].forEach(id => sale($(r, id), t, 21.3));
  } },
// 21,6–24 s · cierre
{ a: 21.6, b: 24.1, html: () => `
  <div class="cierre">
    <div class="icono-app" id="c9i">${LOGO(190, 'g9')}</div>
    <div class="t-l" style="margin-top:80px;color:#FCFBF8" id="c9a">Sumate gratis</div>
    <div class="url" style="margin-top:34px;font-size:38px" id="c9b">${URL_RED}</div>
    <div class="mono" style="margin-top:56px;color:#C9A227;font-size:32px" id="c9c">Más de 40 rubros · sin abono</div>
  </div>`,
  animar(t, r) {
    const i = $(r, '#c9i'), q = U.P(t, 21.95, 22.4);
    i.style.opacity = q > 0 ? 1 : 0; i.style.transform = `scale(${.4 + .6 * U.back(q)})`;
    entra($(r, '#c9a'), t, 22.35); entra($(r, '#c9b'), t, 22.6); entra($(r, '#c9c'), t, 22.85);
  } },
]};
