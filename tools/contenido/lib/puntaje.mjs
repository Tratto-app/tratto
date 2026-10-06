// Motor de puntuación. Las skills ponen un puntaje y una evidencia por
// dimensión; el código valida, pondera según el formato, aplica topes y
// asigna banda y confianza. Así el total no depende del humor del modelo y
// dos análisis del mismo contenido son comparables.
import { conocimiento } from './conocimiento.mjs';
import { ErrorEntrada } from './errores.mjs';
import { limpiar, normalizar } from './texto.mjs';

export function rubrica() {
  return conocimiento('rubrica');
}

// Chequea la coherencia interna de la rúbrica. Devuelve la lista de problemas.
export function revisarRubrica(r = rubrica()) {
  const problemas = [];
  const dims = new Set(Object.keys(r.dimensiones || {}));
  if (!dims.size) problemas.push('La rúbrica no tiene dimensiones');
  for (const [id, d] of Object.entries(r.dimensiones || {})) {
    const niveles = d.niveles || [];
    let esperado = 0;
    for (const [desde, hasta, texto] of niveles) {
      if (desde !== esperado) problemas.push(`${id}: los niveles no son continuos en ${desde}`);
      if (!(hasta >= desde) || !texto) problemas.push(`${id}: nivel ${desde}-${hasta} mal formado`);
      esperado = hasta + 1;
    }
    if (esperado !== 101) problemas.push(`${id}: los niveles tienen que cubrir 0 a 100`);
  }
  for (const [f, def] of Object.entries(r.formatos || {})) {
    let suma = 0;
    for (const [dim, peso] of Object.entries(def.pesos || {})) {
      if (!dims.has(dim)) problemas.push(`formato ${f}: dimensión desconocida ${dim}`);
      if (!Number.isInteger(peso) || peso < 0) problemas.push(`formato ${f}: peso inválido en ${dim}`);
      suma += peso;
    }
    if (suma !== 100) problemas.push(`formato ${f}: los pesos suman ${suma}, tienen que sumar 100`);
  }
  for (const t of r.topes || []) {
    const usadas = t.si?.dimension ? [t.si.dimension] : t.si?.maximo_de || [];
    if (!usadas.length) problemas.push(`tope ${t.id}: sin condición`);
    for (const d of usadas) if (!dims.has(d)) problemas.push(`tope ${t.id}: dimensión desconocida ${d}`);
    for (const f of t.formatos || []) if (!r.formatos?.[f]) problemas.push(`tope ${t.id}: formato desconocido ${f}`);
  }
  let esperado = 0;
  for (const [desde, hasta] of r.bandas || []) {
    if (desde !== esperado) problemas.push(`bandas: no son continuas en ${desde}`);
    esperado = hasta + 1;
  }
  if (esperado !== 101) problemas.push('bandas: tienen que cubrir 0 a 100');
  return problemas;
}

function nivelDe(dim, puntaje) {
  return dim.niveles.find(([d, h]) => puntaje >= d && puntaje <= h)?.[2] || '';
}

function valorCondicion(si, puntajes) {
  if (si.dimension) return puntajes[si.dimension];
  const vals = (si.maximo_de || []).map((d) => puntajes[d]).filter((v) => v !== undefined);
  return vals.length ? Math.max(...vals) : undefined;
}

