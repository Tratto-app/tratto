// Verificación de hooks: lo que se puede medir sin opinar (largo, tiempo de
// lectura, aperturas genéricas, palabras prohibidas por la marca, parecido
// con hooks ya usados o con otros del mismo lote) y, si la skill puntuó los
// criterios de selección, el ranking.
import { conocimiento } from './conocimiento.mjs';
import { ErrorEntrada } from './errores.mjs';
import { contarPalabras, limpiar, normalizar, segundosDeLectura, similitud } from './texto.mjs';

export const UMBRAL_PARECIDO = 0.6;
const MAX_HOOKS = 40;

function guiasDe(formato) {
  const f = conocimiento('formatos');
  const g = f.formatos[formato]?.guias || {};
  return {
    maxPalabras: g.hook_max_palabras ?? g.primer_slide_max_palabras ?? g.primera_linea_max_palabras ?? g.texto_max_palabras ?? 12,
    maxSeg: g.hook_max_seg,
    pps: f.palabras_por_segundo,
  };
}

// entrada: { formato, hooks: [{ texto, categoria, criterios?: { retencion, claridad, curiosidad, identificacion, viralidad } }], evitar?: [frases del original] }
// historial: [{ texto }] hooks ya usados (de la memoria)
// palabrasNo: lista de palabras/frases que la marca no usa
export function verificarHooks(entrada, historial = [], palabrasNo = []) {
  const cat = conocimiento('hooks');
  const formatos = Object.keys(conocimiento('formatos').formatos);
  if (!entrada || typeof entrada !== 'object') throw new ErrorEntrada('La entrada tiene que ser un objeto JSON');
  const formato = entrada.formato || 'reel';
  if (!formatos.includes(formato)) throw new ErrorEntrada(`Formato desconocido: "${formato}". Opciones: ${formatos.join(', ')}`);
  const lista = entrada.hooks;
  if (!Array.isArray(lista) || !lista.length) throw new ErrorEntrada('Falta "hooks": lista con al menos un { texto, categoria }');
  if (lista.length > MAX_HOOKS) throw new ErrorEntrada(`Demasiados hooks (${lista.length}); el máximo por lote es ${MAX_HOOKS}`);

  let evitar = [];
  if (entrada.evitar !== undefined) {
    if (!Array.isArray(entrada.evitar) || entrada.evitar.length > 50) throw new ErrorEntrada('"evitar" tiene que ser una lista de hasta 50 textos (frases del contenido original)');
    evitar = entrada.evitar.map((t) => ({ texto: limpiar(t, 500), origen: 'original' })).filter((t) => t.texto);
  }
  const guias = guiasDe(formato);
  const criterios = Object.keys(cat.criterios_seleccion);
  const errores = [];
  const items = lista.map((h, i) => {
    const texto = limpiar(typeof h === 'string' ? h : h?.texto, 300);
    if (!texto) errores.push(`hooks[${i}]: falta el texto`);
    const categoria = typeof h === 'object' ? h?.categoria : undefined;
    if (categoria !== undefined && !cat.categorias[categoria]) errores.push(`hooks[${i}]: categoría "${categoria}" desconocida. Opciones: ${Object.keys(cat.categorias).join(', ')}`);
    let crit;
    if (h && typeof h === 'object' && h.criterios !== undefined) {
      crit = {};
      for (const c of criterios) {
        const v = h.criterios?.[c];
        if (typeof v !== 'number' || !Number.isInteger(v) || v < 0 || v > 100) errores.push(`hooks[${i}].criterios.${c}: tiene que ser un entero de 0 a 100`);
        else crit[c] = v;
      }
    }
    return { indice: i, texto, categoria, criterios: crit };
  });
  if (errores.length) throw new ErrorEntrada('Hay hooks inválidos', errores);

  const prohibidas = palabrasNo.map(normalizar).filter(Boolean);
  const genericas = cat.aperturas_genericas.map(normalizar);

  for (const it of items) {
    const problemas = [], advertencias = [];
    const n = normalizar(it.texto);
    it.palabras = contarPalabras(it.texto);
    it.segundos = segundosDeLectura(it.texto, guias.pps);
    if (it.palabras > guias.maxPalabras) problemas.push(`Largo: ${it.palabras} palabras (guía para ${formato}: hasta ${guias.maxPalabras}).`);
    if (guias.maxSeg && it.segundos > guias.maxSeg) advertencias.push(`Tarda ~${it.segundos} s en leerse o decirse (guía: ${guias.maxSeg} s).`);
    const gen = genericas.find((g) => n === g || n.startsWith(g + ' ') || n.includes(' ' + g + ' '));
    if (gen) problemas.push(`Apertura genérica: "${gen}". Es una etiqueta, no una tensión.`);
    for (const p of prohibidas) if ((' ' + n + ' ').includes(' ' + p + ' ')) problemas.push(`Usa una palabra que la marca evita: "${p}".`);
    if (it.palabras < 2) advertencias.push('Muy corto: revisá que se entienda sin contexto.');

    let maxHist = { sim: 0 };
    for (const h of [...historial, ...evitar]) {
      const s = similitud(it.texto, h.texto);
      if (s > maxHist.sim) maxHist = { sim: s, texto: h.texto, origen: h.origen };
    }
    if (maxHist.sim >= UMBRAL_PARECIDO) {
      problemas.push(maxHist.origen === 'original'
        ? `Copia al contenido original (${Math.round(maxHist.sim * 100)}%): "${maxHist.texto}". Adaptá el mecanismo, no la frase.`
        : `Muy parecido a un hook ya usado (${Math.round(maxHist.sim * 100)}%): "${maxHist.texto}".`);
    }
    for (const otro of items) {
      if (otro.indice >= it.indice) break;
      const s = similitud(it.texto, otro.texto);
      if (s >= UMBRAL_PARECIDO) advertencias.push(`Casi igual a la opción ${otro.indice + 1} (${Math.round(s * 100)}%): no suma una alternativa real.`);
    }
    it.parecido_historial = Math.round(maxHist.sim * 100) / 100;
    it.problemas = problemas;
    it.advertencias = advertencias;
    it.apto = problemas.length === 0;
    if (it.criterios) it.puntaje_seleccion = Math.round(criterios.reduce((a, c) => a + it.criterios[c], 0) / criterios.length);
  }

  const conCriterios = items.filter((i) => i.criterios);
  let ranking = [];
  let mejor = null;
  if (conCriterios.length) {
    ranking = [...conCriterios].sort((a, b) => Number(b.apto) - Number(a.apto) || b.puntaje_seleccion - a.puntaje_seleccion || a.palabras - b.palabras)
      .map((i) => ({ indice: i.indice, texto: i.texto, apto: i.apto, puntaje_seleccion: i.puntaje_seleccion }));
    mejor = ranking.find((r) => r.apto) || null;
  }
  const categorias = new Set(items.map((i) => i.categoria).filter(Boolean));
  const avisos = [];
  if (items.length >= 3 && categorias.size < 2) avisos.push('Todas las opciones son de la misma categoría: probá al menos dos mecanismos distintos.');
  if (conCriterios.length && conCriterios.length < items.length) avisos.push('Solo algunos hooks tienen criterios: el ranking deja afuera a los demás.');
  if (conCriterios.length && !mejor) avisos.push('Ninguna opción puntuada pasó la verificación: reescribirlas.');

  return { formato, guia_max_palabras: guias.maxPalabras, hooks: items, ranking, mejor, avisos };
}

export function hooksMarkdown(res) {
  const l = [`Verificación de hooks (${res.formato}, hasta ${res.guia_max_palabras} palabras)`, ''];
  for (const h of res.hooks) {
    const marca = h.apto ? '✓' : '✗';
    const extra = h.puntaje_seleccion !== undefined ? ` · selección ${h.puntaje_seleccion}` : '';
    l.push(`${marca} ${h.indice + 1}. ${h.categoria ? `[${h.categoria}] ` : ''}"${h.texto}" — ${h.palabras} palabras, ~${h.segundos} s${extra}`);
    for (const p of h.problemas) l.push(`   ✗ ${p}`);
    for (const a of h.advertencias) l.push(`   ⚠ ${a}`);
  }
  if (res.mejor) l.push('', `MEJOR OPCIÓN (por criterios y verificación): "${res.mejor.texto}" (${res.mejor.puntaje_seleccion})`);
  for (const a of res.avisos) l.push(`⚠ ${a}`);
  return l.join('\n');
}
