/**
 * datos.js — vuelca los datos del negocio en la página.
 *
 * El HTML trae el texto editorial y marcadores `data-slot`. Este módulo los
 * completa con lo que haya en config.js. Si un dato está pendiente, deja el
 * texto honesto que ya estaba en el HTML en lugar de escribir un vacío.
 */

import { CONFIG } from './config.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const slot = (n) => $(`[data-slot="${n}"]`);

const hay = (v) => typeof v === 'string' && v.trim() !== '';

/** Dirección en una línea, con lo que esté cargado. */
export function direccionCorta() {
  const l = CONFIG.local;
  return [l.calle, l.piso, l.zona, l.ciudad].filter(hay).join(', ');
}

/** El día de hoy según los horarios cargados. */
function hoy() {
  // getDay(): 0 = domingo. El array arranca en lunes.
  const i = (new Date().getDay() + 6) % 7;
  return CONFIG.horarios[i];
}

function estaAbierto() {
  const d = hoy();
  if (!d || d.cerrado || !hay(d.abre) || !hay(d.cierra)) return false;
  const ahora = new Date();
  const min = ahora.getHours() * 60 + ahora.getMinutes();
  const aMin = (t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
  return min >= aMin(d.abre) && min < aMin(d.cierra);
}

export function iniciarDatos() {
  const { contacto, local, precios, reviews } = CONFIG;

  /* ── Zona ──────────────────────────────────────────────────────────── */
  if (hay(local.zona)) {
    const zona = local.zona;
    if (slot('zona-hero')) slot('zona-hero').textContent = ` · ${zona}`;
    if (slot('zona-menu')) slot('zona-menu').textContent = zona;
    if (slot('zona-pie')) slot('zona-pie').textContent = [zona, local.ciudad].filter(hay).join(', ');
  }

  /* ── Dirección ─────────────────────────────────────────────────────── */
  const dir = direccionCorta();
  if (hay(dir)) {
    const texto = hay(local.comoLlegar) ? `${dir}. ${local.comoLlegar}` : dir;
    if (slot('direccion')) {
      slot('direccion').textContent = '';
      if (hay(local.mapsUrl)) {
        const a = document.createElement('a');
        a.className = 'enlace';
        a.href = local.mapsUrl;
        a.rel = 'noopener';
        a.target = '_blank';
        a.textContent = dir;
        slot('direccion').append(a);
        if (hay(local.comoLlegar)) slot('direccion').append(` — ${local.comoLlegar}`);
      } else {
        slot('direccion').textContent = texto;
      }
    }
    if (slot('direccion-pie')) slot('direccion-pie').textContent = dir;
    const faqUbi = slot('faq-ubicacion');
    if (faqUbi) {
      faqUbi.replaceChildren(Object.assign(document.createElement('p'), { textContent: texto }));
    }
  }

  /* ── Mapa ──────────────────────────────────────────────────────────── */
  const mapa = $('[data-mapa]');
  if (mapa && hay(local.mapsEmbed)) {
    const marco = document.createElement('iframe');
    marco.src = local.mapsEmbed;
    marco.loading = 'lazy';
    marco.referrerPolicy = 'no-referrer-when-downgrade';
    marco.title = `Ubicación de ${CONFIG.marca.nombreCompleto}`;
    mapa.replaceChildren(marco);
  }

  /* ── Contacto ──────────────────────────────────────────────────────── */
  const cont = slot('contacto');
  if (cont) {
    const partes = [];
    if (hay(contacto.whatsappVisible)) partes.push(['WhatsApp', contacto.whatsappVisible, null]);
    if (hay(contacto.telefono)) partes.push(['Teléfono', contacto.telefono, `tel:${contacto.telefono.replace(/\s/g, '')}`]);
    if (hay(contacto.email)) partes.push(['Email', contacto.email, `mailto:${contacto.email}`]);
    if (partes.length) {
      cont.replaceChildren();
      partes.forEach(([etiqueta, valor, href], i) => {
        if (i) cont.append(document.createElement('br'));
        cont.append(`${etiqueta}: `);
        if (href) {
          const a = document.createElement('a');
          a.className = 'enlace';
          a.href = href;
          a.textContent = valor;
          cont.append(a);
        } else {
          cont.append(valor);
        }
      });
      const br = document.createElement('br');
      const ig = document.createElement('a');
      ig.className = 'enlace';
      ig.href = contacto.instagramUrl;
      ig.rel = 'noopener';
      ig.textContent = `@${contacto.instagram}`;
      cont.append(br, 'Instagram: ', ig);
    }
  }

  /* ── Horarios ──────────────────────────────────────────────────────── */
  const tabla = $('[data-horarios]');
  if (tabla) {
    if (CONFIG.horariosConfirmados) {
      const dHoy = hoy();
      tabla.replaceChildren(
        ...CONFIG.horarios.map((d) => {
          const fila = document.createElement('div');
          if (d === dHoy) fila.dataset.hoy = 'true';
          const dia = document.createElement('span');
          dia.textContent = d.dia;
          const val = document.createElement('span');
          val.textContent = d.cerrado ? 'Cerrado' : `${d.abre} – ${d.cierra}`;
          if (d.cerrado) val.className = 'cerrado';
          fila.append(dia, val);
          return fila;
        })
      );
      const estado = estaAbierto() ? 'Abierto ahora' : 'Cerrado ahora';
      if (slot('hero-respuesta')) slot('hero-respuesta').textContent = `${estado} · Respondemos por WhatsApp`;
      if (slot('hero-horario') && dHoy) {
        slot('hero-horario').textContent = dHoy.cerrado
          ? `Hoy cerrado. Escribinos igual y coordinamos.`
          : `Hoy de ${dHoy.abre} a ${dHoy.cierra}.`;
      }
      if (slot('horario-pie') && dHoy) {
        slot('horario-pie').textContent = dHoy.cerrado ? 'Hoy cerrado' : `Hoy ${dHoy.abre} – ${dHoy.cierra}`;
      }
      if (slot('barra-estado')) slot('barra-estado').textContent = estado;
    } else {
      const p = document.createElement('span');
      p.className = 'cerrado';
      p.textContent = 'Horarios pendientes de confirmar. Escribinos y te los pasamos.';
      tabla.replaceChildren(p);
    }
  }

  /* ── Precios ───────────────────────────────────────────────────────── */
  const fmt = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });
  if (precios.mostrarPrecios) {
    $$('[data-precio]').forEach((el) => {
      const v = precios.lista[el.dataset.precio];
      if (typeof v === 'number') el.textContent = `Desde ${fmt.format(v)}`;
    });
    if (slot('nota-precios')) {
      slot('nota-precios').textContent = hay(precios.actualizado)
        ? `Precios actualizados a ${precios.actualizado}; el final depende del largo y la densidad.`
        : 'El precio final depende del largo y la densidad de tu pelo.';
    }
  } else if (slot('nota-precios')) {
    slot('nota-precios').textContent = 'Los precios se cierran en la consulta, antes de empezar.';
  }

  /* ── Formas de pago ────────────────────────────────────────────────── */
  if (hay(CONFIG.formasDePago) && slot('faq-pagos')) {
    slot('faq-pagos').replaceChildren(
      Object.assign(document.createElement('p'), { textContent: CONFIG.formasDePago })
    );
  }
  if (hay(CONFIG.marcas) && slot('marcas')) {
    slot('marcas').textContent = CONFIG.marcas;
  }

  /* ── Equipo ────────────────────────────────────────────────────────── */
  CONFIG.equipo.forEach((p) => {
    const ficha = $(`[data-persona="${p.id}"]`);
    if (!ficha || !p.confirmado || !hay(p.nombre)) return;

    ficha.classList.remove('persona-pendiente');
    ficha.dataset.confirmado = 'true';
    $('[data-persona-nombre]', ficha).textContent = p.nombre;
    if (hay(p.bio)) $('[data-persona-bio]', ficha).textContent = p.bio;

    const rol = $('.persona-rol', ficha);
    if (hay(p.experiencia) && rol) rol.textContent = `${rol.textContent} · ${p.experiencia}`;

    const cta = $(`[data-persona-cta="${p.id}"]`, ficha);
    if (cta) {
      cta.dataset.profesional = p.nombre;
      cta.textContent = `Reservar con ${p.nombre.split(' ')[0]}`;
    }
    if (hay(p.instagram)) {
      const a = document.createElement('a');
      a.className = 'btn btn-linea btn-chico';
      a.href = `https://www.instagram.com/${p.instagram.replace('@', '')}`;
      a.rel = 'noopener';
      a.textContent = 'Instagram';
      $('.persona-acciones', ficha)?.append(a);
    }
  });

  /* ── Reseñas ───────────────────────────────────────────────────────── */
  if (reviews.verificadas && reviews.lista.length) {
    pintarReviews();
  } else if (hay(reviews.googleUrl)) {
    const cta = slot('cta-google');
    if (cta) {
      cta.href = reviews.googleUrl;
      cta.textContent = 'Ver reseñas en Google';
    }
  }

  if (slot('anio')) slot('anio').textContent = String(new Date().getFullYear());

  actualizarSchema();
}

