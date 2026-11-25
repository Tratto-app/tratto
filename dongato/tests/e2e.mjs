// Pruebas de punta a punta de la página de Don Gato.
// Uso:  (cd dongato && python3 -m http.server 8765)   y en otra terminal:   node dongato/tests/e2e.mjs
// Variable opcional BASE para probar otro archivo (por ejemplo la versión de un solo archivo).
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const BASE = process.env.BASE || 'http://localhost:8765/index.html';
const TZ = 'America/Argentina/Buenos_Aires';
let ok = 0;
const fallas = [];
function check(cond, nombre, extra = '') {
  if (cond) { ok++; console.log('  ✔', nombre); }
  else { fallas.push(nombre); console.log('  ✘', nombre, extra ? '→ ' + extra : ''); }
}
const textoWA = url => new URL(url).searchParams.get('text');

// Precios de prueba (la página real los tiene en null hasta que Don Gato pase la lista)
const PRECIOS = { 'rc-mini': [45000, 52000], 'collares-hund': [8500, null], 'fuente-agua': [23990, null] };
function conPrecios(html) {
  for (const [id, [precio, anterior]] of Object.entries(PRECIOS)) {
    const re = new RegExp(`(id: '${id}'[^\\n]*?)precio: null, precioAnterior: null`);
    if (!re.test(html)) throw new Error('No encontré el producto ' + id);
    html = html.replace(re, `$1precio: ${precio}, precioAnterior: ${anterior}`);
  }
  return html;
}

async function contexto(browser, { ancho = 375, alto = 812, movil = true, precios = false, zona = TZ, sinLogo = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width: ancho, height: alto }, isMobile: movil, hasTouch: movil, timezoneId: zona, locale: 'es-AR' });
  const wa = [];
  await ctx.route('https://wa.me/**', r => { wa.push(r.request().url()); r.fulfill({ contentType: 'text/html', body: '<p>whatsapp</p>' }); });
  await ctx.route(/google\.com\/maps/, r => r.fulfill({ contentType: 'text/html', body: '<p>mapa</p>' }));
  if (sinLogo) await ctx.route(/logo\.png$/, r => r.abort());
  if (precios) {
    await ctx.route(BASE, async r => {
      const resp = await r.fetch();
      r.fulfill({ response: resp, body: conPrecios(await resp.text()) });
    });
  }
  const page = await ctx.newPage();
  const errores = [];
  page.on('pageerror', e => errores.push(e.message));
  return { ctx, page, wa, errores };
}

const browser = await chromium.launch();

// ---------------------------------------------------------------------------
console.log('\n1. Carga, datos para Google y sin scroll horizontal');
{
  const { ctx, page, errores } = await contexto(browser);
  await page.goto(BASE, { waitUntil: 'load' });
  check(errores.length === 0, 'sin errores de JavaScript', errores.join(' | '));
  const ld = await page.$eval('script[type="application/ld+json"]', s => JSON.parse(s.textContent));
  check(ld['@type'].includes('VeterinaryCare') && ld['@type'].includes('PetStore'), 'JSON-LD con VeterinaryCare y PetStore');
  check(ld.telephone.includes('4216-5130') && ld.address.streetAddress === 'Calle 12 4842' && ld.sameAs[0].includes('dongatobegui'), 'JSON-LD con teléfono, dirección e Instagram');
  check(ld.openingHoursSpecification.length === 3, 'JSON-LD con horarios');
  check(/veterinaria/i.test(await page.title()) && /berazategui/i.test(await page.title()), 'título con "veterinaria" y "Berazategui"');
  check(await page.$eval('meta[property="og:image"]', m => !!m.content), 'Open Graph con imagen');
  check(await page.$$eval('img', imgs => imgs.every(i => i.hasAttribute('alt'))), 'todas las imágenes tienen texto alternativo');
  const sinAlt = await page.$$eval('img', imgs => imgs.filter(i => i.alt === '' && !i.closest('.pie__marca') && !i.closest('.item')).length);
  check(sinAlt === 0, 'las imágenes con contenido tienen alt descriptivo', String(sinAlt));
  await ctx.close();

  for (const ancho of [320, 360, 375, 390, 430, 768, 1024, 1280, 1440]) {
    const { ctx, page } = await contexto(browser, { ancho, movil: ancho < 768 });
    await page.goto(BASE, { waitUntil: 'load' });
    // abrir todo lo que puede ensanchar: ver más, preguntas
    await page.click('#ver-mas');
    const res = await page.evaluate(() => {
      const w = document.documentElement.clientWidth;
      const fuera = [];
      for (const el of document.querySelectorAll('body *')) {
        if (el.closest('.chips') || el.closest('[hidden]') || el.closest('.sr-only') || el.classList.contains('saltar')) continue;
        const r = el.getBoundingClientRect();
        if (r.width && r.right > w + 1) fuera.push(el.tagName + '.' + el.className);
      }
      return { sw: document.documentElement.scrollWidth, w, fuera: fuera.slice(0, 5) };
    });
    check(res.sw <= res.w && res.fuera.length === 0, `sin scroll horizontal a ${ancho} px`, JSON.stringify(res));
    await ctx.close();
  }
}

