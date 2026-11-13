// Arma la tienda para Cloudflare Pages en dist-cloudflare/ (no se sube al repo)
// y, con --publicar, la sube. El plan gratis de Cloudflare permite vender; el
// gratis de Vercel (Hobby) es solo para uso personal y no comercial.
//
// Sale de dist/tienda (correr antes `npm run armar`). Toda la tienda va adentro
// de un solo _worker.js: las páginas y las tres funciones (/api/comprar,
// /api/activar, /api/verificar). Así se publica con un único pedido a la API
// de Cloudflare, sin la subida de archivos sueltos.
//
// Publicar:
//   CLOUDFLARE_API_TOKEN=… CLOUDFLARE_ACCOUNT_ID=… node tools/tienda-cloudflare.mjs --publicar
// Claves (en Cloudflare, nunca en el repo): MP_ACCESS_TOKEN y LICENCIA_SECRETO.
import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';

const raiz = new URL('..', import.meta.url);
const en = (r) => new URL(r, raiz).pathname;
const origen = en('dist/tienda');
const salida = en('dist-cloudflare');
const PROYECTO = 'apps-al-dia';

// Las páginas: cada .html de dist/tienda (las funciones de Vercel quedan afuera).
async function paginas(carpeta, prefijo = '') {
  const lista = [];
  for (const e of await readdir(carpeta, { withFileTypes: true })) {
    if (e.name === 'api') continue;
    if (e.isDirectory()) lista.push(...await paginas(`${carpeta}/${e.name}`, `${prefijo}/${e.name}`));
    else if (e.name.endsWith('.html')) lista.push([`${prefijo}/${e.name}`, await readFile(`${carpeta}/${e.name}`, 'utf8')]);
  }
  return lista;
}
const PAGINAS = Object.fromEntries((await paginas(origen)).map(([ruta, html]) => [ruta, { html, etag: `"${createHash('sha256').update(html).digest('hex').slice(0, 16)}"` }]));
PAGINAS['/404.html'] = { html: '<!doctype html>\n<html lang="es-AR">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n<meta name="robots" content="noindex">\n<title>No existe esta página</title>\n<style>body{font-family:system-ui,sans-serif;max-width:32rem;margin:15vh auto;padding:0 16px;color:#16181d;background:#f6f7f9}a{color:#1f5fbf}@media (prefers-color-scheme:dark){body{color:#eef0f3;background:#111317}a{color:#8db4ff}}</style>\n</head>\n<body>\n<h1>Esta página no existe</h1>\n<p><a href="/">Ver las apps</a></p>\n</body>\n</html>\n', etag: '' };

const entrada = `import { manejarTienda } from ${JSON.stringify(en('tienda/nucleo.js'))};
const PAGINAS = ${JSON.stringify(PAGINAS)};
const COMUNES = { 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'strict-origin-when-cross-origin', 'Content-Security-Policy': "frame-ancestors 'self'" };
// /, /libreta/, /libreta/app, /libreta/app.html y /gracias llevan a su página.
function buscar(ruta) {
  const limpia = ruta.endsWith('/') ? ruta + 'index.html' : ruta;
  return PAGINAS[limpia] ? [limpia, PAGINAS[limpia]] : PAGINAS[limpia + '.html'] ? [limpia + '.html', PAGINAS[limpia + '.html']] : null;
}
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/')) {
      const r = await manejarTienda(request, { env, salir: (u, o) => fetch(u, o) });
      return r || new Response('No existe', { status: 404 });
    }
    if (request.method !== 'GET' && request.method !== 'HEAD') return new Response(null, { status: 405, headers: { Allow: 'GET, HEAD' } });
    // /libreta → /libreta/ para que los links relativos de la página funcionen
    if (!url.pathname.endsWith('/') && PAGINAS[url.pathname + '/index.html']) return Response.redirect(url.origin + url.pathname + '/' + url.search, 308);
    const hallada = buscar(url.pathname);
    if (!hallada) return new Response(request.method === 'HEAD' ? null : PAGINAS['/404.html'].html, { status: 404, headers: { ...COMUNES, 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
    const [ruta, pagina] = hallada;
    const privada = /\\/(app|demo)\\.html$/.test(ruta) || ruta === '/gracias.html';
    const encabezados = { ...COMUNES, 'Content-Type': 'text/html; charset=utf-8', ETag: pagina.etag, 'Cache-Control': ruta === '/gracias.html' ? 'no-store' : 'public, max-age=0, must-revalidate' };
    if (privada) encabezados['X-Robots-Tag'] = 'noindex';
    if (ruta !== '/gracias.html' && request.headers.get('If-None-Match') === pagina.etag) return new Response(null, { status: 304, headers: encabezados });
    return new Response(request.method === 'HEAD' ? null : pagina.html, { headers: encabezados });
  },
};
`;
const worker = await build({ stdin: { contents: entrada, resolveDir: en('.'), loader: 'js' }, bundle: true, format: 'esm', write: false, target: 'es2022', legalComments: 'none' });
await rm(salida, { recursive: true, force: true });
await mkdir(salida, { recursive: true });
await writeFile(`${salida}/_worker.js`, worker.outputFiles[0].text);
await writeFile(`${salida}/_routes.json`, `${JSON.stringify({ version: 1, include: ['/*'], exclude: [] }, null, 2)}\n`);
console.log(`tienda para Cloudflare en dist-cloudflare/ (${Object.keys(PAGINAS).length} páginas, _worker.js de ${(worker.outputFiles[0].text.length / 1024).toFixed(0)} KB)`);

if (process.argv.includes('--publicar')) {
  const cuenta = process.env.CLOUDFLARE_ACCOUNT_ID;
  if (!cuenta || !process.env.CLOUDFLARE_API_TOKEN) throw new Error('Faltan CLOUDFLARE_ACCOUNT_ID y CLOUDFLARE_API_TOKEN.');
  let commit = '';
  try { commit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(); } catch { /* sin git */ }
  // curl respeta el proxy y el certificado del sistema; el fetch de Node no siempre.
  const respuesta = execFileSync('curl', ['-sS', '-m', '120', '-X', 'POST',
    '-H', `Authorization: Bearer ${process.env.CLOUDFLARE_API_TOKEN}`,
    '-F', 'manifest={}', '-F', 'branch=main', '-F', `commit_message=Tienda ${commit.slice(0, 7)}`, ...(commit ? ['-F', `commit_hash=${commit}`] : []),
    '-F', `_worker.js=@${salida}/_worker.js;type=application/javascript+module`,
    '-F', `_routes.json=@${salida}/_routes.json;type=application/json`,
    `https://api.cloudflare.com/client/v4/accounts/${cuenta}/pages/projects/${PROYECTO}/deployments`], { encoding: 'utf8' });
  const datos = JSON.parse(respuesta);
  if (!datos.success) throw new Error(`Cloudflare no aceptó la publicación: ${JSON.stringify(datos.errors)}`);
  console.log(`publicada: ${datos.result.url} (${datos.result.id})`);
}
