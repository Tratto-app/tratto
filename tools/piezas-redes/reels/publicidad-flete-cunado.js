// Reel "Tu cuñado no sabe cuánto sale un flete" (22,5 s, sin voz, clientes).
// Cola: growth_mkt_items b3c4c3d3 · memoria c-20261007-fb826f.
// Precios de precios_referencia ajustados +2 % mensual a oct-2026 (misma fórmula
// que calculadora_comparar): flete chico $53.000 a $73.000 (rel. 2026-04),
// baño y corte de perro $39.000 a $66.000 (rel. 2026-05), clase práctica de manejo
// $34.000 a $48.000 (rel. 2026-07), DJ cumpleaños 4 a 5 h $117.000 a $220.000 (rel. 2026-04).
// $85.000 → +35 % sobre el medio del rango, veredicto "caro".
// La URL en pantalla la pone cada versión (-tt / -ig) en window.RED.url.
const $ = (r, s) => r.querySelector(s), $$ = (r, s) => [...r.querySelectorAll(s)];
const URL_RED = (window.RED && window.RED.url) || 'trattoapp.com.ar/calculadora';
document.head.insertAdjacentHTML('beforeend', '<style>#link-fijo{font-size:35px}</style>');
const tel = (img, extra = '') => `<div class="escenario"><div class="tel" ${extra}><div class="isla"></div><div class="pantalla">${img}</div></div></div>`;
const pop = (el, t, t0, d = .35) => { const q = U.P(t, t0, t0 + d); el.style.opacity = q > 0 ? 1 : 0; el.style.transform = `scale(${.6 + .4 * U.back(q)})`; return q; };

