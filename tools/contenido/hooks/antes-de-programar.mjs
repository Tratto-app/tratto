#!/usr/bin/env node
// Control automático antes de programar en Metricool (hook PreToolUse de
// Claude Code, ver .claude/settings.json). Pasa el texto del post por el
// humanizador sin que nadie lo pida: si hay algo que corregir sí o sí o el
// texto "suena a IA", frena la programación y dice qué cambiar. Si el texto
// está bien, o si la entrada no se puede leer, deja pasar (un control que
// falla no tiene que trabar el trabajo).
import { pathToFileURL } from 'node:url';
import { revisarIA } from '../lib/humanizador.mjs';

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
export function textosDelPost(toolInput) {
  let info = toolInput?.info;
  if (typeof info === 'string') {
    try { info = JSON.parse(info); } catch { return []; }
  }
  if (!info || typeof info !== 'object') return [];
  const textos = [];
  if (typeof info.text === 'string' && info.text.trim()) textos.push({ nombre: 'el texto del post', valor: info.text });
  const titulo = info.tiktokData?.title;
  if (typeof titulo === 'string' && titulo.trim() && titulo.trim() !== info.text?.trim()) textos.push({ nombre: 'el título de TikTok', valor: titulo });
  if (typeof info.firstCommentText === 'string' && info.firstCommentText.trim()) textos.push({ nombre: 'el primer comentario', valor: info.firstCommentText });
  return textos;
}

export function decidir(toolInput) {
  const problemas = [];
  for (const { nombre, valor } of textosDelPost(toolInput)) {
    const r = revisarIA(valor);
    if (r.corregir.length) problemas.push(`${nombre}: ${r.corregir.join(' · ')}`);
    else if (r.veredicto === 'suena a IA') problemas.push(`${nombre} suena a IA (${r.porcentaje}%)`);
  }
  if (!problemas.length) return null;
  return {
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: `Humanizador automático: no se programa todavía. ${problemas.join(' | ')}. `
        + 'Corregí solo lo marcado con la skill contenido-humanizador (sin cambiar lo que afirma el texto), '
        + 'volvé a medir con `node tools/contenido/cli.mjs humanizar` y programalo de nuevo. '
        + 'Si el texto ya estaba aprobado, contale a la persona qué cambiaste.',
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
