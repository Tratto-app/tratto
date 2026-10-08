// Reel "Lo encontraste en un grupo. ¿Y ahora?" (23 s, sin voz, clientes).
// Cola: growth_mkt_items 5865e24b · memoria c-20261007-a490a5. Sin precios.
// Pantallas reales de la app (capturas de la ficha de las tiendas, datos de las
// cuentas demo): pedido con proveedores conectados, comparador y chat. No se
// muestra ninguna calificación: la única que existe es de una cuenta demo y no
// se puede presentar como opinión real.
// La URL en pantalla la pone cada versión (-tt / -ig) en window.RED.url.
const $ = (r, s) => r.querySelector(s), $$ = (r, s) => [...r.querySelectorAll(s)];
const URL_RED = (window.RED && window.RED.url) || 'trattoapp.com.ar';
document.head.insertAdjacentHTML('beforeend', '<style>#link-fijo{font-size:35px}</style>');
const tel = (img, extra = '') => `<div class="escenario"><div class="tel" ${extra}><div class="isla"></div><div class="pantalla">${img}</div></div></div>`;
const pop = (el, t, t0, d = .35, o = 'center') => { const q = U.P(t, t0, t0 + d); el.style.opacity = q > 0 ? 1 : 0; el.style.transformOrigin = o; el.style.transform = `scale(${.5 + .5 * U.back(q)})`; return q; };
const item = (ico, txt, sub) => `<div class="fila" style="align-items:flex-start"><span class="ico">${icono(ico, 76)}</span><div style="padding-top:6px"><div class="t-m" style="font-size:66px">${txt}</div>${sub}</div></div>`;

