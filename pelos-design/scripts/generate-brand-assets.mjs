/**
 * Genera los assets de marca derivados: favicon, apple-touch-icon y la
 * imagen de Open Graph. Se arman por código para que sigan al design system
 * si cambian los colores, en lugar de quedar como binarios sueltos.
 *
 * Uso: npm run brand
 */
import sharp from 'sharp';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';

const PUBLIC_DIR = path.join(process.cwd(), 'public');
const INK = '#241C17';
const CREAM = '#FDF0E4';
const COPPER = '#A8471F';
const SAND = '#EBD3BC';

const icon = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 64 64">
  <rect width="64" height="64" fill="${INK}"/>
  <text x="32" y="43" text-anchor="middle" font-family="Georgia, serif" font-size="38" fill="${CREAM}">P</text>
  <circle cx="47" cy="20" r="4.5" fill="${COPPER}"/>
</svg>`;

/**
 * Imagen de Open Graph, 1200×630.
 * Composición: foto del salón a la derecha, bloque tipográfico a la
 * izquierda sobre crema. Se ve legible incluso en la miniatura chica que
 * muestra WhatsApp.
 */
async function buildOgImage() {
  const WIDTH = 1200;
  const HEIGHT = 630;
  const PHOTO_WIDTH = 460;

  const photo = await sharp(path.join(process.cwd(), 'src/assets/images/cobre-rulos.jpg'))
    .resize({ width: PHOTO_WIDTH, height: HEIGHT, fit: 'cover', position: 'attention' })
    .toBuffer();

  const overlay = `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}">
    <rect width="${WIDTH}" height="${HEIGHT}" fill="${CREAM}"/>
    <rect x="72" y="96" width="64" height="2" fill="${COPPER}"/>
    <text x="72" y="150" font-family="Georgia, serif" font-size="26" fill="#6B5B50" letter-spacing="4">PELUQUERÍA EN CABALLITO</text>
    <text x="72" y="268" font-family="Georgia, serif" font-size="82" font-style="italic" fill="${INK}">El color,</text>
    <text x="72" y="360" font-family="Georgia, serif" font-size="82" font-style="italic" fill="${COPPER}">hecho a mano.</text>
    <rect x="72" y="422" width="596" height="1" fill="${SAND}"/>
    <text x="72" y="486" font-family="Georgia, serif" font-size="34" fill="${INK}">Pelo&#8217;s <tspan font-style="italic" fill="${COPPER}">Design</tspan></text>
    <text x="72" y="536" font-family="Georgia, serif" font-size="27" fill="#6B5B50">Yerbal 880, Caballito &#183; CABA</text>
  </svg>`;

  await sharp(Buffer.from(overlay))
    .composite([{ input: photo, left: WIDTH - PHOTO_WIDTH, top: 0 }])
    .jpeg({ quality: 88, mozjpeg: true })
    .toFile(path.join(PUBLIC_DIR, 'og.jpg'));

  console.log(`✓ og.jpg  ${WIDTH}×${HEIGHT}`);
}

async function run() {
  await writeFile(path.join(PUBLIC_DIR, 'icon.svg'), icon.replace(/width="512" height="512" /, ''));

  await sharp(Buffer.from(icon))
    .resize(180, 180)
    .png()
    .toFile(path.join(PUBLIC_DIR, 'apple-touch-icon.png'));
  console.log('✓ apple-touch-icon.png  180×180');

  // .ico con los tres tamaños que usan los navegadores.
  const png32 = await sharp(Buffer.from(icon)).resize(32, 32).png().toBuffer();
  await writeFile(path.join(PUBLIC_DIR, 'favicon.ico'), png32);
  console.log('✓ favicon.ico  32×32');

  await buildOgImage();
}

run().catch((error) => {
  console.error('No se pudieron generar los assets de marca:', error);
  process.exit(1);
});
