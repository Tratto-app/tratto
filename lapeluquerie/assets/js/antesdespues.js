/**
 * antesdespues.js — comparador con tirador.
 *
 * El control real es un <input type="range"> invisible encima del visor: así
 * funciona con mouse, con dedo y con las flechas del teclado, y los lectores de
 * pantalla lo anuncian como lo que es. La línea y el círculo son decorado.
 */

export function iniciarAntesDespues() {
  const raiz = document.querySelector('[data-ad]');
  if (!raiz) return;

  const visor = raiz.querySelector('[data-ad-visor]');
  const control = raiz.querySelector('[data-ad-control]');
  const antes = raiz.querySelector('[data-ad-antes]');
  const despues = raiz.querySelector('[data-ad-despues]');
  const titulo = raiz.querySelector('[data-ad-titulo]');
  const nota = raiz.querySelector('[data-ad-nota]');
  const sesiones = raiz.querySelector('[data-ad-sesiones]');
  const cta = raiz.querySelector('[data-ad-cta]');
  const botones = [...raiz.querySelectorAll('[data-ad-ir]')];

  const plantilla = document.querySelector('[data-ad-datos]');
  const datos = plantilla ? [...plantilla.content.querySelectorAll('span')].map((s) => ({ ...s.dataset })) : [];
  if (!datos.length) return;

  const posicionar = (v) => visor.style.setProperty('--pos', `${v}%`);
  control.addEventListener('input', () => posicionar(control.value));
  posicionar(control.value);

  const ir = (i) => {
    const d = datos[i];
    if (!d) return;

    antes.src = d.antes;
    antes.alt = d.altAntes;
    despues.src = d.despues;
    despues.alt = d.altDespues;
    titulo.textContent = d.titulo;
    nota.textContent = d.nota;
    sesiones.textContent = d.sesiones;

    cta.dataset.titulo = d.titulo;
    cta.dataset.sesiones = d.sesiones;
    cta.dataset.servicioId = d.servicio;

    botones.forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.adIr) === i)));

    // Se vuelve al medio para que el cambio se vea de entrada.
    control.value = 50;
    posicionar(50);
  };

  botones.forEach((b) => b.addEventListener('click', () => ir(Number(b.dataset.adIr))));
  ir(0);
}
