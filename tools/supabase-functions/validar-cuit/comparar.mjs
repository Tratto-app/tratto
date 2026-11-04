// Comparación del nombre que escribió la persona con el que ARCA tiene para
// ese CUIL o CUIT, y lectura de las respuestas de ARCA. Sin red ni Deno: se
// prueba con handler.test.mjs.
//
// Regla (pedido del fundador, 04/11/2026: "que solamente te deje avanzar si
// coincide el CUIL con el nombre, o el CUIT y el nombre de la empresa"):
//   · Persona: no importan mayúsculas, tildes, el orden ni que falte el
//     segundo nombre. Cada palabra escrita tiene que estar en el nombre de
//     ARCA, y tiene que haber al menos un apellido y un nombre.
//   · Empresa: no cuentan el tipo de sociedad (SRL, S.A., SAS…), los puntos
//     ni las palabras de enlace. Tienen que estar las mismas palabras.
// Nunca se devuelve el nombre de ARCA: solo si coincide o no. Si se mostrara,
// cualquiera podría usar el formulario para averiguar de quién es un CUIL.

export const soloNumeros = s => String(s ?? '').replace(/\D/g, '');

export function cuitValido(v) {
  const n = soloNumeros(v);
  if (n.length !== 11) return false;
  const peso = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  let suma = 0;
  for (let i = 0; i < 10; i++) suma += Number(n[i]) * peso[i];
  let dv = 11 - (suma % 11);
  if (dv === 11) dv = 0;
  if (dv === 10) dv = 9;
  return dv === Number(n[10]);
}

// 20, 23, 24 y 27: personas. 30, 33 y 34: empresas y otras organizaciones.
export function tipoPorPrefijo(cuit) {
  const p = soloNumeros(cuit).slice(0, 2);
  if (['20', '23', '24', '27'].includes(p)) return 'persona';
  if (['30', '33', '34'].includes(p)) return 'empresa';
  return null;
}

