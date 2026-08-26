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

  /* ── 4. Que todo funcione sin JavaScript ─────────────────────────────
     Este archivo se abre casi siempre desde el celular, y muchos visores
     de adjuntos (WhatsApp, Gmail, Archivos) muestran el HTML pero no
     ejecutan scripts. Así que las interacciones se rehacen con CSS puro:
     el menú y el visor de fotos con :target, el selector de largo y el
     antes/después con radios. Lo único que queda en JS es el cartel de
     "abierto ahora", que sin script simplemente muestra los horarios. */
  const reglas = [];

  // -- 4.1 Nada depende de la animación de entrada ---------------------
  document.querySelectorAll('.reveal').forEach((el) => {
    el.dataset.visible = 'true';
  });

  // -- 4.2 Menú móvil: se abre y se cierra con :target ------------------
  const toggle = document.querySelector('button[aria-controls="menu-movil"]');
  const panel = document.getElementById('menu-movil');
  if (!toggle || !panel) throw new Error('no se encontró el menú móvil');

  const abrir = document.createElement('a');
  abrir.href = '#menu-movil';
  abrir.className = toggle.className;
  abrir.setAttribute('aria-label', 'Abrir el menú');
  abrir.innerHTML =
    '<span aria-hidden="true" class="relative block h-[11px] w-[22px]">' +
    '<span class="absolute top-0 left-0 block h-px w-full bg-text-primary"></span>' +
    '<span class="absolute top-[10px] left-0 block h-px w-full bg-text-primary"></span>' +
    '</span>';
  toggle.replaceWith(abrir);

  panel.removeAttribute('hidden');
  panel.classList.add('pd-menu');
  // El panel pasa a ocupar la pantalla entera, con su propio cierre.
  const cerrarMenu = document.createElement('a');
  cerrarMenu.href = '#cerrar-menu';
  cerrarMenu.className = 'pd-menu-cerrar';
  cerrarMenu.innerHTML = 'Cerrar <span aria-hidden="true">&times;</span>';
  panel.prepend(cerrarMenu);
  // Blanco del enlace de cierre: al apuntar acá, #menu-movil deja de ser
  // el :target y el panel se esconde solo.
  const anclaCierre = document.createElement('span');
  anclaCierre.id = 'cerrar-menu';
  panel.appendChild(anclaCierre);
  // Tocar cualquier enlace del menú cambia el :target, así que el panel
  // se cierra solo al navegar. No hace falta nada más.

  // -- 4.3 Selector de largo de la lista de precios: radios -------------
  const tabs = [...document.querySelectorAll('[role="tab"]')];
  if (tabs.length === 0) throw new Error('no se encontró el selector de largo');
  const paneles = tabs.map((t) => document.getElementById(t.getAttribute('aria-controls')));
  if (paneles.some((p) => !p)) throw new Error('falta algún panel de precios');
  const raizPrecios = paneles[0].parentElement;
  const listaTabs = tabs[0].parentElement;

  tabs.forEach((tab, i) => {
    const id = 'pd-largo-' + i;
    const radio = document.createElement('input');
    radio.type = 'radio';
    radio.name = 'pd-largo';
    radio.id = id;
    radio.className = 'pd-sr';
    if (i === 0) radio.setAttribute('checked', '');
    raizPrecios.insertBefore(radio, raizPrecios.children[i]);

    const label = document.createElement('label');
    label.setAttribute('for', id);
    label.className = 'pd-largo-tab px-4 py-2.5 text-[0.9375rem]';
    label.textContent = tab.textContent;
    tab.replaceWith(label);

    const panel = paneles[i];
    const panelId = 'pd-precios-' + i;
    panel.id = panelId;
    panel.removeAttribute('hidden');
    panel.removeAttribute('role');
    panel.removeAttribute('tabindex');
    panel.removeAttribute('aria-labelledby');
    panel.classList.add('pd-largo-panel');

    reglas.push('#' + id + ':checked ~ #' + panelId + '{display:block}');
    reglas.push(
      '#' + id + ':checked ~ * label[for="' + id + '"]' +
      '{background:var(--color-surface-deep);color:var(--color-text-inverse)}',
    );
    reglas.push(
      '#' + id + ':focus-visible ~ * label[for="' + id + '"]' +
      '{outline:2px solid var(--color-accent);outline-offset:2px}',
    );
  });
  listaTabs.setAttribute('role', 'group');

  // -- 4.4 Visor de fotos: cada foto es un enlace a sí misma ------------
  [...document.querySelectorAll('#trabajos button.group')].forEach((boton, i) => {
    const id = 'pd-foto-' + i;
    const foto = document.createElement('a');
    foto.id = id;
    foto.href = '#' + id;
    foto.className = boton.className + ' pd-foto';
    foto.innerHTML = boton.innerHTML;

    const cerrar = document.createElement('a');
    cerrar.href = '#trabajos';
    cerrar.className = 'pd-foto-cerrar';
    cerrar.innerHTML = '<span>Cerrar <span aria-hidden="true">&times;</span></span>';

    boton.replaceWith(foto);
    foto.after(cerrar);
  });

  // -- 4.5 Antes / después: dos opciones en lugar del deslizador --------
  const rango = document.querySelector('input[type="range"]');
  if (rango) {
    const caja = rango.parentElement;
    const figura = caja.closest('figure');
    const recorte = caja.querySelector('div[style*="clip-path"]');
    recorte.classList.add('pd-ab-recorte');
    // El tirador y los rótulos de esquina sólo tienen sentido al deslizar.
    caja.querySelectorAll('[aria-hidden="true"], span.absolute').forEach((el) => el.remove());
    document.querySelector('label[for="' + rango.id + '"]')?.remove();
    rango.remove();

    const opciones = [
      { id: 'pd-ab-0', texto: 'Antes', recorte: 'inset(0 0 0 0)' },
      { id: 'pd-ab-1', texto: 'Después', recorte: 'inset(0 100% 0 0)' },
    ];
    const controles = document.createElement('div');
    controles.className = 'pd-ab-controles';
    opciones.forEach((op, i) => {
      const radio = document.createElement('input');
      radio.type = 'radio';
      radio.name = 'pd-ab';
      radio.id = op.id;
      radio.className = 'pd-sr';
      if (i === 1) radio.setAttribute('checked', '');
      figura.parentElement.insertBefore(radio, figura);

      const label = document.createElement('label');
      label.setAttribute('for', op.id);
      label.className = 'pd-ab-tab';
      label.textContent = op.texto;
      controles.appendChild(label);

      reglas.push('#' + op.id + ':checked ~ * .pd-ab-recorte{clip-path:' + op.recorte + '!important}');
      reglas.push(
        '#' + op.id + ':checked ~ * label[for="' + op.id + '"]' +
        '{background:var(--color-surface-deep);color:var(--color-text-inverse)}',
      );
      reglas.push(
        '#' + op.id + ':focus-visible ~ * label[for="' + op.id + '"]' +
        '{outline:2px solid var(--color-accent);outline-offset:2px}',
      );
    });
    figura.querySelector('figcaption').before(controles);
  }

  // -- 4.6 Fuera los dos elementos fijos que dependían del scroll -------
  // La barra de abajo y el botón flotante de WhatsApp sólo aparecían al
  // scrollear, con JavaScript. Dejarlos fijos y siempre visibles tapa lo
  // que está debajo —justamente el problema que este archivo evita—, y
  // los botones de WhatsApp de la portada, de "Reservar" y del pie ya
  // cubren lo mismo.
  document.querySelector('div.fixed.inset-x-0.bottom-0')?.remove();
  document.querySelector('a.fixed[href*="wa.me"]')?.remove();

  // -- 4.7 Fuera los enlaces que en este archivo no llevan a nada -------
  // Las páginas legales todavía no tienen texto y acá tampoco existen:
  // dejar el enlace muerto es peor que no ponerlo.
  document.querySelectorAll('a[data-sin-exportar]').forEach((a) => {
    (a.closest('li') ?? a).remove();
  });
  document.querySelectorAll('ul:empty, ol:empty').forEach((l) => l.remove());

  // -- 4.8 Cabecera siempre opaca --------------------------------------
  // En el sitio real el fondo de la cabecera aparece al scrollear, con JS.
  // Acá se deja puesto: si no, el texto de la página se ve por detrás.
  const cabecera = document.querySelector('header');
  if (cabecera) cabecera.dataset.scrolled = 'true';

  // -- 4.9 Horarios: texto verdadero aunque no corra ningún script ------
  const estado = document.querySelector('#encontranos [aria-live="polite"]');
  if (estado) {
    estado.setAttribute('data-open-now', JSON.stringify([
      { days: ['Tuesday', 'Wednesday', 'Friday'], opens: '10:00', closes: '17:30' },
      { days: ['Saturday'], opens: '10:00', closes: '16:00' },
    ]));
    estado.innerHTML =
      '<span aria-hidden="true" class="inline-block h-1.5 w-1.5 rounded-full bg-border-strong"></span>' +
      '<span data-text><span class="text-text-secondary">Martes, miércoles y viernes de 10:00 a 17:30 ' +
      '· sábados de 10:00 a 16:00</span></span>';
  }

  // -- 4.10 Las reglas que hacen andar todo lo anterior ------------------
  const hojaNoJs = document.createElement('style');
  hojaNoJs.id = 'pd-sin-js';
  hojaNoJs.textContent = [
    /* controles ocultos pero enfocables */
    '.pd-sr{position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;' +
      'clip:rect(0 0 0 0);white-space:nowrap;border:0}',

    /* cabecera: opaca de verdad, sin transparencia que deje ver el texto */
    'header{background:var(--color-background)!important;backdrop-filter:none!important}',

    /* menú móvil */
    '.pd-menu{display:none}',
    '@media (max-width:1023.98px){',
    '.pd-menu:target{display:block;position:fixed;inset:0;z-index:60;overflow-y:auto;' +
      'background:var(--color-background);border:0}',
    '.pd-menu:target > .pd-menu-cerrar{display:flex;align-items:center;justify-content:flex-end;' +
      'gap:.5rem;height:4.5rem;padding:0 var(--shell-gutter,1.5rem);font-size:.9375rem;' +
      'color:var(--color-text-secondary)}',
    '}',
    '.pd-menu-cerrar{display:none}',

    /* selector de largo */
    '.pd-largo-panel{display:none}',
    '.pd-largo-tab{cursor:pointer;color:var(--color-text-secondary);' +
      'transition:background-color .3s var(--ease-editorial),color .3s var(--ease-editorial)}',

    /* visor de fotos */
    '.pd-foto{cursor:zoom-in}',
    '.pd-foto-cerrar{display:none}',
    '.pd-foto:target{position:fixed;inset:0;z-index:90;display:flex;flex-direction:column;' +
      'align-items:center;justify-content:center;gap:1rem;padding:1.25rem;' +
      'background:var(--color-surface-deep);cursor:zoom-out}',
    '.pd-foto:target > *{width:auto;max-width:100%;min-height:0;overflow:visible;background:none}',
    '.pd-foto:target img{width:auto;height:auto;max-width:100%;max-height:76vh;' +
      'object-fit:contain;aspect-ratio:auto!important;transform:none!important}',
    '.pd-foto:target + .pd-foto-cerrar{position:fixed;inset:0;z-index:91;display:flex;' +
      'align-items:flex-start;justify-content:flex-end;padding:1rem 1.25rem;' +
      'color:var(--color-text-inverse);font-size:.9375rem;cursor:zoom-out}',

    /* antes / después */
    '.pd-ab-controles{display:flex;gap:.25rem;justify-content:center;margin-top:1rem}',
    '.pd-ab-tab{cursor:pointer;padding:.625rem 1.25rem;font-size:.9375rem;' +
      'color:var(--color-text-secondary);border:1px solid var(--color-border);' +
      'transition:background-color .3s var(--ease-editorial),color .3s var(--ease-editorial)}',

    ...reglas,
  ].join('\n');
  document.head.appendChild(hojaNoJs);

  /* ── 5. Estilos, fuentes e imágenes adentro del archivo ────────────── */
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

  return '<!doctype html>\n' + document.documentElement.outerHTML;
}, BASE);

const out = html.replace('</body>', `<script>\n${INTERACTIONS}\n</script>\n</body>`);
writeFileSync(process.env.OUT ?? 'Pelos-Design-sitio.html', out);
console.log('archivo único:', (Buffer.byteLength(out) / 1024 / 1024).toFixed(2), 'MB');
await b.close();
