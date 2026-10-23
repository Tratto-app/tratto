// Reel "Antes de señar el DJ del 15, mirá esto" (22,5 s, sin voz, clientes).
// Precios de precios_referencia ajustados +2 % mensual a oct-2026 (misma fórmula
// que calculadora_comparar): DJ para cumpleaños de 15 $220.000 a $439.000
// (rel. 2026-04), cobertura de fotos 4 h $169.000 a $360.000 (rel. 2026-04),
// mesa dulce decorada $51.000 a $117.000 (rel. 2026-04), catering por persona
// $16.000 a $37.000 (rel. 2026-07). La captura de la calculadora es real
// (DJ para 15 en Morón, $450.000 → +37 % · caro), recortada arriba.
// Cada versión (-tt / -ig / -fb) pone la URL en window.RED.url; la de
// Instagram agrega en el cierre dónde tocar (window.RED.ig).
const $ = (r, s) => r.querySelector(s), $$ = (r, s) => [...r.querySelectorAll(s)];
const URL_RED = (window.RED && window.RED.url) || 'trattoapp.com.ar/calculadora';
const ES_IG = !!(window.RED && window.RED.ig);
document.head.insertAdjacentHTML('beforeend', '<style>#link-fijo{font-size:35px}</style>');
const tel = (img, extra = '') => `<div class="escenario"><div class="tel" ${extra}><div class="isla"></div><div class="pantalla">${img}</div></div></div>`;
const pop = (el, t, t0, d = .35) => { const q = U.P(t, t0, t0 + d); el.style.opacity = q > 0 ? 1 : 0; el.style.transform = `scale(${.6 + .4 * U.back(q)})`; return q; };
const precio = (ico, nombre, rango) => `<div class="fila"><span class="ico">${icono(ico, 76)}</span><div><div class="t-m" style="font-size:68px">${nombre}</div><div class="mono acento" style="font-size:54px;margin-top:10px;letter-spacing:0;text-transform:none">${rango}</div></div></div>`;

