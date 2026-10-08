// Humanizador: marca lo que hace que un texto "suene a IA" para quien lo lee
// en castellano rioplatense. No es un detector ni promete pasar uno: cuenta
// las marcas que notan los lectores (vocabulario de folleto, frases hechas,
// remates armados, tuteo en vez de voseo, emojis y signos de más) y dice qué
// reescribir. Criterio adaptado de instagram-skills (Sergey Bulaev, MIT),
// recalibrado para el castellano de Argentina.
//
// La unidad es el párrafo (o la placa del carrusel): una marca suelta no es
// un problema; tres en el mismo párrafo, sí. Los remates armados, los
// paralelismos "no es X, es Y", las frases de sinceridad y el tuteo se
// corrigen aunque aparezcan una sola vez.

import { normalizar } from './texto.mjs';

// [tipo, peso, siempre_corregir, patrones sobre el texto normalizado (sin tildes, minúsculas)]
const MARCAS = [
  ['vocabulario', 1, false, [
    /\bcrucial(es)?\b/, /\bfundamental(es)?\b/, /\besencial(es)?\b/, /\bes clave\b/, /\bpotenci(a|ar|ate|alo|ala)\b/,
    /\boptimiz(a|ar|ate)\b/, /\bdesbloque(a|ar|ate|alo)\b/, /\bsumerg(i|ite|ete|irte|irse)\b/, /\bexplor(a|ar)\b/,
    /\bdescubri\b/, /\bdescubre\b/, /\btransform(a|ar)\b/, /\brevolucion(a|ar|ario|aria)\b/, /\bimpuls(a|ar)\b/,
    /\belev(a|ar)\b/, /\bsinergia\b/, /\brobust[oa]\b/, /\bintegral\b/, /\binnovador(a|es)?\b/, /\becosistema\b/,
    /\bpanorama\b/, /\btu potencial\b/, /\bde manera (eficiente|efectiva|integral)\b/, /\ba la hora de\b/,
  ]],
  ['frase_hecha', 1.5, false, [
    /\bsin lugar a dudas\b/, /\bes (crucial|clave|fundamental|importante|esencial) (destacar|mencionar|senalar|recordar|entender)\b/, /\bcabe (destacar|mencionar|senalar)\b/, /\bes importante (destacar|mencionar|senalar|recordar)\b/,
    /\ben (definitiva|conclusion|resumen|sintesis)\b/, /\ben la era digital\b/, /\ben el mundo (actual|de hoy)\b/,
    /\ben un mundo (donde|en el que)\b/, /\bhoy en dia\b/, /\bal (siguiente|proximo) nivel\b/, /\bun antes y un despues\b/,
    /\bgame changer\b/, /\baprovecha(r)? al maximo\b/, /\bsaca(r)? el maximo provecho\b/, /\bmas alla de\b/,
    /\bno te lo pierdas\b/, /\bdale una vuelta de tuerca\b/,
  ]],
  ['remate_armado', 2, true, [
    /\bel resultado\s*\?/, /\bla clave\s*\?/, /\bel secreto\s*\?/, /\bpor que\s*\?\s*porque\b/, /\bspoiler\b/,
    /\bplot twist\b/, /\bte cuento por que\b/, /\baca va el truco\b/, /\bspoiler alert\b/,
  ]],
  ['paralelismo', 2, true, [
    /\bno es solo\b[^.?!\n]{1,60}\b(es|sino)\b/, /\bno se trata de\b[^.?!\n]{1,60}\bse trata de\b/,
    /\bno [a-z]+\. no [a-z]+\. (solo|solamente)\b/, /\bmenos [a-z]+, mas [a-z]+\b/,
  ]],
  ['sinceridad', 2, true, [
    /\bseamos (honestos|sinceros)\b/, /\bte lo digo claro\b/, /\bla verdad es que\b/, /\bte soy (sincero|sincera|honesto|honesta)\b/,
    /\bno te voy a mentir\b/, /\bhablemos claro\b/, /\bopinion impopular\b/, /\bte voy a ser (sincero|sincera|honesto|honesta)\b/,
  ]],
  ['tuteo', 1.5, true, [
    /\b(puedes|tienes|quieres|eres|necesitas)\b/, /\bdescubre\b/, /\bhaz\b/, /\bdesbloquea\b/,
  ]],
  ['cierre_muerto', 1.5, true, [
    /\bque opinas\s*\?\s*$/m, /\bque te parecio\s*\?\s*$/m, /\bcomenta si\b/, /\bdoble tap\b/, /\bdale like si\b/,
    /\betiqueta a (3|tres|5|cinco) amig/, /\bsi te gusto dale\b/,
  ]],
];

const EMOJI = /\p{Extended_Pictographic}/gu;