// entrada: { formato, insumo, dimensiones: { hook: { puntaje, evidencia }, ... }, titulo? }
export function puntuar(entrada) {
  const r = rubrica();
  const errores = [];
  if (!entrada || typeof entrada !== 'object' || Array.isArray(entrada)) throw new ErrorEntrada('La entrada tiene que ser un objeto JSON');

  const formato = entrada.formato;
  const def = r.formatos[formato];
  if (!def) throw new ErrorEntrada(`Formato desconocido: "${formato}". Opciones: ${Object.keys(r.formatos).join(', ')}`);
  const insumo = entrada.insumo;
  const infoInsumo = r.insumos[insumo];
  if (!infoInsumo) throw new ErrorEntrada(`Insumo desconocido: "${insumo}". Opciones: ${Object.keys(r.insumos).join(', ')}`);

  const dims = entrada.dimensiones;
  if (!dims || typeof dims !== 'object' || Array.isArray(dims)) throw new ErrorEntrada('Falta "dimensiones" (objeto con { puntaje, evidencia } por dimensión)');

  const { minimo_caracteres: minEv, minimo_caracteres_extremos: minExt } = r.evidencia;
  const puntajes = {};
  const evidencias = {};
  for (const [id, valor] of Object.entries(dims)) {
    if (!r.dimensiones[id]) { errores.push(`${id}: dimensión desconocida. Opciones: ${Object.keys(r.dimensiones).join(', ')}`); continue; }
    if (!valor || typeof valor !== 'object') { errores.push(`${id}: tiene que ser { puntaje, evidencia }`); continue; }
    const p = valor.puntaje;
    if (typeof p !== 'number' || !Number.isInteger(p) || p < 0 || p > 100) { errores.push(`${id}: el puntaje tiene que ser un entero de 0 a 100`); continue; }
    const ev = limpiar(valor.evidencia, 600);
    const extremo = p <= 20 || p >= 81;
    const minimo = extremo ? minExt : minEv;
    if (ev.length < minimo) {
      errores.push(`${id}: la evidencia tiene ${ev.length} caracteres; con puntaje ${p} hacen falta al menos ${minimo}. Citá o describí el fragmento concreto.`);
      continue;
    }
    puntajes[id] = p;
    evidencias[id] = ev;
  }

  const requeridas = Object.entries(def.pesos).filter(([, w]) => w > 0).map(([d]) => d);
  const faltan = requeridas.filter((d) => dims[d] === undefined);
  if (faltan.length) errores.push(`Faltan dimensiones para ${formato}: ${faltan.join(', ')}`);
  if (errores.length) throw new ErrorEntrada('La puntuación no es válida', errores);

  let suma = 0;
  const desglose = [];
  for (const d of Object.keys(r.dimensiones)) {
    if (puntajes[d] === undefined) continue;
    const peso = def.pesos[d] || 0;
    suma += puntajes[d] * peso;
    desglose.push({
      dimension: d, nombre: r.dimensiones[d].nombre, puntaje: puntajes[d], peso,
      aporte: Math.round((puntajes[d] * peso) / 10) / 10, nivel: nivelDe(r.dimensiones[d], puntajes[d]), evidencia: evidencias[d],
    });
  }
  desglose.sort((a, b) => b.peso - a.peso || b.puntaje - a.puntaje);
  const bruto = Math.round(suma / 100);

  let total = bruto;
  const topes = [];
  for (const t of r.topes) {
    if (!t.formatos.includes(formato)) continue;
    const v = valorCondicion(t.si, puntajes);
    if (v !== undefined && v < t.si.menor_que && total > t.maximo) {
      topes.push({ id: t.id, maximo: t.maximo, motivo: t.motivo });
      total = Math.min(total, t.maximo);
    }
  }

  const banda = r.bandas.find(([d, h]) => total >= d && total <= h);
  const advertencias = [];
  const valores = Object.values(puntajes);
  if (valores.length >= 5 && new Set(valores).size === 1) advertencias.push('Todas las dimensiones tienen el mismo puntaje: revisá que cada una se haya evaluado por separado.');
  const evs = Object.values(evidencias).map(normalizar);
  if (new Set(evs).size < evs.length) advertencias.push('Hay evidencias repetidas entre dimensiones: cada dimensión necesita su propio fragmento.');
  if (total >= 85 && infoInsumo.confianza === 'baja') advertencias.push('Puntaje muy alto con confianza baja: es una estimación sobre una idea o descripción, no sobre la pieza terminada.');

  return {
    titulo: limpiar(entrada.titulo, 120) || undefined,
    formato, formato_nombre: def.nombre, insumo,
    total, total_sin_topes: bruto,
    banda: banda[2], lectura: banda[3],
    confianza: infoInsumo.confianza, nota_confianza: infoInsumo.nota,
    desglose, topes_aplicados: topes,
    no_evaluadas: Object.keys(r.dimensiones).filter((d) => puntajes[d] === undefined),
    advertencias,
  };
}

function celda(t) {
  return String(t).replace(/\|/g, '\\|').replace(/\n+/g, ' ');
}

export function puntajeMarkdown(res, etiqueta = 'VIRALIDAD') {
  const l = [];
  l.push(`${etiqueta}: ${res.total}/100 (${res.banda} · confianza ${res.confianza})`);
  if (res.titulo) l.push(`Pieza: ${res.titulo}`);
  l.push(`Formato: ${res.formato_nombre} · Insumo: ${res.insumo} — ${res.nota_confianza}`);
  l.push(res.lectura);
  l.push('');
  l.push('| Dimensión | Puntaje | Peso | Evidencia |');
  l.push('|---|---|---|---|');
  for (const d of res.desglose) l.push(`| ${d.nombre} | ${d.puntaje} | ${d.peso} | ${celda(d.evidencia)} |`);
  if (res.topes_aplicados.length) {
    l.push('');
    l.push(`Topes aplicados (sin topes daría ${res.total_sin_topes}):`);
    for (const t of res.topes_aplicados) l.push(`- ${t.id} → máximo ${t.maximo}: ${t.motivo}`);
  }
  if (res.advertencias.length) {
    l.push('');
    for (const a of res.advertencias) l.push(`⚠ ${a}`);
  }
  return l.join('\n');
}
