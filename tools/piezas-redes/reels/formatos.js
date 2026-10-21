// Formatos de video distintos de la "presentación de producto". Pedido del
// fundador del 21/10/2026: que no salgan todos iguales (mismo estilo y misma
// música), para probar qué se pega y qué no en cada red.
//
// Cada video es un HTML chico que define window.RED ({ url, ig? }) y
// window.GUION, y carga en este orden: publicidad.css, formatos.css, este
// archivo y publicidad-comun.js. Acá se arma window.PUBLI (escenas, duración,
// cierre, efectos de sonido y golpes para la música) a partir del guion: un
// video nuevo es solo datos. hacer-video.py lo renderiza con música y efectos.
//
// Formatos (catálogo y rotación: tools/contenido/conocimiento/variedad.json):
//   chat   una conversación que cuenta una historia (POV), con cortes y remate
//   quiz   adiviná el precio: opciones, cuenta regresiva y revelación
//   lista  cortes secos de color con números gigantes
//   nota   notas del celular que se escriben solas y se tildan
// Todos terminan con la pregunta para comentarios (si hay) y el cierre con el logo.
// En el texto, *así* resalta una parte con el color de acento.
//
// Campos del guion (window.GUION):
//   comunes  formato, pregunta (texto o lista de líneas), chip (botón debajo de
//            la pregunta), cierre { a, b, pie }
//   chat     titulo (va arriba todo el video, ej. "POV: …"), contacto, estado,
//            mensajes [{ de: 'yo'|'el'|'sistema', texto, hora?, pausa?, escribe? }
//            o { corte: '3 días después…' }], remate (líneas; *línea* en verde)
//   quiz     titulo, subtitulo, zona, rondas [{ pregunta, icono?, opciones[3],
//            correcta (0, 1 o 2), dato, fuente?, segundos? }]. Precios solo de
//            precios_referencia; las otras opciones son distractores.
//   lista    titulo (líneas), items [{ texto, detalle?, duracion? }], remate (líneas)
//   nota     app, fecha, titulo, lineas (hasta 6, de 34 letras o menos),
//            tildar (true las tilda al final), remate (*parte* resaltada), sello?
//            (sello de latón que entra al principio, ej. "Guardalo"), velocidad?
// Íconos disponibles: los de publicidad-comun.js (huella, volante, nota, torta,
// camara, cubiertos, calendario, chat, presupuesto, plata, celular, etc.).
(function () {
  const G = window.GUION;
  if (!G || !G.formato) throw new Error('Falta window.GUION.formato');
  const RED = window.RED || { url: 'trattoapp.com.ar' };
  const $ = (r, s) => r.querySelector(s), $$ = (r, s) => [...r.querySelectorAll(s)];
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const marca = (s, tag = 'span class="resalta"') => esc(s).replace(/\*([^*]+)\*/g, `<${tag}>$1</${tag.split(' ')[0]}>`);
  const sinMarca = s => String(s).replace(/\*/g, '');
  const escenas = [], efectos = [], golpes = [];
  const fx = (efecto, t, db = -15) => efectos.push({ efecto, t: Math.round(t * 100) / 100, db });
  const lectura = s => Math.min(2.6, Math.max(1.0, .55 + sinMarca(s).length * .045));
  const pop = (el, t, t0, d = .3) => { const q = U.P(t, t0, t0 + d); el.style.opacity = q > 0 ? 1 : 0; el.style.transform = `scale(${.6 + .4 * U.back(q)})`; return q; };
  const golpe = (el, t, t0, d = .22, desde = 1.35) => { const q = U.P(t, t0, t0 + d); el.style.opacity = q > 0 ? 1 : 0; el.style.transform = `scale(${desde - (desde - 1) * U.eo(q)})`; return q; };
  const fondo = () => document.getElementById('fondo');

  // ---------- chat ----------
  function chat() {
    const filas = [], tiempos = [], cortes = [];
    let t = .12;
    (G.mensajes || []).forEach((m, i) => {
      if (m.corte) { cortes.push({ texto: m.corte, a: t }); fx('latigazo', t, -16); t += 1.35; return; }
      const hora = m.hora ? `<span class="hora">${esc(m.hora)}${m.de === 'yo' ? ' ✓✓' : ''}</span>` : '';
      if (m.de === 'el') {
        const escribe = t; t += m.escribe ?? .8;
        filas.push(`<div class="msj el escribe" id="e${i}"><div class="puntos"><i></i><i></i><i></i></div></div>`);
        filas.push(`<div class="msj el" id="m${i}">${esc(m.texto)}${hora}</div>`);
        tiempos.push({ i, t0: t, escribe }); fx('recibido', t, -15);
      } else if (m.de === 'sistema') {
        filas.push(`<div class="msj sis" id="m${i}">${esc(m.texto)}</div>`);
        tiempos.push({ i, t0: t }); fx('tic', t, -18);
      } else {
        filas.push(`<div class="msj yo" id="m${i}">${esc(m.texto)}${hora}</div>`);
        tiempos.push({ i, t0: t }); fx('enviado', t, -16);
      }
      // En un chat se lee rápido: menos pausa que en los textos grandes
      t += m.pausa ?? Math.min(2.0, Math.max(.8, .4 + sinMarca(m.texto).length * .03));
    });
    const fin = t;
    escenas.push({ a: 0, b: fin + .7, html: () => `
      <div class="f-titulo" id="ct"><span>${esc(G.titulo)}</span></div>
      <div class="chat-cab"><span class="av">${esc((G.contacto || '?').trim()[0])}</span>
        <div><div class="nom">${esc(G.contacto || 'Contacto')}</div><div class="est" id="ce">${esc(G.estado || 'en línea')}</div></div></div>
      <div class="chat-zona">${filas.join('')}</div>`,
      animar(tt, r) {
        let escribiendo = false;
        tiempos.forEach(({ i, t0, escribe }) => {
          const m = $(r, '#m' + i);
          if (escribe !== undefined) {
            const e = $(r, '#e' + i), activo = tt >= escribe && tt < t0;
            e.style.display = activo ? 'block' : 'none';
            if (activo) {
              escribiendo = true;
              $$(e, 'i').forEach((p, k) => { p.style.opacity = .35 + .65 * Math.max(0, Math.sin(tt * 9 - k * .9)); });
            }
          }
          if (tt < t0) { m.style.display = 'none'; return; }
          m.style.display = 'block';
          const q = U.P(tt, t0, t0 + .28);
          m.style.opacity = q; m.style.transform = `scale(${.7 + .3 * U.back(q)})`;
        });
        $(r, '#ce').textContent = escribiendo ? 'escribiendo…' : (G.estado || 'en línea');
        // Movimiento desde el primer cuadro: el título entra con un golpe, la
        // conversación se acerca de a poco y da un empujón con cada mensaje.
        golpe($(r, '#ct'), tt, 0, .25, 1.18);
        const ultimo = Math.max(-9, ...tiempos.map(x => x.t0).filter(x => x <= tt));
        const empujon = .022 * Math.exp(-(tt - ultimo) * 7), acerca = .045 * U.cl(tt / fin);
        for (const id of ['.chat-cab', '.chat-zona']) $(r, id).style.transform = `scale(${1 + acerca + empujon})`;
      } });
    cortes.forEach((c, k) => escenas.push({ a: c.a, b: c.a + 1.35, html: () => `<div class="corte" id="k${k}">${marca(c.texto)}</div>`,
      animar(tt, r) { $(r, '#k' + k).style.opacity = U.P(tt, c.a, c.a + .18) * (1 - U.P(tt, c.a + 1.15, c.a + 1.35)); } }));
    const lineas = G.remate || [];
    if (!lineas.length) return fin;
    fx('latigazo', fin, -16); fx('pop', fin + .35, -15);
    lineas.forEach((_, k) => fx('pop', fin + .6 + k * .3, -18));
    escenas.push({ a: fin, b: fin + 3.2, html: () => `<div class="remate" id="rm"><div class="icono-app" id="ri">${LOGO(120, 'gr')}</div>${
      lineas.map((l, k) => `<div class="lin${/^\*.*\*$/.test(l) ? ' acento' : ''}" id="rl${k}">${esc(sinMarca(l))}</div>`).join('')}</div>`,
      animar(tt, r) {
        const el = $(r, '#rm'), q = U.eo(U.P(tt, fin, fin + .5));
        el.style.opacity = 1; el.style.transform = `translateY(${(1 - q) * 1300}px)`;
        pop($(r, '#ri'), tt, fin + .35);
        lineas.forEach((_, k) => entra($(r, '#rl' + k), tt, fin + .6 + k * .3));
        sale(el, tt, fin + 2.95, .25);
      } });
    return fin + 3.2;
  }

  // ---------- quiz ----------
  function quiz() {
    const LET = ['A', 'B', 'C', 'D'], rondas = G.rondas || [];
    fx('sello', .45, -11);
    escenas.push({ a: 0, b: 1.75, html: () => `<div class="q-intro"><div class="t-xl" id="qi1">${esc(G.titulo || '¿Cuánto sale?')}</div>
      <div><span class="sello" id="qi2">${esc(G.subtitulo || 'Adiviná el precio')}</span></div></div>`,
      animar(t, r) {
        golpe($(r, '#qi1'), t, 0, .2);
        const s = $(r, '#qi2'), q = U.P(t, .45, .75);
        s.style.opacity = q > 0 ? 1 : 0; s.style.transform = `scale(${1.6 - .6 * U.back(q)}) rotate(${-6 * (1 - q) - 2}deg)`;
        sale($(r, '#qi1'), t, 1.42); sale($(r, '#qi2'), t, 1.44);
      } });
    let t = 1.65;
    rondas.forEach((ro, n) => {
      const t0 = t, seg = ro.segundos ?? 4, tOp = k => t0 + .7 + k * .3;
      const tc = tOp(ro.opciones.length) + .1, tr = tc + seg, fin = tr + 2.1;
      fx('latigazo', t0, -16);
      ro.opciones.forEach((_, k) => fx('pop', tOp(k), -15));
      for (let s = 0; s < seg; s++) fx('tic', tc + s, -12);
      fx('acierto', tr, -12); golpes.push(Math.round(tr * 100) / 100);
      escenas.push({ a: t0, b: fin, html: () => `
        <div class="q-cab" id="qc${n}">${rondas.length > 1 ? `Ronda ${n + 1} de ${rondas.length} · ` : ''}${esc(G.zona || 'AMBA')}</div>
        <div class="q-preg" id="qp${n}">${ro.icono ? `<span class="ic">${icono(ro.icono, 96)}</span>` : ''}<span>${esc(ro.pregunta)}</span></div>
        ${ro.opciones.map((o, k) => `<div class="q-op" id="qo${n}-${k}" style="top:${650 + k * 180}px"><span class="le">${LET[k]}</span><span>${esc(o)}</span>
          <span class="marca" id="qm${n}-${k}">${icono(k === ro.correcta ? 'check' : 'cruz', 80, k === ro.correcta ? '#1E5D49' : '#C2452A')}</span></div>`).join('')}
        <div class="q-reloj" id="qr${n}"><svg viewBox="0 0 180 180"><circle cx="90" cy="90" r="80" fill="none" stroke="rgba(252,251,248,.18)" stroke-width="12"/>
          <circle id="qa${n}" cx="90" cy="90" r="80" fill="none" stroke="#C9A227" stroke-width="12" stroke-linecap="round" stroke-dasharray="502.65" transform="rotate(-90 90 90)"/></svg><b id="qn${n}">${seg}</b></div>
        <div class="q-dato" id="qd${n}"><span><small>${esc(ro.fuente || 'Precio de referencia')}</small>${esc(ro.dato)}</span></div>`,
        animar(tt, r) {
          entra($(r, '#qc' + n), tt, t0, .4, { y: 20 });
          entra($(r, '#qp' + n), tt, t0 + .1, .45);
          const rev = U.P(tt, tr, tr + .3);
          ro.opciones.forEach((_, k) => {
            const el = $(r, `#qo${n}-${k}`), q = U.eo(U.P(tt, tOp(k), tOp(k) + .35)), ok = k === ro.correcta;
            el.classList.toggle('bien', ok && rev > 0);
            el.style.opacity = ok ? q : q * (1 - .55 * rev);
            el.style.transform = `translateX(${(1 - q) * -140}px) scale(${ok ? 1 + .05 * Math.sin(Math.PI * rev) : 1})`;
            const mk = $(r, `#qm${n}-${k}`);
            mk.style.opacity = rev; mk.style.transform = `scale(${.5 + .5 * U.back(rev)})`;
          });
          const resto = U.cl(tr - tt, 0, seg);
          $(r, '#qr' + n).style.opacity = U.P(tt, tc - .3, tc) * (1 - U.P(tt, tr, tr + .2));
          $(r, '#qa' + n).style.strokeDashoffset = 502.65 * (1 - resto / seg);
          $(r, '#qn' + n).textContent = Math.max(1, Math.ceil(resto));
          const d = $(r, '#qd' + n), qd = U.P(tt, tr + .3, tr + .6);
          d.style.opacity = qd > 0 ? 1 : 0; d.style.transform = `translateY(${(1 - U.eo(qd)) * 30}px)`;
          [...['#qc', '#qp', '#qd', '#qr'].map(id => $(r, id + n)), ...ro.opciones.map((_, k) => $(r, `#qo${n}-${k}`))]
            .forEach(el => sale(el, tt, fin - .3, .28));
        } });
      t = fin;
    });
    return t;
  }

  // ---------- lista ----------
  function lista() {
    // [fondo, texto, número] por ítem: cada corte cambia de color
    const COLORES = [['#2B7E62', '#FCFBF8', '#C9A227'], ['#C9A227', '#0E1815', '#0E1815'], ['#F3F6F2', '#0E1815', '#2B7E62'],
      ['#1E5D49', '#FCFBF8', '#8FD9BC'], ['#0E1815', '#FCFBF8', '#C9A227']];
    const bloque = (lineas, t0, color) => {
      lineas.forEach((_, k) => fx('sello', t0 + .05 + k * .32, -13));
      const d = Math.max(1.8, .05 + lineas.length * .32 + 1.1);
      escenas.push({ a: t0, b: t0 + d, html: () => lineas.map((l, k) => `<div class="l-tit" id="lt${t0}-${k}" style="top:${560 + k * 140}px${/^\*.*\*$/.test(l) ? ';color:#C9A227' : ''}">${esc(sinMarca(l))}</div>`).join(''),
        animar(tt, r) {
          if (tt >= t0) fondo().style.background = color;
          lineas.forEach((_, k) => golpe(r.querySelector(`[id="lt${t0}-${k}"]`), tt, t0 + .05 + k * .32));
        } });
      return t0 + d;
    };
    let t = bloque(G.titulo || [], 0, '#0E1815');
    const items = G.items || [];
    items.forEach((it, n) => {
      const t0 = t, d = it.duracion ?? Math.max(1.9, lectura(it.texto + ' ' + (it.detalle || '')) + .5);
      const [bg, fg, nc] = COLORES[n % COLORES.length];
      fx('sello', t0, -12); if (it.detalle) fx('pop', t0 + .45, -17);
      escenas.push({ a: t0, b: t0 + d, html: () => `
        <div class="l-cont" id="lc${n}" style="color:${fg}">${n + 1}/${items.length}</div>
        <div class="l-num" id="ln${n}" style="color:${nc}">${n + 1}</div>
        <div class="l-txt" id="lx${n}" style="color:${fg}">${esc(it.texto)}</div>
        ${it.detalle ? `<div class="l-det" id="ld${n}" style="color:${fg}">${esc(it.detalle)}</div>` : ''}`,
        animar(tt, r) {
          if (tt >= t0) fondo().style.background = bg;
          golpe($(r, '#ln' + n), tt, t0, .2, 1.6);
          golpe($(r, '#lx' + n), tt, t0 + .12, .2, 1.25);
          $(r, '#lc' + n).style.opacity = tt >= t0 ? .65 : 0;
          if (it.detalle) entra($(r, '#ld' + n), tt, t0 + .45, .35, { y: 24, blur: 0 });
        } });
      t += d;
    });
    if (G.remate) t = bloque([].concat(G.remate), t, '#0E1815');
    return t;
  }

  // ---------- nota ----------
  function nota() {
    const lineas = G.lineas || [], vel = G.velocidad || 28, titulo = String(G.titulo), tTit = Math.min(.7, titulo.length / 45);
    let t = tTit + .2;
    const tiempos = lineas.map(l => { const a = t, d = l.length / vel; t += d + .35; return [a, a + d]; });
    const finEscritura = t;
    const tildes = G.tildar ? lineas.map((_, k) => finEscritura + .1 + k * .32) : [];
    let fin = G.tildar ? finEscritura + .2 + lineas.length * .32 + .25 : finEscritura;
    tiempos.forEach(([a, b]) => { for (let s = a; s < b - .2; s += 2) fx('tecleo', s, -20); });
    tildes.forEach(c => fx('tic', c, -13));
    const tRem = fin;
    if (G.remate) { fx('pop', tRem, -14); fin += 2.6; }
    fx('tecleo', 0, -19); if (G.sello) fx('sello', .3, -10);
    escenas.push({ a: 0, b: fin, html: () => `<div class="n-hoja" id="nh">
      <div class="n-barra"><span>‹ <b>${esc(G.app || 'Notas')}</b></span><span style="display:flex">${icono('lista', 52, '#A07F12')}</span></div>
      <div class="n-fecha">${esc(G.fecha || '')}</div>
      ${G.sello ? `<div class="n-sello" id="ns"><span class="sello">${esc(G.sello)}</span></div>` : ''}
      <div class="n-tit"><mark id="nm">${esc(G.titulo)}</mark></div>
      <div class="n-lineas">${lineas.map((l, k) => `<div class="n-lin" id="nl${k}">${G.tildar ? `<span class="n-caja" id="nc${k}">${icono('check', 40, '#FBF7EC').replace('<circle cx="32" cy="32" r="22"/>', '')}</span>` : ''}<span id="nx${k}"></span></div>`).join('')}</div>
      ${G.remate ? `<div class="n-remate" id="nr">${marca(G.remate, 'b')}</div>` : ''}</div>`,
      animar(tt, r) {
        // El título se escribe solo en el primer segundo y después se subraya
        const m = $(r, '#nm'), nt = Math.ceil(U.cl(tt / tTit) * titulo.length);
        m.textContent = titulo.slice(0, Math.max(1, nt));
        m.style.backgroundSize = `${U.eo(U.P(tt, tTit, tTit + .45)) * 100}% 100%`;
        // La hoja se acerca de a poco y da un empujón con cada línea y cada tilde
        const marcas = [...tiempos.map(x => x[0]), ...tildes, ...(G.remate ? [tRem] : [])].filter(x => x <= tt);
        const ultimo = marcas.length ? Math.max(...marcas) : -9;
        if (G.sello) {
          const se = $(r, '#ns'), q = U.P(tt, .3, .6);
          se.style.opacity = q > 0 ? 1 : 0; se.style.transform = `scale(${1.8 - .8 * U.back(q)}) rotate(${-8 * (1 - q) - 5}deg)`;
        }
        $(r, '#nh').style.transform = `scale(${1 + .06 * U.cl(tt / fin) + .02 * Math.exp(-(tt - ultimo) * 7)})`;
        lineas.forEach((l, k) => {
          const [a, b] = tiempos[k], hasta = (tiempos[k + 1] || [finEscritura])[0];
          $(r, '#nl' + k).style.visibility = tt >= a ? 'visible' : 'hidden';
          const n = Math.floor(U.cl((tt - a) / (b - a)) * l.length);
          const cursor = tt >= a && tt < hasta && (tt < b || Math.floor(tt * 3) % 2 === 0);
          $(r, '#nx' + k).innerHTML = esc(l.slice(0, n)) + (cursor ? '<span class="n-cursor"></span>' : '');
          if (G.tildar) {
            const c = $(r, '#nc' + k), on = tt >= tildes[k];
            c.classList.toggle('ok', on);
            c.style.transform = on ? `scale(${1 + .25 * Math.sin(Math.PI * U.P(tt, tildes[k], tildes[k] + .25))})` : 'none';
          }
        });
        if (G.remate) {
          const el = $(r, '#nr'), q = U.P(tt, tRem, tRem + .35);
          el.style.opacity = q > 0 ? 1 : 0; el.style.transform = `translateY(${(1 - U.back(q)) * 60}px)`;
        }
      } });
    return fin;
  }

  const FORMATOS = { chat, quiz, lista, nota };
  if (!FORMATOS[G.formato]) throw new Error('Formato desconocido: ' + G.formato);
  let t = FORMATOS[G.formato]();

  // Pregunta para comentarios
  if (G.pregunta) {
    const tp = t, lin = [].concat(G.pregunta), d = 2.5, chipTop = 640 + lin.length * 110 + 40;
    fx('latigazo', tp, -16); if (G.chip) fx('pop', tp + .8, -15);
    escenas.push({ a: tp, b: tp + d, html: () => lin.map((l, k) => `<div class="f-preg" id="fp${k}" style="top:${620 + k * 110}px">${marca(l)}</div>`).join('') +
      (G.chip ? `<div class="abs centro" style="top:${chipTop}px" id="fpc"><span class="chip" style="font-size:44px">${esc(G.chip)}</span></div>` : ''),
      animar(tt, r) {
        if (G.formato === 'lista' && tt >= tp) fondo().style.background = '#0E1815';
        lin.forEach((_, k) => entra($(r, '#fp' + k), tt, tp + .08 + k * .14));
        if (G.chip) pop($(r, '#fpc'), tt, tp + .8);
        [...$$(r, '.f-preg'), ...(G.chip ? [$(r, '#fpc')] : [])].forEach(el => sale(el, tt, tp + d - .3));
      } });
    t += d;
  }

  // Cierre: el mismo de siempre (la marca quieta al final ayuda a recordarla)
  const c = t, dc = 2.7, C = G.cierre || {}, ES_IG = !!RED.ig;
  fx('latigazo', c, -16); fx('pop', c + .35, -15);
  escenas.push({ a: c, b: c + dc + .1, html: () => `
    <div class="cierre">
      <div class="icono-app" id="z1">${LOGO(190, 'gz')}</div>
      <div class="t-m" style="margin-top:70px;color:#FCFBF8" id="z2">${esc(C.a || 'Pedí y compará')}</div>
      <div class="t-l" style="margin-top:6px;color:#8FD9BC" id="z3">${esc(C.b || 'presupuestos de tu zona.')}</div>
      <div class="url" style="margin-top:44px;font-size:44px" id="z4">${esc(RED.url)}</div>
      ${ES_IG ? `<div class="mono" style="margin-top:34px;color:#FCFBF8;font-size:32px;text-transform:none;letter-spacing:.02em" id="z5">Tocá @trattoapp_ → «${esc(RED.ig)}»</div>` : ''}
      <div class="mono" style="margin-top:${ES_IG ? 30 : 50}px;color:#C9A227;font-size:32px" id="z6">${esc(C.pie || '46 rubros · gratis')}</div>
    </div>`,
    animar(tt, r) {
      const i = $(r, '#z1'), q = U.P(tt, c + .35, c + .8);
      i.style.opacity = q > 0 ? 1 : 0; i.style.transform = `scale(${.4 + .6 * U.back(q)})`;
      ['#z2', '#z3', '#z4', '#z5', '#z6'].forEach((id, k) => { const el = $(r, id); if (el) entra(el, tt, c + .75 + k * .2); });
    } });

  window.PUBLI = { tema: G.formato, cierre: c, duracion: Math.round((c + dc) * 100) / 100, url: [RED.url, 1.0], escenas, efectos, golpes };
})();
