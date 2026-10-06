// Métricas de resultados reales. Se comparan tasas (por alcance), no números
// absolutos: una pieza con poco alcance y muchos guardados enseña más que
// una con mucho alcance y nada más.
import { ErrorEntrada } from './errores.mjs';
import { TIPOS } from './memoria.mjs';
import { validar } from './validar.mjs';

const TASAS = ['guardados', 'compartidos', 'comentarios', 'visitas_perfil', 'seguidores_nuevos', 'clics_link'];

const pct = (n, d) => Math.round((n / d) * 10000) / 100;

export function tasas(r) {
  const t = {};
  for (const c of TASAS) if (typeof r[c] === 'number') t[`${c}_por_alcance`] = pct(r[c], r.alcance);
  t.interaccion_por_alcance = pct((r.guardados || 0) + (r.compartidos || 0) + (r.comentarios || 0), r.alcance);
  return t;
}

function mediana(vals) {
  if (!vals.length) return undefined;
  const v = [...vals].sort((a, b) => a - b);
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : Math.round(((v[m - 1] + v[m]) / 2) * 100) / 100;
}

// Une cada contenido con su resultado más reciente y lo ordena por interacción.
export function rendimiento(contenidos, resultados) {
  // Último resultado de cada contenido en cada plataforma: Instagram y TikTok no se mezclan.
  const ultimo = new Map();
  for (const r of resultados) {
    const clave = `${r.contenido_id}|${r.plataforma || 'instagram'}`;
    const prev = ultimo.get(clave);
    if (!prev || String(r.fecha) >= String(prev.fecha)) ultimo.set(clave, r);
  }
  const porId = new Map(contenidos.map((c) => [c.id, c]));
  const filas = [];
  for (const r of ultimo.values()) {
    const c = porId.get(r.contenido_id);
    if (!c) continue;
    filas.push({ id: c.id, titulo: c.titulo, formato: c.formato, plataforma: r.plataforma || 'instagram', hook: c.hook, pilar: c.pilar, puntaje_previsto: c.puntaje, alcance: r.alcance, ...tasas(r) });
  }
  filas.sort((a, b) => b.interaccion_por_alcance - a.interaccion_por_alcance);
  return filas;
}

export function medianas(filas) {
  const salida = {};
  if (!filas.length) return salida;
  for (const k of Object.keys(filas[0]).filter((k) => k.endsWith('_por_alcance'))) {
    const m = mediana(filas.map((f) => f[k]).filter((v) => typeof v === 'number'));
    if (m !== undefined) salida[k] = m;
  }
  return salida;
}

// Analiza un resultado (sin guardarlo) contra las medianas de la cuenta.
export function analizarMetricas(entrada, filas) {
  const esquema = { ...TIPOS.resultado.esquema, campos: { ...TIPOS.resultado.esquema.campos, contenido_id: { tipo: 'texto', max: 40 }, fecha: { tipo: 'fecha' }, fuente: { tipo: 'enum', valores: ['manual', 'metricool', 'instagram_api'] }, plataforma: { tipo: 'enum', valores: ['instagram', 'tiktok'] } } };
  const errores = validar(entrada, esquema);
  if (errores.length) throw new ErrorEntrada('Las métricas no son válidas', errores);
  const propias = tasas(entrada);
  const base = medianas(filas);
  const comparacion = {};
  for (const [k, v] of Object.entries(propias)) {
    if (base[k] === undefined) continue;
    comparacion[k] = { valor: v, mediana_cuenta: base[k], relacion: base[k] ? Math.round((v / base[k]) * 100) / 100 : null };
  }
  const avisos = [];
  if (filas.length < 5) avisos.push(`Hay ${filas.length} contenido(s) con resultados en la memoria: con menos de 5 la comparación con la cuenta no es confiable.`);
  if (entrada.alcance < 300) avisos.push('Alcance menor a 300: las tasas pueden variar mucho por azar.');
  return { tasas: propias, comparacion, base_contenidos: filas.length, avisos };
}
