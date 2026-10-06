// Extracción de fotogramas de un video con ffmpeg, para que Claude pueda
// "ver" un reel: unos fotogramas al principio (el hook) y el resto
// repartidos de forma pareja. No transcribe audio: si hace falta el texto
// hablado, se pide la transcripción o los subtítulos.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { ErrorEntrada } from './errores.mjs';

const EXTENSIONES = new Set(['.mp4', '.mov', '.m4v', '.webm', '.mkv', '.avi']);
const MAX_BYTES = 500 * 1024 * 1024;
const MAX_FOTOGRAMAS = 24;

function hay(binario) {
  const r = spawnSync(binario, ['-version'], { encoding: 'utf8' });
  return !r.error && r.status === 0;
}

export function ffmpegDisponible() {
  return hay('ffmpeg') && hay('ffprobe');
}

export function duracion(video) {
  const r = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration:stream=codec_type,width,height',
    '-of', 'json', '--', video], { encoding: 'utf8', timeout: 30000 });
  if (r.error || r.status !== 0) throw new ErrorEntrada(`No se pudo leer el video (¿está dañado o no es un video?): ${(r.stderr || r.error?.message || '').slice(0, 300)}`);
  let info;
  try { info = JSON.parse(r.stdout); } catch { throw new ErrorEntrada('ffprobe devolvió una respuesta ilegible'); }
  const segundos = Number(info.format?.duration);
  const video_ = (info.streams || []).find((s) => s.codec_type === 'video');
  if (!video_) throw new ErrorEntrada('El archivo no tiene pista de video');
  if (!Number.isFinite(segundos) || segundos <= 0) throw new ErrorEntrada('No se pudo determinar la duración del video');
  return { segundos, ancho: video_.width, alto: video_.height, tiene_audio: (info.streams || []).some((s) => s.codec_type === 'audio') };
}

// Momentos a capturar: 0, 1 y 2 s (el hook) y el resto repartidos entre el
// último momento del hook y el final, sin repetir.
export function momentos(segundos, cantidad) {
  const n = Math.max(1, Math.min(MAX_FOTOGRAMAS, Math.floor(cantidad)));
  const hook = [0, 1, 2].filter((t) => t < segundos).slice(0, n);
  const inicio = hook[hook.length - 1] ?? 0;
  const resto = n - hook.length;
  const set = new Set(hook);
  for (let i = 1; i <= resto; i++) set.add(Math.round((inicio + ((segundos - inicio) * i) / (resto + 1)) * 10) / 10);
  return [...set].filter((t) => t < segundos).sort((a, b) => a - b);
}

export function extraerFotogramas(video, salida, { cantidad = 8, ancho = 540 } = {}) {
  if (!ffmpegDisponible()) throw new Error('ffmpeg/ffprobe no están instalados en esta máquina');
  if (typeof video !== 'string' || !video) throw new ErrorEntrada('Falta la ruta del video');
  const abs = path.resolve(video);
  let st;
  try { st = fs.statSync(abs); } catch { throw new ErrorEntrada(`No existe el archivo: ${video}`); }
  if (!st.isFile()) throw new ErrorEntrada(`No es un archivo: ${video}`);
  if (!EXTENSIONES.has(path.extname(abs).toLowerCase())) throw new ErrorEntrada(`Extensión no soportada (${path.extname(abs) || 'sin extensión'}). Usá: ${[...EXTENSIONES].join(', ')}`);
  if (st.size > MAX_BYTES) throw new ErrorEntrada(`El video pesa ${Math.round(st.size / 1048576)} MB; el máximo es ${MAX_BYTES / 1048576} MB`);
  if (!Number.isInteger(cantidad) || cantidad < 1 || cantidad > MAX_FOTOGRAMAS) throw new ErrorEntrada(`La cantidad de fotogramas tiene que ser un entero de 1 a ${MAX_FOTOGRAMAS}`);
  if (!Number.isInteger(ancho) || ancho < 120 || ancho > 1920) throw new ErrorEntrada('El ancho tiene que ser un entero de 120 a 1920');

  const info = duracion(abs);
  const dir = path.resolve(salida);
  fs.mkdirSync(dir, { recursive: true });
  const archivos = [];
  for (const [i, t] of momentos(info.segundos, cantidad).entries()) {
    const nombre = path.join(dir, `fotograma-${String(i + 1).padStart(2, '0')}-${t.toFixed(1)}s.jpg`);
    // Sin shell: los argumentos van como lista, así una ruta con caracteres raros no se interpreta.
    const r = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-ss', String(t), '-i', abs,
      '-frames:v', '1', '-vf', `scale=${ancho}:-2`, '-q:v', '4', nombre], { encoding: 'utf8', timeout: 60000 });
    if (r.error || r.status !== 0 || !fs.existsSync(nombre)) continue;
    archivos.push({ segundo: t, archivo: nombre });
  }
  if (!archivos.length) throw new Error('ffmpeg no pudo extraer ningún fotograma');
  return { ...info, segundos: Math.round(info.segundos * 10) / 10, fotogramas: archivos, nota: info.tiene_audio ? 'El video tiene audio: los fotogramas no lo capturan. Pedí la transcripción o los subtítulos para analizar lo que se dice.' : 'El video no tiene audio.' };
}
