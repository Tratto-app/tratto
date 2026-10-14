// Saca del video, en el navegador, lo que necesita el analizador: cuadros
// chiquitos (6 por segundo) y el sonido en mono a 16 kHz de los primeros 30 s.
// El archivo no se sube a ningún lado.
import { SEGUNDOS_ANALIZADOS, type Entrada } from './cerebro-core';

const FPS = 6;
const ANCHO = 72;
const MUESTREO = 16000;
export const MAX_MB = 300;

function esperar(v: HTMLVideoElement, evento: 'loadedmetadata' | 'seeked', ms = 8000) {
  return new Promise<void>((ok, mal) => {
    const t = window.setTimeout(() => { limpiar(); mal(new Error('El video tardó demasiado en responder.')); }, ms);
    const listo = () => { limpiar(); ok(); };
    const error = () => { limpiar(); mal(new Error('El navegador no puede abrir este video. Probá con un MP4.')); };
    const limpiar = () => { window.clearTimeout(t); v.removeEventListener(evento, listo); v.removeEventListener('error', error); };
    v.addEventListener(evento, listo);
    v.addEventListener('error', error);
  });
}

async function sonido(file: File): Promise<Float32Array | null> {
  try {
    const ctx = new OfflineAudioContext(1, MUESTREO * SEGUNDOS_ANALIZADOS, MUESTREO);
    const buf = await ctx.decodeAudioData(await file.arrayBuffer());
    const n = Math.min(buf.length, MUESTREO * SEGUNDOS_ANALIZADOS);
    const mono = new Float32Array(n);
    for (let c = 0; c < buf.numberOfChannels; c++) {
      const ch = buf.getChannelData(c);
      for (let i = 0; i < n; i++) mono[i] += ch[i] / buf.numberOfChannels;
    }
    return mono;
  } catch {
    return null; // sin pista de sonido o formato que el navegador no decodifica
  }
}

export async function extraer(file: File, progreso: (p: number) => void): Promise<Entrada> {
  if (!file.type.startsWith('video/') && !/\.(mp4|mov|m4v|webm)$/i.test(file.name)) throw new Error('Elegí un archivo de video (MP4, MOV o WEBM).');
  if (file.size > MAX_MB * 1048576) throw new Error(`El video pesa ${Math.round(file.size / 1048576)} MB; el máximo es ${MAX_MB} MB.`);
  const url = URL.createObjectURL(file);
  const v = document.createElement('video');
  v.muted = true; v.playsInline = true; v.preload = 'auto';
  try {
    const meta = esperar(v, 'loadedmetadata');
    v.src = url;
    await meta;
    const duracion = Number.isFinite(v.duration) ? v.duration : SEGUNDOS_ANALIZADOS;
    if (!v.videoWidth || !v.videoHeight) throw new Error('No se pudo leer la imagen del video.');
    const alto = Math.max(2, Math.round((ANCHO * v.videoHeight) / v.videoWidth / 2) * 2);
    const lienzo = document.createElement('canvas');
    lienzo.width = ANCHO; lienzo.height = alto;
    const ctx = lienzo.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('El navegador no deja dibujar el video.');
    // Achicar promediando (como ffmpeg con flags=area en la CLI), así los dos dan lo mismo.
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    const tomar = async (t: number) => {
      const s = esperar(v, 'seeked');
      v.currentTime = Math.min(t, Math.max(duracion - 0.05, 0));
      await s;
      ctx.drawImage(v, 0, 0, ANCHO, alto);
      return new Uint8ClampedArray(ctx.getImageData(0, 0, ANCHO, alto).data);
    };
    const hasta = Math.min(duracion, SEGUNDOS_ANALIZADOS);
    const total = Math.max(1, Math.floor(hasta * FPS));
    const largo = duracion > SEGUNDOS_ANALIZADOS + 0.5;
    const cuadros: Uint8ClampedArray[] = [];
    for (let i = 0; i < total; i++) {
      cuadros.push(await tomar(i / FPS));
      progreso((0.8 * (i + 1)) / total);
    }
    // Si dura más de lo analizado, los últimos 2 s aparte para ver el cierre.
    let cola: Uint8ClampedArray[] | undefined;
    if (largo) {
      cola = [];
      for (let i = 2 * FPS; i > 0; i--) cola.push(await tomar(duracion - i / FPS));
    }
    progreso(0.85);
    const audio = await sonido(file);
    progreso(0.95);
    return { ancho: ANCHO, alto, fps: FPS, cuadros, cola, audio, muestreo: MUESTREO, duracion };
  } finally {
    v.removeAttribute('src');
    v.load();
    URL.revokeObjectURL(url);
  }
}
