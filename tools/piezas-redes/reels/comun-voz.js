// Base de la serie de reels con voz: mismo fondo, marca, subtítulos palabra por
// palabra, entrada "latigazo" de escenas, golpes de cámara y cierre que
// reel-tratto-voz.html. Cada reel define window.REEL antes de cargar este archivo:
//   escenas: [[id, entra, sale], ...]   golpes: [t, ...]   sinSubs: [[a, b], ...]
//   cierre: {entra, logo, a: [texto, t], b: [texto, t], sello: [texto, t]}
//   animar(t): lo propio de cada escena
const cl = (x) => Math.min(Math.max(x, 0), 1);
const P = (t, a, b) => cl((t - a) / (b - a));
const eo = (x) => 1 - Math.pow(1 - cl(x), 3);
const back = (x) => { x = cl(x); const c = 1.9; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };
const $ = (id) => document.getElementById(id);
const set = (el, o, tr) => { el.style.opacity = o; if (tr !== undefined) el.style.transform = tr; };
const pop = (el, t, a, base = '', dur = 0.38) => { const s = back(P(t, a, a + dur)); set(el, P(t, a, a + 0.1), `${base} scale(${Math.max(s, 0)})`); };
const C = 'translate(-50%,-50%)';
const LOGO = (px, id) => `<svg width='${px}' height='${px}' viewBox='0 0 32 32' fill='none'><defs><linearGradient id='${id}' gradientUnits='userSpaceOnUse' x1='10.3' y1='10.37' x2='22.54' y2='22.46'><stop offset='0' stop-color='#96E7CE'/><stop offset='1' stop-color='#62AD98'/></linearGradient></defs><path d='M10.3 10.37 L22.54 22.46' stroke='url(#${id})' stroke-width='2.39'/><circle cx='7.47' cy='7.58' r='5.23' stroke='#9EECD4' stroke-width='2.5'/><path d='M10.3 10.37 L12.08 12.13' stroke='#96E7CE' stroke-width='2.39'/><circle cx='25.12' cy='25.02' r='4.76' stroke='#F7CA55' stroke-width='2.24'/><path d='M20.95 20.89 L22.54 22.46' stroke='#9EECD4' stroke-opacity='.32' stroke-width='2.39'/></svg>`;
const TEL = (color, px = 110) => `<svg width="${px}" height="${px}" viewBox="0 0 24 24"><path fill="${color}" d="M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25 11.4 11.4 0 0 0 3.6.57 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.57 3.6a1 1 0 0 1-.25 1z"/></svg>`;
const TILDE = (px = 120) => `<svg width="${px}" height="${px}" viewBox="0 0 120 120"><circle cx="60" cy="60" r="56" fill="#F7CA55"/><path d="M34 62 L52 80 L88 42" fill="none" stroke="#0E1815" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const ESTRELLA = (px, lleno) => `<svg width="${px}" height="${px}" viewBox="0 0 24 24"><path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.8z" fill="${lleno ? '#F7CA55' : 'none'}" stroke="#F7CA55" stroke-width="1.6" stroke-linejoin="round"/></svg>`;

(function armar() {
  const R = window.REEL, lienzo = $('lienzo');
  lienzo.insertAdjacentHTML('afterbegin', `
    <div class="mancha-fondo" id="bg1" style="width:900px;height:900px;background:#2B7E62;left:-300px;top:-200px"></div>
    <div class="mancha-fondo" id="bg2" style="width:700px;height:700px;background:#C9A227;left:600px;top:1300px;opacity:.22"></div>
    <div class="mancha-fondo" id="bg3" style="width:600px;height:600px;background:#1E5D49;left:500px;top:500px;opacity:.4"></div>
    <div id="negro"></div>
    <div class="marca">${LOGO(48, 'gx')}<span>TRATTO</span></div>`);
  const c = R.cierre;
  $('escenario').insertAdjacentHTML('beforeend', `
    <div class="sc" id="sfin" style="top:330px"><div class="c" style="text-align:center;width:840px">
      <div id="fin-logo" style="opacity:0">${LOGO(210, 'gz')}
        <div style="font-family:Montserrat;font-weight:600;letter-spacing:.32em;font-size:70px;margin-top:20px;padding-left:.32em">TRATTO</div></div>
      <div class="cond" id="fin-a" style="font-size:96px;line-height:1.02;margin-top:70px;opacity:0">${c.a[0]}</div>
      <div class="cond" id="fin-b" style="font-size:96px;line-height:1.02;color:var(--laton-cl);opacity:0;white-space:nowrap">${c.b[0]}</div>
      <div id="fin-c" style="margin-top:60px;opacity:0"><span class="sello" style="font-size:30px;padding:12px 24px;border-width:3px">${c.sello[0]}</span></div>
    </div></div>`);
  R.escenas.push(['sfin', c.entra, 99]);
  lienzo.insertAdjacentHTML('beforeend', `<div id="subs"><div id="linea"></div></div><div id="flash"></div>
    <svg id="grano" width="1160" height="2000"><filter id="ruido"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" stitchTiles="stitch"/></filter><rect width="100%" height="100%" filter="url(#ruido)"/></svg>`);
})();