// ---------------------------------------------------------------------------
console.log('\n2. Carrito: suma, se guarda, mensaje de pedido y repetir último pedido');
{
  const { ctx, page, wa, errores } = await contexto(browser, { precios: true });
  await page.goto(BASE, { waitUntil: 'load' });
  const card = id => page.locator(`.card[data-id="${id}"]`);
  check(await card('rc-mini').locator('.badge--oferta').count() === 1, 'producto con precio anterior muestra la etiqueta Oferta');
  check((await card('rc-mini').locator('.precio').innerText()).includes('$45.000'), 'precio grande con formato $45.000');
  check((await card('rc-mini').locator('.precio-anterior').innerText()).includes('$52.000'), 'precio anterior tachado');
  check(await card('rc-mini').locator('.precio-anterior').evaluate(e => getComputedStyle(e).textDecorationLine.includes('line-through')), 'el precio anterior está tachado');

  await card('rc-mini').getByRole('button', { name: /Agregar/ }).click();
  await card('collares-hund').getByRole('button', { name: /Agregar/ }).click();
  await card('collares-hund').getByRole('button', { name: /Sumar uno/ }).click();
  await card('fuente-agua').getByRole('button', { name: /Agregar/ }).click();
  check(await page.locator('#burbuja').innerText() === '4', 'el ícono del carrito muestra 4 productos');
  check(await card('collares-hund').locator('output').innerText() === '2', 'botones + y − cambian la cantidad en la tarjeta');
  check(await page.locator('#barra-pedido').isVisible(), 'aparece la barra "Ver mi pedido" abajo');
  check((await page.locator('#barra-total').innerText()) === '$85.990', 'la barra muestra el total $85.990', await page.locator('#barra-total').innerText());

  await page.reload({ waitUntil: 'load' });
  check(await page.locator('#burbuja').innerText() === '4', 'el carrito se guarda al recargar la página');

  await page.click('#abrir-carrito');
  check(await page.locator('#carrito-panel').isVisible(), 'el carrito se abre');
  check(await page.locator('#carrito-lista .item').count() === 3, 'el carrito muestra 3 productos');
  check((await page.locator('.resumen__total').innerText()).includes('$85.990'), 'total $85.990 (45.000 + 2 × 8.500 + 23.990)');
  check((await page.locator('#carrito-lista .item').nth(1).locator('.item__subtotal').innerText()).includes('$17.000'), 'subtotal del collar x2 = $17.000');
  check((await page.locator('#carrito-lista .item').nth(1).locator('.item__foto').count()) === 1, 'cada producto con foto chica');

  // restar y volver a sumar desde el carrito
  await page.locator('#carrito-lista .item').nth(1).getByRole('button', { name: /Restar uno/ }).click();
  check((await page.locator('.resumen__total').innerText()).includes('$77.490'), 'restar en el carrito recalcula el total ($77.490)');
  await page.locator('#carrito-lista .item').nth(1).getByRole('button', { name: /Sumar uno/ }).click();
  check((await page.locator('.resumen__total').innerText()).includes('$85.990'), 'sumar en el carrito recalcula el total');

  // validación
  await page.click('#enviar-pedido');
  check(await page.locator('#p-nombre').getAttribute('aria-invalid') === 'true', 'pide el nombre antes de enviar');
  check(wa.length === 0, 'no manda nada si faltan datos');

  await page.fill('#p-nombre', 'Ana');
  await page.fill('#p-direccion', '14 N° 4520');
  await page.fill('#p-entre', '148 y 149');
  await page.fill('#p-barrio', 'Centro');
  await page.check('#p-pago input[value="Transferencia"]');
  await page.fill('#p-comentario', 'tocar timbre 2B');
  await Promise.all([page.waitForURL(/wa\.me/), page.click('#enviar-pedido')]);
  const esperado = [
    'Hola Don Gato! Quiero hacer este pedido 🐾',
    '• 1 x Royal Canin Alimento seco línea Mini (Bolsas de 3 kg en adelante) — $45.000',
    '• 2 x Hund Collares (Lisos, coloridos y estampados) — $17.000',
    '• 1 x Fuente de agua (Silenciosa · mantiene el agua en movimiento) — $23.990',
    'Total: $85.990',
    'Nombre: Ana',
    'Dirección: 14 N° 4520 (entre 148 y 149), barrio Centro',
    'Pago: Transferencia',
    'Comentario: tocar timbre 2B'
  ].join('\n');
  check(wa.length === 1 && wa[0].startsWith('https://wa.me/5491142165130?text='), 'abre wa.me/5491142165130');
  check(textoWA(wa[0]) === esperado, 'el mensaje del pedido sale bien armado', '\n' + textoWA(wa[0] || 'https://x/?text='));
  console.log('\n' + textoWA(wa[0]).split('\n').map(l => '      ' + l).join('\n') + '\n');

  // volver (como cuando la persona vuelve de WhatsApp)
  await page.goto(BASE, { waitUntil: 'load' });
  check(await page.locator('#burbuja').innerText() === '0', 'después de mandar el pedido el carrito queda vacío');
  check(await page.locator('#repetir').isVisible(), 'aparece "Repetir mi último pedido" arriba del catálogo');
  await page.click('#repetir-boton');
  check(await page.locator('#burbuja').innerText() === '4', '"Repetir mi último pedido" carga el carrito (4 productos)');
  check(await page.locator('#carrito-lista .item').count() === 3 && (await page.locator('.resumen__total').innerText()).includes('$85.990'), 'el pedido repetido tiene los mismos 3 productos y total');
  check(await page.inputValue('#p-nombre') === 'Ana' && await page.inputValue('#p-barrio') === 'Centro', 'recuerda nombre y dirección para la próxima');
  check(errores.length === 0, 'sin errores de JavaScript en todo el flujo', errores.join(' | '));
  await ctx.close();
}

