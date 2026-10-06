#!/usr/bin/env node
// Motor de contenido: lo que las skills necesitan calcular o recordar de forma
// determinística. Las skills razonan; este programa valida, puntúa, verifica
// y guarda. Sin dependencias: Node 18+ (y ffmpeg solo para `fotogramas`).
//
//   node tools/contenido/cli.mjs ayuda
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { cargarConfig } from './lib/config.mjs';
import { armarContexto } from './lib/contexto.mjs';
import { conocimiento } from './lib/conocimiento.mjs';
import { ErrorEntrada } from './lib/errores.mjs';
import { extraerFotogramas } from './lib/fotogramas.mjs';
import { hooksMarkdown, verificarHooks } from './lib/hooks.mjs';
import { actualizar, estadoMemoria, leer, registrar, TIPOS } from './lib/memoria.mjs';
import { analizarMetricas, medianas, rendimiento } from './lib/metricas.mjs';
import { puntajeMarkdown, puntuar, revisarRubrica } from './lib/puntaje.mjs';
import { verificacionMarkdown, verificarPieza } from './lib/verificar.mjs';

const MAX_ENTRADA = 1024 * 1024;

const AYUDA = `Motor de contenido (tools/contenido)

Uso: node tools/contenido/cli.mjs <comando> [opciones]

  contexto [--segmento ID]            Marca, público, estrategia y memoria resumida (leer siempre primero)
  puntuar  [--archivo F]              Puntúa con la rúbrica: { formato, insumo, dimensiones: { dim: { puntaje, evidencia } } }
           [--etiqueta TEXTO]         Título de la tabla (por defecto VIRALIDAD)
  hooks    [--archivo F]              Verifica hooks: { formato, hooks: [{ texto, categoria, criterios? }] }
  verificar [--archivo F]             Límites de la plataforma y reglas de marca de una pieza:
                                      reel {guion, hook?, duracion_seg?} · carrusel {slides, texto?}
                                      historia {pantallas} · publicacion {texto} · perfil {nombre?, usuario?, bio?, destacadas?}
  metricas                            Ranking de la cuenta por interacción y medianas
  metricas --comparar [--archivo F]   Compara un resultado (sin guardarlo) con las medianas de la cuenta
  registrar <tipo> [--archivo F]      Guarda en memoria. Tipos: ${Object.keys(TIPOS).join(', ')}
  actualizar <tipo> <id> [--archivo F]  Cambia campos permitidos (por ejemplo estado o url)
  memoria  [tipo] [--limite N]        Lista lo guardado (o el resumen si no se indica tipo)
  validar                             Revisa rúbrica, conocimiento, configuración y memoria
  fotogramas <video> [--salida DIR] [--cantidad N] [--ancho PX]
                                      Extrae fotogramas con ffmpeg para analizar un video
  ayuda                               Esta ayuda

La entrada JSON va por --archivo o por stdin. --json devuelve JSON en lugar de texto.
Códigos de salida: 0 bien · 1 error interno · 2 entrada inválida · 3 la pieza no cumple un límite de la plataforma.`;

function parsear(argv) {
  const pos = [], op = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const [k, v] = a.slice(2).split('=', 2);
      if (v !== undefined) op[k] = v;
      else if (i + 1 < argv.length && !argv[i + 1].startsWith('--')) op[k] = argv[++i];
      else op[k] = true;
    } else pos.push(a);
  }
  return { pos, op };
}

function entero(v, nombre, def) {
  if (v === undefined) return def;
  const n = Number(v);
  if (!Number.isInteger(n)) throw new ErrorEntrada(`--${nombre} tiene que ser un número entero`);
  return n;
}

const ESPERA_STDIN_MS = 3000;

// Lee stdin con límite de tamaño. Si en unos segundos no llega nada (stdin
// abierto pero vacío, como cuando se llama desde otro programa), corta en
// lugar de quedarse colgado.
function leerStdin() {
  return new Promise((resolve, reject) => {
    const partes = [];
    let total = 0;
    const fin = (err, valor) => {
      clearTimeout(reloj);
      process.stdin.removeAllListeners('data').removeAllListeners('end').removeAllListeners('error');
      process.stdin.pause();
      if (err) reject(err); else resolve(valor);
    };
    const reloj = setTimeout(() => fin(null, ''), ESPERA_STDIN_MS);
    process.stdin.on('data', (parte) => {
      clearTimeout(reloj);
      total += parte.length;
      if (total > MAX_ENTRADA) return fin(new ErrorEntrada(`La entrada pesa más de ${MAX_ENTRADA / 1024} KB`));
      partes.push(parte);
    });
    process.stdin.on('end', () => fin(null, Buffer.concat(partes).toString('utf8')));
    process.stdin.on('error', () => fin(null, ''));
  });
}

