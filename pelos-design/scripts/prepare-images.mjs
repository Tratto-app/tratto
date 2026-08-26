/**
 * Prepara las fotos originales del salón para el sitio.
 *
 * Trabajo real que hace este script:
 *  - Recorta el chrome de iOS del screenshot de Instagram (barra de estado,
 *    botones y pill de autoría) para dejar sólo la fotografía.
 *  - Parte el collage "antes y después" en dos imágenes independientes del
 *    mismo tamaño, para que el slider comparativo alinee bien.
 *  - Normaliza, reescala y comprime todo a masters que después optimiza
 *    next/image (AVIF/WebP + srcset + blur placeholder).
 *
 * Uso: npm run images
 */
import sharp from 'sharp';
import { mkdir, access } from 'node:fs/promises';
import path from 'node:path';

const SOURCE_DIR =
  process.env.PELOS_SOURCE_DIR ??
  '/root/.claude/uploads/68bc1e37-5859-5a77-8edc-d453618f1b9c';
const OUT_DIR = path.join(process.cwd(), 'src/assets/images');

/** Recorte medido sobre el screenshot: la foto vive entre y=540 e y=2012. */
const INSTAGRAM_CROP = { left: 0, top: 540, width: 1179, height: 1472 };

/** Costura del collage antes/después, detectada por discontinuidad de columnas. */
const SEAM_X = 554;
const PANEL_WIDTH = 554;

const jobs = [
  {
    source: '90118c55-image.png',
    out: 'cobre-rulos',
    maxWidth: 1600,
    extract: INSTAGRAM_CROP,
  },
  { source: '2f998b72-image.jpg', out: 'taller-color', maxWidth: 1600 },
  { source: 'a5480905-image.jpg', out: 'salon-interior', maxWidth: 1600 },
  { source: '41601943-image.jpg', out: 'ondas-castanas', maxWidth: 1400 },
  { source: '5cf88cf1-image.jpg', out: 'liso-caramelo', maxWidth: 1400 },
  {
    source: '4c493e40-image.jpg',
    out: 'transformacion-antes',
    maxWidth: 1100,
    extract: { left: 0, top: 0, width: PANEL_WIDTH, height: 992 },
  },
  {
    source: '4c493e40-image.jpg',
    out: 'transformacion-despues',
    maxWidth: 1100,
    // Recorte centrado en el panel derecho, del mismo ancho que el izquierdo,
    // para que ambas mitades del slider compartan proporción exacta.
    extract: {
      left: SEAM_X + Math.round((1179 - SEAM_X - PANEL_WIDTH) / 2),
      top: 0,
      width: PANEL_WIDTH,
      height: 992,
    },
  },
];

async function run() {
  await mkdir(OUT_DIR, { recursive: true });

  for (const job of jobs) {
    const from = path.join(SOURCE_DIR, job.source);
    try {
      await access(from);
    } catch {
      console.warn(`· omitido (no está el original): ${job.source}`);
      continue;
    }

    let pipeline = sharp(from).rotate();
    if (job.extract) pipeline = pipeline.extract(job.extract);

    const target = path.join(OUT_DIR, `${job.out}.jpg`);
    const info = await pipeline
      .resize({ width: job.maxWidth, withoutEnlargement: true })
      .jpeg({ quality: 82, mozjpeg: true, chromaSubsampling: '4:4:4' })
      .toFile(target);

    console.log(
      `✓ ${job.out}.jpg  ${info.width}×${info.height}  ${(info.size / 1024).toFixed(0)} kB`,
    );
  }
}

run().catch((error) => {
  console.error('No se pudieron preparar las imágenes:', error);
  process.exit(1);
});
