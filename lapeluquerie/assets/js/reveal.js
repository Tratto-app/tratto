/**
 * reveal.js — aparición al entrar en pantalla.
 * Se anima una sola vez por elemento. Con prefers-reduced-motion el CSS ya deja
 * todo visible, así que acá directamente no observamos nada.
 */

export function iniciarReveal() {
  const elementos = document.querySelectorAll('.revelar, .revelar-foto');
  if (!elementos.length) return;

  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce || !('IntersectionObserver' in window)) {
    elementos.forEach((el) => (el.dataset.visible = 'true'));
    return;
  }

  const obs = new IntersectionObserver((entradas) => {
    entradas.forEach((e) => {
      if (!e.isIntersecting) return;
      e.target.dataset.visible = 'true';
      obs.unobserve(e.target);
    });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.06 });

  elementos.forEach((el) => obs.observe(el));
}