window.PUBLI = { cierre: 19.6, url: [URL_RED, 1.0], escenas: [
// 0–2 s · gancho
{ a: 0, b: 2.15, html: () => `
  <div class="abs centro" style="top:420px" id="g0"><span class="chip" style="font-size:40px"><span style="color:#2B7E62;display:flex">${icono('nota', 50)}</span>Cumple de 15 · AMBA</span></div>
  <div class="abs centro t-l" style="top:640px;font-size:108px" id="h1a">Antes de señar</div>
  <div class="abs centro t-l acento" style="top:752px;font-size:108px" id="h1b">el DJ del 15,</div>
  <div class="abs centro t-l" style="top:864px;font-size:108px" id="h1c">mirá esto.</div>`,
  animar(t, r) {
    const g = $(r, '#g0'); g.style.opacity = 1; g.style.filter = 'none';
    g.style.transform = `translateY(${Math.sin(t * 2) * 4}px)`;
    entra($(r, '#h1a'), t, .05, .45); entra($(r, '#h1b'), t, .3, .45); entra($(r, '#h1c'), t, .55, .5);
    ['#g0', '#h1a', '#h1b', '#h1c'].forEach(id => sale($(r, id), t, 1.8));
  } },
// 2–4,6 s · escalada
{ a: 2.05, b: 4.65, html: () => `
  <div class="abs centro t-l" style="top:620px" id="h2a">Cuánto sale</div>
  <div class="abs centro t-l" style="top:735px" id="h2b">en octubre</div>
  <div class="pila centro" style="position:absolute;top:870px;left:60px;right:60px;height:130px" id="h2p">
    <div class="t-l oro" style="font-size:96px">la música,</div>
    <div class="t-l oro" style="font-size:96px">las fotos,</div>
    <div class="t-l oro" style="font-size:96px">la mesa dulce</div>
    <div class="t-l oro" style="font-size:96px">y el catering.</div>
  </div>`,
  animar(t, r) {
    entra($(r, '#h2a'), t, 2.1); entra($(r, '#h2b'), t, 2.25);
    cambia($$(r, '#h2p > div'), t, [2.4, 2.95, 3.5, 4.05, 4.62]);
    sale($(r, '#h2a'), t, 4.35); sale($(r, '#h2b'), t, 4.37);
  } },
// 4,6–12,6 s · precios reales
{ a: 4.55, b: 12.65, html: () => `
  <div class="abs t-m" style="top:330px;left:110px" id="h3">Cumple de 15</div>
  <div class="abs mono oro" style="top:425px;left:112px;font-size:34px" id="h3m">Octubre 2026 · AMBA</div>
  <div class="pila" style="position:absolute;top:640px;left:110px;right:120px;height:300px" id="h3p">
    ${precio('nota', 'DJ para el 15', '$220.000 a $439.000')}
    ${precio('camara', 'Fotos (4 horas)', '$169.000 a $360.000')}
    ${precio('torta', 'Mesa dulce decorada', '$51.000 a $117.000')}
    ${precio('cubiertos', 'Catering (por persona)', '$16.000 a $37.000')}
  </div>
  <div class="abs mono" style="top:1040px;left:112px;font-size:28px;letter-spacing:.03em;color:#3A4A43;text-transform:none;white-space:nowrap" id="h3f">Precios de referencia · Tratto · oct-2026</div>`,
  animar(t, r) {
    entra($(r, '#h3'), t, 4.65); entra($(r, '#h3m'), t, 4.8);
    cambia($$(r, '#h3p > div'), t, [4.95, 6.85, 8.75, 10.65, 12.6]);
    entra($(r, '#h3f'), t, 5.3, .5, { y: 16 });
    ['#h3', '#h3m', '#h3f'].forEach(id => sale($(r, id), t, 12.3));
  } },
// 12,6–17,2 s · prueba con la calculadora (captura real)
{ a: 12.55, b: 17.25, html: () => tel('<img src="img/calc-form.jpg"><img src="img/calc-dj15-resultado.jpg" id="i4" style="opacity:0">', 'id="t4" style="top:470px"') + `
  <div class="abs centro t-m" style="top:290px" id="h4">¿Ya te pasaron un precio?</div>
  <div style="position:absolute;left:300px;top:470px" id="s4"><span class="sello oro">+37% · caro</span></div>
  <div style="position:absolute;left:70px;top:1180px" id="c4"><span class="chip" style="padding:16px 26px;font-size:40px"><span style="color:#2B7E62;display:flex">${icono('reloj2', 50)}</span>20 segundos · gratis</span></div>`,
  animar(t, r) {
    const tl = $(r, '#t4');
    const k = U.eo(U.P(t, 12.55, 13.5)), f = U.eio(U.P(t, 13.5, 16.9)), sl = U.eo(U.P(t, 16.85, 17.2));
    tl.style.transform = `translateY(${(1 - k) * 760 + sl * 120}px) rotateX(${14 - 9 * k}deg) rotateY(${-26 + 16 * k + 6 * f}deg) scale(${.86 - sl * .12})`;
    tl.style.opacity = 1 - sl;
    $(r, '#i4').style.opacity = U.eio(U.P(t, 14.3, 14.65));
    entra($(r, '#h4'), t, 12.7);
    const s = $(r, '#s4'), w = U.P(t, 15.1, 15.45);
    s.style.opacity = w > 0 ? 1 - sl : 0;
    s.style.transform = `scale(${1.8 - .8 * U.back(w)}) rotate(${-7 * (1 - w) - 4}deg)`;
    const c = $(r, '#c4'), q = U.P(t, 15.7, 16.05);
    c.style.opacity = q > 0 ? 1 - sl : 0; c.style.transform = `scale(${.6 + .4 * U.back(q)})`;
    sale($(r, '#h4'), t, 16.85);
  } },
// 17,2–19,6 s · pregunta para comentarios
{ a: 17.15, b: 19.7, html: () => `
  <div class="abs centro t-l" style="top:600px;font-size:104px" id="h5a">¿Qué fue lo más caro</div>
  <div class="abs centro t-l oro" style="top:708px;font-size:104px" id="h5b">de tu fiesta?</div>
  <div class="abs centro" style="top:900px" id="h5c"><span class="chip" style="font-size:46px">Contalo en los comentarios</span></div>`,
  animar(t, r) {
    entra($(r, '#h5a'), t, 17.25); entra($(r, '#h5b'), t, 17.45);
    pop($(r, '#h5c'), t, 17.95);
    ['#h5a', '#h5b', '#h5c'].forEach(id => sale($(r, id), t, 19.3));
  } },
// 19,6–22,5 s · cierre
{ a: 19.6, b: 22.6, html: () => `
  <div class="cierre">
    <div class="icono-app" id="c6i">${LOGO(190, 'g6')}</div>
    <div class="t-m" style="margin-top:70px;color:#FCFBF8" id="c6a">Antes de señar,</div>
    <div class="t-l" style="margin-top:6px;color:#8FD9BC" id="c6b">fijate.</div>
    <div class="url" style="margin-top:44px;font-size:44px" id="c6c">${URL_RED}</div>
    ${ES_IG ? `<div class="mono" style="margin-top:34px;color:#FCFBF8;font-size:32px;text-transform:none;letter-spacing:.02em" id="c6e">Tocá @trattoapp_ → «Calculadora de precios»</div>` : ''}
    <div class="mono" style="margin-top:${ES_IG ? 30 : 50}px;color:#C9A227;font-size:32px" id="c6d">46 rubros · gratis</div>
  </div>`,
  animar(t, r) {
    const i = $(r, '#c6i'), q = U.P(t, 19.95, 20.4);
    i.style.opacity = q > 0 ? 1 : 0; i.style.transform = `scale(${.4 + .6 * U.back(q)})`;
    entra($(r, '#c6a'), t, 20.35); entra($(r, '#c6b'), t, 20.55); entra($(r, '#c6c'), t, 20.8);
    if ($(r, '#c6e')) entra($(r, '#c6e'), t, 21.0);
    entra($(r, '#c6d'), t, 21.2);
  } },
]};
