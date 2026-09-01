/* Verifica el archivo autocontenido COPIÁNDOLO A UNA CARPETA VACÍA.
   Esto es lo importante: probarlo al lado de assets/ daba falsos positivos,
   porque las rutas que arma el JavaScript se resolvían contra esa carpeta.
   En el celular del cliente el archivo viaja solo. */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { copyFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const origen = process.argv[2];
const aislado = join(mkdtempSync(join(tmpdir(), 'lp-')), 'index.html');
copyFileSync(origen, aislado);
const URL_ARCHIVO = 'file://' + aislado;

let fallos = 0;
const ok = (n, c, e = '') => { if (!c) fallos++; console.log(`${c ? '✓' : '✗'} ${n}${c || !e ? '' : ' → ' + e}`); };
const b = await chromium.launch();

for (const [nombre, conJs] of [['con JavaScript', true], ['sin JavaScript', false]]) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, javaScriptEnabled: conJs });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(String(e)));
  await p.goto(URL_ARCHIVO);
  await p.waitForTimeout(conJs ? 1500 : 600);
  await p.evaluate(() => document.querySelectorAll('img[loading=lazy]').forEach(i => i.loading = 'eager'))
    .catch(() => {});
  await p.waitForTimeout(1200);
  console.log(`\n── Carpeta vacía, ${nombre} ──`);
  if (conJs) ok('Sin errores', errs.length === 0, errs.slice(0, 2).join(' | '));
  const imgs = await p.$$eval('img', is => {
    const con = is.filter(i => i.getAttribute('src'));
    return { total: con.length, vacias: con.filter(i => i.naturalWidth === 0).length };
  });
  ok(`Las ${imgs.total} imágenes cargan píxeles`, imgs.total >= 14 && imgs.vacias === 0,
     imgs.vacias + ' vacías de ' + imgs.total);
  // La del visor de galería no lleva src hasta que se abre: es correcto.
  ok('Ninguna imagen quedó sin src',
     (await p.$$eval('img', is => is.filter(i => !i.getAttribute('src') && !i.closest('.lb')).length)) === 0);
  const wa = await p.$$eval('[data-wa]', as => as.map(a => a.getAttribute('href')));
  ok(`Los ${wa.length} CTA apuntan a wa.me`,
     wa.length >= 18 && wa.every(h => /^https:\/\/wa\.me\/5492304356392\?text=/.test(h)),
     wa.filter(h => !/^https:\/\/wa\.me\//.test(h)).slice(0, 2).join(' | '));
  ok('Contenido completo',
     (await p.$$('.serv')).length === 8 && (await p.$$('.gitem')).length === 6 &&
     (await p.$$('.paso')).length === 6 && (await p.$$('.faq__item')).length === 8);
  await ctx.close();
}
await b.close();
console.log(`\n${fallos === 0 ? 'ARCHIVO OK' : fallos + ' FALLOS'}`);
process.exit(fallos ? 1 : 0);
