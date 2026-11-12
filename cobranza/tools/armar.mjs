// Arma los dos archivos que se entregan:
//   dist/worker.js  → la app entera en un solo archivo, para pegar en Cloudflare
//   dist/demo.html  → la demo que corre sola en el navegador
// Uso: npm run armar            (necesita `npm install` una vez)
import { build, transform } from 'esbuild';
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { RUBROS } from '../src/rubros.js';
import { paginaApp, paginaInicio, paginaGracias } from '../tienda/pagina.mjs';

const raiz = new URL('..', import.meta.url);
const en = (r) => new URL(r, raiz);
const leer = (r) => readFile(en(r), 'utf8');
const paquete = async (entrada, define = {}) => (await build({
  entryPoints: [en(entrada).pathname], bundle: true, format: 'iife', minify: true, write: false, target: 'es2022', legalComments: 'none', define,
})).outputFiles[0].text;

// La tipografía (Plus Jakarta Sans, licencia OFL) va adentro de cada archivo: no se pide nada a otros sitios.
const fuente = (await readFile(en('node_modules/@fontsource-variable/plus-jakarta-sans/files/plus-jakarta-sans-latin-wght-normal.woff2'))).toString('base64');
const fuenteCss = `@font-face{font-family:"Plus Jakarta Sans Variable";font-style:normal;font-display:swap;font-weight:200 800;src:url(data:font/woff2;base64,${fuente}) format("woff2-variations")}`;
const css = fuenteCss + (await transform(await leer('web/app.css'), { loader: 'css', minify: true })).code.trim();
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

// Las micro apps de nicho. De cada una salen la app suelta y su demo (dist/),
// y la tienda (dist/tienda/): página de venta, demo y la app que pide la
// licencia que entrega la compra.
const carpetaDemos = process.argv[3];
if (carpetaDemos) await mkdir(carpetaDemos, { recursive: true });
const cssTienda = fuenteCss + (await transform(await leer('tienda/tienda.css'), { loader: 'css', minify: true })).code.trim();
const nichos = Object.values(RUBROS).filter((r) => r.archivo);
await mkdir(en('dist/tienda/api'), { recursive: true });
for (const rubro of nichos) {
  const armarApp = async (demo, tienda) => (await paquete('web/basica.js', { RUBRO: JSON.stringify(rubro.id), DEMO: String(demo), TIENDA: String(tienda) })).replaceAll('</script', '<\\/script');
  const titulo = rubro.titulo || rubro.nombre;
  const arriba = `<title>${titulo}</title>\n<meta name="claude:viewport-fit-sides" content="cover">\n<style>${css}</style>`;
  const abajo = (codigo) => `<div id="app"><main class="cont"><p class="tenue">Cargando…</p></main></div>\n<script>${codigo}</script>`;
  const completo = (codigo) => `<!doctype html>\n<html lang="es-AR">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n<meta name="robots" content="noindex">\n<meta name="mobile-web-app-capable" content="yes">\n<meta name="apple-mobile-web-app-capable" content="yes">\n<meta name="apple-mobile-web-app-title" content="${titulo}">\n<meta name="theme-color" content="${rubro.color}">\n${arriba}\n</head>\n<body>\n${abajo(codigo)}\n</body>\n</html>\n`;
  const [real, demo, deTienda] = [await armarApp(false, false), await armarApp(true, false), await armarApp(false, true)];
  await writeFile(en(`dist/${rubro.archivo}.html`), completo(real));
  await writeFile(en(`dist/${rubro.archivo}-demo.html`), completo(demo));
  await mkdir(en(`dist/tienda/${rubro.archivo}`), { recursive: true });
  await writeFile(en(`dist/tienda/${rubro.archivo}/index.html`), paginaApp(rubro, cssTienda));
  await writeFile(en(`dist/tienda/${rubro.archivo}/demo.html`), completo(demo));
  await writeFile(en(`dist/tienda/${rubro.archivo}/app.html`), completo(deTienda));
  if (carpetaDemos) {
    await writeFile(`${carpetaDemos}/${rubro.archivo}-demo.html`, `${arriba}\n${abajo(demo)}\n`);
    await writeFile(`${carpetaDemos}/${rubro.archivo}-venta.html`, paginaApp(rubro, cssTienda, true));
  }
}
await writeFile(en('dist/tienda/index.html'), paginaInicio(nichos, cssTienda));
await writeFile(en('dist/tienda/gracias.html'), paginaGracias(nichos, cssTienda));
// El servidor de la tienda, listo para Vercel: tres funciones que comparten un archivo.
const servidorTienda = await build({ entryPoints: [en('tienda/nucleo.js').pathname], bundle: true, format: 'esm', write: false, target: 'es2022', legalComments: 'none' });
await writeFile(en('dist/tienda/api/_nucleo.js'), servidorTienda.outputFiles[0].text);
for (const nombre of ['comprar', 'activar', 'verificar']) {
  await writeFile(en(`dist/tienda/api/${nombre}.js`), `import { manejarTienda } from './_nucleo.js';\n\nexport const config = { runtime: 'edge' };\n\nexport default async function manejar(request) {\n  return (await manejarTienda(request, { env: process.env, salir: (url, opciones) => fetch(url, opciones) })) || new Response('No existe', { status: 404 });\n}\n`);
}
await writeFile(en('dist/tienda/vercel.json'), `${JSON.stringify({
  headers: [
    { source: '/(.*)', headers: [{ key: 'X-Content-Type-Options', value: 'nosniff' }, { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' }, { key: 'Content-Security-Policy', value: "frame-ancestors 'self'" }] },
    { source: '/(.*)/(app|demo).html', headers: [{ key: 'X-Robots-Tag', value: 'noindex' }] },
    { source: '/gracias.html', headers: [{ key: 'X-Robots-Tag', value: 'noindex' }, { key: 'Cache-Control', value: 'no-store' }] },
  ],
}, null, 2)}\n`);
console.log(`micro apps: ${nichos.map((r) => r.archivo).join(' · ')} (sueltas, demos y tienda)`);

const kb = (t) => `${(Buffer.byteLength(t) / 1024).toFixed(0)} KB`;
console.log(`worker.js ${kb(worker.outputFiles[0].text)} · demo.html ${kb(demoJs)} · versión ${version}`);
