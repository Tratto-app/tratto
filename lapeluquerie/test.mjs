/**
 * Suite funcional del sitio. Cubre navegación, conversión, formulario,
 * interacciones, responsive y accesibilidad. Sin framework: reporta al final.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';

// Ruta al Chromium del entorno. Si Playwright bajó el suyo, dejá EXE vacío.
const EXE = process.env.CHROME_PATH || undefined;
const URL = process.env.SITIO || 'http://127.0.0.1:8099/';
const axe = fs.readFileSync('./node_modules/axe-core/axe.min.js', 'utf8');

let ok = 0; const fallos = [];
const t = (nombre, cond, extra = '') => {
  if (cond) { ok += 1; } else { fallos.push(`✗ ${nombre}${extra ? ' → ' + extra : ''}`); }
};

const b = await chromium.launch(EXE ? { executablePath: EXE } : {});

/* ═══════════ 1 · ESCRITORIO ═══════════ */
{
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage();
  const errores = [];
  p.on('pageerror', e => errores.push(e.message));
  p.on('console', m => { if (m.type() === 'error') errores.push(m.text()); });
  await p.goto(URL, { waitUntil: 'networkidle' });

  // ── Navegación: cada link del menú llega a una sección real
  const hrefs = await p.$$eval('.nav-menu a', as => as.map(a => a.getAttribute('href')));
  for (const h of hrefs) {
    t(`anchor ${h} existe`, await p.$(h) !== null);
  }
  await p.click('.nav-menu a[href="#servicios"]');
  await p.waitForTimeout(700);
  t('el link Servicios scrollea', await p.evaluate(() => window.scrollY > 400));

  // ── Nav cambia de estado con el scroll
  t('nav pasa a estado compacto', await p.evaluate(() => document.querySelector('.nav').classList.contains('compacta')));
  await p.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await p.waitForTimeout(500);
  t('nav vuelve a transparente', await p.evaluate(() => !document.querySelector('.nav').classList.contains('compacta')));

  // ── Logo vuelve al inicio
  await p.evaluate(() => window.scrollTo(0, 2000));
  await p.click('.marca');
  await p.waitForTimeout(700);
  t('el logo vuelve al inicio', await p.evaluate(() => window.scrollY < 120));

  // ── Acordeón de servicios
  await p.click('.servicio[data-servicio="balayage"] .servicio-cabeza');
  await p.waitForTimeout(450);
  t('el servicio abre', await p.getAttribute('.servicio[data-servicio="balayage"] .servicio-cabeza', 'aria-expanded') === 'true');
  t('el panel del servicio se ve', await p.isVisible('#p-balayage .servicio-detalle'));
  await p.click('.servicio[data-servicio="corte"] .servicio-cabeza');
  await p.waitForTimeout(450);
  t('abrir otro cierra el anterior', await p.getAttribute('.servicio[data-servicio="balayage"] .servicio-cabeza', 'aria-expanded') === 'false');
  t('la foto sigue al servicio activo',
    await p.getAttribute('[data-servicios-foto] img[data-para="corte"]', 'data-activa') === 'true');

  // ── Buscador de servicio, recorrido completo
  await p.click('[data-paso="0"] .finder-op[data-valor="aclarar"]');
  await p.waitForTimeout(200);
  t('el buscador avanza al paso 2', await p.isVisible('[data-paso="1"]'));
  await p.click('[data-paso="1"] .finder-op[data-valor="con-color"]');
  await p.click('[data-paso="2"] .finder-op[data-valor="largo"]');
  await p.click('[data-paso="3"] .finder-op[data-valor="minimo"]');
  await p.waitForTimeout(300);
  t('el buscador muestra resultado', await p.isVisible('[data-paso="resultado"]'));
  const rec = await p.$$eval('[data-finder-items] h4', hs => hs.map(h => h.textContent));
  t('recomienda al menos un servicio', rec.length >= 1, rec.join(', '));
  t('recomienda balayage para aclarar espaciado', rec.some(r => /Balayage/i.test(r)), rec.join(', '));
  const etiquetas = await p.$$eval('[data-finder-respuestas] .etiqueta', es => es.length);
  t('muestra las 4 respuestas elegidas', etiquetas === 4, String(etiquetas));
  t('el CTA del buscador lleva el contexto',
    (await p.getAttribute('[data-finder-cta]', 'data-recomendados') || '').length > 0);
  await p.click('[data-finder-reiniciar]');
  await p.waitForTimeout(200);
  t('el buscador se reinicia', await p.isVisible('[data-paso="0"]'));

  // ── Volver atrás conserva la respuesta
  await p.click('[data-paso="0"] .finder-op[data-valor="evento"]');
  await p.click('[data-finder-atras]');
  await p.waitForTimeout(200);
  t('volver atrás recuerda lo elegido',
    await p.getAttribute('[data-paso="0"] .finder-op[data-valor="evento"]', 'aria-pressed') === 'true');

  // ── Galería: filtros
  const total = await p.$$eval('.pieza', ps => ps.filter(x => !x.hidden).length);
  await p.click('.filtro[data-cat="cortes"]');
  await p.waitForTimeout(250);
  const cortes = await p.$$eval('.pieza', ps => ps.filter(x => !x.hidden).length);
  t('el filtro reduce los resultados', cortes > 0 && cortes < total, `${cortes}/${total}`);
  t('el filtro queda marcado', await p.getAttribute('.filtro[data-cat="cortes"]', 'aria-pressed') === 'true');
  t('el filtro anuncia el cambio', (await p.textContent('[data-galeria-anuncio]')).includes('Cortes'));
  await p.click('.filtro[data-cat="todos"]');
  await p.waitForTimeout(250);
  t('volver a Todos restaura', await p.$$eval('.pieza', ps => ps.filter(x => !x.hidden).length) === total);

  // ── Galería: visor
  await p.click('.pieza >> nth=0');
  await p.waitForTimeout(350);
  t('el visor abre', await p.evaluate(() => document.querySelector('[data-lightbox]').open));
  t('el visor muestra título', (await p.textContent('[data-lb-titulo]')).length > 3);
  t('el visor carga la imagen', await p.evaluate(() => {
    const i = document.querySelector('[data-lb-img]'); return i.naturalWidth > 0;
  }));
  const c1 = await p.textContent('[data-lb-contador]');
  await p.click('[data-lb-next]');
  await p.waitForTimeout(200);
  t('el visor navega al siguiente', (await p.textContent('[data-lb-contador]')) !== c1);
  await p.keyboard.press('ArrowLeft');
  await p.waitForTimeout(200);
  t('flecha izquierda vuelve', (await p.textContent('[data-lb-contador]')) === c1);
  t('el CTA del visor lleva el trabajo',
    (await p.getAttribute('[data-lb-cta]', 'data-titulo') || '').length > 3);
  await p.keyboard.press('Escape');
  await p.waitForTimeout(300);
  t('Escape cierra el visor', await p.evaluate(() => !document.querySelector('[data-lightbox]').open));

  // ── Antes / Después
  const pos0 = await p.evaluate(() => getComputedStyle(document.querySelector('[data-ad-visor]')).getPropertyValue('--pos'));
  await p.focus('[data-ad-control]');
  for (let i = 0; i < 6; i += 1) await p.keyboard.press('ArrowRight');
  await p.waitForTimeout(200);
  const pos1 = await p.evaluate(() => getComputedStyle(document.querySelector('[data-ad-visor]')).getPropertyValue('--pos'));
  t('el comparador se mueve con el teclado', pos0 !== pos1, `${pos0} → ${pos1}`);
  t('el comparador tiene etiqueta accesible',
    (await p.getAttribute('[data-ad-control]', 'aria-label') || '').length > 10);
  const tit0 = await p.textContent('[data-ad-titulo]');
  await p.click('[data-ad-ir="2"]');
  await p.waitForTimeout(300);
  t('cambiar de transformación cambia el contenido', (await p.textContent('[data-ad-titulo]')) !== tit0);
  t('el CTA del comparador lleva contexto',
    (await p.getAttribute('[data-ad-cta]', 'data-servicio-id') || '').length > 0);

  // ── FAQ
  await p.click('.faq summary >> nth=0');
  await p.waitForTimeout(250);
  t('la FAQ abre', await p.evaluate(() => document.querySelector('.faq details').open));

  // ── Formulario: validación
  await p.click('[data-form] button[type="submit"]');
  await p.waitForTimeout(250);
  t('el formulario bloquea el envío vacío',
    await p.getAttribute('#f-nombre', 'aria-invalid') === 'true');
  t('el error del nombre es concreto', (await p.textContent('#e-nombre')).length > 10);
  t('el error del teléfono es concreto', (await p.textContent('#e-tel')).length > 10);
  t('hay un estado general de error', (await p.textContent('[data-form-estado]')).length > 10);
  await p.fill('#f-nombre', 'Ana');
  await p.fill('#f-tel', '123');
  await p.click('[data-form] button[type="submit"]');
  await p.waitForTimeout(200);
  t('rechaza un teléfono corto', await p.getAttribute('#f-tel', 'aria-invalid') === 'true');
  await p.fill('#f-tel', '1155554444');
  await p.waitForTimeout(200);
  t('el error se limpia al corregir', await p.getAttribute('#f-tel', 'aria-invalid') === 'false');

  // ── Texto de los inputs legible (bug detectado en la primera pasada)
  const contraste = await p.evaluate(() => {
    const i = document.querySelector('#f-nombre');
    const s = getComputedStyle(i);
    return { color: s.color, fondo: s.backgroundColor };
  });
  t('el texto del input no es del color del fondo',
    contraste.color !== contraste.fondo, JSON.stringify(contraste));

  // ── Reserva sin configurar: avisa, no deja un botón muerto
  await p.click('.hero-acciones [data-reservar]');
  await p.waitForTimeout(300);
  t('sin WhatsApp cargado se abre el aviso',
    await p.evaluate(() => document.querySelector('[data-aviso-reserva]').open));
  await p.click('[data-aviso-cerrar]');
  await p.waitForTimeout(200);
  t('el aviso se cierra', await p.evaluate(() => !document.querySelector('[data-aviso-reserva]').open));

  // ── Sin overflow horizontal
  t('no hay desborde horizontal en escritorio',
    await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));

  t('sin errores de consola en escritorio', errores.length === 0, errores.join(' | '));
  await ctx.close();
}

