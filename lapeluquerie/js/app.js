/* ============================================================
   LAPELUQUERIE — comportamiento
   Sin dependencias. Todo el contenido sale de datos.js.
   ============================================================ */
import {
  NEGOCIO, SERVICIOS, CATEGORIAS, GALERIA, TRANSFORMACIONES,
  DIAGNOSTICO, EQUIPO, RESENAS, FAQ, EXPERIENCIA, PILARES, TICKER
} from './datos.js';

const $  = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => [...c.querySelectorAll(s)];
const servicioPorId = id => SERVICIOS.find(s => s.id === id);

/* Fotos que existen en dos anchos reales (640 y 1100 px). Los recortes del
   collage sólo existen a 520 px, así que no se les inventa un srcset. */
const DOS_ANCHOS = new Set(['bronde', 'caoba', 'castano']);
const srcset = (base, sizes) => DOS_ANCHOS.has(base)
  ? ` srcset="assets/${base}-640.webp 640w, assets/${base}.webp 1100w" sizes="${sizes}"`
  : '';
const menosMovimiento = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ── Iconos ─────────────────────────────────────────────── */
const ICO = {
  wa:'<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.9 9.9 0 0 0 4.79 1.22h.01c5.46 0 9.9-4.45 9.9-9.91C21.95 6.45 17.5 2 12.04 2Zm5.8 14.16c-.25.69-1.44 1.32-1.99 1.36-.53.05-1.02.23-3.44-.72-2.9-1.14-4.74-4.1-4.88-4.29-.14-.19-1.16-1.55-1.16-2.95 0-1.4.73-2.09 1-2.38.26-.29.57-.36.76-.36.19 0 .38 0 .55.01.18.01.41-.07.65.49.24.58.81 2 .88 2.14.07.14.12.31.02.5-.09.19-.14.31-.28.48-.14.17-.29.37-.42.5-.14.14-.28.29-.12.57.16.29.72 1.18 1.54 1.91 1.06.94 1.95 1.23 2.23 1.37.28.14.44.12.6-.07.17-.19.69-.8.87-1.08.19-.29.37-.24.62-.14.25.09 1.6.75 1.87.89.28.14.46.21.53.33.07.11.07.67-.18 1.36Z"/></svg>',
  flecha:'<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><path d="M2 8h11M9 4l4 4-4 4"/></svg>',
  cerrar:'<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><path d="M2 2l12 12M14 2L2 14"/></svg>',
  prev:'<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><path d="M14 8H3M7 4L3 8l4 4"/></svg>',
  next:'<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><path d="M2 8h11M9 4l4 4-4 4"/></svg>',
  arrastrar:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M9 6 4 12l5 6M15 6l5 6-5 6"/></svg>',
  estrella:'<svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path d="M10 1.5l2.47 5.3 5.53.66-4.1 3.9 1.09 5.64L10 14.3l-4.99 2.7 1.09-5.64-4.1-3.9 5.53-.66L10 1.5Z"/></svg>'
};
/* Sin puntaje real no se dibujan estrellas: no inventamos valoraciones. */
const estrellas = n => Number.isFinite(n)
  ? `<span class="estrellas" role="img" aria-label="${n} de 5 estrellas">${ICO.estrella.repeat(n)}</span>`
  : '';

/* ════════════════════════════════════════════════════════
   RESERVAS — única puerta de salida a la conversión.
   Cambiar de WhatsApp a Fresha/Calendly se hace en datos.js.
   ════════════════════════════════════════════════════════ */
const MENSAJES = {
  general:  () => `Hola! Quisiera reservar un turno en ${NEGOCIO.nombre}.`,
  servicio: s  => `Hola! Quisiera consultar disponibilidad para ${s.nombre.toLowerCase()}.`,
  galeria:  g  => `Hola! Vi "${g.titulo}" en la web y quisiera consultar por un resultado similar.`,
  transformacion: t => `Hola! Vi la transformación "${t.titulo}" en la web y quisiera consultar por un turno.`,
  equipo:   p  => `Hola! Quisiera reservar un turno con ${p.nombre}.`,
  eventos:  () => `Hola! Quisiera consultar disponibilidad para un peinado de evento.`,
  diagnostico: r =>
    `Hola! Hice el diagnóstico en la web y me recomendó ${r.reco.map(s => s.nombre.toLowerCase()).join(' + ')}.\n\n` +
    r.respuestas.map(x => `· ${x.pregunta} ${x.respuesta}`).join('\n') +
    `\n\nQuisiera consultar disponibilidad.`
};

