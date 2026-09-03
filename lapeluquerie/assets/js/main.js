/**
 * main.js — arranque.
 *
 * Cada módulo se ocupa de una cosa y sale si su marcador no está en la página,
 * así el mismo bundle sirve para futuras páginas internas sin tocar nada.
 */

import { iniciarNav } from './nav.js';
import { iniciarDatos } from './datos.js';
import { iniciarServicios } from './servicios.js';
import { iniciarFinder } from './finder.js';
import { iniciarGaleria } from './galeria.js';
import { iniciarAntesDespues } from './antesdespues.js';
import { iniciarForm } from './form.js';
import { iniciarBarra } from './barra.js';
import { iniciarReveal } from './reveal.js';
import { abrirReserva, contextoDe } from './booking.js';

/**
 * Un único punto de entrada para todos los CTA de reserva del sitio.
 * Sin JavaScript, cada uno sigue siendo un ancla a #reservar: la página no
 * queda sin salida.
 */
function iniciarReservas() {
  document.addEventListener('click', (e) => {
    const cta = e.target.closest('[data-reservar]');
    if (!cta) return;

    e.preventDefault();
    const ctx = contextoDe(cta);

    // El buscador deja su resultado en el propio botón.
    if (cta.dataset.recomendados) {
      ctx.recomendados = cta.dataset.recomendados.split(',');
      try {
        ctx.respuestas = JSON.parse(cta.dataset.respuestas || '{}');
      } catch {
        ctx.respuestas = {};
      }
    }

    abrirReserva(ctx);
  });

  document.querySelector('[data-aviso-cerrar]')?.addEventListener('click', () => {
    document.querySelector('[data-aviso-reserva]')?.close();
  });
}

function iniciar() {
  iniciarDatos();
  iniciarNav();
  iniciarServicios();
  iniciarFinder();
  iniciarGaleria();
  iniciarAntesDespues();
  iniciarForm();
  iniciarBarra();
  iniciarReveal();
  iniciarReservas();

  // Panel de control de datos pendientes: solo con ?revisar=1 en la URL.
  if (new URLSearchParams(location.search).has('revisar')) {
    import('./revisar.js').then((m) => m.iniciarRevision());
  }
}

document.readyState === 'loading'
  ? document.addEventListener('DOMContentLoaded', iniciar)
  : iniciar();
