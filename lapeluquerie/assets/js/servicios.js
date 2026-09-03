/**
 * servicios.js — acordeón de servicios y foto sincronizada en escritorio.
 */

import { SERVICIOS } from './config.js';

export function iniciarServicios() {
  const lista = document.querySelector('[data-servicios]');
  if (!lista) return;

  const figura = document.querySelector('[data-servicios-foto]');
  const fotos = figura ? [...figura.querySelectorAll('img[data-para]')] : [];
  const nombreFoto = figura?.querySelector('[data-foto-nombre]');
  const durFoto = figura?.querySelector('[data-foto-dur]');

  const mostrarFoto = (id) => {
    if (!fotos.length) return;
    fotos.forEach((img) => {
      img.dataset.activa = String(img.dataset.para === id);
    });
    const s = SERVICIOS[id];
    if (s && nombreFoto && durFoto) {
      nombreFoto.textContent = s.nombre;
      durFoto.textContent = s.duracion;
    }
  };

  const items = [...lista.querySelectorAll('.servicio')];

  /* Un panel cerrado tiene alto cero pero sus links siguen siendo enfocables:
     quien navega con teclado caía en controles que no ve. `inert` los saca del
     orden de tabulación sin romper la animación de apertura. */
  const cerrar = (item) => {
    item.dataset.abierto = 'false';
    item.querySelector('.servicio-cabeza').setAttribute('aria-expanded', 'false');
    item.querySelector('.servicio-panel').setAttribute('inert', '');
  };

  const abrir = (item) => {
    item.dataset.abierto = 'true';
    item.querySelector('.servicio-cabeza').setAttribute('aria-expanded', 'true');
    item.querySelector('.servicio-panel').removeAttribute('inert');
    mostrarFoto(item.dataset.servicio);
  };

  items.forEach(cerrar);

  items.forEach((item) => {
    const boton = item.querySelector('.servicio-cabeza');
    const id = item.dataset.servicio;

    boton.addEventListener('click', () => {
      const estaba = item.dataset.abierto === 'true';
      // Acordeón de uno solo: dos paneles abiertos rompen el ritmo de la lista.
      items.forEach(cerrar);
      if (!estaba) abrir(item);
    });

    // En escritorio la foto acompaña la fila que se está mirando.
    const seguir = () => mostrarFoto(id);
    boton.addEventListener('pointerenter', seguir);
    boton.addEventListener('focus', seguir);
  });
}
