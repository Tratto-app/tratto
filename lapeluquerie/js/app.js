/* ============================================================
   LAPELUQUERIE — comportamiento
   Sin dependencias. Todo el contenido sale de datos.js.
   ============================================================ */
import {
  NEGOCIO, SERVICIOS, GALERIA, TRANSFORMACIONES,
  PASOS, MOTIVOS, CONSEJOS, RESENAS, FAQ
} from './datos.js';

const $  = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => [...c.querySelectorAll(s)];
const servicioPorId = id => SERVICIOS.find(s => s.id === id);
const menosMovimiento = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* Fotos que existen en dos anchos reales (640 y 1100 px). Los recortes
   del collage sólo existen a 520, así que no llevan srcset. */
const DOS_ANCHOS = new Set(['bronde', 'caoba', 'castano']);
const srcset = (base, sizes) => DOS_ANCHOS.has(base)
  ? ` srcset="assets/${base}-640.webp 640w, assets/${base}.webp 1100w" sizes="${sizes}"`
  : '';

const ICO = {
  wa:'<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.9 9.9 0 0 0 4.79 1.22h.01c5.46 0 9.9-4.45 9.9-9.91C21.95 6.45 17.5 2 12.04 2Zm5.8 14.16c-.25.69-1.44 1.32-1.99 1.36-.53.05-1.02.23-3.44-.72-2.9-1.14-4.74-4.1-4.88-4.29-.14-.19-1.16-1.55-1.16-2.95 0-1.4.73-2.09 1-2.38.26-.29.57-.36.76-.36.19 0 .38 0 .55.01.18.01.41-.07.65.49.24.58.81 2 .88 2.14.07.14.12.31.02.5-.09.19-.14.31-.28.48-.14.17-.29.37-.42.5-.14.14-.28.29-.12.57.16.29.72 1.18 1.54 1.91 1.06.94 1.95 1.23 2.23 1.37.28.14.44.12.6-.07.17-.19.69-.8.87-1.08.19-.29.37-.24.62-.14.25.09 1.6.75 1.87.89.28.14.46.21.53.33.07.11.07.67-.18 1.36Z"/></svg>',
  flecha:'<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2.5 8h11M9.5 4l4 4-4 4"/></svg>',
  cerrar:'<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true"><path d="M2.5 2.5l11 11M13.5 2.5l-11 11"/></svg>',
  arrastrar:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6 4 12l5 6M15 6l5 6-5 6"/></svg>',
  estrella:'<svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path d="M10 1.5l2.47 5.3 5.53.66-4.1 3.9 1.09 5.64L10 14.3l-4.99 2.7 1.09-5.64-4.1-3.9 5.53-.66L10 1.5Z"/></svg>',
  charla:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a8 8 0 0 1-11.6 7.1L3 21l1.9-6.4A8 8 0 1 1 21 12Z"/></svg>',
  reloj:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7.5V12l3 2"/></svg>',
  corazon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20s-7.5-4.7-7.5-9.6A4.4 4.4 0 0 1 12 7.6a4.4 4.4 0 0 1 7.5 2.8C19.5 15.3 12 20 12 20Z"/></svg>'
};
const estrellas = n => Number.isFinite(n)
  ? `<span class="estrellas" role="img" aria-label="${n} de 5 estrellas">${ICO.estrella.repeat(n)}</span>`
  : '';

/* ════════════════════════════════════════════════════════
   WHATSAPP — única vía de contacto. No hay reservas online.
   ════════════════════════════════════════════════════════ */
const MENSAJES = {
  general:  () => `Hola! Quería hacerte una consulta.`,
  servicio: s  => `Hola! Quería consultarte por ${s.nombre.toLowerCase()}.`,
  galeria:  g  => `Hola! Vi "${g.titulo}" en la web y me gustaría algo así. ¿Me contás?`,
  transformacion: t => `Hola! Vi el antes y después de "${t.titulo}" en la web y quería consultarte.`,
  precios:  () => `Hola! Quería consultarte precios y qué días tenés lugar.`,
  eventos:  () => `Hola! Quería consultarte por un peinado para un evento.`
};

function urlWhatsapp(mensaje) {
  const { whatsapp, instagramUsuario } = NEGOCIO;
  return whatsapp
    ? `https://wa.me/${whatsapp}?text=${encodeURIComponent(mensaje)}`
    : `https://ig.me/m/${instagramUsuario}`;
}

