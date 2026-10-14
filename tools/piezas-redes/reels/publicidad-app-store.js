// Reel de lanzamiento: Tratto ya está en la App Store (25 s, sin voz, clientes).
// Pilar producto. Gancho: "¿Alguien conoce un flete?" (identificación) y
// rubros que se reemplazan para mostrar variedad (no solo hogar).
// Datos: App Store publicada el 9/10/2026; Google Play todavía no (no se
// nombra). En Android Tratto se usa desde la web. Pantallas reales de la app
// (capturas de la ficha de las tiendas, cuentas demo). No se muestra ninguna
// calificación.
// Cada versión (-ig / -tt) define window.RED = { url, red } antes de cargar
// este archivo: la URL del link fijo y el cierre cambian por red (en TikTok no
// hay link en el perfil ni se menciona @trattoapp_).
const $ = (r, s) => r.querySelector(s), $$ = (r, s) => [...r.querySelectorAll(s)];
const RED = window.RED || { url: 'trattoapp.com.ar', red: 'instagram' };
document.head.insertAdjacentHTML('beforeend', '<style>#link-fijo{font-size:35px}</style>');
const tel = (img, extra = '') => `<div class="escenario"><div class="tel" ${extra}><div class="isla"></div><div class="pantalla">${img}</div></div></div>`;
const pop = (el, t, t0, d = .35, o = 'center') => { const q = U.P(t, t0, t0 + d); el.style.opacity = q > 0 ? 1 : 0; el.style.transformOrigin = o; el.style.transform = `scale(${.5 + .5 * U.back(q)})`; return q; };

// Función: LOGO lo define publicidad-comun.js, que se carga después.
const CIERRE = () => RED.red === 'tiktok' ? `
    <div class="icono-app" id="c8i">${LOGO(190, 'g8')}</div>
    <div class="t-m" style="margin-top:64px;color:#FCFBF8" id="c8a">En iPhone:</div>
    <div class="t-l" style="margin-top:10px;color:#FCFBF8" id="c8b">buscá Tratto</div>
    <div class="t-m" style="margin-top:6px;color:#C9A227" id="c8c">en la App Store</div>
    <div class="mono" style="margin-top:56px;color:#FCFBF8;font-size:32px" id="c8d">Android y compu:</div>
    <div class="url" style="margin-top:14px;font-size:44px" id="c8e">${RED.url}</div>` : `
    <div class="icono-app" id="c8i">${LOGO(190, 'g8')}</div>
    <div class="t-l" style="margin-top:64px;color:#FCFBF8" id="c8a">Ya en la App Store</div>
    <div class="t-m" style="margin-top:34px;color:#8FD9BC" id="c8b">Tocá @trattoapp_</div>
    <div class="mono" style="margin-top:16px;color:#C9A227;font-size:40px;text-transform:none;letter-spacing:.01em" id="c8c">y entrá al link «Pedí un servicio»</div>
    <div class="url" style="margin-top:40px;font-size:40px" id="c8d">trattoapp.com.ar</div>
    <div style="display:none" id="c8e"></div>`;

