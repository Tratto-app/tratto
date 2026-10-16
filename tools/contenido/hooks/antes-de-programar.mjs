#!/usr/bin/env node
// Control automático antes de programar en Buffer o Metricool (hook
// PreToolUse de Claude Code, ver .claude/settings.json). Sin que nadie lo pida:
// 1. Pasa el texto del post por el humanizador: si hay algo que corregir sí
//    o sí o el texto "suena a IA", frena la programación y dice qué cambiar.
// 2. Revisa el camino de un toque al link de cada red (lib/links.mjs): en
//    Instagram el texto tiene que mencionar la cuenta y el link del perfil, y
//    en TikTok no se promete un link que todavía no existe.
// Si todo está bien, o si la entrada no se puede leer, deja pasar (un control
// que falla no tiene que trabar el trabajo).
import { pathToFileURL } from 'node:url';
import { cargarConfig } from '../lib/config.mjs';
import { revisarIA } from '../lib/humanizador.mjs';
import { revisarCaminoAlLink } from '../lib/links.mjs';

const MAX = 1024 * 1024;

function leerStdin() {
  return new Promise((resolve) => {
    const partes = [];
    let total = 0;
    process.stdin.on('data', (p) => { total += p.length; if (total <= MAX) partes.push(p); });
    process.stdin.on('end', () => resolve(Buffer.concat(partes).toString('utf8')));
    process.stdin.on('error', () => resolve(''));
  });
}

// Los textos que salen publicados: el del post, el título de TikTok y el
// primer comentario. Metricool los manda en `info` (texto JSON u objeto);
// Buffer, en `text` y `metadata`, con la red en `metadata` o en `channelId`.
function leerInfo(toolInput) {
  let info = toolInput?.info;
  if (typeof info === 'string') {
    try { info = JSON.parse(info); } catch { return null; }
  }
  return info && typeof info === 'object' ? info : null;
}

const esBuffer = (toolInput) => !!toolInput && toolInput.info === undefined && ('channelId' in toolInput || 'postId' in toolInput || 'text' in toolInput || 'metadata' in toolInput);

// Red de un post de Buffer: por el canal (marca.json, links.<red>.canal_buffer)
// o por la clave de `metadata`.
function redDeBuffer(toolInput, links) {
  for (const red of ['instagram', 'tiktok']) {
    if (toolInput.channelId && links?.[red]?.canal_buffer === toolInput.channelId) return red;
  }
  const meta = toolInput.metadata && typeof toolInput.metadata === 'object' ? toolInput.metadata : {};
  return ['instagram', 'tiktok', 'facebook'].find((r) => meta[r]) || null;
}

// Redes del post donde el texto se publica (las historias no llevan texto).
export function redesConTexto(toolInput, links = cargarConfig().marca?.links) {
  if (esBuffer(toolInput)) {
    const red = redDeBuffer(toolInput, links);
    if (red === 'instagram') return String(toolInput.metadata?.instagram?.type || 'post').toLowerCase() === 'story' ? [] : ['instagram'];
    return red === 'tiktok' ? ['tiktok'] : [];
  }
  const info = leerInfo(toolInput);
  if (!info || !Array.isArray(info.providers)) return [];
  return info.providers.map((p) => p?.network).filter((r) => {
    if (r === 'instagram') return String(info.instagramData?.type || 'POST').toUpperCase() !== 'STORY';
    return r === 'tiktok';
  });
}

export function textosDelPost(toolInput) {
  let texto, titulo, comentario;
  if (esBuffer(toolInput)) {
    const meta = toolInput.metadata && typeof toolInput.metadata === 'object' ? toolInput.metadata : {};
    texto = toolInput.text;
    titulo = meta.tiktok?.title;
    comentario = meta.instagram?.firstComment ?? meta.facebook?.firstComment;
  } else {
    const info = leerInfo(toolInput);
    if (!info) return [];
    texto = info.text;
    titulo = info.tiktokData?.title;
    comentario = info.firstCommentText;
  }
  const textos = [];
  if (typeof texto === 'string' && texto.trim()) textos.push({ nombre: 'el texto del post', valor: texto });
  if (typeof titulo === 'string' && titulo.trim() && titulo.trim() !== texto?.trim()) textos.push({ nombre: 'el título de TikTok', valor: titulo });
  if (typeof comentario === 'string' && comentario.trim()) textos.push({ nombre: 'el primer comentario', valor: comentario });
  return textos;
}

export function decidir(toolInput, links = cargarConfig().marca?.links) {
  const ia = [], link = [];
  const textos = textosDelPost(toolInput);
  for (const { nombre, valor } of textos) {
    const r = revisarIA(valor);
    if (r.corregir.length) ia.push(`${nombre}: ${r.corregir.join(' · ')}`);
    else if (r.veredicto === 'suena a IA') ia.push(`${nombre} suena a IA (${r.porcentaje}%)`);
  }
  const principal = textos.find((t) => t.nombre === 'el texto del post')?.valor;
  if (principal) for (const red of redesConTexto(toolInput, links)) link.push(...revisarCaminoAlLink(principal, red, links));
  if (!ia.length && !link.length) return null;
  const partes = [];
  if (ia.length) partes.push(`Humanizador automático: ${ia.join(' | ')}. Corregí solo lo marcado con la skill contenido-humanizador (sin cambiar lo que afirma el texto) y volvé a medir con \`node tools/contenido/cli.mjs humanizar\`.`);
  if (link.length) partes.push(`Link de un toque: ${[...new Set(link)].join(' | ')}`);
  return {
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: `No se programa todavía. ${partes.join(' ')} Después programalo de nuevo. Si el texto ya estaba aprobado, contale a la persona qué cambiaste.`,
    },
  };
}

const esPrincipal = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (esPrincipal) {
  try {
    const entrada = JSON.parse((await leerStdin()) || '{}');
    const r = decidir(entrada.tool_input);
    if (r) process.stdout.write(JSON.stringify(r) + '\n');
  } catch {
    // Entrada ilegible: se deja pasar.
  }
  process.exitCode = 0;
}