// ---------------------------------------------------------------------------
console.log('\n3. Pedido con precios a confirmar y botones de consulta');
{
  const { ctx, page, wa } = await contexto(browser);
  await page.goto(BASE, { waitUntil: 'load' });
  check(await page.locator('.card[data-id="rc-mini"] .sin-precio').innerText() === 'Precio a confirmar', 'sin precio cargado dice "Precio a confirmar"');
  const consultar = await page.locator('.card[data-id="rc-mini"] .btn-consultar').getAttribute('href');
  check(textoWA(consultar) === 'Hola Don Gato! Quería consultar por: Royal Canin Alimento seco línea Mini (Bolsas de 3 kg en adelante)', 'botón Consultar con el mensaje del producto', textoWA(consultar));
  const flotante = await page.locator('#wa-flotante').getAttribute('href');
  check(textoWA(flotante) === 'Hola Don Gato! Tengo una consulta', 'botón flotante de WhatsApp con "Hola Don Gato! Tengo una consulta"');
  await page.locator('.card[data-id="rc-mini"]').getByRole('button', { name: /Agregar/ }).click();
  await page.locator('#barra-pedido').click();
  check((await page.locator('.resumen__total').innerText()).includes('A confirmar'), 'total "A confirmar" si no hay precios');
  check(await page.locator('#carrito-minimo').isHidden(), 'sin monto mínimo cargado no muestra nada de mínimo');
  await page.fill('#p-nombre', 'Juan');
  await page.fill('#p-direccion', '21 N° 3900');
  await page.fill('#p-barrio', 'Hudson');
  await page.check('#p-pago input[value="Efectivo"]');
  await Promise.all([page.waitForURL(/wa\.me/), page.click('#enviar-pedido')]);
  const t = textoWA(wa[0]);
  check(t.includes('• 1 x Royal Canin Alimento seco línea Mini (Bolsas de 3 kg en adelante) — precio a confirmar') && t.includes('Total: a confirmar') && t.includes('Dirección: 21 N° 3900, barrio Hudson') && !t.includes('Comentario'), 'mensaje con precio a confirmar, sin "entre" ni comentario vacíos', '\n' + t);
  await ctx.close();
}