// ---------- subtítulos: grupos de hasta 3 palabras (igual que reel-tratto-voz) ----------
const GRUPOS = [];
{
  const W = window.PALABRAS || [];
  let g = [];
  W.forEach(([a, b, w], i) => {
    g.push([a, b, w]);
    const sig = W[i + 1];
    const corte = /[.,?!:]$/.test(w) || g.length >= 3 || !sig || sig[0] - b > 0.3;
    if (corte) { GRUPOS.push(g); g = []; }
  });
}
let grupoActual = -1;
function subtitulos(t) {
  const linea = $('linea');
  const oculto = REEL.sinSubs.some(([a, b]) => t >= a && t < b) || t >= REEL.cierre.entra;
  let gi = -1;
  for (let i = 0; i < GRUPOS.length; i++) {
    const ini = GRUPOS[i][0][0] - 0.05;
    const fin = i + 1 < GRUPOS.length ? Math.min(GRUPOS[i + 1][0][0] - 0.05, GRUPOS[i].at(-1)[1] + 0.6) : GRUPOS[i].at(-1)[1] + 0.6;
    if (t >= ini && t < fin) { gi = i; break; }
  }
  if (oculto || gi < 0) { linea.style.opacity = 0; return; }
  if (gi !== grupoActual) {
    linea.innerHTML = GRUPOS[gi].map(([, , w]) => `<span>${w}</span>`).join(' ');
    grupoActual = gi;
  }
  const g = GRUPOS[gi];
  const entra = eo(P(t, g[0][0] - 0.05, g[0][0] + 0.12));
  linea.style.opacity = 1;
  linea.style.transform = `translateY(${(1 - entra) * 30}px) scale(${0.92 + 0.08 * entra})`;
  [...linea.children].forEach((sp, k) => {
    const [a, b] = g[k];
    const activa = t >= a && t < b + 0.08;
    sp.className = t >= a ? (activa ? 'ahora' : 'ya') : 'no';
    const s = activa ? 1 + 0.12 * Math.exp(-(t - a) * 9) : 1;
    sp.style.transform = `scale(${s})`;
  });
}

// ---------- render ----------
window.render = function (t) {
  const R = window.REEL;
  $('bg1').style.transform = `translate(${Math.sin(t * 0.5) * 80}px,${Math.cos(t * 0.4) * 60}px)`;
  $('bg2').style.transform = `translate(${Math.cos(t * 0.35) * 90}px,${Math.sin(t * 0.45) * 70}px)`;
  $('bg3').style.transform = `translate(${Math.sin(t * 0.3 + 1) * 120}px,${Math.cos(t * 0.5) * 90}px)`;
  $('grano').style.transform = `translate(${(Math.floor(t * 24) * 37) % 40 - 20}px,${(Math.floor(t * 24) * 53) % 40 - 20}px)`;
  for (const [id, a, b] of R.escenas) {
    const el = $(id);
    if (t < a - 0.01 || t > b + 0.01) { el.style.opacity = 0; continue; }
    const e = a < 0 ? 1 : eo(P(t, a, a + 0.3));
    const s = 1 - P(t, b - 0.12, b);
    el.style.opacity = Math.min(e, s);
    el.style.transform = `translateX(${(1 - e) * 220}px) scale(${0.94 + 0.06 * e + (1 - s) * 0.08}) rotate(${(1 - e) * 3}deg)`;
    el.style.filter = e < 0.98 ? `blur(${(1 - e) * 14}px)` : 'none';
  }
  let golpe = 0;
  for (const g of R.golpes) if (t >= g) golpe = Math.max(golpe, 0.05 * Math.exp(-(t - g) * 7));
  $('escenario').style.transform = `scale(${1 + golpe})`;
  $('flash').style.opacity = 0;
  $('negro').style.opacity = 0;

  R.animar(t);

  // cierre
  const c = R.cierre;
  pop($('fin-logo'), t, c.logo, '');
  set($('fin-a'), eo(P(t, c.a[1], c.a[1] + 0.25)), `translateY(${(1 - eo(P(t, c.a[1], c.a[1] + 0.3))) * 40}px)`);
  pop($('fin-b'), t, c.b[1], '');
  set($('fin-c'), eo(P(t, c.sello[1], c.sello[1] + 0.3)), `rotate(-4deg) scale(${1 + 0.6 * (1 - eo(P(t, c.sello[1], c.sello[1] + 0.25)))})`);
  subtitulos(t);
};