async function leerEntrada(op) {
  let crudo;
  if (typeof op.archivo === 'string') {
    let st;
    try { st = fs.statSync(op.archivo); } catch { throw new ErrorEntrada(`No existe el archivo: ${op.archivo}`); }
    if (st.size > MAX_ENTRADA) throw new ErrorEntrada(`La entrada pesa más de ${MAX_ENTRADA / 1024} KB`);
    crudo = fs.readFileSync(op.archivo, 'utf8');
  } else if (!process.stdin.isTTY) {
    crudo = await leerStdin();
  }
  if (!crudo || !crudo.trim()) {
    throw new ErrorEntrada('Falta la entrada JSON (pasala con --archivo o por stdin)');
  }
  try {
    return JSON.parse(crudo);
  } catch (e) {
    throw new ErrorEntrada(`La entrada no es JSON válido: ${e.message}`);
  }
}

function salida(op, objeto, texto) {
  process.stdout.write((op.json || texto === undefined ? JSON.stringify(objeto, null, 2) : texto) + '\n');
}

function validarTodo() {
  const problemas = [], avisos = [];
  for (const p of revisarRubrica()) problemas.push(`rúbrica: ${p}`);
  const hooks = conocimiento('hooks');
  const criterios = conocimiento('rubrica').dimensiones;
  for (const [id, c] of Object.entries(hooks.categorias)) {
    if (!c.mecanismo || !Array.isArray(c.plantillas) || !c.plantillas.length) problemas.push(`hooks.json: categoría ${id} incompleta`);
  }
  if (Object.keys(hooks.categorias).length !== 12) avisos.push(`hooks.json tiene ${Object.keys(hooks.categorias).length} categorías (se esperaban 12)`);
  const formatos = conocimiento('formatos');
  for (const f of Object.keys(conocimiento('rubrica').formatos)) {
    if (f !== 'idea' && !formatos.formatos[f]) problemas.push(`formatos.json: falta el formato ${f} que usa la rúbrica`);
  }
  for (const c of Object.keys(hooks.criterios_seleccion)) {
    if (c !== 'viralidad' && !criterios[c]) problemas.push(`hooks.json: criterio ${c} no existe en la rúbrica`);
  }
  const config = cargarConfig();
  problemas.push(...config.errores);
  avisos.push(...config.advertencias);
  const mem = estadoMemoria();
  for (const [tipo, e] of Object.entries(mem)) {
    for (const c of e.corruptas) problemas.push(`memoria/${TIPOS[tipo].archivo}: línea ${c.linea} ilegible (${c.error})`);
  }
  // Referencias rotas en la memoria.
  const ids = new Set(leer('contenido').registros.map((c) => c.id));
  for (const r of leer('resultado').registros) if (!ids.has(r.contenido_id)) problemas.push(`memoria: el resultado ${r.id} apunta a un contenido inexistente (${r.contenido_id})`);
  return { ok: problemas.length === 0, problemas, avisos, memoria: Object.fromEntries(Object.entries(mem).map(([k, v]) => [k, v.total])) };
}