// ---------------------------------------------------------------------------
console.log('\n4. Turnos por WhatsApp');
{
  const { ctx, page, wa } = await contexto(browser);
  await page.clock.setFixedTime(new Date('2026-11-25T10:00:00-03:00'));
  await page.goto(BASE, { waitUntil: 'load' });
  await page.click('.portada a[href="#turnos"]');
  await page.click('#form-turno button[type="submit"]');
  check(await page.locator('#t-nombre').getAttribute('aria-invalid') === 'true' && wa.length === 0, 'el turno pide los datos obligatorios');
  check(await page.evaluate(() => document.activeElement.id) === 't-nombre', 'el foco va al primer dato que falta');
  await page.fill('#t-nombre', 'Ana');
  await page.fill('#t-mascota', 'Lola');
  await page.selectOption('#t-especie', 'Perro');
  await page.check('input[name="motivo"][value="Vacuna"]');
  await page.fill('#t-dia', '2026-11-29');
  await page.check('input[name="franja"][value="mañana"]');
  await page.click('#form-turno button[type="submit"]');
  check((await page.locator('#t-dia-error').innerText()).includes('domingos está cerrado'), 'avisa que los domingos está cerrado');
  await page.fill('#t-dia', '2026-11-28');
  await page.check('input[name="franja"][value="tarde"]');
  await page.click('#form-turno button[type="submit"]');
  check((await page.locator('#t-franja-error').innerText()).includes('sábados atendemos solo a la mañana'), 'avisa que los sábados es solo a la mañana');
  await page.fill('#t-dia', '2026-11-27');
  await page.fill('#t-comentario', 'le toca la antirrábica');
  await Promise.all([page.waitForURL(/wa\.me/), page.click('#form-turno button[type="submit"]')]);
  const esperado = [
    'Hola Don Gato! Quiero pedir un turno 🐾',
    'Nombre: Ana',
    'Mascota: Lola (especie: perro)',
    'Motivo: Vacuna',
    'Día preferido: viernes 27/11 – turno tarde',
    'Comentario: le toca la antirrábica'
  ].join('\n');
  check(wa.length === 1 && textoWA(wa[0]) === esperado, 'el mensaje del turno sale bien armado', '\n' + (wa[0] ? textoWA(wa[0]) : ''));
  console.log('\n' + textoWA(wa[0]).split('\n').map(l => '      ' + l).join('\n') + '\n');
  await ctx.close();
}

// ---------------------------------------------------------------------------
console.log('\n5. Abierto ahora / Cerrado ahora');
{
  const casos = [
    ['2026-11-25T10:00:00-03:00', TZ, true, 'Abierto ahora · cierra a las 13 h', 'miércoles 10:00'],
    ['2026-11-25T12:45:00-03:00', TZ, true, 'Abierto ahora · cierra en 15 min', 'miércoles 12:45'],
    ['2026-11-25T14:00:00-03:00', TZ, false, 'Cerrado ahora · abre hoy a las 16 h', 'miércoles 14:00'],
    ['2026-11-25T17:30:00-03:00', TZ, true, 'Abierto ahora · cierra a las 19 h', 'miércoles 17:30'],
    ['2026-11-25T20:00:00-03:00', TZ, false, 'Cerrado ahora · abre mañana a las 9 h', 'miércoles 20:00'],
    ['2026-11-28T11:00:00-03:00', TZ, true, 'Abierto ahora · cierra a las 13 h', 'sábado 11:00'],
    ['2026-11-28T15:00:00-03:00', TZ, false, 'Cerrado ahora · abre el lunes a las 9 h', 'sábado 15:00'],
    ['2026-11-29T11:00:00-03:00', TZ, false, 'Cerrado ahora · abre mañana a las 9 h', 'domingo 11:00'],
    ['2026-11-30T08:30:00-03:00', TZ, false, 'Cerrado ahora · abre hoy a las 9 h', 'lunes 8:30'],
    ['2026-11-25T10:00:00-03:00', 'Europe/Madrid', true, 'Abierto ahora · cierra a las 13 h', 'celular con otra zona horaria']
  ];
  for (const [fecha, zona, abierto, texto, nombre] of casos) {
    const { ctx, page } = await contexto(browser, { zona });
    await page.clock.setFixedTime(new Date(fecha));
    await page.goto(BASE, { waitUntil: 'load' });
    const t = await page.locator('#estado-portada .estado__texto').innerText();
    const clase = await page.locator('#estado-portada').evaluate(e => e.classList.contains('abierto'));
    check(t === texto && clase === abierto, `${nombre} → "${texto}"`, t);
    await ctx.close();
  }
}