function urlReserva(mensaje) {
  const { reservas, whatsapp, instagramUsuario } = NEGOCIO;
  if (reservas.proveedor === 'url' && reservas.url) return reservas.url;
  if (whatsapp) return `https://wa.me/${whatsapp}?text=${encodeURIComponent(mensaje)}`;
  return `https://ig.me/m/${instagramUsuario}`;   // fallback real mientras no haya número
}

function reservar(tipo = 'general', dato = null) {
  const mensaje = (MENSAJES[tipo] || MENSAJES.general)(dato);
  window.open(urlReserva(mensaje), '_blank', 'noopener,noreferrer');
}

/* Cualquier elemento con data-reservar dispara una reserva. */
document.addEventListener('click', e => {
  const el = e.target.closest('[data-reservar]');
  if (!el) return;
  e.preventDefault();
  const tipo = el.dataset.reservar || 'general';
  const id   = el.dataset.ref;
  const dato =
    tipo === 'servicio'       ? servicioPorId(id) :
    tipo === 'galeria'        ? GALERIA.find(g => g.id === id) :
    tipo === 'transformacion' ? TRANSFORMACIONES.find(t => t.id === id) :
    tipo === 'equipo'         ? EQUIPO[Number(id)] : null;
  reservar(tipo, dato);
});

/* ════════════════════════════════════════════════════════
   NAVEGACIÓN
   ════════════════════════════════════════════════════════ */
function iniciarNav() {
  const nav    = $('.nav');
  const boton  = $('.hamburguesa');
  const panel  = $('#menu-movil');
  const sticky = $('.sticky');
  const hero   = $('.hero');
  let ultimoY = 0;

  const alScrollear = () => {
    const y = window.scrollY;
    nav.classList.toggle('fija', y > 40);
    nav.classList.toggle('oculta', y > 460 && y > ultimoY && !panel.classList.contains('abierto'));
    if (sticky) sticky.classList.toggle('visible', y > (hero?.offsetHeight || 600) * 0.6);
    ultimoY = y;
  };
  alScrollear();
  addEventListener('scroll', alScrollear, { passive: true });

  const cerrarPanel = () => {
    panel.classList.remove('abierto');
    boton.setAttribute('aria-expanded', 'false');
    document.body.classList.remove('bloqueado');
  };
  boton.addEventListener('click', () => {
    const abierto = panel.classList.toggle('abierto');
    boton.setAttribute('aria-expanded', String(abierto));
    document.body.classList.toggle('bloqueado', abierto);
    if (abierto) panel.querySelector('a')?.focus();
  });
  panel.addEventListener('click', e => { if (e.target.closest('a,button')) cerrarPanel(); });
  addEventListener('keydown', e => {
    if (e.key === 'Escape' && panel.classList.contains('abierto')) { cerrarPanel(); boton.focus(); }
  });

  /* Sección activa en el menú */
  const enlaces = $$('.nav__link');
  const secciones = enlaces
    .map(a => document.getElementById(a.getAttribute('href').slice(1)))
    .filter(Boolean);
  if (secciones.length) {
    const obs = new IntersectionObserver(entradas => {
      entradas.forEach(en => {
        if (!en.isIntersecting) return;
        enlaces.forEach(a =>
          a.setAttribute('aria-current', String(a.getAttribute('href') === `#${en.target.id}`)));
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    secciones.forEach(s => obs.observe(s));
  }
}

/* ════════════════════════════════════════════════════════
   REVEAL + PARALLAX
   ════════════════════════════════════════════════════════ */
function iniciarMovimiento() {
  const obs = new IntersectionObserver((entradas, o) => {
    entradas.forEach(en => {
      if (!en.isIntersecting) return;
      en.target.classList.add('visible');
      o.unobserve(en.target);
    });
  }, { rootMargin: '0px 0px -12% 0px', threshold: 0.08 });
  $$('.rv').forEach(el => obs.observe(el));

  const foto = $('.hero__foto img');
  if (!foto || menosMovimiento()) return;
  let ticking = false;
  addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      const y = Math.min(window.scrollY, 900);
      foto.style.transform = `translate3d(0, ${y * 0.14}px, 0) scale(1.08)`;
      ticking = false;
    });
  }, { passive: true });
}

