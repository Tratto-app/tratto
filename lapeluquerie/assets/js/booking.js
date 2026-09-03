/**
 * booking.js — capa de reservas
 * ---------------------------------------------------------------------------
 * Todo el sitio pide un turno llamando a `abrirReserva(contexto)`. Nadie más
 * sabe que hoy eso termina en WhatsApp.
 *
 * Para migrar a una agenda online (Calendly, Fresha, Treatwell, sistema propio)
 * alcanza con cambiar `reservas.proveedor` en config.js y sumar el proveedor
 * acá abajo. Ni el HTML ni el resto de los módulos cambian.
 */

import { CONFIG, SERVICIOS, RESPUESTAS } from './config.js';

/* ─── Mensajes por contexto ─────────────────────────────────────────────────
   Nunca mandamos el mismo "Hola, quiero reservar". El mensaje dice de dónde
   viene la persona, así del otro lado ya se sabe de qué se está hablando. */

const SALUDO = 'Hola, La Peluquerie.';

/** @param {Contexto} ctx  @returns {string} */
export function armarMensaje(ctx = {}) {
  const s = ctx.servicio ? SERVICIOS[ctx.servicio] : null;
  const nombreServicio = s ? s.nombre.toLowerCase() : null;

  switch (ctx.origen) {
    case 'servicio':
      return `${SALUDO} Quisiera consultar disponibilidad para ${nombreServicio || 'un turno'}.`;

    case 'galeria':
      return `${SALUDO} Vi "${ctx.titulo}" en la galería de la web y quisiera consultar por un resultado similar${nombreServicio ? ` (${nombreServicio})` : ''}.`;

    case 'transformacion':
      return `${SALUDO} Vi la transformación "${ctx.titulo}" en la web y me gustaría consultar por algo así${ctx.sesiones ? `. Entiendo que llevó ${ctx.sesiones}` : ''}.`;

    case 'equipo':
      return ctx.profesional
        ? `${SALUDO} Quisiera reservar un turno con ${ctx.profesional}.`
        : `${SALUDO} Quisiera reservar un turno con una de las profesionales del equipo.`;

    case 'finder': {
      const plan = (ctx.recomendados || [])
        .map((id) => SERVICIOS[id]?.nombre)
        .filter(Boolean)
        .join(' + ');
      const respuestas = ctx.respuestas
        ? Object.entries(ctx.respuestas)
            .map(([k, v]) => RESPUESTAS[k]?.[v])
            .filter(Boolean)
            .map((t) => `· ${t}`)
            .join('\n')
        : '';
      return [
        `${SALUDO} Usé el buscador de la web y me recomendó: ${plan || 'un turno de consulta'}.`,
        respuestas ? `\nEsto es lo que respondí:\n${respuestas}` : '',
        '\n¿Me confirman disponibilidad?',
      ].join('');
    }

    case 'formulario': {
      const f = ctx.formulario || {};
      return [
        `${SALUDO} Quiero reservar un turno.`,
        `\nNombre: ${f.nombre}`,
        f.servicio && f.servicio !== 'no-se' ? `\nServicio: ${SERVICIOS[f.servicio]?.nombre || f.servicio}` : '\nServicio: todavía no sé, necesito asesoramiento',
        f.mensaje ? `\n\n${f.mensaje}` : '',
      ].join('');
    }

    case 'resenas':
      return `${SALUDO} Estuve viendo la web y quisiera reservar un turno.`;

    case 'nav':
    case 'menu':
    case 'hero':
    case 'barra-fija':
    case 'pie':
    case 'seccion-reserva':
    default:
      return `${SALUDO} Quisiera consultar disponibilidad para un turno.`;
  }
}

/* ─── Proveedores ──────────────────────────────────────────────────────── */

const proveedores = {
  /** WhatsApp: abre el chat con el mensaje ya escrito. */
  whatsapp(ctx) {
    const numero = (CONFIG.contacto.whatsapp || '').replace(/\D/g, '');
    if (!numero) return null;
    return `https://wa.me/${numero}?text=${encodeURIComponent(armarMensaje(ctx))}`;
  },

  /** Calendly: se pasa el servicio como parámetro para preseleccionar el evento. */
  calendly(ctx) {
    const base = CONFIG.reservas.url;
    if (!base) return null;
    const u = new URL(base);
    if (ctx.servicio) u.searchParams.set('a1', SERVICIOS[ctx.servicio]?.nombre || ctx.servicio);
    return u.toString();
  },

  /** Fresha y similares: no aceptan contexto, se abre la agenda directamente. */
  fresha() {
    return CONFIG.reservas.url || null;
  },

  /** Sistema propio: la URL recibe el contexto como query. */
  externo(ctx) {
    const base = CONFIG.reservas.url;
    if (!base) return null;
    const u = new URL(base);
    if (ctx.servicio) u.searchParams.set('servicio', ctx.servicio);
    if (ctx.origen) u.searchParams.set('origen', ctx.origen);
    return u.toString();
  },
};

/**
 * Devuelve la URL de reserva para un contexto, o null si el proveedor todavía
 * no está configurado.
 * @param {Contexto} ctx
 * @returns {string|null}
 */
export function urlReserva(ctx = {}) {
  const proveedor = proveedores[CONFIG.reservas.proveedor] || proveedores.whatsapp;
  return proveedor(ctx);
}

/** true si hoy se puede reservar de verdad. */
export function reservaActiva() {
  return urlReserva({ origen: 'test' }) !== null;
}

/**
 * Punto de entrada único. Abre la reserva o, si falta configurarla, avisa en
 * vez de dejar un botón muerto.
 * @param {Contexto} ctx
 */
export function abrirReserva(ctx = {}) {
  const url = urlReserva(ctx);
  if (!url) {
    document.querySelector('[data-aviso-reserva]')?.showModal();
    return false;
  }
  window.open(url, '_blank', 'noopener');
  return true;
}

/**
 * Lee el contexto desde los data-* del elemento que se tocó, para que el HTML
 * no tenga que saber nada de cómo se arma el mensaje.
 * @param {HTMLElement} el
 * @returns {Contexto}
 */
export function contextoDe(el) {
  return {
    origen: el.dataset.origen || 'generico',
    servicio: el.dataset.servicioId || undefined,
    titulo: el.dataset.titulo || undefined,
    sesiones: el.dataset.sesiones || undefined,
    profesional: el.dataset.profesional || undefined,
  };
}

/**
 * @typedef {Object} Contexto
 * @property {string}  [origen]       De dónde salió el pedido: hero, servicio, galeria…
 * @property {string}  [servicio]     Id del servicio (ver SERVICIOS en config.js)
 * @property {string}  [titulo]       Título del trabajo o transformación
 * @property {string}  [sesiones]     '2 sesiones'
 * @property {string}  [profesional]  Nombre de la profesional
 * @property {string[]} [recomendados] Ids que devolvió el buscador
 * @property {Object}  [respuestas]   Respuestas del buscador
 * @property {Object}  [formulario]   Datos del formulario de contacto
 */
