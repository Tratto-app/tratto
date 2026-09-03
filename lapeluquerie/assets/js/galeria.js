/**
 * galeria.js — filtros por categoría y visor ampliado.
 */

export function iniciarGaleria() {
  const grilla = document.querySelector('[data-galeria]');
  const filtros = document.querySelector('[data-filtros]');
  if (!grilla) return;

  const piezas = [...grilla.querySelectorAll('.pieza')];
  const vacio = document.querySelector('[data-galeria-vacio]');
  const anuncio = document.querySelector('[data-galeria-anuncio]');

  /* ── Filtros ───────────────────────────────────────────────────────── */
  let visibles = piezas;

  if (filtros) {
    const botones = [...filtros.querySelectorAll('.filtro')];

    filtros.addEventListener('click', (e) => {
      const btn = e.target.closest('.filtro');
      if (!btn) return;
      const cat = btn.dataset.cat;

      botones.forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
      piezas.forEach((p) => {
        p.hidden = cat !== 'todos' && p.dataset.cat !== cat;
      });

      visibles = piezas.filter((p) => !p.hidden);
      if (vacio) vacio.hidden = visibles.length > 0;
      anuncio.textContent = visibles.length
        ? `${visibles.length} ${visibles.length === 1 ? 'trabajo' : 'trabajos'} en ${btn.textContent.trim()}.`
        : `No hay trabajos cargados en ${btn.textContent.trim()}.`;
    });
  }

  /* ── Visor ─────────────────────────────────────────────────────────── */
  const lb = document.querySelector('[data-lightbox]');
  if (!lb) return;

  const img = lb.querySelector('[data-lb-img]');
  const cat = lb.querySelector('[data-lb-cat]');
  const titulo = lb.querySelector('[data-lb-titulo]');
  const nota = lb.querySelector('[data-lb-nota]');
  const cta = lb.querySelector('[data-lb-cta]');
  const contador = lb.querySelector('[data-lb-contador]');

  let actual = 0;

  const pintar = (i) => {
    const lista = visibles.length ? visibles : piezas;
    actual = (i + lista.length) % lista.length;
    const p = lista[actual];
    const original = p.querySelector('img');

    img.src = original.src;
    img.alt = original.alt;
    img.width = original.width;
    img.height = original.height;
    cat.textContent = p.dataset.cat;
    titulo.textContent = p.dataset.titulo;
    nota.textContent = p.dataset.nota;
    contador.textContent = `${actual + 1} / ${lista.length}`;

    // El CTA lleva el trabajo puntual: el mensaje sale con la referencia.
    cta.dataset.titulo = p.dataset.titulo;
    cta.dataset.servicioId = p.dataset.servicio;
  };

  const abrir = (i) => {
    pintar(i);
    lb.showModal();
  };

  grilla.addEventListener('click', (e) => {
    const p = e.target.closest('.pieza');
    if (!p) return;
    const lista = visibles.length ? visibles : piezas;
    abrir(lista.indexOf(p));
  });

  lb.querySelector('[data-lb-cerrar]').addEventListener('click', () => lb.close());
  lb.querySelector('[data-lb-prev]').addEventListener('click', () => pintar(actual - 1));
  lb.querySelector('[data-lb-next]').addEventListener('click', () => pintar(actual + 1));

  lb.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') { e.preventDefault(); pintar(actual - 1); }
    if (e.key === 'ArrowRight') { e.preventDefault(); pintar(actual + 1); }
  });

  // Clic sobre el fondo del diálogo, no sobre su contenido.
  lb.addEventListener('click', (e) => {
    if (e.target === lb) lb.close();
  });
}