/* ════════════════════════════════════════════════════════
   TICKER
   ════════════════════════════════════════════════════════ */
function iniciarTicker() {
  const pista = $('.ticker__pista');
  if (!pista) return;
  const grupo = TICKER.map(t => `<span>${t}</span><i></i>`).join('');
  pista.innerHTML = `<div class="ticker__grupo" aria-hidden="false">${grupo}</div>` +
                    `<div class="ticker__grupo" aria-hidden="true">${grupo}</div>`;
}

/* ════════════════════════════════════════════════════════
   PILARES + EXPERIENCIA
   ════════════════════════════════════════════════════════ */
function iniciarTextos() {
  $('.pilares').innerHTML = PILARES.map((p, i) => `
    <article class="pilar rv rv-d${i}">
      <span class="pilar__n">0${i + 1}</span>
      <h3 class="h4">${p.t}</h3>
      <p>${p.d}</p>
    </article>`).join('');

  $('.exp__pasos').innerHTML = EXPERIENCIA.map((p, i) => `
    <article class="paso rv">
      <span class="paso__n">0${i + 1}</span>
      <div class="paso__txt">
        <h3 class="h4">${p.t}</h3>
        <p>${p.d}</p>
      </div>
    </article>`).join('');
}

/* ════════════════════════════════════════════════════════
   SERVICIOS (acordeón)
   ════════════════════════════════════════════════════════ */
function iniciarServicios() {
  const cont = $('.servicios__lista');
  cont.innerHTML = SERVICIOS.map((s, i) => {
    const datos = [
      s.duracion ? `<span class="pastilla">${s.duracion}</span>` : '',
      s.precio   ? `<span class="pastilla">${s.precio}</span>`   : '',
      ...s.etiquetas.map(e => `<span class="pastilla">${e}</span>`)
    ].join('');
    return `
    <article class="serv rv" data-serv="${s.id}">
      <h3>
        <button class="serv__cab" type="button" aria-expanded="false" aria-controls="p-${s.id}">
          <span class="serv__n">${String(i + 1).padStart(2, '0')}</span>
          <span class="serv__nombre">${s.nombre}</span>
          <span class="serv__resumen">${s.resumen}</span>
          <span class="serv__mas" aria-hidden="true"></span>
        </button>
      </h3>
      <div class="serv__panel" id="p-${s.id}">
        <div>
          <div class="serv__cuerpo">
            <div class="serv__texto">
              <p>${s.texto}</p>
              <div class="serv__datos">${datos}</div>
              ${s.precio ? '' : `<p class="serv__nota plomo">Los valores dependen del largo y
                del punto de partida de tu pelo: te los pasamos por WhatsApp antes de reservar.</p>`}
              <button class="btn btn--fantasma" type="button"
                      data-reservar="servicio" data-ref="${s.id}">
                Consultar por ${s.nombre.toLowerCase()} ${ICO.wa}
              </button>
            </div>
            <figure class="serv__media">
              <img src="assets/${s.img}-640.webp"${srcset(s.img, '(min-width:900px) 40vw, 92vw')}
                   alt="${s.alt}" loading="lazy" decoding="async" width="640" height="400">
            </figure>
          </div>
        </div>
      </div>
    </article>`;
  }).join('');

  cont.addEventListener('click', e => {
    const btn = e.target.closest('.serv__cab');
    if (!btn) return;
    const item = btn.closest('.serv');
    const abrir = !item.classList.contains('abierto');
    $$('.serv', cont).forEach(o => {
      o.classList.remove('abierto');
      $('.serv__cab', o).setAttribute('aria-expanded', 'false');
    });
    if (abrir) {
      item.classList.add('abierto');
      btn.setAttribute('aria-expanded', 'true');
    }
  });
}

/* ════════════════════════════════════════════════════════
   DIAGNÓSTICO EXPRESS
   ════════════════════════════════════════════════════════ */