function pintarReviews() {
  const { reviews } = CONFIG;
  const cont = $('[data-reviews]');
  const vacio = $('[data-reviews-vacio]');
  if (!cont) return;

  const estrellas = (n) => {
    const s = document.createElement('span');
    s.className = 'estrellas';
    s.setAttribute('role', 'img');
    s.setAttribute('aria-label', `${n} de 5 estrellas`);
    for (let i = 0; i < 5; i += 1) {
      s.insertAdjacentHTML('beforeend',
        `<svg viewBox="0 0 20 20" fill="${i < n ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="1.2" aria-hidden="true"><path d="M10 1.6l2.5 5.3 5.5.8-4 4 .9 5.7-4.9-2.7-4.9 2.7.9-5.7-4-4 5.5-.8z"/></svg>`);
    }
    return s;
  };

  cont.replaceChildren(
    ...reviews.lista.map((r) => {
      const art = document.createElement('article');
      art.className = 'review';
      art.append(estrellas(r.puntaje));

      const q = document.createElement('blockquote');
      q.textContent = `“${r.texto}”`;
      art.append(q);

      const pie = document.createElement('footer');
      const nombre = document.createElement('strong');
      nombre.textContent = r.nombre;
      const meta = document.createElement('span');
      const fecha = r.fecha
        ? new Date(r.fecha).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })
        : '';
      meta.textContent = [r.servicio, fecha].filter(Boolean).join(' · ');
      pie.append(nombre, meta);
      art.append(pie);
      return art;
    })
  );

  cont.hidden = false;
  if (vacio) vacio.hidden = true;

  const resumen = slot('resumen-reviews');
  if (resumen && reviews.promedio && reviews.total) {
    resumen.textContent = `${reviews.promedio} de 5 sobre ${reviews.total} reseñas verificadas en Google.`;
  }
}

