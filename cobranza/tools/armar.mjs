// Arma los dos archivos que se entregan:
//   dist/worker.js  → la app entera en un solo archivo, para pegar en Cloudflare
//   dist/demo.html  → la demo que corre sola en el navegador
// Uso: npm run armar            (necesita `npm install` una vez)
import { build, transform } from 'esbuild';
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { RUBROS } from '../src/rubros.js';

const raiz = new URL('..', import.meta.url);
const en = (r) => new URL(r, raiz);
const leer = (r) => readFile(en(r), 'utf8');
const paquete = async (entrada, define = {}) => (await build({
  entryPoints: [en(entrada).pathname], bundle: true, format: 'iife', minify: true, write: false, target: 'es2022', legalComments: 'none', define,
})).outputFiles[0].text;

const css = (await transform(await leer('web/app.css'), { loader: 'css', minify: true })).code.trim();
const js = await paquete('web/principal.js');
const version = createHash('sha256').update(css).update(js).digest('hex').slice(0, 10);
const html = (await leer('web/index.html')).replaceAll('__VERSION__', version);
await writeFile(en('src/_web.js'), `// Generado por tools/armar.mjs. No editar.\nexport const VERSION = ${JSON.stringify(version)};\nexport const HTML = ${JSON.stringify(html)};\nexport const CSS = ${JSON.stringify(css)};\nexport const JS = ${JSON.stringify(js)};\n`);

await mkdir(en('dist'), { recursive: true });
const worker = await build({
  entryPoints: [en('src/worker.js').pathname], bundle: true, format: 'esm', minify: true, write: false, target: 'es2022', legalComments: 'none',
  banner: { js: `// Cobranza sin vueltas · versión ${version}\n// Archivo generado (npm run armar). Para instalar: pegar este archivo entero en el editor del Worker en Cloudflare.` },
});
await writeFile(en('dist/worker.js'), worker.outputFiles[0].text);

const demoJs = (await paquete('web/demo.js')).replaceAll('</script', '<\\/script');
const cabeza = `<title>Cobranza sin vueltas</title>\n<meta name="claude:viewport-fit-sides" content="cover">\n<style>${css}</style>`;
const cuerpo = `<div id="app"><main class="cont"><p class="tenue">Cargando…</p></main></div>\n<script>${demoJs}</script>`;
await writeFile(en('dist/demo.html'), `<!doctype html>\n<html lang="es-AR">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n<meta name="robots" content="noindex">\n${cabeza}\n</head>\n<body>\n${cuerpo}\n</body>\n</html>\n`);
// La misma demo sin <html>/<head>/<body>, para publicarla como página compartible.
const fragmento = process.argv[2];
if (fragmento) await writeFile(fragmento, `${cabeza}\n${cuerpo}\n`);

// Las micro apps de nicho: cada una en dos archivos, la real (guarda los datos
// en el celular) y su demo (datos de ejemplo, no guarda nada).
const carpetaDemos = process.argv[3];
if (carpetaDemos) await mkdir(carpetaDemos, { recursive: true });
const nichos = [];
for (const rubro of Object.values(RUBROS).filter((r) => r.archivo)) {
  for (const demo of [false, true]) {
    const codigo = (await paquete('web/basica.js', { RUBRO: JSON.stringify(rubro.id), DEMO: String(demo) })).replaceAll('</script', '<\\/script');
    const titulo = rubro.titulo || rubro.nombre;
    const arriba = `<title>${titulo}</title>\n<meta name="claude:viewport-fit-sides" content="cover">\n<style>${css}</style>`;
    const abajo = `<div id="app"><main class="cont"><p class="tenue">Cargando…</p></main></div>\n<script>${codigo}</script>`;
    const nombre = `${rubro.archivo}${demo ? '-demo' : ''}.html`;
    await writeFile(en(`dist/${nombre}`), `<!doctype html>\n<html lang="es-AR">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n<meta name="robots" content="noindex">\n<meta name="mobile-web-app-capable" content="yes">\n<meta name="apple-mobile-web-app-capable" content="yes">\n<meta name="apple-mobile-web-app-title" content="${titulo}">\n<meta name="theme-color" content="${rubro.color}">\n${arriba}\n</head>\n<body>\n${abajo}\n</body>\n</html>\n`);
    if (demo && carpetaDemos) await writeFile(`${carpetaDemos}/${nombre}`, `${arriba}\n${abajo}\n`);
    nichos.push(nombre);
  }
}
console.log(`micro apps: ${nichos.join(' · ')}`);

const kb = (t) => `${(Buffer.byteLength(t) / 1024).toFixed(0)} KB`;
console.log(`worker.js ${kb(worker.outputFiles[0].text)} · demo.html ${kb(demoJs)} · versión ${version}`);