function iniciarDiagnostico() {
  const caja    = $('.diag__caja');
  const avance  = $('.diag__avance', caja);
  const paso    = $('.diag__paso', caja);
  const preg    = $('.diag__pregunta', caja);
  const result  = $('.diag__result', caja);
  const volver  = $('.diag__volver', caja);
  const total   = DIAGNOSTICO.length;
  let indice = 0;
  const respuestas = [];

  const pintar = () => {
    const p = DIAGNOSTICO[indice];
    paso.textContent = `${String(indice + 1).padStart(2, '0')} / ${String(total).padStart(2, '0')}`;
    avance.style.transform = `scaleX(${indice / total})`;
    volver.hidden = indice === 0;
    preg.innerHTML = `
      <h3 id="diag-pregunta">${p.pregunta}</h3>
      <div class="diag__ops" role="group" aria-labelledby="diag-pregunta">
        ${p.opciones.map((o, i) => `
          <button class="diag__op" type="button" data-i="${i}" aria-pressed="false">
            <span class="marca-op" aria-hidden="true">${String.fromCharCode(65 + i)}</span>
            <span>${o.txt}</span>
          </button>`).join('')}
      </div>`;
    preg.hidden = false;
    result.hidden = true;
  };

  const calcular = () => {
    const puntos = {};
    respuestas.forEach(r => {
      Object.entries(r.puntos).forEach(([id, n]) => { puntos[id] = (puntos[id] || 0) + n; });
    });
    const reco = Object.entries(puntos)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2)
      .map(([id]) => servicioPorId(id))
      .filter(Boolean);
    return reco.length ? reco : [servicioPorId('balayage')];
  };

  const mostrarResultado = () => {
    const reco = calcular();
    const payload = {
      reco,
      respuestas: respuestas.map(r => ({ pregunta: r.pregunta, respuesta: r.txt }))
    };
    avance.style.transform = 'scaleX(1)';
    paso.textContent = 'Listo';
    preg.hidden = true;
    volver.hidden = false;
    result.hidden = false;
    result.innerHTML = `
      <p class="eyebrow">Según lo que nos contaste</p>
      <h3 class="diag__titulo">Empezaríamos por acá</h3>
      <div class="diag__reco">
        ${reco.map((s, i) => `
          <article class="reco ${i === 0 ? 'reco--principal' : ''}">
            ${i === 0 ? '<span class="reco__tag">Recomendado</span>' : ''}
            <h4>${s.nombre}</h4>
            <p>${s.resumen}</p>
          </article>`).join('')}
      </div>
      <p class="diag__nota">Es una orientación, no un diagnóstico cerrado: el tono y la cantidad
      de sesiones se definen viendo tu pelo en el salón.</p>
      <div class="diag__acciones">
        <button class="btn btn--claro" type="button" id="diag-cta">
          Hablar con una especialista ${ICO.wa}
        </button>
        <button class="btn btn--fantasma" type="button" id="diag-reiniciar">Empezar de nuevo</button>
      </div>`;
    $('#diag-cta', result).addEventListener('click', () => reservar('diagnostico', payload));
    $('#diag-reiniciar', result).addEventListener('click', () => {
      respuestas.length = 0; indice = 0; pintar();
      caja.scrollIntoView({ behavior: menosMovimiento() ? 'auto' : 'smooth', block: 'center' });
    });
    result.focus({ preventScroll: true });
  };

  preg.addEventListener('click', e => {
    const btn = e.target.closest('.diag__op');
    if (!btn) return;
    const p = DIAGNOSTICO[indice];
    const op = p.opciones[Number(btn.dataset.i)];
    btn.setAttribute('aria-pressed', 'true');
    respuestas[indice] = { pregunta: p.pregunta, txt: op.txt, puntos: op.puntos };
    setTimeout(() => {
      indice++;
      if (indice >= total) mostrarResultado(); else pintar();
    }, menosMovimiento() ? 0 : 190);
  });

  volver.addEventListener('click', () => {
    if (!result.hidden) { indice = total - 1; pintar(); return; }
    if (indice > 0) { indice--; pintar(); }
  });

  pintar();
}

/* ════════════════════════════════════════════════════════
   GALERÍA + LIGHTBOX
   ════════════════════════════════════════════════════════ */
