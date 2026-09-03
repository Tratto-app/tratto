/**
 * barra.js — CTA fijo en mobile.
 *
 * Aparece recién cuando el hero quedó atrás y se retira cuando la sección de
 * reservas entra en pantalla: nunca compite con el CTA real de esa sección.
 */

export function iniciarBarra() {
  const barra = document.querySelector('[data-barra-fija]');
  const hero = document.getElementById('inicio');
  const reservar = document.getElementById('reservar');
  if (!barra || !hero || !('IntersectionObserver' in window)) return;

  let heroFuera = false;
  let reservaDentro = false;

  const refrescar = () => {
    barra.dataset.visible = String(heroFuera && !reservaDentro);
  };

  new IntersectionObserver(([e]) => {
    heroFuera = !e.isIntersecting;
    refrescar();
  }, { threshold: 0, rootMargin: '-120px 0px 0px 0px' }).observe(hero);

  new IntersectionObserver(([e]) => {
    reservaDentro = e.isIntersecting;
    refrescar();
  }, { threshold: 0 }).observe(reservar);
}