// ---------------------------------------------------------------------------
console.log('\n6. Filtros, buscador y "Ver más"');
{
  const { ctx, page, errores } = await contexto(browser);
  await page.goto(BASE, { waitUntil: 'load' });
  check(await page.locator('#grilla .card').count() === 12, 'arranca mostrando 12 productos');
  await page.click('#ver-mas');
  check(await page.locator('#grilla .card').count() === 24, '"Ver más" suma 12 productos');
  await page.click('#especies-botones [data-especie="gato"]');
  const especies = await page.$$eval('#grilla .card', cs => cs.map(c => c.dataset.id));
  const todosGato = await page.evaluate(ids => ids.every(id => { const p = PRODUCTOS.find(x => x.id === id); return [].concat(p.especie).includes('gato'); }), especies);
  check(especies.length > 0 && todosGato, '"¿Para quién comprás?" → Gatos filtra el catálogo');
  check(await page.locator('#chips-especie [data-especie="gato"]').getAttribute('aria-pressed') === 'true', 'el filtro de especie queda marcado');
  await page.click('#chips-categoria [data-categoria="rascadores"]');
  const cats = await page.$$eval('#grilla .card', cs => cs.map(c => c.dataset.id));
  check(cats.length === 4 && cats.every(id => id.startsWith('rascador')), 'filtro por categoría Rascadores (4 productos)', cats.join(','));
  await page.click('#limpiar');
  await page.fill('#buscar', 'piedras');
  await page.waitForTimeout(400);
  const piedras = await page.$$eval('#grilla .card', cs => cs.map(c => c.dataset.id));
  check(piedras.length >= 3 && piedras.every(id => /litera|bano|alfombra/.test(id)), 'buscar "piedras" muestra literas y afines', piedras.join(','));
  await page.fill('#buscar', 'royal canin');
  await page.waitForTimeout(400);
  check(await page.locator('#grilla .card').count() === 3, 'buscar "royal canin" (sin tildes ni mayúsculas) encuentra 3');
  await page.fill('#buscar', 'xyzabc');
  await page.waitForTimeout(400);
  check(await page.locator('#vacio').isVisible() && textoWA(await page.locator('#vacio a').getAttribute('href')) === 'Hola Don Gato! ¿Tienen xyzabc?', 'sin resultados ofrece preguntar por WhatsApp');
  await page.fill('#buscar', '');
  await page.waitForTimeout(400);
  await page.click('#chips-especie [data-especie="otros"]');
  check((await page.locator('#vacio').innerText()).includes('erizos'), 'especie "Otros" invita a consultar');
  await page.click('#chips-especie [data-especie="aves"]');
  check(await page.locator('#grilla .badge--ejemplo').count() === 3, 'aves muestra 3 productos marcados EJEMPLO');
  await page.click('#chips-especie [data-especie="todas"]');
  await page.click('#promo-ver');
  check(await page.locator('#grilla .card').count() === 3 && await page.inputValue('#buscar') === 'Royal Canin', '"Ver alimentos de la promo" muestra los Royal Canin');
  check(errores.length === 0, 'sin errores de JavaScript', errores.join(' | '));
  await ctx.close();
}