function iniciarGaleria() {
  const filtros = $('.filtros');
  const grid    = $('.galeria');
  let visibles  = [...GALERIA];

  filtros.innerHTML = CATEGORIAS.map((c, i) => `
    <button class="filtro" type="button" data-cat="${c.id}"
            aria-pressed="${i === 0}">${c.nombre}</button>`).join('');

  const tarjeta = g => {
    const s = servicioPorId(g.servicio);
    return `
    <figure class="gitem" data-id="${g.id}">
      <button class="gitem__btn" type="button" aria-label="Ampliar: ${g.titulo}">
        <img src="assets/${g.img}-640.webp"${srcset(g.img, '(min-width:900px) 32vw, 48vw')}
             alt="${g.titulo}" loading="lazy" decoding="async" width="640" height="800">
        <figcaption class="gitem__velo">
          <span class="gitem__serv">${s ? s.nombre : ''}</span>
          <span class="gitem__tit">${g.titulo}</span>
          <span class="gitem__cta">Quiero este look ${ICO.flecha}</span>
        </figcaption>
      </button>
    </figure>`;
  };

  const tarjetaInstagram = () => `
    <figure class="gitem gitem--ig">
      <a class="gitem__btn" href="${NEGOCIO.instagram}" target="_blank" rel="noopener noreferrer">
        <span>
          <img src="assets/marca-blanca.png" alt="" width="88" height="82"
               loading="lazy" decoding="async">
          <span class="gitem__serv">Más looks</span>
          <span class="gitem__tit">@${NEGOCIO.instagramUsuario}</span>
          <span class="gitem__cta">Ver Instagram ${ICO.flecha}</span>
        </span>
      </a>
    </figure>`;

  const pintar = () => {
    grid.innerHTML = visibles.map(tarjeta).join('') + tarjetaInstagram();
  };
  pintar();

  filtros.addEventListener('click', e => {
    const b = e.target.closest('.filtro');
    if (!b) return;
    $$('.filtro', filtros).forEach(f => f.setAttribute('aria-pressed', String(f === b)));
    const cat = b.dataset.cat;
    visibles = cat === 'todos' ? [...GALERIA] : GALERIA.filter(g => g.cats.includes(cat));
    pintar();
    $('#galeria-estado').textContent =
      `${visibles.length} ${visibles.length === 1 ? 'trabajo' : 'trabajos'} en ${b.textContent.toLowerCase()}`;
  });

  /* ---------- Lightbox ---------- */
  const lb      = $('.lb');
  const lbFoto  = $('.lb__foto img');
  const lbInfo  = $('.lb__info');
  let idx = 0, ultimoFoco = null;

  const render = () => {
    const g = visibles[idx];
    const s = servicioPorId(g.servicio);
    lbFoto.src = `assets/${g.img}.webp`;
    lbFoto.alt = g.titulo;
    lbInfo.innerHTML = `
      <p class="eyebrow">${s ? s.nombre : 'Trabajo del salón'}</p>
      <h3 id="lb-titulo">${g.titulo}</h3>
      <p>${g.texto}</p>
      <div class="lb__acciones">
        <button class="btn btn--claro" type="button" data-reservar="galeria" data-ref="${g.id}">
          Quiero este look ${ICO.wa}
        </button>
        <a class="btn btn--fantasma" href="#servicios" data-cerrar-lb>Ver el servicio</a>
      </div>
      <p class="lb__conteo">${idx + 1} de ${visibles.length}</p>`;
  };

  const abrir = i => {
    idx = i; ultimoFoco = document.activeElement;
    render();
    lb.classList.add('abierto');
    lb.setAttribute('aria-hidden', 'false');
    document.body.classList.add('bloqueado');
    $('.lb__cerrar', lb).focus();
  };
  const cerrar = () => {
    lb.classList.remove('abierto');
    lb.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('bloqueado');
    ultimoFoco?.focus();
  };
  const mover = d => { idx = (idx + d + visibles.length) % visibles.length; render(); };

  grid.addEventListener('click', e => {
    const btn = e.target.closest('.gitem__btn');
    if (!btn || btn.tagName === 'A') return;
    abrir(visibles.findIndex(g => g.id === btn.closest('.gitem').dataset.id));
  });
  $('.lb__cerrar', lb).addEventListener('click', cerrar);
  $('.lb__nav--prev', lb).addEventListener('click', () => mover(-1));
  $('.lb__nav--next', lb).addEventListener('click', () => mover(1));
  lb.addEventListener('click', e => {
    if (e.target === lb || e.target.closest('[data-cerrar-lb]')) cerrar();
  });
  addEventListener('keydown', e => {
    if (!lb.classList.contains('abierto')) return;
    if (e.key === 'Escape') cerrar();
    if (e.key === 'ArrowLeft') mover(-1);
    if (e.key === 'ArrowRight') mover(1);
    if (e.key === 'Tab') {
      const foco = $$('button, a[href]', lb).filter(el => el.offsetParent !== null);
      if (!foco.length) return;
      const primero = foco[0], ultimo = foco[foco.length - 1];
      if (e.shiftKey && document.activeElement === primero) { e.preventDefault(); ultimo.focus(); }
      else if (!e.shiftKey && document.activeElement === ultimo) { e.preventDefault(); primero.focus(); }
    }
  });
}