window.PUBLI = { cierre: 20.7, url: [URL_RED, 1.0], escenas: [
// 0–2 s · gancho
{ a: 0, b: 2.05, html: () => `
  <div class="chat-card" style="left:110px;top:270px;width:820px" id="p1">
    <div class="grupo-cab"><span class="av">${icono('grupo', 50)}</span><span>Grupo del barrio<small>Publicación</small></span></div>
    <div style="font:600 50px/1.25 'IBM Plex Sans';padding:18px 4px 6px">¿Alguien que pasee perros por la zona?</div>
    <div style="display:flex;gap:16px;flex-wrap:wrap">
      <div class="globo" id="r1" style="font-size:38px;padding:14px 24px">yo!</div><div class="globo" id="r2" style="font-size:38px;padding:14px 24px">yo hago</div><div class="globo" id="r3" style="font-size:38px;padding:14px 24px">te mando privado</div>
    </div>
  </div>
  <div class="abs centro t-l" style="top:770px;font-size:100px" id="h1a">Lo encontraste</div>
  <div class="abs centro t-l" style="top:872px;font-size:100px" id="h1b">en un grupo</div>
  <div class="abs centro t-l" style="top:974px;font-size:100px" id="h1c">de Facebook.</div>
  <div class="abs centro t-l oro" style="top:1095px;font-size:120px" id="h1d">¿Y ahora?</div>`,
  animar(t, r) {
    const p = $(r, '#p1');
    p.style.opacity = 1; p.style.filter = 'none'; p.style.transform = `translateY(${Math.sin(t * 2) * 4}px)`;
    pop($(r, '#r1'), t, .2, .3, 'left bottom'); pop($(r, '#r2'), t, .45, .3, 'left bottom'); pop($(r, '#r3'), t, .7, .3, 'left bottom');
    entra($(r, '#h1a'), t, .05, .45); entra($(r, '#h1b'), t, .25, .45); entra($(r, '#h1c'), t, .45, .45); entra($(r, '#h1d'), t, .85, .45);
    ['#h1a', '#h1b', '#h1c', '#h1d'].forEach(id => sale($(r, id), t, 1.72));
    sale(p, t, 1.7);
  } },
// 2–5 s · tensión
{ a: 1.95, b: 5.1, html: () => `
  <div class="abs centro t-m" style="top:540px;font-size:68px;color:#3A4A43" id="h2t">Te contestó medio barrio.</div>
  <div class="abs centro t-l" style="top:680px" id="h2a">¿A quién</div>
  <div class="pila centro" style="position:absolute;top:805px;left:60px;right:60px;height:130px" id="h2p">
    <div class="t-l acento" style="font-size:88px">le abrís la puerta?</div>
    <div class="t-l acento" style="font-size:88px">le dejás el perro?</div>
    <div class="t-l acento" style="font-size:88px">le das la llave?</div>
  </div>`,
  animar(t, r) {
    entra($(r, '#h2t'), t, 2.0); entra($(r, '#h2a'), t, 2.25);
    cambia($$(r, '#h2p > div'), t, [2.45, 3.3, 4.15, 5.05]);
    sale($(r, '#h2t'), t, 4.8); sale($(r, '#h2a'), t, 4.82);
  } },
// 5–8 s · contrarian
{ a: 5.0, b: 7.85, html: () => `
  <div class="abs centro t-l" style="top:540px" id="h3a">Que conteste</div>
  <div class="abs centro t-xl oro" style="top:655px" id="h3b">rápido</div>
  <div class="abs centro t-l" style="top:830px" id="h3c">no lo hace</div>
  <div class="abs centro t-xl acento" style="top:945px" id="h3d">confiable.</div>`,
  animar(t, r) {
    entra($(r, '#h3a'), t, 5.1); entra($(r, '#h3b'), t, 5.35); entra($(r, '#h3c'), t, 5.85); entra($(r, '#h3d'), t, 6.1);
    ['#h3a', '#h3b', '#h3c', '#h3d'].forEach(id => sale($(r, id), t, 7.5));
  } },
// 8–9,3 s · loop
{ a: 7.75, b: 9.35, html: () => `
  <div class="abs centro t-l" style="top:500px" id="h4a">Fijate</div>
  <div class="abs centro oro" style="top:590px;font:700 300px/1 'IBM Plex Sans Condensed'" id="h4b">3</div>
  <div class="abs centro t-l" style="top:895px" id="h4c">cosas.</div>
  <div class="abs centro t-m" style="top:1060px" id="h4d">La <span class="oro">3</span> es la que<br>te cuida a vos.</div>`,
  animar(t, r) {
    entra($(r, '#h4a'), t, 7.85, .4);
    const n = $(r, '#h4b'), q = U.P(t, 7.95, 8.3);
    n.style.opacity = q > 0 ? 1 : 0; n.style.transform = `scale(${.3 + .7 * U.back(q)})`;
    entra($(r, '#h4c'), t, 8.1, .4); entra($(r, '#h4d'), t, 8.35, .45);
    ['#h4a', '#h4b', '#h4c', '#h4d'].forEach(id => sale($(r, id), t, 9.05));
  } },
// 9–15 s · las 3 cosas
{ a: 9.25, b: 15.1, html: () => `
  <div class="abs t-m" style="top:320px;left:110px" id="h5">Fijate:</div>
  <div class="pila" style="position:absolute;top:470px;left:110px;right:165px;height:520px" id="h5p">
    ${item('estrella', '1. Calificaciones de otros clientes', '<div class="t-s" style="margin-top:12px">(no del primo)</div>')}
    ${item('hojacheck', '2. Qué incluye, por escrito', '<div class="t-s" style="margin-top:12px">(no en un audio)</div>')}
    ${item('candado', '3. Tu número y tu dirección, recién cuando ya elegiste.', '<div style="margin-top:26px" id="s5"><span class="sello oro" style="font-size:46px;padding:12px 28px;border-width:6px">te cuida a vos</span></div>')}
  </div>
  <div class="abs mono" style="top:1150px;left:112px;font-size:32px;color:#3A4A43" id="h5v">Vale para</div>
  <div class="pila" style="position:absolute;top:1200px;left:110px;right:120px;height:90px" id="h5r">
    <div class="t-m acento" style="font-size:62px">el paseador</div><div class="t-m acento" style="font-size:62px">la profe de inglés</div>
    <div class="t-m acento" style="font-size:62px">el DJ</div><div class="t-m acento" style="font-size:62px">el flete</div>
  </div>`,
  animar(t, r) {
    entra($(r, '#h5'), t, 9.35);
    cambia($$(r, '#h5p > div'), t, [9.45, 11.35, 13.25, 15.0]);
    const s = $(r, '#s5'), q = U.P(t, 13.9, 14.25);
    s.style.opacity = q > 0 ? 1 : 0; s.style.transformOrigin = 'left center';
    s.style.transform = `scale(${1.5 - .5 * U.back(q)}) rotate(${-5 * (1 - q) - 2}deg)`;
    entra($(r, '#h5v'), t, 9.6, .45, { y: 16 });
    cambia($$(r, '#h5r > div'), t, [9.75, 11.05, 12.35, 13.65, 15.0]);
    sale($(r, '#h5'), t, 14.7); sale($(r, '#h5v'), t, 14.7);
  } },
// 15–18,8 s · producto (pantallas reales de la app)
{ a: 15.0, b: 18.85, html: () => tel('<img src="img/app-1.jpg"><img src="img/app-3.jpg" id="i2" style="opacity:0"><img src="img/app-2.jpg" id="i3" style="opacity:0">', 'id="t6" style="top:370px"') + `
  <div class="abs centro mono oro" style="top:250px;font-size:34px" id="h6m">En Tratto</div>
  <div class="pila centro" style="position:absolute;top:300px;left:60px;right:60px;height:80px" id="h6p">
    <div class="t-m acento" style="font-size:58px">Calificaciones de otros clientes</div>
    <div class="t-m acento" style="font-size:58px">Presupuestos con qué incluye</div>
    <div class="t-m acento" style="font-size:58px">Chat dentro de la app</div>
  </div>
  <div style="position:absolute;left:60px;top:1120px" id="c6"><span class="chip" style="flex-direction:column;align-items:flex-start;gap:8px;padding:22px 30px">
    <span style="display:flex;align-items:center;gap:14px;font:700 50px 'IBM Plex Sans Condensed';color:#0E1815"><span style="color:#2B7E62;display:flex">${icono('chat', 50)}</span>Chat en la app</span>
    <span style="font:600 32px 'IBM Plex Mono';color:#1E5D49">tu número no se muestra</span></span></div>`,
  animar(t, r) {
    const tl = $(r, '#t6');
    const k = U.eo(U.P(t, 15.0, 15.9)), f = U.eio(U.P(t, 15.9, 18.5)), s = U.eo(U.P(t, 18.5, 18.85));
    tl.style.transform = `translateX(${(1 - k) * 700}px) rotateY(${26 - 16 * k - 6 * f}deg) rotateX(${6 - 4 * f}deg) scale(${.82 - s * .14})`;
    tl.style.opacity = 1 - s;
    $(r, '#i2').style.opacity = U.eio(U.P(t, 16.3, 16.55));
    $(r, '#i3').style.opacity = U.eio(U.P(t, 17.55, 17.8));
    entra($(r, '#h6m'), t, 15.05, .4, { y: 16 });
    cambia($$(r, '#h6p > div'), t, [15.15, 16.4, 17.65, 18.8]);
    const c = $(r, '#c6'), q = U.P(t, 17.85, 18.2);
    c.style.opacity = q > 0 ? 1 - s : 0; c.style.transform = `scale(${.6 + .4 * U.back(q)}) translateY(${s * 60}px)`;
    sale($(r, '#h6m'), t, 18.5);
  } },
// 18,8–20,7 s · pregunta para comentarios + compartir
{ a: 18.75, b: 20.8, html: () => `
  <div class="abs centro t-l" style="top:470px;font-size:92px" id="h7a">¿Vos a quién le</div>
  <div class="abs centro t-l" style="top:565px;font-size:92px" id="h7b">preguntás primero:</div>
  <div class="abs centro t-l acento" style="top:660px;font-size:92px" id="h7c">al grupo</div>
  <div class="abs centro t-l oro" style="top:755px;font-size:92px" id="h7d">o a un vecino?</div>
  <div class="abs centro" style="top:930px;left:150px;right:150px" id="h7e"><div class="chip" style="white-space:normal;text-align:center;font-size:42px;line-height:1.25;padding:24px 34px">Mandáselo a tu vieja antes de que contrate al primero que le contesta.</div></div>`,
  animar(t, r) {
    entra($(r, '#h7a'), t, 18.85); entra($(r, '#h7b'), t, 18.98); entra($(r, '#h7c'), t, 19.12); entra($(r, '#h7d'), t, 19.26);
    entra($(r, '#h7e'), t, 19.55, .45, { y: 24 });
    ['#h7a', '#h7b', '#h7c', '#h7d', '#h7e'].forEach(id => sale($(r, id), t, 20.4));
  } },
// 20,7–23 s · cierre
{ a: 20.7, b: 23.1, html: () => `
  <div class="cierre">
    <div class="icono-app" id="c8i">${LOGO(190, 'g8')}</div>
    <div class="t-l" style="margin-top:80px;color:#FCFBF8" id="c8a">Pedí gratis</div>
    <div class="url" style="margin-top:34px;font-size:42px" id="c8b">${URL_RED}</div>
    <div class="mono" style="margin-top:56px;color:#C9A227;font-size:32px" id="c8c">Más de 40 rubros</div>
  </div>`,
  animar(t, r) {
    const i = $(r, '#c8i'), q = U.P(t, 21.05, 21.5);
    i.style.opacity = q > 0 ? 1 : 0; i.style.transform = `scale(${.4 + .6 * U.back(q)})`;
    entra($(r, '#c8a'), t, 21.45); entra($(r, '#c8b'), t, 21.7); entra($(r, '#c8c'), t, 21.95);
  } },
]};