// ---------------------------------------------------------------------------
console.log('\n7. Teclado y accesibilidad');
{
  const { ctx, page } = await contexto(browser, { ancho: 1280, alto: 900, movil: false });
  await page.goto(BASE, { waitUntil: 'load' });
  await page.locator('.card[data-id="rc-mini"]').getByRole('button', { name: /Agregar/ }).focus();
  await page.keyboard.press('Enter');
  check(await page.locator('.card[data-id="rc-mini"] output').innerText() === '1', 'se agrega con Enter');
  check(await page.evaluate(() => document.activeElement.dataset.accion) === 'sumar', 'el foco queda en el control de cantidad');
  await page.keyboard.press('Enter');
  check(await page.locator('.card[data-id="rc-mini"] output').innerText() === '2', 'el + funciona con teclado');
  await page.focus('#abrir-carrito');
  await page.keyboard.press('Enter');
  check(await page.locator('#carrito-panel').isVisible(), 'el carrito se abre con Enter');
  check(await page.evaluate(() => document.getElementById('carrito-panel').contains(document.activeElement)), 'el foco entra al carrito');
  let adentro = true;
  for (let i = 0; i < 30; i++) {
    await page.keyboard.press('Tab');
    adentro = adentro && await page.evaluate(() => document.getElementById('carrito-panel').contains(document.activeElement));
  }
  check(adentro, 'con Tab el foco no se escapa del carrito');
  await page.locator('#carrito-lista .item').first().getByRole('button', { name: /Restar uno/ }).focus();
  await page.keyboard.press('Enter');
  check(await page.evaluate(() => document.activeElement.dataset.accion === 'restar'), 'el foco no se pierde al cambiar cantidades en el carrito');
  await page.keyboard.press('Escape');
  check(await page.locator('#carrito').isHidden(), 'Escape cierra el carrito');
  check(await page.evaluate(() => document.activeElement.id) === 'abrir-carrito', 'el foco vuelve al botón del carrito');
  const panel = await page.locator('#carrito-panel').evaluate(e => getComputedStyle(e).width);
  check(parseInt(panel) <= 470, 'en la compu el carrito es un panel lateral', panel);
  // tamaños táctiles en el celular
  const { ctx: c2, page: p2 } = await contexto(browser);
  await p2.goto(BASE, { waitUntil: 'load' });
  await p2.locator('.card[data-id="rc-mini"]').getByRole('button', { name: /Agregar/ }).click();
  const chicos = await p2.evaluate(() => {
    const sel = 'button, a.btn, .chip, .btn-consultar, .especie, .buscador input, .campo input, .campo select, .opcion span, summary, .pie__links a, .wa-flotante, .btn-carrito';
    return Array.from(document.querySelectorAll(sel)).filter(el => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && !el.closest('[hidden]') && !el.closest('.sr-only') && r.height < 44;
    }).map(el => el.tagName + '.' + el.className + ':' + Math.round(el.getBoundingClientRect().height));
  });
  check(chicos.length === 0, 'botones y campos de al menos 44 px de alto', chicos.join(', '));
  const posCarrito = await p2.evaluate(async () => {
    document.getElementById('abrir-carrito').click();
    await new Promise(r => setTimeout(r, 350));
    const r = document.getElementById('carrito-panel').getBoundingClientRect();
    return { abajo: Math.round(window.innerHeight - r.bottom), ancho: Math.round(r.width) };
  });
  check(posCarrito.abajo === 0 && posCarrito.ancho === 375, 'en el celular el carrito sube desde abajo', JSON.stringify(posCarrito));
  await c2.close();
  await ctx.close();
}

// ---------------------------------------------------------------------------
console.log('\n8. Logo de respaldo');
{
  const { ctx, page } = await contexto(browser, { sinLogo: true });
  await page.goto(BASE, { waitUntil: 'load' });
  await page.waitForTimeout(300);
  check(await page.locator('.logo .logo-texto').isVisible() && (await page.locator('.logo .logo-texto').innerText()).includes('DON GATO'), 'si logo.png no carga aparece "DON GATO" en texto');
  await ctx.close();
}

await browser.close();
console.log(`\n${ok} chequeos OK, ${fallas.length} con problemas`);
if (fallas.length) { console.log('Fallaron:\n - ' + fallas.join('\n - ')); process.exit(1); }
