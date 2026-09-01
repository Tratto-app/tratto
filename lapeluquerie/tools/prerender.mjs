/* Deja el HTML ya armado dentro del archivo único: si el navegador del
   cliente bloquea el JavaScript, la página se ve igual de completa.
   El script sigue adentro, así que las partes interactivas andan cuando sí corre. */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const archivo = process.argv[2];
const b = await chromium.launch();
const p = await (await b.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
await p.goto('file://' + archivo, { waitUntil: 'load' });
await p.waitForTimeout(1500);
const html = await p.evaluate(() => {
  // El cartel de horario se calcula en vivo: si queda congelado en el HTML
  // mostraría un horario viejo cuando el JS no corre.
  document.querySelectorAll('.estado').forEach(e => { e.textContent = ''; delete e.dataset.abierto; });
  document.querySelectorAll('.rv').forEach(e => e.classList.remove('visible'));
  // Sin la marca 'js' el botón de menú queda oculto, que es lo correcto
  // cuando el navegador no ejecuta scripts.
  document.documentElement.classList.remove('js');
  return '<!DOCTYPE html>\n' + document.documentElement.outerHTML;
});
await b.close();
(await import('node:fs')).writeFileSync(archivo, html);
console.log('pre-renderizado');