/* Cada CTA es un enlace de verdad con su href ya resuelto. Nada de
   window.open: los navegadores embebidos de Instagram y WhatsApp lo
   bloquean sin avisar, y ahí los botones no hacen nada. */
function enlazarWhatsapp(raiz = document) {
  $$('[data-wa]', raiz).forEach(el => {
    const tipo = el.dataset.wa || 'general';
    const id = el.dataset.ref;
    const dato =
      tipo === 'servicio'       ? servicioPorId(id) :
      tipo === 'galeria'        ? GALERIA.find(g => g.id === id) :
      tipo === 'transformacion' ? TRANSFORMACIONES.find(t => t.id === id) : null;
    el.href = urlWhatsapp((MENSAJES[tipo] || MENSAJES.general)(dato));
  });
}

/* ════════════════════════════════════════════════════════
   NAVEGACIÓN
   ════════════════════════════════════════════════════════ */
function iniciarNav() {
  const nav = $('.nav');
  const boton = $('.hamburguesa');
  const panel = $('#menu-movil');
  const sticky = $('.sticky');

  const alScrollear = () => {
    const y = window.scrollY;
    nav.classList.toggle('fija', y > 20);
    if (sticky) sticky.classList.toggle('visible', y > 420);
  };
  alScrollear();
  addEventListener('scroll', alScrollear, { passive: true });

  const cerrar = () => {
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
  panel.addEventListener('click', e => { if (e.target.closest('a,button')) cerrar(); });
  addEventListener('keydown', e => {
    if (e.key === 'Escape' && panel.classList.contains('abierto')) { cerrar(); boton.focus(); }
  });

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

function iniciarReveal() {
  const obs = new IntersectionObserver((entradas, o) => {
    entradas.forEach(en => {
      if (!en.isIntersecting) return;
      en.target.classList.add('visible');
      o.unobserve(en.target);
    });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });
  $$('.rv').forEach(el => obs.observe(el));
}

/* ════════════════════════════════════════════════════════
   SERVICIOS
   ════════════════════════════════════════════════════════ */
function iniciarServicios() {
  $('.servicios__lista').innerHTML = SERVICIOS.map(s => {
    const datos = [s.duracion, s.precio].filter(Boolean).join(' · ');
    return `
    <article class="serv rv">
      <h3 class="serv__nombre">${s.nombre}</h3>
      <div class="serv__texto">
        <p>${s.texto}</p>
        ${datos ? `<p class="serv__datos">${datos}</p>` : ''}
      </div>
      <a class="serv__consulta" data-wa="servicio" data-ref="${s.id}"
         href="#" target="_blank" rel="noopener noreferrer">
        Consultame ${ICO.flecha}
      </a>
    </article>`;
  }).join('');
}

/* ════════════════════════════════════════════════════════
   TRABAJOS + LIGHTBOX
   ════════════════════════════════════════════════════════ */
function iniciarGaleria() {
  const grid = $('.galeria');

  /* El epígrafe va debajo de la foto, no encima: superpuesto sólo aparecía
     al pasar el mouse, así que en la compu se veía distinto que en el celular. */
  grid.innerHTML = GALERIA.map(g => `
    <figure class="gitem" data-id="${g.id}">
      <button class="gitem__btn" type="button" aria-label="Ver más grande: ${g.titulo}">
        <img src="assets/${g.img}-640.webp"${srcset(g.img, '(min-width:820px) 31vw, 47vw')}
             alt="${g.titulo}" loading="lazy" decoding="async" width="640" height="800">
      </button>
      <figcaption class="gitem__pie">${g.titulo}</figcaption>
    </figure>`).join('') + `
    <figure class="gitem gitem--ig">
      <a class="gitem__btn" href="${NEGOCIO.instagram}" target="_blank" rel="noopener noreferrer">
        <img src="assets/marca-blanca.png" alt="" width="62" height="58"
             loading="lazy" decoding="async">
      </a>
      <figcaption class="gitem__pie">Más en @${NEGOCIO.instagramUsuario}</figcaption>
    </figure>`;

  const lb = $('.lb');
  const lbFoto = $('.lb__foto img');
  const lbInfo = $('.lb__info');
  let idx = 0, ultimoFoco = null;

  const render = () => {
    const g = GALERIA[idx];
    lbFoto.src = `assets/${g.img}.webp`;
    lbFoto.alt = g.titulo;
    lbInfo.innerHTML = `
      <h3 id="lb-titulo">${g.titulo}</h3>
      <p>${g.texto}</p>
      <div><a class="btn btn--claro" data-wa="galeria" data-ref="${g.id}"
        href="#" target="_blank" rel="noopener noreferrer">
        ${ICO.wa} Quiero algo así</a></div>
      <p class="lb__conteo">${idx + 1} de ${GALERIA.length}</p>`;
    enlazarWhatsapp(lbInfo);
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
  const mover = d => { idx = (idx + d + GALERIA.length) % GALERIA.length; render(); };

  grid.addEventListener('click', e => {
    const btn = e.target.closest('.gitem__btn');
    if (!btn || btn.tagName === 'A') return;
    abrir(GALERIA.findIndex(g => g.id === btn.closest('.gitem').dataset.id));
  });
  $('.lb__cerrar', lb).addEventListener('click', cerrar);
  $('.lb__nav--prev', lb).addEventListener('click', () => mover(-1));
  $('.lb__nav--next', lb).addEventListener('click', () => mover(1));
  lb.addEventListener('click', e => { if (e.target === lb) cerrar(); });
  addEventListener('keydown', e => {
    if (!lb.classList.contains('abierto')) return;
    if (e.key === 'Escape') cerrar();
    if (e.key === 'ArrowLeft') mover(-1);
    if (e.key === 'ArrowRight') mover(1);
    if (e.key === 'Tab') {
      const foco = $$('button, a[href]', lb).filter(el => el.offsetParent !== null);
      if (!foco.length) return;
      const [primero] = foco, ultimo = foco[foco.length - 1];
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
          <img src="assets/${t.antes}.webp" alt="${t.altA}" loading="lazy"
               decoding="async" width="520" height="520">
        </div>
        <div class="ad__capa ad__capa--despues">
          <img src="assets/${t.despues}.webp" alt="${t.altD}" loading="lazy"
               decoding="async" width="520" height="520">
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
      <a class="btn btn--suave" data-wa="transformacion" data-ref="${t.id}"
         href="#" target="_blank" rel="noopener noreferrer">
        ${ICO.wa} Consultame por un cambio así
      </a>
    </article>`).join('');

  $$('.ad__marco', cont).forEach(marco => {
    const rango = $('.ad__rango', marco);
    const set = v => marco.style.setProperty('--pos', `${v}%`);
    rango.addEventListener('input', () => set(rango.value));
    const desde = e => {
      const r = marco.getBoundingClientRect();
      const v = Math.max(0, Math.min(100, ((e.clientX - r.left) / r.width) * 100));
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
   PROCESO, MOTIVOS, CONSEJOS, RESEÑAS, FAQ
   ════════════════════════════════════════════════════════ */
function iniciarContenido() {
  $('.pasos').innerHTML = PASOS.map((p, i) => `
    <article class="paso rv${p.cierre ? ' paso--cierre' : ''}">
      <span class="paso__n" aria-hidden="true">${i + 1}</span>
      <div class="paso__txt"><h3 class="h4">${p.t}</h3><p>${p.d}</p></div>
    </article>`).join('');

  $('.motivos').innerHTML = MOTIVOS.map((m, i) => `
    <article class="motivo rv rv-d${i}">
      <span class="motivo__ico" aria-hidden="true">${ICO[m.ico]}</span>
      <h3 class="h4">${m.t}</h3>
      <p>${m.d}</p>
    </article>`).join('');

  $('.consejos').innerHTML = CONSEJOS.map(c => `
    <article class="consejo rv">
      <span class="consejo__punto" aria-hidden="true"></span>
      <div><b>${c.t}</b><p>${c.d}</p></div>
    </article>`).join('');

  $('.resenas').innerHTML = RESENAS.map(r => `
    <article class="resena rv">
      ${estrellas(r.estrellas)}
      <blockquote>“${r.texto}”</blockquote>
      <footer class="resena__pie">
        <span class="resena__autor">${r.autor}</span>
        <span class="resena__meta">Google · ${r.fecha}</span>
      </footer>
    </article>`).join('');

  $('.faq').innerHTML = FAQ.map(f => `
    <details class="faq__item">
      <summary>${f.q}<span class="faq__icono" aria-hidden="true"></span></summary>
      <div class="faq__resp"><p>${f.a}</p></div>
    </details>`).join('');
  const items = $$('.faq__item');
  items.forEach(d => d.addEventListener('toggle', () => {
    if (d.open) items.forEach(o => { if (o !== d) o.open = false; });
  }));

  const ld = document.createElement('script');
  ld.type = 'application/ld+json';
  ld.textContent = JSON.stringify({
    '@context': 'https://schema.org', '@type': 'FAQPage',
    mainEntity: FAQ.map(f => ({
      '@type': 'Question', name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a }
    }))
  });
  document.head.appendChild(ld);
}

/* ════════════════════════════════════════════════════════
   DATOS DEL NEGOCIO + ESTADO ABIERTO/CERRADO
   ════════════════════════════════════════════════════════ */
const DIAS_ES = { Mo:'lunes', Tu:'martes', We:'miércoles', Th:'jueves',
                  Fr:'viernes', Sa:'sábado', Su:'domingo' };
const ORDEN = ['Su','Mo','Tu','We','Th','Fr','Sa'];

/* La hora del salón, no la del visitante. */
function ahoraEnElSalon() {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
    timeZone: 'America/Argentina/Buenos_Aires',
    weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false
  }).formatToParts(new Date()).map(x => [x.type, x.value]));
  return { dia: p.weekday.slice(0, 2), minutos: +p.hour * 60 + +p.minute };
}
const aMinutos = h => +h.slice(0, 2) * 60 + +h.slice(3, 5);
const franjaDe = codigo => NEGOCIO.horarios.find(h => h.schema.includes(codigo));

function estadoActual() {
  const { dia, minutos } = ahoraEnElSalon();
  const hoy = franjaDe(dia);
  if (hoy && minutos >= aMinutos(hoy.abre) && minutos < aMinutos(hoy.cierra)) {
    return { abierto: true, texto: `Abierto ahora · hasta las ${hoy.cierra}` };
  }
  if (hoy && minutos < aMinutos(hoy.abre)) {
    return { abierto: false, texto: `Hoy abrimos a las ${hoy.abre}` };
  }
  const i = ORDEN.indexOf(dia);
  for (let n = 1; n <= 7; n++) {
    const prox = franjaDe(ORDEN[(i + n) % 7]);
    if (prox) return {
      abierto: false,
      texto: `Abrimos el ${DIAS_ES[ORDEN[(i + n) % 7]]} a las ${prox.abre}`
    };
  }
  return { abierto: false, texto: 'Consultanos por WhatsApp' };
}

function iniciarDatos() {
  const d = NEGOCIO.direccion;
  const valores = {
    zona: NEGOCIO.zona,
    ciudad: NEGOCIO.ciudad,
    direccion: `${d.calle}, ${d.localidad}`,
    direccionCompleta: `${d.calle}, ${d.localidad}, ${d.provincia}`,
    telefono: NEGOCIO.telefonoVisible,
    instagram: `@${NEGOCIO.instagramUsuario}`,
    anio: new Date().getFullYear()
  };
  $$('[data-campo]').forEach(el => {
    const v = valores[el.dataset.campo];
    if (v != null) el.textContent = v;
  });
  $$('[data-href="maps"]').forEach(a => { a.href = NEGOCIO.maps; });
  $$('[data-href="instagram"]').forEach(a => { a.href = NEGOCIO.instagram; });
  $$('[data-href="tel"]').forEach(a => { a.href = `tel:+${NEGOCIO.whatsapp}`; });

  const hoy = ahoraEnElSalon().dia;
  $('.horarios').innerHTML = NEGOCIO.horarios.map(h => `
    <li${h.schema.includes(hoy) ? ' class="hoy"' : ''}>
      <span>${h.dias}</span><span>${h.texto}</span>
    </li>`).join('');

  const estado = estadoActual();
  const chip = $('.estado');
  chip.textContent = estado.texto;
  chip.dataset.abierto = estado.abierto ? 'si' : 'no';
}

/* ── Arranque ── */
iniciarDatos();
iniciarServicios();
iniciarGaleria();
iniciarAntesDespues();
iniciarContenido();
enlazarWhatsapp();
iniciarNav();
iniciarReveal();
if (menosMovimiento()) $$('.rv').forEach(el => el.classList.add('visible'));
