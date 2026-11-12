// Entrada de las micro apps de nicho (Cuotas al día, Libreta, Combi al día,
// Control al día). La app entera corre en el navegador del dueño: no hay
// servidor ni cuentas. Los datos se guardan en el almacenamiento del navegador
// de ese celular y se pueden llevar a un archivo de copia.
// RUBRO, DEMO y TIENDA los define tools/armar.mjs al armar cada archivo.
// Con TIENDA, la app pide la licencia que entrega la compra (ver tienda/).
import { iniciar, h, icono } from './app.js';
import { sembrar } from './ejemplos.js';
import { manejar } from '../src/nucleo.js';
import { repoMemoria } from '../src/datos.js';
import { RUBROS } from '../src/rubros.js';
import { ahoraAR } from '../src/logica.js';

const rubro = RUBROS[RUBRO];
const CLAVE = `microapp:${rubro.id}:v1`;

function leer() {
  try { const t = localStorage.getItem(CLAVE); return t ? JSON.parse(t) : null; } catch { return null; }
}
let seGuarda = true;
function guardar() {
  try { localStorage.setItem(CLAVE, JSON.stringify(repo.exportar())); seGuarda = true; } catch { seGuarda = false; }
}
// En la demo, para que siempre haya avisos para mostrar: si es domingo o fuera
// de las 9 a 20, hace de cuenta que es el próximo día hábil a las 10:30.
function ahoraDemo() {
  let d = new Date();
  let ar = ahoraAR(d);
  if (ar.diaSemana === 0) { d = new Date(d.getTime() + 864e5); ar = ahoraAR(d); }
  if (ar.hora < 9 || ar.hora >= 20) d = new Date(`${ar.fecha}T10:30:00-03:00`);
  return d;
}

const repo = repoMemoria(DEMO ? null : leer());
const e = { repo, rubro, local: true, demo: DEMO, env: {}, ahora: DEMO ? ahoraDemo : () => new Date(), salir: async () => new Response('{}', { status: 200 }) };

async function pedir(metodo, ruta, cuerpo) {
  const r = await manejar(new Request(`https://app.local${ruta}`, {
    method: metodo, headers: { 'Content-Type': 'application/json' }, body: metodo === 'GET' ? undefined : JSON.stringify(cuerpo ?? {}),
  }), e);
  let datos = {};
  try { datos = await r.json(); } catch { datos = {}; }
  if (!DEMO && (metodo !== 'GET' || ruta === '/api/panel')) guardar();   // el panel puede crear las cuotas del mes
  if (!DEMO && !seGuarda && metodo !== 'GET' && r.status < 400) {
    return { estado: 507, datos: { error: 'Este navegador no está guardando los datos (¿ventana privada o sin espacio?). Lo que cargues se pierde al cerrar.' } };
  }
  return { estado: r.status, datos };
}

const copia = DEMO ? null : {
  exportar: () => JSON.stringify({ app: rubro.id, guardado: new Date().toISOString(), datos: repo.exportar() }),
  importar(texto) {
    let c;
    try { c = JSON.parse(texto); } catch { throw new Error('Ese archivo no es una copia de esta app.'); }
    if (c?.app !== rubro.id || !c.datos?.tablas) throw new Error(`Ese archivo no es una copia de ${rubro.nombre}.`);
    localStorage.setItem(CLAVE, JSON.stringify(c.datos));
    location.reload();
  },
};

if (!DEMO) { try { navigator.storage?.persist?.(); } catch { /* opcional */ } }
// ── Licencia (solo en la versión que se vende sola) ───────────────────────
const CLAVE_LICENCIA = `microapp:${rubro.id}:licencia`;
async function validar(codigo) {
  const r = await fetch(`/api/verificar?licencia=${encodeURIComponent(codigo)}`);
  const datos = await r.json();
  return datos.ok && datos.app === rubro.id;
}
async function tieneLicencia() {
  const url = new URL(location.href);
  const traida = url.searchParams.get('licencia');
  if (traida) {
    try { if (await validar(traida)) localStorage.setItem(CLAVE_LICENCIA, traida); } catch { /* sin conexión: se intenta de nuevo al reabrir el link */ }
    url.searchParams.delete('licencia');
    history.replaceState(null, '', url.pathname + url.search + url.hash);
  }
  try { return !!localStorage.getItem(CLAVE_LICENCIA); } catch { return false; }
}
function pedirCompra() {
  const raiz = document.documentElement.style;
  raiz.setProperty('--marca', rubro.color);
  const aviso = h('p', { class: 'tenue chico', role: 'status' });
  const codigo = h('input', { id: 'lic-codigo', name: 'codigo', placeholder: 'Pegá el código o el link que te quedó al comprar', autocomplete: 'off' });
  const activar = async (ev) => {
    ev.preventDefault();
    const texto = codigo.value.trim();
    const limpio = texto.includes('licencia=') ? new URL(texto, location.href).searchParams.get('licencia') : texto;
    aviso.textContent = 'Revisando…';
    try {
      if (limpio && await validar(limpio)) { localStorage.setItem(CLAVE_LICENCIA, limpio); location.reload(); return; }
      aviso.textContent = 'Ese código no corresponde a esta app.';
    } catch { aviso.textContent = 'No hay conexión. Probá de nuevo.'; }
  };
  document.title = rubro.titulo || rubro.nombre;
  document.getElementById('app').replaceChildren(h('main', { class: 'cont' }, h('div', { class: 'acceso' }, h('div', { class: 'tarjeta portada' },
    h('span', { class: 'logo' }, icono(`r-${rubro.id}`)),
    h('div', null, h('h2', null, rubro.nombre), h('p', { class: 'tenue' }, 'Se paga una sola vez y queda para siempre en tu celular.')),
    h('a', { class: 'btn pri ancho', href: `/api/comprar?app=${rubro.id}` }, `Comprar por $ ${rubro.precio.toLocaleString('es-AR')}`),
    h('a', { class: 'btn sec ancho', href: './' }, 'Ver cómo funciona'),
    h('form', { onsubmit: activar, style: 'display:grid;gap:10px' },
      h('label', { class: 'campo' }, h('span', null, '¿Ya la compraste?'), codigo),
      h('button', { class: 'btn sec', type: 'submit' }, 'Activar'), aviso)))));
}

const arrancar = () => (DEMO ? sembrar(rubro.id, { pedir, repo, ahora: ahoraDemo }) : Promise.resolve()).then(() => iniciar({ pedir, copia }));
if (TIENDA && !DEMO) tieneLicencia().then((si) => (si ? arrancar() : pedirCompra()));
else arrancar();