/**
 * Completa los datos estructurados con lo que esté confirmado.
 * No se agregan dirección, teléfono ni rating si no existen: publicar datos
 * incompletos en el schema es peor que no publicarlos.
 */
function actualizarSchema() {
  const script = $('[data-schema]');
  if (!script) return;

  let datos;
  try {
    datos = JSON.parse(script.textContent);
  } catch {
    return;
  }

  const salon = datos['@graph'].find((n) => n['@type'] === 'HairSalon');
  if (!salon) return;

  const { local, contacto, reviews, precios } = CONFIG;

  if (hay(local.calle) && hay(local.ciudad)) {
    salon.address = {
      '@type': 'PostalAddress',
      streetAddress: [local.calle, local.piso].filter(hay).join(', '),
      addressLocality: local.ciudad,
      addressRegion: local.provincia || undefined,
      postalCode: local.cp || undefined,
      addressCountry: local.pais,
    };
  }
  if (hay(local.zona)) salon.areaServed = local.zona;
  if (hay(local.lat) && hay(local.lng)) {
    salon.geo = { '@type': 'GeoCoordinates', latitude: local.lat, longitude: local.lng };
  }
  if (hay(local.mapsUrl)) salon.hasMap = local.mapsUrl;
  if (hay(contacto.telefono)) salon.telephone = contacto.telefono;
  if (hay(contacto.email)) salon.email = contacto.email;

  if (CONFIG.horariosConfirmados) {
    salon.openingHoursSpecification = CONFIG.horarios
      .filter((d) => !d.cerrado && hay(d.abre))
      .map((d) => ({
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: `https://schema.org/${{ Mo: 'Monday', Tu: 'Tuesday', We: 'Wednesday', Th: 'Thursday', Fr: 'Friday', Sa: 'Saturday', Su: 'Sunday' }[d.iso]}`,
        opens: d.abre,
        closes: d.cierra,
      }));
  }

  // Solo se declara rating si hay reseñas reales cargadas y verificadas.
  if (reviews.verificadas && reviews.promedio && reviews.total) {
    salon.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: reviews.promedio,
      reviewCount: reviews.total,
      bestRating: 5,
    };
  }
  if (hay(reviews.googleUrl)) {
    salon.sameAs = [...new Set([...(salon.sameAs || []), reviews.googleUrl])];
  }
  if (!precios.mostrarPrecios) delete salon.priceRange;

  script.textContent = JSON.stringify(datos, null, 2);
}
