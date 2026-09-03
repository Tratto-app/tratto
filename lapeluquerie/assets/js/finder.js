/**
 * finder.js — buscador de servicio en cuatro pasos.
 *
 * La gracia no es el cuestionario: es que el mensaje de WhatsApp sale con las
 * respuestas adentro, así del otro lado ya se sabe de qué se viene a hablar.
 */

import { SERVICIOS, RESPUESTAS, recomendar } from './config.js';

const CLAVES = ['objetivo', 'estado', 'tiempo', 'frecuencia'];

export function iniciarFinder() {
  const raiz = document.querySelector('[data-finder]');
  if (!raiz) return;

  const pasos = [...raiz.querySelectorAll('.finder-paso')];
  const resultado = raiz.querySelector('[data-paso="resultado"]');
  const titulo = raiz.querySelector('[data-finder-titulo]');
  const marcas = [...raiz.querySelectorAll('.finder-progreso i')];
  const atras = raiz.querySelector('[data-finder-atras]');
  const reiniciar = raiz.querySelector('[data-finder-reiniciar]');
  const contItems = raiz.querySelector('[data-finder-items]');
  const porqueEl = raiz.querySelector('[data-finder-porque]');
  const respEl = raiz.querySelector('[data-finder-respuestas]');
  const cta = raiz.querySelector('[data-finder-cta]');
  const anuncio = raiz.querySelector('[data-finder-anuncio]');

  /** @type {Record<string,string>} */
  let respuestas = {};
  let indice = 0;

  const mostrar = (n) => {
    indice = n;
    const enResultado = n >= CLAVES.length;

    pasos.forEach((p) => {
      const suyo = enResultado ? p.dataset.paso === 'resultado' : p.dataset.paso === String(n);
      p.hidden = !suyo;
    });

    marcas.forEach((m, i) => (m.dataset.hecho = String(enResultado || i < n)));
    titulo.textContent = enResultado ? 'Tu recomendación' : `Pregunta ${n + 1} de ${CLAVES.length}`;
    atras.hidden = n === 0 || enResultado;

    if (!enResultado) {
      // Se marca lo ya elegido para que volver atrás muestre la respuesta.
      const elegido = respuestas[CLAVES[n]];
      pasos[n].querySelectorAll('.finder-op').forEach((b) => {
        b.setAttribute('aria-pressed', String(b.dataset.valor === elegido));
      });
      anuncio.textContent = `${titulo.textContent}. ${pasos[n].querySelector('.finder-pregunta').textContent}`;
    }
  };

  const renderResultado = () => {
    const { ids, porque } = recomendar(respuestas);

    contItems.replaceChildren(
      ...ids.map((id, i) => {
        const s = SERVICIOS[id];
        const item = document.createElement('div');
        item.className = 'finder-item';
        const fila = document.createElement('div');
        fila.className = 'finder-item-fila';
        const h = document.createElement('h4');
        h.textContent = s.nombre;
        const d = document.createElement('span');
        d.className = 'dur';
        d.textContent = s.duracion;
        fila.append(h, d);
        const p = document.createElement('p');
        p.textContent = i === 0 ? 'Es el servicio principal de tu plan.' : 'Lo sumamos al mismo turno o al siguiente, según cómo esté tu pelo.';
        item.append(fila, p);
        return item;
      })
    );

    porqueEl.textContent = porque;

    respEl.replaceChildren(
      ...CLAVES.map((k) => {
        const texto = RESPUESTAS[k]?.[respuestas[k]];
        if (!texto) return null;
        const e = document.createElement('span');
        e.className = 'etiqueta';
        e.textContent = texto;
        return e;
      }).filter(Boolean)
    );

    // El contexto viaja en el propio botón: booking.js lo lee de acá.
    cta.dataset.recomendados = ids.join(',');
    cta.dataset.respuestas = JSON.stringify(respuestas);

    anuncio.textContent = `Recomendación lista: ${ids.map((i) => SERVICIOS[i].nombre).join(', ')}.`;
    mostrar(CLAVES.length);
  };

  raiz.addEventListener('click', (e) => {
    const op = e.target.closest('.finder-op');
    if (!op) return;
    respuestas[CLAVES[indice]] = op.dataset.valor;
    indice + 1 >= CLAVES.length ? renderResultado() : mostrar(indice + 1);
  });

  atras.addEventListener('click', () => mostrar(Math.max(0, indice - 1)));

  reiniciar.addEventListener('click', () => {
    respuestas = {};
    mostrar(0);
    raiz.querySelector('.finder-op')?.focus();
  });

  mostrar(0);
}
