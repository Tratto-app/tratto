/**
 * nav.js — barra superior, menú mobile y link activo.
 */

const UMBRAL = 40;

export function iniciarNav() {
  const nav = document.querySelector('[data-nav]');
  const btn = document.getElementById('btn-menu');
  const panel = document.getElementById('panel-menu');
  if (!nav) return;

  /* ── Estado compacto al salir del hero ─────────────────────────────── */
  let ultimo = 0;
  let anclado = 0;   // hasta cuándo hay que dejar la barra quieta

  const alScrollear = () => {
    const y = window.scrollY;
    nav.classList.toggle('compacta', y > UMBRAL);
    // Se esconde al bajar y vuelve al subir, solo bien lejos del inicio.
    // Durante un salto a un ancla no se esconde: si no, el usuario llega al
    // destino y la barra ya no está donde la dejó.
    const bajando = y > ultimo && y > 340 && Date.now() > anclado;
    if (!panel?.dataset.abierto || panel.dataset.abierto === 'false') {
      nav.classList.toggle('oculta', bajando);
    }
    ultimo = y;
  };

  // Cualquier salto interno mantiene la barra a la vista mientras dura.
  document.addEventListener('click', (e) => {
    if (!e.target.closest('a[href^="#"]')) return;
    anclado = Date.now() + 1200;
    nav.classList.remove('oculta');
  });
  alScrollear();
  addEventListener('scroll', alScrollear, { passive: true });

  /* ── Menú mobile ───────────────────────────────────────────────────── */
  if (btn && panel) {
    let devolverFoco = null;

    const abrir = () => {
      panel.dataset.abierto = 'true';
      panel.removeAttribute('inert');
      btn.setAttribute('aria-expanded', 'true');
      btn.querySelector('.oculto-visual').textContent = 'Cerrar menú';
      document.body.classList.add('cuerpo-bloqueado');
      nav.classList.remove('oculta');
      devolverFoco = document.activeElement;
      panel.querySelector('a')?.focus();
    };

    const cerrar = ({ foco = true } = {}) => {
      if (panel.dataset.abierto !== 'true') return;
      // El foco sale del panel antes de marcarlo inert, si no queda huérfano.
      if (foco && devolverFoco) devolverFoco.focus();
      else if (panel.contains(document.activeElement)) btn.focus();
      panel.dataset.abierto = 'false';
      panel.setAttribute('inert', '');
      btn.setAttribute('aria-expanded', 'false');
      btn.querySelector('.oculto-visual').textContent = 'Abrir menú';
      document.body.classList.remove('cuerpo-bloqueado');
    };

    btn.addEventListener('click', () => {
      panel.dataset.abierto === 'true' ? cerrar() : abrir();
    });

    panel.addEventListener('click', (e) => {
      if (e.target.closest('a')) cerrar({ foco: false });
    });

    addEventListener('keydown', (e) => {
      if (e.key === 'Escape') cerrar();
    });

    // El menú es solo para pantallas chicas: si se agranda, se cierra.
    matchMedia('(min-width: 1060px)').addEventListener('change', (e) => {
      if (e.matches) cerrar({ foco: false });
    });
  }

  /* ── Sección activa ────────────────────────────────────────────────── */
  const links = [...document.querySelectorAll('.nav-menu a[href^="#"]')];
  const secciones = links
    .map((a) => document.querySelector(a.getAttribute('href')))
    .filter(Boolean);
  if (!secciones.length || !('IntersectionObserver' in window)) return;

  const activar = (id) => {
    links.forEach((a) => {
      const esta = a.getAttribute('href') === `#${id}`;
      esta ? a.setAttribute('aria-current', 'true') : a.removeAttribute('aria-current');
    });
  };

  const visto = new Set();
  const obs = new IntersectionObserver((entradas) => {
    entradas.forEach((e) => (e.isIntersecting ? visto.add(e.target) : visto.delete(e.target)));
    // Con varias secciones en pantalla, gana la que está más arriba.
    const arriba = [...visto].sort((a, b) => a.offsetTop - b.offsetTop)[0];
    if (arriba) activar(arriba.id);
  }, { rootMargin: '-45% 0px -45% 0px' });

  secciones.forEach((s) => obs.observe(s));
}