/* ═══════════ 2 · WHATSAPP CON NÚMERO CARGADO ═══════════ */
{
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage();
  // Se inyecta un número de prueba para verificar que los links se arman bien.
  await ctx.route('**://wa.me/**', (route) => route.fulfill({ status: 200, contentType: 'text/html', body: '<p>stub</p>' }));
  await p.route('**/assets/js/config.js', async (route) => {
    const r = await route.fetch();
    let body = await r.text();
    body = body.replace("whatsapp: '',", "whatsapp: '5491100000000',");
    await route.fulfill({ response: r, body, headers: { ...r.headers(), 'content-type': 'text/javascript' } });
  });
  await p.goto(URL, { waitUntil: 'networkidle' });

  const capturarUrl = async (accion) => {
    const [pop] = await Promise.all([ctx.waitForEvent('page'), accion()]);
    await pop.waitForLoadState('domcontentloaded').catch(() => {});
    const u = pop.url();
    await pop.close();
    return decodeURIComponent(u);
  };

  const uHero = await capturarUrl(() => p.click('.hero-acciones [data-reservar]'));
  t('el CTA del hero abre wa.me', uHero.startsWith('https://wa.me/5491100000000'), uHero.slice(0, 60));

  await p.click('.servicio[data-servicio="balayage"] .servicio-cabeza');
  await p.waitForTimeout(400);
  const uServ = await capturarUrl(() => p.click('#p-balayage [data-reservar]'));
  t('desde un servicio el mensaje nombra ese servicio', /balayage/i.test(uServ), uServ.slice(-90));

  await p.click('.pieza >> nth=0');
  await p.waitForTimeout(300);
  const uGal = await capturarUrl(() => p.click('[data-lb-cta]'));
  t('desde la galería el mensaje cita el trabajo', /galer|vi "/i.test(uGal), uGal.slice(-110));
  await p.keyboard.press('Escape');

  const uTr = await capturarUrl(() => p.click('[data-ad-cta]'));
  t('desde el comparador el mensaje cita la transformación',
    /transformaci/i.test(uTr), uTr.slice(-110));

  await p.click('[data-paso="0"] .finder-op[data-valor="evento"]');
  await p.click('[data-paso="1"] .finder-op[data-valor="virgen"]');
  await p.click('[data-paso="2"] .finder-op[data-valor="medio"]');
  await p.click('[data-paso="3"] .finder-op[data-valor="minimo"]');
  await p.waitForTimeout(300);
  const uFind = await capturarUrl(() => p.click('[data-finder-cta]'));
  t('el buscador manda las respuestas en el mensaje',
    /buscador/i.test(uFind) && /Tengo un evento/i.test(uFind), uFind.slice(-160));

  const uEq = await capturarUrl(() => p.click('[data-persona-cta="p1"]'));
  t('desde el equipo el mensaje pide turno con una profesional',
    /profesionales del equipo|turno con/i.test(uEq), uEq.slice(-90));

  await p.fill('#f-nombre', 'Ana Pérez');
  await p.fill('#f-tel', '1155554444');
  await p.selectOption('#f-servicio', 'corte');
  await p.fill('#f-mensaje', 'Quiero sacarme 10 cm.');
  const uForm = await capturarUrl(() => p.click('[data-form] button[type="submit"]'));
  t('el formulario arma el mensaje con los datos',
    /Ana Pérez/.test(uForm) && /Corte/.test(uForm) && /10 cm/.test(uForm), uForm.slice(-140));
  t('el formulario confirma el envío',
    (await p.textContent('[data-form-estado]')).includes('WhatsApp'));
  t('el formulario se limpia', (await p.inputValue('#f-nombre')) === '');

  await ctx.close();
}

/* ═══════════ 3 · MOBILE ═══════════ */
{
  const ctx = await b.newContext({
    viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148',
  });
  const p = await ctx.newPage();
  const errores = [];
  p.on('pageerror', e => errores.push(e.message));
  await p.goto(URL, { waitUntil: 'networkidle' });

  t('el menú de escritorio está oculto en mobile', !(await p.isVisible('.nav-menu')));
  t('la hamburguesa se ve', await p.isVisible('#btn-menu'));

  await p.click('#btn-menu');
  await p.waitForTimeout(800);
  t('el menú mobile abre', await p.getAttribute('#btn-menu', 'aria-expanded') === 'true');
  t('el panel es visible', await p.isVisible('#panel-menu'));
  t('el panel deja de ser inert', await p.getAttribute('#panel-menu', 'inert') === null);
  t('el cuerpo queda bloqueado', await p.evaluate(() => document.body.classList.contains('cuerpo-bloqueado')));

  // Los dos trazos tienen que terminar en el mismo punto: si no se cruzan,
  // el icono dibuja un ">" en lugar de una cruz.
  const cruz = await p.evaluate(() => {
    const [a, , c] = [...document.querySelectorAll('.hamburguesa span:not(.oculto-visual)')];
    const ra = a.getBoundingClientRect(), rc = c.getBoundingClientRect();
    return Math.abs((ra.top + ra.height / 2) - (rc.top + rc.height / 2));
  });
  t('la hamburguesa dibuja una cruz', cruz < 1.5, `centros separados ${cruz.toFixed(1)}px`);

  await p.click('#panel-menu a[href="#trabajos"]');
  await p.waitForTimeout(900);
  t('tocar un link cierra el menú', await p.getAttribute('#btn-menu', 'aria-expanded') === 'false');
  t('el panel vuelve a inert', await p.getAttribute('#panel-menu', 'inert') !== null);
  t('y navega a la sección', await p.evaluate(() => window.scrollY > 500));

  await p.evaluate(() => window.scrollTo(0, 0));
  await p.waitForTimeout(500);
  await p.click('#btn-menu');
  await p.waitForTimeout(700);
  await p.keyboard.press('Escape');
  await p.waitForTimeout(500);
  t('Escape cierra el menú', await p.getAttribute('#btn-menu', 'aria-expanded') === 'false');

  // ── CTA fijo
  await p.evaluate(() => window.scrollTo(0, 0));
  await p.waitForTimeout(500);
  t('el CTA fijo no aparece en el hero',
    await p.getAttribute('[data-barra-fija]', 'data-visible') === 'false');
  await p.evaluate(() => document.getElementById('trabajos').scrollIntoView());
  await p.waitForTimeout(700);
  t('el CTA fijo aparece al bajar',
    await p.getAttribute('[data-barra-fija]', 'data-visible') === 'true');
  await p.evaluate(() => document.getElementById('reservar').scrollIntoView());
  await p.waitForTimeout(800);
  t('el CTA fijo se retira sobre la sección de reservas',
    await p.getAttribute('[data-barra-fija]', 'data-visible') === 'false');

  // ── Touch en el comparador
  await p.evaluate(() => document.getElementById('transformaciones').scrollIntoView());
  await p.waitForTimeout(500);
  const caja = await p.locator('[data-ad-visor]').boundingBox();
  const antes = await p.evaluate(() => document.querySelector('[data-ad-control]').value);
  await p.locator('[data-ad-control]').click({ position: { x: caja.width * 0.2, y: caja.height / 2 } });
  await p.waitForTimeout(300);
  const despues = await p.evaluate(() => document.querySelector('[data-ad-control]').value);
  t('el comparador responde al toque', antes !== despues, `${antes} → ${despues}`);

  // ── Áreas táctiles ≥ 44px
  const chicos = await p.evaluate(() => {
    const sel = 'a[href], button, input, select, textarea, summary';
    return [...document.querySelectorAll(sel)]
      .filter(el => el.offsetParent !== null && !el.closest('[inert]'))
      // Los enlaces dentro de un párrafo están exceptuados por WCAG 2.2.
      .filter(el => !(el.tagName === 'A' && el.parentElement && /^(P|SPAN|LI|DD|H2)$/.test(el.parentElement.tagName)))
      .map(el => ({ el: el.tagName + '.' + (el.className || '').toString().split(' ')[0], h: Math.round(el.getBoundingClientRect().height) }))
      .filter(x => x.h > 0 && x.h < 24);
  });
  t('todo control llega al mínimo de 24px (WCAG 2.2)', chicos.length === 0, JSON.stringify(chicos.slice(0, 6)));

  const ctaChicos = await p.evaluate(() => [...document.querySelectorAll('.btn')]
    .filter(el => el.offsetParent !== null && el.getBoundingClientRect().height < 42)
    .map(el => el.textContent.trim().slice(0, 24) + ' :: ' + Math.round(el.getBoundingClientRect().height)));
  t('los botones llegan a 42px de alto', ctaChicos.length === 0, ctaChicos.join(' | '));

  t('no hay desborde horizontal en mobile',
    await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
    await p.evaluate(() => `${document.documentElement.scrollWidth} > ${window.innerWidth}`));
  t('sin errores de consola en mobile', errores.length === 0, errores.join(' | '));
  await ctx.close();
}

/* ═══════════ 4 · TECLADO ═══════════ */
{
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage();
  await p.goto(URL, { waitUntil: 'networkidle' });

  await p.keyboard.press('Tab');
  const primero = await p.evaluate(() => document.activeElement.className);
  t('el primer tab da el link de salto', primero.includes('saltar'), primero);

  const anillo = await p.evaluate(() => {
    const el = document.activeElement;
    const s = getComputedStyle(el);
    return { w: s.outlineWidth, style: s.outlineStyle };
  });
  t('el foco dibuja un anillo visible',
    anillo.style !== 'none' && parseFloat(anillo.w) >= 2, JSON.stringify(anillo));

  // Recorrido completo sin trampas de foco
  let pasos = 0; const vistos = new Set();
  for (let i = 0; i < 70; i += 1) {
    await p.keyboard.press('Tab');
    const id = await p.evaluate(() => {
      const e = document.activeElement;
      return e.tagName + ':' + (e.id || e.className || e.textContent?.slice(0, 18));
    });
    vistos.add(id); pasos += 1;
  }
  t('el tabulador recorre muchos controles distintos', vistos.size > 24, `${vistos.size} en ${pasos}`);

  const fantasmas = await p.evaluate(() => {
    const sel = 'a[href],button:not([disabled]),input,select,textarea,summary';
    return [...document.querySelectorAll(sel)]
      .filter(el => !el.closest('[inert]'))
      // checkVisibility descarta lo que está en display:none, que ya sale solo
      // del orden de tabulación. Queda lo que se ve para el CSS pero mide cero:
      // eso sí es un control al que el teclado puede llegar a ciegas.
      .filter(el => el.checkVisibility({ checkVisibilityCSS: true }))
      .filter(el => { const r = el.getBoundingClientRect(); return r.width === 0 || r.height === 0; })
      .map(el => (el.textContent || el.name || el.tagName).trim().slice(0, 26));
  });
  t('ningún control enfocable con tamaño cero', fantasmas.length === 0, fantasmas.join(' | '));

  // El acordeón se opera con Enter
  await p.focus('.servicio[data-servicio="color"] .servicio-cabeza');
  await p.keyboard.press('Enter');
  await p.waitForTimeout(350);
  t('el acordeón responde a Enter',
    await p.getAttribute('.servicio[data-servicio="color"] .servicio-cabeza', 'aria-expanded') === 'true');

  // El buscador se opera con teclado
  await p.focus('[data-paso="0"] .finder-op[data-valor="recuperar"]');
  await p.keyboard.press('Enter');
  await p.waitForTimeout(250);
  t('el buscador avanza con Enter', await p.isVisible('[data-paso="1"]'));
  await ctx.close();
}

/* ═══════════ 5 · MOVIMIENTO REDUCIDO ═══════════ */
{
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  const p = await ctx.newPage();
  await p.goto(URL, { waitUntil: 'networkidle' });
  const invisibles = await p.evaluate(() =>
    [...document.querySelectorAll('.revelar')].filter(e => getComputedStyle(e).opacity !== '1').length);
  t('con movimiento reducido nada queda invisible', invisibles === 0, String(invisibles));
  const dur = await p.evaluate(() => getComputedStyle(document.querySelector('.btn')).transitionDuration);
  t('las transiciones se anulan', parseFloat(dur) < 0.002, dur);
  await ctx.close();
}

/* ═══════════ 6 · SIN JAVASCRIPT ═══════════ */
{
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, javaScriptEnabled: false });
  const p = await ctx.newPage();
  await p.goto(URL, { waitUntil: 'load' });
  t('sin JS el contenido se ve', await p.isVisible('h1'));
  t('sin JS los servicios están en el HTML', (await p.$$('.servicio')).length === 7);
  t('sin JS la galería está en el HTML', (await p.$$('.pieza')).length === 12);
  t('sin JS las FAQ están en el HTML', (await p.$$('.faq details')).length === 9);
  t('sin JS los CTA siguen siendo anclas a la reserva',
    await p.getAttribute('.hero-acciones [data-reservar]', 'href') === '#reservar');
  const opac = await p.evaluate(() => getComputedStyle(document.querySelector('.revelar')).opacity);
  t('sin JS nada queda oculto por la animación', opac === '1', opac);
  await ctx.close();
}