export function normalizar(s) {
  return String(s ?? '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim().replace(/\s+/g, ' ');
}

const ENLACES = new Set(['DE', 'DEL', 'LA', 'LAS', 'LOS', 'EL', 'Y', 'E', 'VON', 'VAN', 'DA', 'DI', 'DO', 'DOS']);
const palabras = s => normalizar(s).split(' ').filter(Boolean);
const utiles = s => palabras(s).filter(w => !ENLACES.has(w));

export function coincidePersona(escrito, { nombre, apellido }) {
  const ap = new Set(utiles(apellido));
  const no = new Set(utiles(nombre));
  const todas = new Set([...ap, ...no]);
  const w = utiles(escrito);
  if (w.length < 2 || !todas.size) return false;
  if (!w.every(x => todas.has(x))) return false;
  // Sin nombre de pila en ARCA (pasa en algunos registros viejos), alcanza con
  // dos palabras del apellido completo.
  if (!no.size) return w.length >= 2;
  return w.some(x => ap.has(x)) && w.some(x => no.has(x));
}

// Tipos de sociedad, escritos de las formas en que la gente los escribe. Se
// sacan antes de comparar: "Climatizar del Sur SRL" y "CLIMATIZAR DEL SUR
// SOCIEDAD DE RESPONSABILIDAD LIMITADA" son la misma empresa.
const SOCIEDADES = [
  'SOCIEDAD DE RESPONSABILIDAD LIMITADA', 'SOCIEDAD POR ACCIONES SIMPLIFICADA',
  'SOCIEDAD ANONIMA UNIPERSONAL', 'SOCIEDAD ANONIMA', 'SOCIEDAD EN COMANDITA POR ACCIONES',
  'SOCIEDAD EN COMANDITA SIMPLE', 'SOCIEDAD COLECTIVA', 'SOCIEDAD DE HECHO',
  'SOCIEDAD COOPERATIVA', 'COOPERATIVA LIMITADA', 'S R L', 'S A S', 'S A U', 'S A', 'S C A', 'S C S',
  'S DE H', 'S H', 'SRL', 'SAS', 'SAU', 'SA', 'SCA', 'SCS', 'SH', 'LTDA', 'LIMITADA', 'COOP',
];
function nucleoEmpresa(s) {
  let t = ' ' + normalizar(s) + ' ';
  for (const x of SOCIEDADES) t = t.split(' ' + x + ' ').join(' ');
  return [...new Set(t.trim().split(/\s+/).filter(w => w && !ENLACES.has(w)))].sort();
}

export function coincideEmpresa(escrito, { razonSocial }) {
  const a = nucleoEmpresa(razonSocial), b = nucleoEmpresa(escrito);
  return a.length > 0 && a.length === b.length && a.every((w, i) => w === b[i]);
}

// ── Respuestas SOAP ──────────────────────────────────────────────────────
const des = s => String(s ?? '')
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
  .replace(/&apos;/g, "'").replace(/&#13;/g, '').replace(/&amp;/g, '&');

export function etiqueta(xml, nombre) {
  const m = String(xml).match(new RegExp('<(?:[\\w-]+:)?' + nombre + '\\b[^>]*>([\\s\\S]*?)</(?:[\\w-]+:)?' + nombre + '>'));
  return m ? des(m[1]).trim() : null;
}

// Devuelve {estado:'ok', persona} | {estado:'no_existe'|'inactiva'} | {estado:'error', detalle}
export function leerPersona(xml) {
  const falla = etiqueta(xml, 'faultstring');
  if (falla) {
    if (/inexistente/i.test(falla)) return { estado: 'no_existe' };
    if (/inactiva/i.test(falla)) return { estado: 'inactiva' };
    return { estado: 'error', detalle: falla.slice(0, 200) };
  }
  const p = etiqueta(xml, 'persona');
  if (!p) return { estado: 'error', detalle: 'Respuesta sin persona' };
  // Los domicilios traen etiquetas propias que no se usan; se sacan para que
  // no se confundan con las de la persona.
  const base = p.replace(/<domicilio>[\s\S]*?<\/domicilio>/g, '');
  const persona = {
    tipoPersona: etiqueta(base, 'tipoPersona'),
    tipoClave: etiqueta(base, 'tipoClave'),
    estadoClave: etiqueta(base, 'estadoClave'),
    nombre: etiqueta(base, 'nombre') || '',
    apellido: etiqueta(base, 'apellido') || '',
    razonSocial: etiqueta(base, 'razonSocial') || '',
  };
  if (persona.estadoClave && persona.estadoClave !== 'ACTIVO') return { estado: 'inactiva' };
  return { estado: 'ok', persona };
}

export function leerTicket(xml) {
  const falla = etiqueta(xml, 'faultstring');
  if (falla) return { error: falla.slice(0, 200), yaTiene: /ya posee un TA valido/i.test(falla) };
  const ret = etiqueta(xml, 'loginCmsReturn');
  if (!ret) return { error: 'Respuesta sin ticket' };
  const token = etiqueta(ret, 'token'), sign = etiqueta(ret, 'sign'), vence = etiqueta(ret, 'expirationTime');
  if (!token || !sign || !vence) return { error: 'Ticket incompleto' };
  return { token, sign, vence };
}

// El resultado de comparar a la persona de ARCA con lo que se escribió.
export function resultadoPara(tipo, escrito, persona) {
  const esEmpresa = persona.tipoPersona === 'JURIDICA' || (!persona.apellido && !!persona.razonSocial);
  if (tipo === 'empresa' && !esEmpresa) return 'tipo_distinto';
  if (tipo === 'persona' && esEmpresa) return 'tipo_distinto';
  const ok = tipo === 'empresa' ? coincideEmpresa(escrito, persona) : coincidePersona(escrito, persona);
  return ok ? 'coincide' : 'no_coincide';
}