window.PUBLI = { cierre: 22.4, url: [RED.url, 1.0], escenas: [
// 0–3 s · gancho: el mensaje de siempre en el grupo
{ a: 0, b: 3.05, html: () => `
  <div class="chat-card" style="left:110px;top:280px;width:820px" id="p1">
    <div class="grupo-cab"><span class="av">${icono('grupo', 50)}</span><span>Grupo del barrio<small>Publicación</small></span></div>
    <div style="display:flex;gap:16px;flex-wrap:wrap">
      <div class="globo" id="r1" style="font-size:38px;padding:14px 24px">te paso el de mi cuñado</div><div class="globo" id="r2" style="font-size:38px;padding:14px 24px">yo conozco uno</div><div class="globo" id="r3" style="font-size:38px;padding:14px 24px">¿cuánto cobra?</div>
    </div>
  </div>
  <div class="abs centro t-l" style="top:700px" id="h1a">¿Alguien conoce</div>
  <div class="pila centro" style="position:absolute;top:830px;left:60px;right:60px;height:130px" id="h1p">
    <div class="t-l acento" style="font-size:108px">un flete?</div>
    <div class="t-l acento" style="font-size:108px">un DJ?</div>
    <div class="t-l acento" style="font-size:100px">clases de inglés?</div>
    <div class="t-l acento" style="font-size:108px">un paseador?</div>
    <div class="t-l acento" style="font-size:108px">una manicura?</div>
  </div>`,
  animar(t, r) {
    const p = $(r, '#p1');
    p.style.opacity = 1; p.style.filter = 'none'; p.style.transform = `translateY(${Math.sin(t * 2) * 4}px)`;
    pop($(r, '#r1'), t, .35, .3, 'left bottom'); pop($(r, '#r2'), t, .7, .3, 'left bottom'); pop($(r, '#r3'), t, 1.25, .3, 'left bottom');
    entra($(r, '#h1a'), t, .02, .4);
    cambia($$(r, '#h1p > div'), t, [.08, 1.05, 1.55, 2.05, 2.5, 3.0], .35);
    sale($(r, '#h1a'), t, 2.72); sale(p, t, 2.72);
  } },
// 3–5,5 s · tensión: te pasan un número y no sabés nada
{ a: 2.95, b: 5.5, html: () => `
  <div class="abs centro t-l" style="top:600px" id="h2a">Te pasan un número.</div>
  <div class="pila centro" style="position:absolute;top:760px;left:60px;right:60px;height:160px" id="h2p">
    <div class="t-xl acento">¿Quién es?</div>
    <div class="t-xl oro">¿Cuánto cobra?</div>
    <div class="t-xl acento" style="font-size:132px">¿Te clava el visto?</div>
  </div>`,
  animar(t, r) {
    entra($(r, '#h2a'), t, 3.0, .45);
    cambia($$(r, '#h2p > div'), t, [3.35, 4.05, 4.75, 5.45]);
    sale($(r, '#h2a'), t, 5.15);
  } },
// 5,5–8,7 s · la noticia
{ a: 5.4, b: 8.75, html: () => `
  <div class="abs centro mono" style="top:440px;font-size:34px;color:#1E5D49;line-height:1.35" id="h3m">La app para pedir presupuestos<br>de tu zona</div>
  <div style="position:absolute;left:390px;top:570px" id="h3i"><div class="icono-app">${LOGO(190, 'g3')}</div></div>
  <div class="abs centro t-l" style="top:930px" id="h3a">Tratto ya está</div>
  <div class="abs centro t-l oro" style="top:1050px" id="h3b">en la App Store.</div>
  <div class="abs centro" style="top:1190px" id="h3s"><span class="sello oro" style="font-size:52px;padding:14px 32px;border-width:6px;text-transform:none;letter-spacing:.02em">Nuevo en iPhone</span></div>
  <div class="abs centro mono" style="top:1330px;font-size:32px;color:#3A4A43;text-transform:none;letter-spacing:.02em" id="h3q">¿Tenés Android? Esperá al final.</div>`,
  animar(t, r) {
    entra($(r, '#h3m'), t, 5.5, .45, { y: 16 });
    const i = $(r, '#h3i'), q = U.P(t, 5.7, 6.1);
    i.style.opacity = q > 0 ? 1 : 0; i.style.transform = `scale(${.2 + .8 * U.back(q)})`;
    entra($(r, '#h3a'), t, 6.05); entra($(r, '#h3b'), t, 6.4);
    const s = $(r, '#h3s'), w = U.P(t, 7.15, 7.5);
    s.style.opacity = w > 0 ? 1 : 0;
    s.style.transform = `scale(${1.5 - .5 * U.back(w)}) rotate(${-5 * (1 - w) - 3}deg)`;
    entra($(r, '#h3q'), t, 7.6, .45, { y: 16 });
    ['#h3m', '#h3i', '#h3a', '#h3b', '#h3s', '#h3q'].forEach(id => sale($(r, id), t, 8.4));
  } },
// 8,7–13,6 s · cómo funciona
{ a: 8.65, b: 13.65, html: () => `
  <div class="abs t-m" style="top:480px;left:110px" id="h4h">Así funciona:</div>
  <div class="abs mono oro" style="top:580px;left:112px;font-size:32px;text-transform:none;letter-spacing:.02em" id="h4q">La 4 es la que te cuida.</div>
  <div class="pila" style="position:absolute;top:690px;left:110px;right:120px;height:260px" id="h4p">
    <div class="fila t-m" style="font-size:66px"><span class="ico">${icono('pedido', 76)}</span><span>Sacás una foto o<br>contás qué necesitás</span></div>
    <div class="fila t-m" style="font-size:66px"><span class="ico">${icono('presupuesto', 76)}</span><span>Te mandan presupuestos</span></div>
    <div class="fila t-m" style="font-size:66px"><span class="ico">${icono('hojacheck', 76)}</span><span>Comparás qué incluye</span></div>
    <div class="fila t-m" style="font-size:66px"><span class="ico">${icono('candado', 76)}</span><span>Chateás sin dar<br>tu número</span></div>
  </div>
  <div class="abs mono" style="top:1010px;left:112px;font-size:32px;color:#3A4A43" id="h4n">Para el que pide, gratis</div>
  <div style="position:absolute;left:250px;top:880px" id="h4s"><span class="sello oro" style="font-size:44px;padding:12px 28px;border-width:6px">te cuida</span></div>`,
  animar(t, r) {
    entra($(r, '#h4h'), t, 8.75);
    cambia($$(r, '#h4p > div'), t, [8.85, 10.05, 11.25, 12.45, 13.6]);
    entra($(r, '#h4n'), t, 9.3, .45, { y: 16 });
    entra($(r, '#h4q'), t, 9.0, .45, { y: 16 });
    const s4 = $(r, '#h4s'), q4 = U.P(t, 12.9, 13.2);
    s4.style.opacity = q4 > 0 ? 1 : 0; s4.style.transformOrigin = 'left center';
    s4.style.transform = `scale(${1.5 - .5 * U.back(q4)}) rotate(${-5 * (1 - q4) - 2}deg)`;
    sale($(r, '#h4h'), t, 13.3); sale($(r, '#h4n'), t, 13.3); sale($(r, '#h4q'), t, 13.3); sale(s4, t, 13.35);
  } },
// 13,6–17,7 s · pantallas reales de la app
{ a: 13.55, b: 17.75, html: () => tel('<img src="img/app-4.jpg"><img src="img/app-1.jpg" id="i2" style="opacity:0"><img src="img/app-3.jpg" id="i3" style="opacity:0">', 'id="t5" style="top:370px"') + `
  <div class="abs centro mono oro" style="top:250px;font-size:34px" id="h5m">En la app</div>
  <div class="pila centro" style="position:absolute;top:300px;left:60px;right:60px;height:80px" id="h5p">
    <div class="t-m acento" style="font-size:58px">Pedís un servicio</div>
    <div class="t-m acento" style="font-size:58px">Ves quién trabaja en tu zona</div>
    <div class="t-m acento" style="font-size:58px">Comparás los presupuestos</div>
  </div>
  <div style="position:absolute;left:70px;top:1110px" id="n5"><span class="chip"><span class="icono-app" style="width:84px;height:84px;border-radius:22px">${LOGO(54, 'g5')}</span><span>Presupuesto nuevo<br><span style="font:600 40px 'IBM Plex Mono';color:#2B7E62">$68.000</span></span></span></div>`,
  animar(t, r) {
    const tl = $(r, '#t5');
    const k = U.eo(U.P(t, 13.55, 14.45)), f = U.eio(U.P(t, 14.45, 17.4)), s = U.eo(U.P(t, 17.4, 17.75));
    tl.style.transform = `translateX(${(1 - k) * 700}px) rotateY(${26 - 16 * k - 6 * f}deg) rotateX(${6 - 4 * f}deg) scale(${.82 - s * .14})`;
    tl.style.opacity = 1 - s;
    $(r, '#i2').style.opacity = U.eio(U.P(t, 14.8, 15.05));
    $(r, '#i3').style.opacity = U.eio(U.P(t, 16.1, 16.35));
    entra($(r, '#h5m'), t, 13.6, .4, { y: 16 });
    cambia($$(r, '#h5p > div'), t, [13.7, 14.85, 16.15, 17.7]);
    const n = $(r, '#n5'), q = U.P(t, 15.35, 15.7);
    n.style.opacity = q > 0 ? 1 - s : 0;
    n.style.transform = `translateY(${(1 - U.eo(q)) * -60}px) scale(${.85 + .15 * U.back(q)})`;
    sale($(r, '#h5m'), t, 17.4);
  } },
// 17,7–20,2 s · más de 40 rubros
{ a: 17.65, b: 20.25, html: () => `
  <div class="abs centro t-l" style="top:600px" id="h6a">Más de 40 rubros:</div>
  <div class="pila centro" style="position:absolute;top:760px;left:60px;right:60px;height:160px" id="h6p">
    <div class="t-xl acento">clases</div><div class="t-xl oro">eventos</div><div class="t-xl acento">autos</div>
    <div class="t-xl oro">mascotas</div><div class="t-xl acento">belleza</div><div class="t-xl oro">trámites</div>
  </div>
  <div class="abs centro mono" style="top:980px;font-size:34px;color:#3A4A43" id="h6n">y también la casa</div>`,
  animar(t, r) {
    entra($(r, '#h6a'), t, 17.75, .45);
    cambia($$(r, '#h6p > div'), t, [17.9, 18.3, 18.7, 19.1, 19.5, 19.9, 20.2], .3);
    entra($(r, '#h6n'), t, 18.5, .45, { y: 16 });
    sale($(r, '#h6a'), t, 19.95); sale($(r, '#h6n'), t, 19.95);
  } },
// 20,2–22,4 s · Android y para mandar
{ a: 20.15, b: 22.45, html: () => `
  <div class="abs centro t-l" style="top:560px" id="h7a">¿Tenés Android?</div>
  <div class="abs centro t-l acento" style="top:680px;font-size:96px" id="h7b">Usalo desde la web.</div>
  <div class="abs centro" style="top:870px;left:110px;right:140px" id="h7c"><div class="chip" style="white-space:normal;text-align:center;font-size:42px;line-height:1.25;padding:24px 34px">Mandáselo al que pregunta «¿alguien conoce…?» en todos los grupos.</div></div>`,
  animar(t, r) {
    entra($(r, '#h7a'), t, 20.25); entra($(r, '#h7b'), t, 20.55);
    entra($(r, '#h7c'), t, 21.0, .45, { y: 24 });
    ['#h7a', '#h7b', '#h7c'].forEach(id => sale($(r, id), t, 22.1));
  } },
// 22,4–25 s · cierre
{ a: 22.4, b: 25.1, html: () => `<div class="cierre">${CIERRE()}</div>`,
  animar(t, r) {
    const i = $(r, '#c8i'), q = U.P(t, 22.75, 23.2);
    i.style.opacity = q > 0 ? 1 : 0; i.style.transform = `scale(${.4 + .6 * U.back(q)})`;
    entra($(r, '#c8a'), t, 23.1); entra($(r, '#c8b'), t, 23.35); entra($(r, '#c8c'), t, 23.6);
    entra($(r, '#c8d'), t, 23.85); entra($(r, '#c8e'), t, 24.05);
  } },
]};