/* ════════════════════════════════════════════════════════
   ANTES / DESPUÉS
   ════════════════════════════════════════════════════════ */
function iniciarAntesDespues() {
  const cont = $('.ad');
  cont.innerHTML = TRANSFORMACIONES.map(t => `
    <article class="ad__item rv">
      <div class="ad__marco" style="--pos:50%">
        <div class="ad__capa">
          <img src="assets/${t.antes}.webp" alt="${t.altA}" loading="lazy" decoding="async"
               width="520" height="520">
        </div>
        <div class="ad__capa ad__capa--despues">
          <img src="assets/${t.despues}.webp" alt="${t.altD}" loading="lazy" decoding="async"
               width="520" height="520">
        </div>
        <span class="ad__etiq ad__etiq--a">Antes</span>
        <span class="ad__etiq ad__etiq--d">Después</span>
        <span class="ad__linea"></span>
        <input class="ad__rango" type="range" min="0" max="100" value="50" step="1"
               aria-label="Comparar antes y después: ${t.titulo}">
        <span class="ad__tirador" aria-hidden="true">${ICO.arrastrar}</span>
      </div>
      <div class="ad__pie">
        <h3>${t.titulo}</h3>
        <span>${t.detalle}</span>
      </div>
      <button class="btn btn--fantasma" type="button" data-reservar="transformacion" data-ref="${t.id}">
        Quiero un cambio así ${ICO.wa}
      </button>
    </article>`).join('');

  $$('.ad__marco', cont).forEach(marco => {
    const rango = $('.ad__rango', marco);
    const set = v => marco.style.setProperty('--pos', `${v}%`);
    rango.addEventListener('input', () => set(rango.value));

    const desde = e => {
      const r = marco.getBoundingClientRect();
      const x = (e.touches ? e.touches[0].clientX : e.clientX) - r.left;
      const v = Math.max(0, Math.min(100, (x / r.width) * 100));
      rango.value = v; set(v);
    };
    let arrastrando = false;
    marco.addEventListener('pointerdown', e => {
      arrastrando = true; marco.setPointerCapture(e.pointerId); desde(e);
    });
    marco.addEventListener('pointermove', e => { if (arrastrando) desde(e); });
    marco.addEventListener('pointerup', e => {
      arrastrando = false;
      if (marco.hasPointerCapture(e.pointerId)) marco.releasePointerCapture(e.pointerId);
    });
    marco.addEventListener('pointercancel', () => { arrastrando = false; });
  });
}

/* ════════════════════════════════════════════════════════
   EQUIPO
   ════════════════════════════════════════════════════════ */
function iniciarEquipo() {
  $('.equipo').innerHTML = EQUIPO.map((p, i) => `
    <article class="pro rv rv-d${i}">
      <div class="pro__foto${p.foto ? '' : ' pro__foto--vacio'}">
        ${p.foto
          ? `<img src="assets/${p.foto}.webp" alt="${p.nombre}, ${p.rol} en ${NEGOCIO.nombre}"
                  loading="lazy" decoding="async" width="640" height="800">`
          : `<span class="pro__vacio">
               <img src="assets/marca-blanca.png" alt="" width="120" height="112"
                    loading="lazy" decoding="async">
               <span>Foto pendiente</span>
             </span>`}
      </div>
      <div class="pro__info">
        <h3 class="pro__nombre">${p.nombre}</h3>
        <p class="pro__rol">${p.rol}${p.anios ? ` · ${p.anios}` : ''}</p>
      </div>
      <p>${p.texto}</p>
      <div class="pro__acciones">
        <button class="link" type="button" data-reservar="equipo" data-ref="${i}">
          Reservar con ella ${ICO.flecha}
        </button>
        ${p.instagram ? `<a class="link" href="${p.instagram}" target="_blank"
           rel="noopener noreferrer">Instagram ${ICO.flecha}</a>` : ''}
      </div>
    </article>`).join('');
}

