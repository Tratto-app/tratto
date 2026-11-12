// Entrada de las micro apps de nicho (Cuotas al día, Libreta, Combi al día,
// Control al día). La app entera corre en el navegador del dueño: no hay
// servidor ni cuentas. Los datos se guardan en el almacenamiento del navegador
// de ese celular y se pueden llevar a un archivo de copia.
// RUBRO y DEMO los define tools/armar.mjs al armar cada archivo.
import { iniciar } from './app.js';
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
(DEMO ? sembrar(rubro.id, { pedir, repo, ahora: ahoraDemo }) : Promise.resolve()).then(() => iniciar({ pedir, copia }));