function marcasDe(parrafo) {
  const n = normalizar(parrafo).replace(/\s*\?/g, '?');
  // normalizar() saca los signos; para los patrones con "?" usamos una versión que los conserva
  const conSignos = String(parrafo).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[¿¡]/g, '').replace(/[^a-z0-9ñ?.,!\s\n]/g, ' ').replace(/[ \t]+/g, ' ');
  const hits = [];
  for (const [tipo, peso, siempre, patrones] of MARCAS) {
    for (const p of patrones) {
      const m = (p.source.includes('\\?') || p.source.includes('\\.') || p.source.includes(',') ? conSignos : n).match(p);
      if (m) hits.push({ tipo, peso, siempre, texto: m[0].trim() });
    }
  }
  return hits;
}

export function revisarIA(entrada) {
  const texto = String(entrada ?? '').replace(/\r\n?/g, '\n').trim();
  if (!texto) return { palabras: 0, porcentaje: 0, veredicto: 'sin texto', parrafos: [], formato: [] };
  const sinHashtags = texto.replace(/#[\p{L}\p{N}_]+/gu, ' ');
  const parrafos = sinHashtags.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  const palabras = normalizar(sinHashtags).split(' ').filter(Boolean).length;

  let puntos = 0;
  const detalle = parrafos.map((p, i) => {
    const marcas = marcasDe(p);
    puntos += marcas.reduce((s, m) => s + m.peso, 0);
    const accion = marcas.length >= 3 ? 'reescribir el párrafo'
      : marcas.some((m) => m.siempre) ? 'reemplazar lo marcado'
      : marcas.length ? 'dejar (una marca suelta no es un problema)' : 'bien';
    return { parrafo: i + 1, inicio: p.slice(0, 60), marcas: marcas.map(({ tipo, texto: t }) => ({ tipo, texto: t })), accion };
  });

  // Formato: lo que en un caption o una placa se nota de lejos.
  const formato = [];
  const emojis = (texto.match(EMOJI) || []).length;
  if (emojis > 3) { formato.push(`${emojis} emojis (más de 3 cansa; dejá 1 a 3 con sentido)`); puntos += emojis - 3; }
  const hashtags = (texto.match(/#[\p{L}\p{N}_]+/gu) || []).length;
  if (hashtags > 5) { formato.push(`${hashtags} hashtags (usá de 3 a 5 bien elegidos: contenido-hashtags)`); puntos += 1; }
  const rayas = (texto.match(/—/g) || []).length;
  const maxRayas = Math.max(1, Math.round(palabras / 100));
  if (rayas > maxRayas) { formato.push(`${rayas} rayas (—): como mucho ${maxRayas}; cambiá las demás por coma, dos puntos o punto y aparte`); puntos += rayas - maxRayas; }
  const exclamaciones = (texto.match(/!/g) || []).length;
  if (exclamaciones > 2) { formato.push(`${exclamaciones} signos de exclamación (más de 2 suena a folleto)`); puntos += 1; }
  const mayus = (texto.match(/\b[A-ZÁÉÍÓÚÑ]{4,}\b/g) || []).filter((w) => !/^(CABA|AMBA|GBA|DJ|IVA|CBC)$/.test(w)).length;
  if (mayus > 2) { formato.push(`${mayus} palabras en mayúsculas (gritan; dejá una como mucho)`); puntos += 1; }
  const sueltas = texto.split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#') && normalizar(l).split(' ').filter(Boolean).length <= 2).length;
  if (sueltas >= 3) { formato.push(`${sueltas} renglones de una o dos palabras para dar drama: unilos en oraciones`); puntos += 1; }

  const densidad = (puntos * 100) / Math.max(palabras, 30);
  const porcentaje = Math.min(99, Math.round(densidad * 6));
  const veredicto = porcentaje < 25 ? 'suena humano' : porcentaje < 55 ? 'mixto' : 'suena a IA';
  return { palabras, porcentaje, veredicto, parrafos: detalle, formato,
    nota: 'Estimación por las marcas que notan los lectores, no un detector: no promete pasar ningún detector de IA.' };
}

export function informeIA(r) {
  const l = [`SUENA A IA: ${r.porcentaje}% (${r.veredicto}) · ${r.palabras} palabras`, ''];
  for (const p of r.parrafos) {
    if (!p.marcas.length) continue;
    l.push(`Párrafo ${p.parrafo} ("${p.inicio}${p.inicio.length >= 60 ? '…' : ''}") → ${p.accion}`);
    for (const m of p.marcas) l.push(`  · ${m.tipo}: "${m.texto}"`);
  }
  if (r.formato.length) { l.push('', 'Formato:'); for (const f of r.formato) l.push(`  · ${f}`); }
  if (!r.parrafos.some((p) => p.marcas.length) && !r.formato.length) l.push('Sin marcas: no hace falta tocarlo.');
  l.push('', r.nota);
  return l.join('\n');
}
