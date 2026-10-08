#!/usr/bin/env node
// Control automático antes de programar en Metricool (hook PreToolUse de
// Claude Code, ver .claude/settings.json). Sin que nadie lo pida:
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
// primer comentario. `info` llega como texto JSON o como objeto.
function leerInfo(toolInput) {
  let info = toolInput?.info;
  if (typeof info === 'string') {
    try { info = JSON.parse(info); } catch { return null; }
  }
  return info && typeof info === 'object' ? info : null;
}

// Redes del post donde el texto se publica (las historias no llevan texto).
export function redesConTexto(toolInput) {
  const info = leerInfo(toolInput);
  if (!info || !Array.isArray(info.providers)) return [];
  return info.providers.map((p) => p?.network).filter((r) => {
    if (r === 'instagram') return String(info.instagramData?.type || 'POST').toUpperCase() !== 'STORY';
    return r === 'tiktok';
  });
}

export function textosDelPost(toolInput) {
  const info = leerInfo(toolInput);
  if (!info) return [];
  const textos = [];
  if (typeof info.text === 'string' && info.text.trim()) textos.push({ nombre: 'el texto del post', valor: info.text });
  const titulo = info.tiktokData?.title;
  if (typeof titulo === 'string' && titulo.trim() && titulo.trim() !== info.text?.trim()) textos.push({ nombre: 'el título de TikTok', valor: titulo });
  if (typeof info.firstCommentText === 'string' && info.firstCommentText.trim()) textos.push({ nombre: 'el primer comentario', valor: info.firstCommentText });
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
  if (principal) for (const red of redesConTexto(toolInput)) link.push(...revisarCaminoAlLink(principal, red, links));
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
