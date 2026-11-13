// Arma la tienda para Cloudflare Pages en dist-cloudflare/ (no se sube al repo).
// El plan gratis de Cloudflare permite vender; el gratis de Vercel (Hobby) es
// solo para uso personal y no comercial.
//
// Sale de dist/tienda (correr antes `npm run armar`) y cambia solo lo del servidor:
//   _worker.js   las tres funciones (/api/comprar, /api/activar, /api/verificar)
//   _routes.json el worker corre solo para /api/*; el resto es estático y gratis
//   _headers     los mismos encabezados que vercel.json
// Publicar: npx wrangler pages deploy dist-cloudflare --project-name apps-al-dia --branch main
// Claves (en Cloudflare, nunca en el repo): MP_ACCESS_TOKEN y LICENCIA_SECRETO.
import { build } from 'esbuild';
import { cp, rm, writeFile } from 'node:fs/promises';

const raiz = new URL('..', import.meta.url);
const en = (r) => new URL(r, raiz).pathname;
const salida = en('dist-cloudflare');
const queda = new Set(['api', 'vercel.json', 'package.json', '.vercelignore']);

await rm(salida, { recursive: true, force: true });
await cp(en('dist/tienda'), salida, { recursive: true, filter: (origen) => !queda.has(origen.slice(en('dist/tienda').length + 1).split('/')[0]) });

const entrada = `import { manejarTienda } from ${JSON.stringify(en('tienda/nucleo.js'))};
export default {
  async fetch(request, env) {
    const respuesta = await manejarTienda(request, { env, salir: (url, opciones) => fetch(url, opciones) });
    return respuesta || new Response('No existe', { status: 404 });
  },
};
`;
const worker = await build({ stdin: { contents: entrada, resolveDir: en('.'), loader: 'js' }, bundle: true, format: 'esm', write: false, target: 'es2022', legalComments: 'none' });
await writeFile(`${salida}/_worker.js`, worker.outputFiles[0].text);
await writeFile(`${salida}/_routes.json`, `${JSON.stringify({ version: 1, include: ['/api/*'], exclude: [] }, null, 2)}\n`);
await writeFile(`${salida}/_headers`, `/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Content-Security-Policy: frame-ancestors 'self'

/:carpeta/app
  X-Robots-Tag: noindex

/:carpeta/demo
  X-Robots-Tag: noindex

/gracias*
  X-Robots-Tag: noindex
  Cache-Control: no-store
`);
// Sin 404.html, Cloudflare devuelve la portada para cualquier dirección inventada.
await writeFile(`${salida}/404.html`, '<!doctype html>\n<html lang="es-AR">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n<meta name="robots" content="noindex">\n<title>No existe esta página</title>\n<style>body{font-family:system-ui,sans-serif;max-width:32rem;margin:15vh auto;padding:0 16px;color:#16181d;background:#f6f7f9}a{color:#1f5fbf}@media (prefers-color-scheme:dark){body{color:#eef0f3;background:#111317}a{color:#8db4ff}}</style>\n</head>\n<body>\n<h1>Esta página no existe</h1>\n<p><a href="/">Ver las apps</a></p>\n</body>\n</html>\n');
console.log('tienda para Cloudflare en dist-cloudflare/');
