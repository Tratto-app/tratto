// Base común de los carruseles: íconos (mismo trazo que publicidad-comun.js),
// logo, fondo panorámico continuo y cabecera con el número de placa.
// Cada placa es <section class="placa" data-n="3"> y adentro usa
// <i data-ico="huella"></i> donde va un ícono.
(function () {
  const LOGO = (px, id) => `<svg width='${px}' height='${px}' viewBox='0 0 32 32' fill='none'><defs><linearGradient id='${id}' gradientUnits='userSpaceOnUse' x1='10.3' y1='10.37' x2='22.54' y2='22.46'><stop offset='0' stop-color='#96E7CE'/><stop offset='1' stop-color='#62AD98'/></linearGradient></defs><path d='M10.3 10.37 L22.54 22.46' stroke='url(#${id})' stroke-width='2.39'/><circle cx='7.47' cy='7.58' r='5.23' stroke='#9EECD4' stroke-width='2.5'/><path d='M10.3 10.37 L12.08 12.13' stroke='#96E7CE' stroke-width='2.39'/><circle cx='25.12' cy='25.02' r='4.76' stroke='#F7CA55' stroke-width='2.24'/><path d='M20.95 20.89 L22.54 22.46' stroke='#9EECD4' stroke-opacity='.32' stroke-width='2.39'/></svg>`;
  window.LOGO = LOGO;

  const ICONOS = {
    // de publicidad-comun.js
    pedido: '<path d="M14 12h28l8 8v32H14z"/><path d="M22 30h20M22 39h14"/><path d="M42 12v8h8"/>',
    chat: '<path d="M10 16h44v26H30l-10 9v-9H10z"/><path d="M20 26h24M20 33h16"/>',
    plata: '<circle cx="32" cy="32" r="22"/><path d="M38 24c-2-3-11-4-12 1-1 6 13 4 12 10-1 5-10 4-13 1M32 18v4M32 42v4"/>',
    // nuevos, mismo trazo (viewBox 64, stroke 4, puntas redondas)
    idioma: '<path d="M8 10h32v22H24l-9 8v-8H8z"/><path d="M40 22h16v22h-6v8l-9-8H28v-6"/><path d="M16 21h16"/>',
    esmalte: '<rect x="18" y="30" width="28" height="24" rx="6"/><path d="M24 30v-8h16v8"/><path d="M28 22V9h8v13"/>',
    volante: '<circle cx="32" cy="32" r="23"/><circle cx="32" cy="32" r="6"/><path d="M9.5 29h16.5M38 29h16.5M32 38v17"/>',
    camion: '<path d="M6 16h32v26H6z"/><path d="M38 24h11l9 10v8H38z"/><circle cx="17" cy="46" r="5" fill="#fff"/><circle cx="46" cy="46" r="5" fill="#fff"/>',
    huella: '<path d="M32 34c-9 0-15 8-15 14 0 5 4 7 8 6 3-1 5-2 7-2s4 1 7 2c4 1 8-1 8-6 0-6-6-14-15-14z"/><ellipse cx="15" cy="27" rx="4.5" ry="5.5"/><ellipse cx="25" cy="16" rx="4.5" ry="6"/><ellipse cx="39" cy="16" rx="4.5" ry="6"/><ellipse cx="49" cy="27" rx="4.5" ry="5.5"/>',
    globo: '<ellipse cx="32" cy="25" rx="15" ry="18"/><path d="M28.5 43h7L32 47.5z"/><path d="M32 47.5c-5 4 5 7 0 12"/>',
    torta: '<path d="M10 54h44V34H10z"/><path d="M10 43c5 3 9 3 13 0s9-3 13 0 9 3 13 0"/><path d="M22 34v-9M32 34v-9M42 34v-9"/><path d="M22 18v-2M32 18v-2M42 18v-2"/>',
    libro: '<path d="M7 13h17c5 0 8 3 8 7v34c0-3-3-5-8-5H7z"/><path d="M57 13H40c-5 0-8 3-8 7v34c0-3 3-5 8-5h17z"/>',
    check: '<circle cx="32" cy="32" r="24"/><path d="M21 33l7.5 7.5L44 25"/>',
    cruz: '<circle cx="32" cy="32" r="24"/><path d="M23.5 23.5l17 17M40.5 23.5l-17 17"/>',
    reloj: '<circle cx="32" cy="32" r="24"/><path d="M32 17v16l10 6"/>',
    nota: '<path d="M24 46V15l26-6v31"/><circle cx="18" cy="46" r="6"/><circle cx="44" cy="40" r="6"/>',
    camara: '<rect x="7" y="19" width="50" height="34" rx="7"/><path d="M22 19l4-7h12l4 7"/><circle cx="32" cy="36" r="9"/>',
    calendario: '<rect x="9" y="14" width="46" height="41" rx="7"/><path d="M9 26h46M21 8v11M43 8v11"/><path d="M19 36h6M30 36h6M41 36h4M19 45h6M30 45h6"/>',
    billete: '<rect x="6" y="17" width="52" height="31" rx="5"/><circle cx="32" cy="32.5" r="7.5"/><path d="M15 25v15M49 25v15"/>',
    guardar: '<path d="M18 9h28v46L32 45 18 55z"/>',
    flecha: '<path d="M12 32h38M36 18l14 14-14 14"/>',
    // checklist de mudanza (23/10/2026)
    mueble: '<rect x="10" y="12" width="44" height="38" rx="4"/><path d="M10 31h44M32 12v38"/><path d="M25 22h-3M42 22h-3M25 41h-3M42 41h-3"/><path d="M15 50v5M49 50v5"/>',
    rodillo: '<rect x="8" y="10" width="38" height="14" rx="4"/><path d="M46 17h7v14H32v8"/><rect x="28" y="39" width="8" height="16" rx="3"/>',
    escoba: '<path d="M42 7L30 33"/><path d="M19 31l22 9-5 16H12z"/><path d="M21 44l-3 11M29 47l-3 8"/>',
    llave: '<circle cx="19" cy="32" r="10"/><path d="M29 32h27M48 32v9M56 32v7"/>',
    aire: '<rect x="6" y="13" width="52" height="21" rx="5"/><path d="M14 26h36"/><path d="M20 42c0 4-4 5-4 9M32 42c0 4-4 5-4 9M44 42c0 4-4 5-4 9"/>',
    cuadro: '<path d="M32 9L19 22M32 9l13 13"/><rect x="10" y="22" width="44" height="32" rx="3"/><path d="M15 48l11-11 8 8 6-6 9 9"/>',
    casa: '<path d="M8 30L32 10l24 20"/><path d="M14 26v28h36V26"/><path d="M27 54V40h10v14"/>',
    // cumple infantil y fotos antes de pedir (25/10/2026)
    banderines: '<path d="M6 12c17 9 35 9 52 0"/><path d="M12 15l5 17 7-14"/><path d="M28 19l4 17 4-17"/><path d="M40 18l7 14 5-17"/>',
    cupcake: '<path d="M15 32h34l-5 22H20z"/><path d="M15 32c0-9 7-15 17-15s17 6 17 15"/><path d="M32 17v-6"/><path d="M26 32l2 22M38 32l-2 22"/>',
    gota: '<path d="M32 8C24 21 16 30 16 39a16 16 0 0 0 32 0c0-9-8-18-16-31z"/><path d="M25 41a7 7 0 0 0 7 7"/>',
    pared: '<rect x="8" y="12" width="48" height="40" rx="3"/><path d="M8 25h48M8 38h48M24 12v13M40 12v13M16 25v13M32 25v13M48 25v13M24 38v14M40 38v14"/>',
    remera: '<path d="M22 10l-14 8 6 11 6-3v28h24V26l6 3 6-11-14-8c-2 5-6 7-10 7s-8-2-10-7z"/>',
    metro: '<rect x="8" y="22" width="48" height="20" rx="4"/><path d="M16 22v8M24 22v5M32 22v8M40 22v5M48 22v8"/>',
    // antes del calor (28/10/2026)
    sol: '<circle cx="32" cy="32" r="11"/><path d="M32 6v7M32 51v7M6 32h7M51 32h7M13.6 13.6l5 5M45.4 45.4l5 5M13.6 50.4l5-5M45.4 18.6l5-5"/>',
    pileta: '<path d="M22 40V14a5 5 0 0 1 10 0M38 40V14a5 5 0 0 1 10 0M22 22h16M22 31h16"/><path d="M6 48c5 4 9 4 13 0s9-4 13 0 9 4 13 0 9-4 13 0"/>',
    pasto: '<path d="M6 54h52"/><path d="M12 54c0-10-3-17-6-22M21 54c0-14 2-24 6-32M31 54c0-12-4-20-9-26M40 54c0-15 3-26 9-34M50 54c0-10 3-18 8-23"/>',
    arbol: '<path d="M20 38a10 10 0 0 1-3-19 15 15 0 0 1 29-2 10 10 0 0 1 1 21z"/><path d="M32 56V30M32 44l-7-6M32 39l6-5"/>',
    techo: '<path d="M6 32L32 10l26 22"/><path d="M32 36c-5 7-7 10-7 13a7 7 0 0 0 14 0c0-3-2-6-7-13z"/>',
    // nombre técnico, a quién llamo (mueble) y entregar el depto (28/10/2026)
    canilla: '<path d="M8 22h26a8 8 0 0 1 8 8v4"/><path d="M8 15v14"/><path d="M22 22v-9M15 13h14"/><path d="M42 42c0 4-3 6-3 9a3 3 0 0 0 6 0c0-3-3-5-3-9z"/>',
    inodoro: '<rect x="12" y="8" width="26" height="16" rx="3"/><path d="M8 28h44c0 9-7 15-16 16v10H20V44c-7-2-12-8-12-16z"/>',
    sillon: '<path d="M14 30V20a6 6 0 0 1 6-6h24a6 6 0 0 1 6 6v10"/><rect x="6" y="30" width="10" height="16" rx="4"/><rect x="48" y="30" width="10" height="16" rx="4"/><path d="M16 36h32v10H16z"/><path d="M12 46v6M52 46v6"/>',
    puerta: '<rect x="16" y="8" width="32" height="48" rx="2"/><path d="M39 33h3"/><path d="M8 56h48"/>',
    cajon: '<rect x="8" y="12" width="48" height="40" rx="4"/><path d="M8 32h48"/><path d="M27 22h10M27 42h10"/>',
    silla: '<path d="M20 8v48"/><path d="M46 38v18"/><rect x="18" y="30" width="32" height="8" rx="3"/>',
    cerradura: '<rect x="18" y="8" width="28" height="48" rx="6"/><circle cx="32" cy="28" r="5"/><path d="M32 33v10"/>',
  };
  const icono = (n, px = 64, color = 'currentColor', grosor = 4) =>
    `<svg width="${px}" height="${px}" viewBox="0 0 64 64" fill="none" stroke="${color}" stroke-width="${grosor}" stroke-linecap="round" stroke-linejoin="round">${ICONOS[n]}</svg>`;
  window.icono = icono;

  // Manchas del panorama (en coordenadas del carrusel entero: 10800 x 1350)
  const MANCHAS = [
    ['mv', -300, -250, 1000], ['ml', 650, 820, 900], ['mc', 1500, -300, 900], ['mv', 2250, 700, 1000],
    ['ml', 3000, -200, 800], ['mc', 3600, 760, 1000], ['mv', 4350, -320, 900], ['ml', 5150, 720, 900],
    ['mc', 5800, -250, 1000], ['mv', 6550, 780, 900], ['ml', 7250, -200, 900], ['mc', 8000, 700, 1000],
    ['mv', 8700, -300, 900], ['ml', 9500, 760, 900], ['mc', 10200, -150, 900],
  ];
  const panorama = MANCHAS.map(([c, x, y, d]) =>
    `<div class="mancha ${c}" style="left:${x}px;top:${y}px;width:${d}px;height:${d}px"></div>`).join('') + '<div class="grano"></div>';

  const total = document.querySelectorAll('.placa').length;
  document.querySelectorAll('.placa').forEach((p, i) => {
    p.style.setProperty('--i', i);
    if (p.classList.contains('noche')) p.insertAdjacentHTML('afterbegin', '<div class="fondo-noche"></div>');
    else p.insertAdjacentHTML('afterbegin', `<div class="pano">${panorama}</div>`);
    const cont = p.querySelector('.cont');
    const n = String(i + 1).padStart(2, '0');
    cont.insertAdjacentHTML('afterbegin',
      `<div class="cab"><div class="marca"><div class="logo">${LOGO(40, 'lg' + i)}</div><span>TRATTO</span></div>` +
      `<div class="cuenta"><b>${n}</b> / ${String(total).padStart(2, '0')}</div></div>`);
  });
  // Versión para TikTok (render-carrusel.py --red tiktok): cambia el link de
  // Instagram por el de TikTok y lo que en TikTok no va, como "link en la bio"
  // (protocolo de contenido, sección 8.2). data-tiktok="" saca el elemento.
  if (new URLSearchParams(location.search).get('red') === 'tiktok') {
    document.querySelectorAll('[data-tiktok]').forEach(el => {
      if (el.dataset.tiktok) el.textContent = el.dataset.tiktok; else el.remove();
    });
  }
  document.querySelectorAll('[data-ico]').forEach(el => {
    const px = +(el.dataset.px || 64);
    el.outerHTML = icono(el.dataset.ico, px, el.dataset.color || 'currentColor', +(el.dataset.grosor || 4));
  });
})();