/* ═══════════ 7 · ACCESIBILIDAD (axe-core) ═══════════ */
const vistas = [['escritorio', 1440, 900], ['tablet', 768, 1024], ['mobile', 390, 844]];
for (const [nombre, width, height] of vistas) {
  const ctx = await b.newContext({ viewport: { width, height }, reducedMotion: 'reduce' });
  const p = await ctx.newPage();
  await p.goto(URL, { waitUntil: 'networkidle' });
  await p.evaluate(() => document.querySelectorAll('.revelar,.revelar-foto').forEach(e => (e.dataset.visible = 'true')));
  await p.waitForTimeout(200);
  await p.addScriptTag({ content: axe });
  const r = await p.evaluate(async () => await window.axe.run(document, {
    runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'] },
  }));
  const graves = r.violations.filter(v => ['critical', 'serious', 'moderate'].includes(v.impact));
  t(`axe sin violaciones en ${nombre}`, graves.length === 0,
    graves.map(v => `${v.impact}:${v.id}(${v.nodes.length}) ${v.nodes[0]?.target}`).join(' | '));
  await ctx.close();
}

/* ═══════════ 8 · RESPONSIVE ═══════════ */
for (const [nombre, width, height] of [['mobile-chico', 375, 667], ['mobile', 390, 844],
  ['tablet', 768, 1024], ['laptop', 1440, 900], ['desktop', 1920, 1080]]) {
  const ctx = await b.newContext({ viewport: { width, height } });
  const p = await ctx.newPage();
  await p.goto(URL, { waitUntil: 'networkidle' });
  await p.evaluate(() => document.querySelectorAll('.revelar,.revelar-foto').forEach(e => (e.dataset.visible = 'true')));
  await p.waitForTimeout(250);

  t(`${nombre}: sin desborde horizontal`,
    await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
    await p.evaluate(() => `${document.documentElement.scrollWidth}>${window.innerWidth}`));

  const desbordados = await p.evaluate(() => {
    const enScroller = (el) => {
      for (let a = el.parentElement; a; a = a.parentElement) {
        const o = getComputedStyle(a).overflowX;
        if (o === 'auto' || o === 'scroll') return true;
      }
      return false;
    };
    return [...document.querySelectorAll('body *')]
      .filter(el => el.getBoundingClientRect().right > window.innerWidth + 2
        && getComputedStyle(el).position !== 'fixed' && !enScroller(el))
      .map(el => el.tagName + '.' + (el.className || '').toString().split(' ')[0]).slice(0, 5);
  });
  t(`${nombre}: ningún elemento se sale`, desbordados.length === 0, desbordados.join(', '));

  const nav = await p.evaluate(() => {
    const f = document.querySelector('.nav-fila');
    return f.scrollWidth <= f.clientWidth + 1;
  });
  t(`${nombre}: la barra superior no se rompe`, nav);
  await ctx.close();
}

await b.close();

console.log(`\n${'═'.repeat(58)}`);
console.log(`  ${ok} pruebas OK · ${fallos.length} fallas`);
console.log('═'.repeat(58));
if (fallos.length) { console.log(fallos.join('\n')); process.exitCode = 1; }
