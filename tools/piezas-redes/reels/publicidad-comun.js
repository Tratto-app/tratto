// Base de las publicidades estilo "presentación de producto": fondo claro con
// manchas de color que se mueven, títulos grandes que entran con desenfoque,
// palabras que se reemplazan, lista de funciones con íconos, pantallas en 3D y
// cierre oscuro con el logo. Cada publicidad define window.PUBLI = { escenas }
// antes de cargar este archivo. render(t) dibuja el cuadro del segundo t.
(function () {
  const W = 1080, H = 1920;
  const cl = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
  const P = (t, a, b) => cl((t - a) / (b - a));
  const eo = x => 1 - Math.pow(1 - x, 3);
  const eio = x => x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
  const back = x => { const c = 1.7; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };
  window.U = { W, H, cl, P, eo, eio, back };

  const LOGO = (px, id) => `<svg width='${px}' height='${px}' viewBox='0 0 32 32' fill='none'><defs><linearGradient id='${id}' gradientUnits='userSpaceOnUse' x1='10.3' y1='10.37' x2='22.54' y2='22.46'><stop offset='0' stop-color='#96E7CE'/><stop offset='1' stop-color='#62AD98'/></linearGradient></defs><path d='M10.3 10.37 L22.54 22.46' stroke='url(#${id})' stroke-width='2.39'/><circle cx='7.47' cy='7.58' r='5.23' stroke='#9EECD4' stroke-width='2.5'/><path d='M10.3 10.37 L12.08 12.13' stroke='#96E7CE' stroke-width='2.39'/><circle cx='25.12' cy='25.02' r='4.76' stroke='#F7CA55' stroke-width='2.24'/><path d='M20.95 20.89 L22.54 22.46' stroke='#9EECD4' stroke-opacity='.32' stroke-width='2.39'/></svg>`;
  window.LOGO = LOGO;

  const ICONOS = {
    lista: '<rect x="12" y="10" width="40" height="44" rx="6"/><path d="M22 24h20M22 33h20M22 42h12"/>',
    plata: '<circle cx="32" cy="32" r="22"/><path d="M38 24c-2-3-11-4-12 1-1 6 13 4 12 10-1 5-10 4-13 1M32 18v4M32 42v4"/>',
    medidor: '<path d="M10 42a22 22 0 0 1 44 0"/><path d="M32 42l12-12"/><circle cx="32" cy="42" r="3" fill="currentColor"/>',
    pedido: '<path d="M14 12h28l8 8v32H14z"/><path d="M22 30h20M22 39h14"/><path d="M42 12v8h8"/>',
    presupuesto: '<rect x="10" y="14" width="44" height="36" rx="6"/><path d="M10 24h44"/><path d="M20 36h10M20 42h18"/>',
    chat: '<path d="M10 16h44v26H30l-10 9v-9H10z"/><path d="M20 26h24M20 33h16"/>',
    estrella: '<path d="M32 10l6.5 13.5 14.5 2-10.5 10 2.5 14.5L32 43l-13 7 2.5-14.5L11 25.5l14.5-2z"/>',
  };
  window.icono = (n, px = 92, color = 'currentColor') =>
    `<svg width="${px}" height="${px}" viewBox="0 0 64 64" fill="none" stroke="${color}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round">${ICONOS[n]}</svg>`;

  // Lienzo: fondo con manchas, capa de escenas y cortina oscura del cierre.
  document.body.insertAdjacentHTML('afterbegin', `
    <div id="fondo"><div class="mancha m1"></div><div class="mancha m2"></div><div class="mancha m3"></div><div class="grano"></div></div>
    <div id="escena"></div>
    <div id="noche"></div>
    <div style="position:absolute;opacity:0;pointer-events:none">
      <span style="font-family:'IBM Plex Sans Condensed';font-weight:700">a</span><span style="font-family:'IBM Plex Sans Condensed';font-weight:600">a</span>
      <span style="font-family:'IBM Plex Sans';font-weight:500">a</span><span style="font-family:'IBM Plex Sans';font-weight:600">a</span>
      <span style="font-family:'IBM Plex Mono';font-weight:600">a</span><span style="font-family:Montserrat;font-weight:600">a</span></div>`);
  // Link fijo en pantalla (en TikTok no hay link en la bio): PUBLI.url = [texto, desde]
  if (window.PUBLI.url) document.body.insertAdjacentHTML('beforeend',
    `<div id="link-fijo" class="link-fijo"><span class="lf-ico">${LOGO(40, 'glf')}</span><span>${window.PUBLI.url[0]}</span></div>`);
  const linkFijo = document.getElementById('link-fijo');
  const escena = document.getElementById('escena');
  const noche = document.getElementById('noche');
  const manchas = [...document.querySelectorAll('.mancha')];

  // Cada escena del guion: { a, b, html, animar(t, raiz) }
  const escenas = (window.PUBLI.escenas || []).map(s => {
    const raiz = document.createElement('div');
    raiz.className = 'capa';
    raiz.innerHTML = typeof s.html === 'function' ? s.html() : s.html;
    escena.appendChild(raiz);
    return Object.assign({ raiz }, s);
  });

  // Entrada con desenfoque (como los títulos de la referencia) y salida.
  window.entra = (el, t, t0, d = .55, o = {}) => {
    const y = o.y ?? 46, blur = o.blur ?? 18, s0 = o.escala ?? .97;
    const k = eo(P(t, t0, t0 + d));
    el.style.opacity = k;
    el.style.filter = k < 1 ? `blur(${(1 - k) * blur}px)` : 'none';
    el.style.transform = `translateY(${(1 - k) * y}px) scale(${s0 + (1 - s0) * k})` + (o.extra || '');
    return k;
  };
  window.sale = (el, t, t0, d = .35, o = {}) => {
    if (t < t0) return 1;
    const k = eo(P(t, t0, t0 + d));
    el.style.opacity = (1 - k) * (parseFloat(el.style.opacity) || 1);
    el.style.filter = `blur(${k * (o.blur ?? 14)}px)`;
    el.style.transform = (el.style.transform || '') + ` translateY(${-k * (o.y ?? 30)}px)`;
    return 1 - k;
  };
  // Muestra la palabra i de una lista que se reemplaza en el lugar.
  window.cambia = (els, t, tiempos, d = .4) => {
    els.forEach((el, i) => {
      const t0 = tiempos[i], t1 = tiempos[i + 1];
      if (t < t0 - .01) { el.style.opacity = 0; return; }
      entra(el, t, t0, d, { y: 40, blur: 20 });
      if (t1 !== undefined) sale(el, t, t1 - .18, .3);
    });
  };

  window.render = t => {
    // Manchas en movimiento lento
    const mv = [[.22, .2, 260], [.78, .55, 300], [.35, .85, 240]];
    manchas.forEach((m, i) => {
      const [x, y, r] = mv[i];
      m.style.transform = `translate(${Math.sin(t * .35 + i * 2) * r}px, ${Math.cos(t * .28 + i) * r * .7}px)`;
      m.style.left = (x * W - 450) + 'px'; m.style.top = (y * H - 450) + 'px';
    });
    escenas.forEach(s => {
      const vivo = t >= s.a - .05 && t <= s.b + .05;
      s.raiz.style.display = vivo ? 'block' : 'none';
      if (vivo && s.animar) s.animar(t, s.raiz);
    });
    if (linkFijo) {
      const k = eo(P(t, window.PUBLI.url[1], window.PUBLI.url[1] + .5)) * (1 - eo(P(t, (window.PUBLI.cierre ?? 99) - .3, window.PUBLI.cierre ?? 99)));
      linkFijo.style.opacity = k;
      linkFijo.style.transform = `translateX(-50%) translateY(${(1 - k) * 20}px)`;
    }
    // Cierre: la cortina oscura se abre en círculo desde el centro
    const c = window.PUBLI.cierre;
    if (c !== undefined) {
      const k = eio(P(t, c, c + .7));
      noche.style.clipPath = `circle(${k * 125}% at 50% 52%)`;
      noche.style.display = k > 0 ? 'block' : 'none';
    }
  };
  render(0);
})();
