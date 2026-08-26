import { chromium } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';

const BASE = process.env.BASE ?? 'http://localhost:3000';
const INTERACTIONS = readFileSync(new URL('./export-interactions.js', import.meta.url), 'utf8');

const b = await chromium.launch(
  process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
);
const page = await b.newPage({ viewport: { width: 1440, height: 900 } });

await page.goto(BASE + '/', { waitUntil: 'networkidle' });
// Se recorre la página para que carguen las imágenes diferidas.
await page.evaluate(async () => {
  const step = window.innerHeight * 0.6;
  for (let y = 0; y < document.body.scrollHeight; y += step) {
    window.scrollTo(0, y);
    await new Promise((r) => setTimeout(r, 120));
  }
  window.scrollTo(0, 0);
});
await page.waitForTimeout(1500);

const html = await page.evaluate(async (base) => {
  /* ── 1. Traer las otras dos páginas y pegarlas como secciones ───────── */
  async function fetchMain(path) {
    const text = await (await fetch(base + path)).text();
    return new DOMParser().parseFromString(text, 'text/html');
  }

  const footer = document.querySelector('footer');

  // -- Servicios en detalle -------------------------------------------
  const serviciosDoc = await fetchMain('/servicios');
  const serviciosWrap = document.createElement('section');
  serviciosWrap.id = 'servicios-detalle';
  serviciosWrap.className = 'scroll-mt-28';
  // Del documento original se toman sólo los bloques de cada rubro.
  serviciosDoc.querySelectorAll('main section[id]').forEach((sec) => {
    serviciosWrap.appendChild(document.importNode(sec, true));
  });
  const serviciosIntro = document.createElement('div');
  serviciosIntro.className = 'shell pt-[clamp(3rem,7vw,5rem)]';
  serviciosIntro.innerHTML =
    '<p class="eyebrow">Servicios en detalle</p>' +
    '<h2 class="mt-4 max-w-[20ch] text-[length:var(--text-h2)]">Todo lo que hacemos, ' +
    '<span class="heading-highlight">en detalle</span>.</h2>' +
    '<p class="mt-6 max-w-[38rem] text-[length:var(--text-lead)] leading-[1.5] text-text-secondary">' +
    'La técnica exacta se define cuando vemos tu pelo, así que tomá esto como un mapa, no como un menú cerrado.</p>';
  serviciosWrap.prepend(serviciosIntro);
  footer.before(serviciosWrap);

  // -- Lista de precios ------------------------------------------------
  const preciosDoc = await fetchMain('/precios');
  const preciosWrap = document.createElement('section');
  preciosWrap.id = 'lista-precios';
  preciosWrap.className = 'scroll-mt-28 bg-surface-muted py-[length:var(--space-section)]';
  const inner = document.createElement('div');
  inner.className = 'shell';
  inner.innerHTML =
    '<p class="eyebrow">Lista de precios</p>' +
    '<h2 class="mt-4 max-w-[18ch] text-[length:var(--text-h2)]">Todo lo que hacemos, ' +
    '<span class="heading-highlight">con su precio</span>.</h2>' +
    '<p class="mt-6 max-w-[38rem] text-[length:var(--text-lead)] leading-[1.5] text-text-secondary">' +
    'Elegí cómo tenés el pelo y vas a ver exactamente lo que te sale. Si lo tenés muy poblado, ' +
    'algún color puede moverse un poco: te lo decimos siempre antes de empezar, nunca después.</p>';
  // La tabla completa: selector de largo Y los cuatro paneles de precios.
  // Todos los paneles cuelgan del mismo padre, que es la raíz del componente.
  const tabla = preciosDoc.querySelector('main [role="tabpanel"]')?.parentElement;
  if (!tabla) throw new Error('no se encontró la tabla de precios en /precios');
  inner.appendChild(document.importNode(tabla, true));
  preciosWrap.appendChild(inner);
  footer.before(preciosWrap);

  /* ── 2. Enlaces internos apuntados a las secciones nuevas ───────────── */
  for (const a of [...document.querySelectorAll('a[href^="/"]')]) {
    const href = a.getAttribute('href');
    const [p, hash] = href.split('#');
    if (p === '/precios') a.setAttribute('href', '#lista-precios');
    else if (p === '/servicios') a.setAttribute('href', '#servicios-detalle');
    else if (p === '/' || p === '') a.setAttribute('href', hash ? '#' + hash : '#contenido');
    else { a.setAttribute('href', '#'); a.dataset.sinExportar = 'true'; }
  }

  /* ── 3. Un solo h1 en la página: los traídos bajan a h2 ─────────────── */
  const h1s = [...document.querySelectorAll('h1')];
  h1s.slice(1).forEach((h) => {
    const h2 = document.createElement('h2');
    h2.className = h.className;
    h2.innerHTML = h.innerHTML;
    h.replaceWith(h2);
  });
  // Migas de pan de las páginas traídas: acá no aplican.
  document.querySelectorAll('nav[aria-label="Ruta de navegación"]').forEach((n) => n.remove());

  /* ── 4. Estilos, fuentes e imágenes adentro del archivo ─────────────── */
  async function toDataUri(url) {
    const blob = await (await fetch(url)).blob();
    return await new Promise((res) => {
      const fr = new FileReader();
      fr.onload = () => res(fr.result);
      fr.readAsDataURL(blob);
    });
  }

  const link = document.querySelector('link[rel="stylesheet"]');
  if (link) {
    let css = await (await fetch(link.href)).text();
    // Las url() de las fuentes vienen relativas a la hoja de estilos ("../media/x.woff2"),
    // así que hay que resolverlas contra link.href, no contra el origen.
    const refs = [...new Set([...css.matchAll(/url\(\s*['"]?([^)'"]+\.woff2?)['"]?\s*\)/g)].map((m) => m[1]))];
    if (refs.length === 0) throw new Error('no se encontró ninguna fuente en el CSS');
    for (const f of refs) {
      css = css.split(f).join(await toDataUri(new URL(f, link.href).href));
    }
    const style = document.createElement('style');
    style.textContent = css;
    link.replaceWith(style);
  }

  for (const img of [...document.images]) {
    const src = img.currentSrc || img.src;
    if (!src || src.startsWith('data:')) continue;
    try {
      img.src = await toDataUri(src);
      img.removeAttribute('srcset');
      img.removeAttribute('sizes');
      img.loading = 'eager';
    } catch { /* una imagen menos no justifica romper la página */ }
  }

  document
    .querySelectorAll('link[rel="preload"], link[rel="prefetch"], link[rel="modulepreload"], script')
    .forEach((el) => el.remove());

  /* ── 5. Cartel de "abierto ahora", listo para recalcularse ──────────── */
  const status = document.querySelector('#encontranos [aria-live="polite"]');
  if (status) {
    status.setAttribute('data-open-now', JSON.stringify([
      { days: ['Tuesday', 'Wednesday', 'Friday'], opens: '10:00', closes: '17:30' },
      { days: ['Saturday'], opens: '10:00', closes: '16:00' },
    ]));
    status.innerHTML =
      '<span aria-hidden="true" class="inline-block h-1.5 w-1.5 rounded-full bg-border-strong"></span><span data-text></span>';
  }

  return '<!doctype html>\n' + document.documentElement.outerHTML;
}, BASE);

const out = html.replace('</body>', `<script>\n${INTERACTIONS}\n</script>\n</body>`);
writeFileSync(process.env.OUT ?? 'Pelos-Design-sitio.html', out);
console.log('archivo único:', (Buffer.byteLength(out) / 1024 / 1024).toFixed(2), 'MB');
await b.close();
