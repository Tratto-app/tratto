// Prueba del cerebro de un video, gratis y sin conexión: saca con ffmpeg los
// cuadros (6 por segundo, chiquitos) y el sonido (mono, 16 kHz) de los
// primeros 30 segundos y se los pasa al mismo analizador que usa el CRM
// (growth/web/src/lib/cerebro-core.ts). Es una estimación por señales del
// video, no un modelo del cerebro.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { ErrorEntrada } from './errores.mjs';
import { duracion, ffmpegDisponible } from './fotogramas.mjs';

const EXTENSIONES = new Set(['.mp4', '.mov', '.m4v', '.webm', '.mkv', '.avi']);
const MAX_BYTES = 500 * 1024 * 1024;
const FPS = 6;
const ANCHO = 72;
const MUESTREO = 16000;
const CORE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../growth/web/src/lib/cerebro-core.ts');

function ffmpeg(args, maxBuffer) {
  // Sin shell: los argumentos van como lista.
  const r = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', ...args], { maxBuffer, timeout: 120000 });
  if (r.error || r.status !== 0) throw new Error(`ffmpeg falló: ${(r.stderr?.toString() || r.error?.message || '').slice(0, 300)}`);
  return r.stdout;
}

export async function analizarVideo(video) {
  if (!ffmpegDisponible()) throw new Error('ffmpeg/ffprobe no están instalados en esta máquina');
  if (typeof video !== 'string' || !video) throw new ErrorEntrada('Falta la ruta del video');
  const abs = path.resolve(video);
  let st;
  try { st = fs.statSync(abs); } catch { throw new ErrorEntrada(`No existe el archivo: ${video}`); }
  if (!st.isFile()) throw new ErrorEntrada(`No es un archivo: ${video}`);
  if (!EXTENSIONES.has(path.extname(abs).toLowerCase())) throw new ErrorEntrada(`Extensión no soportada (${path.extname(abs) || 'sin extensión'}). Usá: ${[...EXTENSIONES].join(', ')}`);
  if (st.size > MAX_BYTES) throw new ErrorEntrada(`El video pesa ${Math.round(st.size / 1048576)} MB; el máximo es ${MAX_BYTES / 1048576} MB`);

  const { analizar, SEGUNDOS_ANALIZADOS } = await import(pathToFileURL(CORE).href);
  const info = duracion(abs);
  const alto = Math.max(2, Math.round((ANCHO * info.alto) / info.ancho / 2) * 2);
  const t = String(SEGUNDOS_ANALIZADOS);

  const tam = ANCHO * alto * 4;
  const leer = (antes) => {
    const crudo = ffmpeg([...antes, '-i', abs, '-an', '-vf', `fps=${FPS},scale=${ANCHO}:${alto}:flags=area`, '-f', 'rawvideo', '-pix_fmt', 'rgba', '-'], 256 * 1024 * 1024);
    const out = [];
    for (let i = 0; i + tam <= crudo.length; i += tam) out.push(new Uint8Array(crudo.buffer, crudo.byteOffset + i, tam));
    return out;
  };
  const cuadros = leer(['-t', t]);
  if (!cuadros.length) throw new Error('ffmpeg no devolvió ningún cuadro');
  // Si dura más de lo analizado, los últimos 2 s aparte para ver el cierre.
  const cola = info.segundos > SEGUNDOS_ANALIZADOS + 0.5 ? leer(['-sseof', '-2']) : undefined;

  let audio = null;
  if (info.tiene_audio) {
    const pcm = ffmpeg(['-t', t, '-i', abs, '-vn', '-ac', '1', '-ar', String(MUESTREO), '-f', 'f32le', '-'], 64 * 1024 * 1024);
    audio = new Float32Array(pcm.length >> 2);
    for (let i = 0; i < audio.length; i++) audio[i] = pcm.readFloatLE(i * 4);
  }

  const r = analizar({ ancho: ANCHO, alto, fps: FPS, cuadros, cola, audio, muestreo: MUESTREO, duracion: info.segundos });
  return { ...r, archivo: path.basename(abs) };
}