/* ════════════════════════════════════════════════════════
   RESEÑAS
   ════════════════════════════════════════════════════════ */
function iniciarResenas() {
  const resumen = $('.resumen-google');
  const hayPuntaje = Number.isFinite(RESENAS.puntaje);
  resumen.innerHTML = `
    ${hayPuntaje ? `${estrellas(Math.round(RESENAS.puntaje))}
      <span class="resumen-google__puntaje">
        <strong>${RESENAS.puntaje.toString().replace('.', ',')}</strong>
        <span class="plomo">${RESENAS.cantidad
          ? `sobre ${RESENAS.cantidad} reseñas en Google` : 'en Google'}</span></span>`
      : '<span class="resumen-google__nota">Las reseñas y el puntaje se toman del perfil de Google del salón. Todavía no están cargados en el sitio.</span>'}
    <a class="link" href="${NEGOCIO.maps}" target="_blank" rel="noopener noreferrer">
      Ver en Google ${ICO.flecha}</a>`;

  $('.resenas').innerHTML = RESENAS.items.map(r => `
    <article class="resena rv">
      ${estrellas(r.estrellas)}
      <blockquote>${r.texto}</blockquote>
      <footer class="resena__pie">
        <span class="resena__autor">${r.autor}</span>
        <span class="resena__meta">${r.servicio} · ${r.fecha}</span>
      </footer>
    </article>`).join('');
}

/* ════════════════════════════════════════════════════════
   FAQ (+ structured data)
   ════════════════════════════════════════════════════════ */
function iniciarFaq() {
  $('.faq').innerHTML = FAQ.map(f => `
    <details class="faq__item">
      <summary>${f.q}<span class="faq__icono" aria-hidden="true"></span></summary>
      <div class="faq__resp"><p>${f.a}</p></div>
    </details>`).join('');

  /* Un solo acordeón abierto a la vez */
  const items = $$('.faq__item');
  items.forEach(d => d.addEventListener('toggle', () => {
    if (d.open) items.forEach(o => { if (o !== d) o.open = false; });
  }));

  const ld = document.createElement('script');
  ld.type = 'application/ld+json';
  ld.textContent = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQ.map(f => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a }
    }))
  });
  document.head.appendChild(ld);
}

/* ════════════════════════════════════════════════════════
   DATOS DE CONTACTO EN EL DOM
   ════════════════════════════════════════════════════════ */
function iniciarDatos() {
  const d = NEGOCIO.direccion;
  $$('[data-campo]').forEach(el => {
    const v = {
      zona: NEGOCIO.zona,
      ciudad: NEGOCIO.ciudad,
      direccion: `${d.calle}, ${d.localidad}`,
      direccionCompleta: `${d.calle}, ${d.localidad}, ${d.provincia}`,
      telefono: NEGOCIO.telefonoVisible,
      instagram: `@${NEGOCIO.instagramUsuario}`,
      anio: new Date().getFullYear()
    }[el.dataset.campo];
    if (v != null) el.textContent = v;
  });
  $$('[data-href="maps"]').forEach(a => { a.href = NEGOCIO.maps; });
  $$('[data-href="instagram"]').forEach(a => { a.href = NEGOCIO.instagram; });

  $('.horarios').innerHTML = NEGOCIO.horarios.map(h => `
    <li><span>${h.dias}</span><span>${h.texto}</span></li>`).join('');
}

/* ════════════════════════════════════════════════════════
   ARRANQUE
   ════════════════════════════════════════════════════════ */
iniciarDatos();
iniciarTicker();
iniciarTextos();
iniciarServicios();
iniciarDiagnostico();
iniciarGaleria();
iniciarAntesDespues();
iniciarEquipo();
iniciarResenas();
iniciarFaq();
iniciarNav();
iniciarMovimiento();