window.PUBLI = { cierre: 20.0, url: [URL_RED, 1.0], escenas: [
// 0–2 s · gancho
{ a: 0, b: 2.05, html: () => `
  <div class="chat-card" style="left:110px;top:270px;width:820px" id="g1">
    <div class="grupo-cab"><span class="av">${icono('grupo', 50)}</span><span>Grupo familia</span></div>
    <div class="globo yo">¿$85.000 por un flete es caro?</div>
    <div class="globo"><span class="quien">Cuñado</span>Carísimo, a mí me lo hacían por la mitad</div>
  </div>
  <div class="abs centro t-l" style="top:850px;font-size:100px" id="h1a">Tu cuñado no sabe</div>
  <div class="abs centro t-l" style="top:955px;font-size:100px" id="h1b">cuánto sale</div>
  <div class="abs centro t-l acento" style="top:1060px;font-size:100px" id="h1c">un flete.</div>`,
  animar(t, r) {
    const g = $(r, '#g1');
    g.style.opacity = 1; g.style.filter = 'none';
    g.style.transform = `translateY(${Math.sin(t * 2) * 4}px)`;
    entra($(r, '#h1a'), t, .05, .45); entra($(r, '#h1b'), t, .3, .45); entra($(r, '#h1c'), t, .55, .5);
    ['#h1a', '#h1b', '#h1c'].forEach(id => sale($(r, id), t, 1.72));
    sale(g, t, 1.7);
  } },
// 2–5 s · escalada
{ a: 1.95, b: 5.1, html: () => `
  <div class="abs centro t-l" style="top:600px" id="h2a">Nadie sabe</div>
  <div class="abs centro t-l" style="top:715px" id="h2b">cuánto sale</div>
  <div class="pila centro" style="position:absolute;top:850px;left:60px;right:60px;height:130px" id="h2p">
    <div class="t-l oro" style="font-size:88px">bañar al perro</div>
    <div class="t-l oro" style="font-size:88px">una clase de manejo</div>
    <div class="t-l oro" style="font-size:88px">el DJ del cumple.</div>
  </div>`,
  animar(t, r) {
    entra($(r, '#h2a'), t, 2.0); entra($(r, '#h2b'), t, 2.15);
    cambia($$(r, '#h2p > div'), t, [2.3, 3.2, 4.1, 5.05]);
    sale($(r, '#h2a'), t, 4.8); sale($(r, '#h2b'), t, 4.82);
  } },
// 5–8 s · tensión + remate
{ a: 5.0, b: 8.05, html: () => `
  <div class="abs centro t-m" style="top:290px" id="h3t">Y vos igual preguntás.</div>
  <div class="chat-card" style="left:110px;top:430px;width:820px" id="h3c">
    <div class="grupo-cab"><span class="av">${icono('grupo', 50)}</span><span>Grupo familia</span></div>
    <div class="globo" id="b1">Carísimo.</div>
    <div class="globo" id="b2">A mí me salió la mitad… en 2019.</div>
    <div class="globo" id="b3">Preguntale a Rubén.</div>
  </div>
  <div class="abs centro" style="top:1150px" id="h3s"><span class="sello oro" style="font-size:46px;padding:14px 30px;border-width:6px">Spoiler: ninguno acertó</span></div>`,
  animar(t, r) {
    entra($(r, '#h3t'), t, 5.1);
    entra($(r, '#h3c'), t, 5.2, .4, { y: 30, blur: 10 });
    [['#b1', 5.55], ['#b2', 6.05], ['#b3', 6.55]].forEach(([id, t0]) => {
      const b = $(r, id), q = U.P(t, t0, t0 + .3);
      b.style.opacity = q > 0 ? 1 : 0; b.style.transformOrigin = 'left bottom';
      b.style.transform = `scale(${.5 + .5 * U.back(q)})`;
    });
    const s = $(r, '#h3s'), q = U.P(t, 7.1, 7.42);
    s.style.opacity = q > 0 ? 1 : 0;
    s.style.transform = `scale(${1.6 - .6 * U.back(q)}) rotate(${-5 * (1 - q) - 2}deg)`;
    ['#h3t', '#h3c', '#h3s'].forEach(id => sale($(r, id), t, 7.75));
  } },
// 8–9,4 s · giro
{ a: 7.95, b: 9.45, html: () => `
  <div class="abs centro t-l" style="top:700px;font-size:100px" id="h4a">Mejor preguntale</div>
  <div class="abs centro t-l acento" style="top:805px;font-size:100px" id="h4b">a la calculadora.</div>`,
  animar(t, r) {
    entra($(r, '#h4a'), t, 8.05); entra($(r, '#h4b'), t, 8.35);
    sale($(r, '#h4a'), t, 9.1); sale($(r, '#h4b'), t, 9.12);
  } },
// 9,4–13 s · prueba (captura real de la calculadora, respuesta simulada)
{ a: 9.35, b: 13.25, html: () => tel('<img src="img/calc-flete-form.jpg"><img src="img/calc-flete-resultado.jpg" id="i2" style="opacity:0">', 'id="t5" style="top:400px"') + `
  <div style="position:absolute;left:80px;top:262px" id="c5"><span class="chip" style="padding:16px 26px;font-size:40px"><span style="color:#2B7E62;display:flex">${icono('reloj2', 50)}</span>20 s</span></div>
  <div style="position:absolute;right:150px;top:286px;text-align:right" class="mono" id="m5"><span style="color:#3A4A43;font-size:34px">Flete chico · AMBA</span></div>
  <div style="position:absolute;left:60px;top:1110px" id="r5"><span class="chip" style="flex-direction:column;align-items:flex-start;gap:8px;padding:22px 30px">
    <span style="font:600 28px 'IBM Plex Mono';letter-spacing:.06em;color:#3A4A43;text-transform:uppercase">Referencia oct-2026</span>
    <span style="font:600 50px 'IBM Plex Mono';color:#1E5D49">$53.000 a $73.000</span></span></div>
  <div style="position:absolute;left:300px;top:380px" id="s5"><span class="sello oro">+35% · caro</span></div>`,
  animar(t, r) {
    const tl = $(r, '#t5');
    const k = U.eo(U.P(t, 9.35, 10.3)), f = U.eio(U.P(t, 10.3, 13.0)), sl = U.eo(U.P(t, 12.9, 13.25));
    tl.style.transform = `translateY(${(1 - k) * 760 + sl * 120}px) rotateX(${14 - 9 * k}deg) rotateY(${-26 + 16 * k + 6 * f}deg) scale(${.86 - sl * .12})`;
    tl.style.opacity = 1 - sl;
    $(r, '#i2').style.opacity = U.eio(U.P(t, 10.75, 11.1));
    entra($(r, '#c5'), t, 9.55, .45, { y: 20 }); entra($(r, '#m5'), t, 9.7, .45, { y: 20 });
    const c = $(r, '#r5'), q = U.P(t, 11.3, 11.65);
    c.style.opacity = q > 0 ? 1 - sl : 0; c.style.transform = `scale(${.6 + .4 * U.back(q)}) translateY(${sl * 60}px)`;
    const s = $(r, '#s5'), w = U.P(t, 11.95, 12.3);
    s.style.opacity = w > 0 ? 1 - sl : 0;
    s.style.transform = `scale(${1.8 - .8 * U.back(w)}) rotate(${-7 * (1 - w) - 4}deg)`;
    sale($(r, '#c5'), t, 12.9); sale($(r, '#m5'), t, 12.9);
  } },
// 13–18 s · lo que nadie supo
{ a: 13.15, b: 18.0, html: () => `
  <div class="abs t-m" style="top:330px;left:110px" id="h6">Lo que nadie supo</div>
  <div class="abs mono oro" style="top:425px;left:112px;font-size:34px" id="h6m">Octubre 2026</div>
  <div class="pila" style="position:absolute;top:640px;left:110px;right:120px;height:300px" id="h6p">
    <div class="fila"><span class="ico">${icono('huella', 76)}</span><div><div class="t-m" style="font-size:68px">Baño y corte de perro</div><div class="mono acento" style="font-size:54px;margin-top:10px;letter-spacing:0;text-transform:none">$39.000 a $66.000</div></div></div>
    <div class="fila"><span class="ico">${icono('volante', 76)}</span><div><div class="t-m" style="font-size:68px">Clase de manejo</div><div class="mono acento" style="font-size:54px;margin-top:10px;letter-spacing:0;text-transform:none">$34.000 a $48.000</div></div></div>
    <div class="fila"><span class="ico">${icono('nota', 76)}</span><div><div class="t-m" style="font-size:68px">DJ para un cumple<br>(4 a 5 h)</div><div class="mono acento" style="font-size:54px;margin-top:10px;letter-spacing:0;text-transform:none">$117.000 a $220.000</div></div></div>
  </div>
  <div class="abs mono" style="top:1040px;left:112px;font-size:26px;letter-spacing:.03em;color:#3A4A43;text-transform:none;white-space:nowrap" id="h6f">Referencia de mano de obra · AMBA · oct-2026</div>`,
  animar(t, r) {
    entra($(r, '#h6'), t, 13.25); entra($(r, '#h6m'), t, 13.4);
    cambia($$(r, '#h6p > div'), t, [13.55, 15.0, 16.45, 17.9]);
    entra($(r, '#h6f'), t, 13.9, .5, { y: 16 });
    ['#h6', '#h6m', '#h6f'].forEach(id => sale($(r, id), t, 17.65));
  } },
// 18–20 s · pregunta para comentarios
{ a: 17.85, b: 20.1, html: () => `
  <div class="abs centro t-l" style="top:600px;font-size:104px" id="h7a">¿Cuánto te</div>
  <div class="abs centro t-l" style="top:708px;font-size:104px" id="h7b">cobraron a vos</div>
  <div class="abs centro t-l oro" style="top:816px;font-size:104px" id="h7c">el último flete?</div>
  <div class="abs centro" style="top:1010px" id="h7d"><span class="chip" style="font-size:46px">Etiquetá a tu cuñado</span></div>`,
  animar(t, r) {
    entra($(r, '#h7a'), t, 17.95); entra($(r, '#h7b'), t, 18.1); entra($(r, '#h7c'), t, 18.25);
    pop($(r, '#h7d'), t, 18.75);
    ['#h7a', '#h7b', '#h7c', '#h7d'].forEach(id => sale($(r, id), t, 19.8));
  } },
// 20–22,5 s · cierre
{ a: 20.0, b: 22.6, html: () => `
  <div class="cierre">
    <div class="icono-app" id="c8i">${LOGO(190, 'g8')}</div>
    <div class="t-m" style="margin-top:70px;color:#FCFBF8" id="c8a">Antes de decir que sí,</div>
    <div class="t-l" style="margin-top:6px;color:#8FD9BC" id="c8b">fijate.</div>
    <div class="url" style="margin-top:44px;font-size:44px" id="c8c">${URL_RED}</div>
    <div class="mono" style="margin-top:50px;color:#C9A227;font-size:32px" id="c8d">46 rubros · gratis</div>
  </div>`,
  animar(t, r) {
    const i = $(r, '#c8i'), q = U.P(t, 20.35, 20.8);
    i.style.opacity = q > 0 ? 1 : 0; i.style.transform = `scale(${.4 + .6 * U.back(q)})`;
    entra($(r, '#c8a'), t, 20.75); entra($(r, '#c8b'), t, 20.95); entra($(r, '#c8c'), t, 21.2); entra($(r, '#c8d'), t, 21.45);
  } },
]};