async function main(argv) {
  const { pos, op } = parsear(argv);
  const cmd = pos[0] || 'ayuda';

  switch (cmd) {
    case 'ayuda': case 'help': case '--help':
      process.stdout.write(AYUDA + '\n');
      return 0;

    case 'contexto': {
      const r = armarContexto({ segmento: typeof op.segmento === 'string' ? op.segmento : undefined, limite: entero(op.limite, 'limite', 15) });
      salida(op, r, r.markdown);
      return 0;
    }

    case 'puntuar': {
      const r = puntuar(await leerEntrada(op));
      const etiqueta = typeof op.etiqueta === 'string' ? op.etiqueta.slice(0, 40) : 'VIRALIDAD';
      salida(op, r, puntajeMarkdown(r, etiqueta));
      return 0;
    }

    case 'hooks': {
      const entrada = await leerEntrada(op);
      const config = cargarConfig();
      const r = verificarHooks(entrada, leer('hook').registros, config.marca?.palabras_no || []);
      salida(op, r, hooksMarkdown(r));
      return 0;
    }

    case 'verificar': {
      const r = verificarPieza(await leerEntrada(op), cargarConfig().marca);
      salida(op, r, verificacionMarkdown(r));
      return r.ok ? 0 : 3;
    }

    case 'metricas': {
      const filas = rendimiento(leer('contenido').registros, leer('resultado').registros);
      if (!op.comparar) {
        const r = { contenidos: filas, medianas: medianas(filas) };
        const texto = filas.length
          ? ['Rendimiento por interacción (guardados + compartidos + comentarios sobre alcance):', '',
            ...filas.map((f, i) => `${i + 1}. ${f.interaccion_por_alcance}% · ${f.plataforma} · ${f.formato} · ${f.titulo} (guardados ${f.guardados_por_alcance}%, compartidos ${f.compartidos_por_alcance}%, alcance ${f.alcance})`),
            '', `Medianas: ${JSON.stringify(r.medianas)}`].join('\n')
          : 'Todavía no hay resultados registrados. Cargalos con: registrar resultado';
        salida(op, r, texto);
      } else {
        const r = analizarMetricas(await leerEntrada(op), filas);
        salida(op, r);
      }
      return 0;
    }

    case 'registrar': {
      const tipo = pos[1];
      if (!tipo) throw new ErrorEntrada(`Falta el tipo. Opciones: ${Object.keys(TIPOS).join(', ')}`);
      const entrada = await leerEntrada(op);
      const config = cargarConfig();
      const lista = Array.isArray(entrada) ? entrada : [entrada];
      if (lista.length > 100) throw new ErrorEntrada('Se pueden registrar hasta 100 elementos por vez');
      const guardados = lista.map((d) => registrar(tipo, d, { config }));
      salida(op, Array.isArray(entrada) ? guardados : guardados[0],
        guardados.map((g) => g.duplicado ? `Ya existía: ${g.id} (no se duplicó)` : `Guardado: ${g.id}`).join('\n'));
      return 0;
    }

    case 'actualizar': {
      const [, tipo, id] = pos;
      if (!tipo || !id) throw new ErrorEntrada('Uso: actualizar <tipo> <id> --archivo cambios.json');
      const r = actualizar(tipo, id, await leerEntrada(op));
      salida(op, r, `Actualizado: ${r.id}`);
      return 0;
    }

    case 'memoria': {
      const tipo = pos[1];
      if (!tipo) {
        const e = estadoMemoria();
        salida(op, e, Object.entries(e).map(([k, v]) => `${k}: ${v.total}${v.corruptas.length ? ` (${v.corruptas.length} líneas ilegibles)` : ''}`).join('\n'));
        return 0;
      }
      if (!TIPOS[tipo]) throw new ErrorEntrada(`Tipo desconocido: ${tipo}. Opciones: ${Object.keys(TIPOS).join(', ')}`);
      const limite = entero(op.limite, 'limite', 50);
      const { registros } = leer(tipo);
      salida({ json: true }, registros.slice(-Math.max(1, limite)));
      return 0;
    }

    case 'validar': {
      const r = validarTodo();
      const texto = [r.ok ? 'OK: rúbrica, conocimiento, configuración y memoria son válidos.' : 'Hay problemas:',
        ...r.problemas.map((p) => `✗ ${p}`), ...r.avisos.map((a) => `⚠ ${a}`),
        `Memoria: ${Object.entries(r.memoria).map(([k, v]) => `${k} ${v}`).join(' · ')}`].join('\n');
      salida(op, r, texto);
      return r.ok ? 0 : 2;
    }

    case 'fotogramas': {
      const video = pos[1];
      if (!video) throw new ErrorEntrada('Uso: fotogramas <video> [--salida DIR] [--cantidad N]');
      const dir = typeof op.salida === 'string' ? op.salida
        : fs.mkdtempSync(path.join(os.tmpdir(), 'fotogramas-'));
      const r = extraerFotogramas(video, dir, { cantidad: entero(op.cantidad, 'cantidad', 8), ancho: entero(op.ancho, 'ancho', 540) });
      salida(op, r, [`Video: ${r.segundos} s · ${r.ancho}×${r.alto}`, r.nota, '', ...r.fotogramas.map((f) => `${f.segundo}s → ${f.archivo}`)].join('\n'));
      return 0;
    }

    default:
      throw new ErrorEntrada(`Comando desconocido: ${cmd}. Probá: node tools/contenido/cli.mjs ayuda`);
  }
}

main(process.argv.slice(2)).then((codigo) => { process.exitCode = codigo; }).catch((e) => {
  if (e instanceof ErrorEntrada) {
    process.stderr.write(`Error: ${e.message}\n${(e.detalles || []).map((d) => `  - ${d}`).join('\n')}${e.detalles?.length ? '\n' : ''}`);
    process.exitCode = 2;
  } else {
    process.stderr.write(`Error interno: ${e.message}\n`);
    process.exitCode = 1;
  }
});
