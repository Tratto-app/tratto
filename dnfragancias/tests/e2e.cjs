// Pruebas de punta a punta de la página de DN Fragancias.
// Uso: (en otra terminal) python3 -m http.server 8137   desde la carpeta dnfragancias
//      node tests/e2e.cjs
// Las fotos y tipografías externas se bloquean a propósito: así también se prueba el recuadro gris.
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:8137/index.html';

let ok = 0, mal = 0;
const chequear = (cond, txt, extra = '') => {
  if (cond) { ok++; console.log('  ✓ ' + txt); } else { mal++; console.log('  ✗ ' + txt + (extra ? '  → ' + extra : '')); }
};
const plata = n => '$' + String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');

async function nuevaPagina(browser, opciones = {}) {
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, hasTouch: true, ...opciones });
  const page = await ctx.newPage();
  page.errores = [];
  page.on('pageerror', e => page.errores.push(e.message));
  await page.route(/fonts\.googleapis|fonts\.gstatic|digitaloceanspaces|google\.com\/maps/, r => r.abort());
  await page.addInitScript(() => { window.open = (u) => { window.__abierto = u; return {}; }; });
  await page.goto(BASE);
  return { ctx, page };
}
const nombresVisibles = page => page.$$eval('#grid .card-nombre', els => els.map(e => e.textContent.trim()));
const conteo = page => page.$eval('#conteo', e => e.textContent.trim());
async function buscar(page, txt) {
  await page.fill('#q', txt);
  await page.waitForTimeout(250);
}
async function cantidadEn(page, nombre, formato, n) {
  const card = page.locator('#grid .card', { has: page.locator('.card-nombre', { hasText: new RegExp('^' + nombre + '$') }) })
    .filter({ has: page.locator('.card-formato', { hasText: formato }) }).first();
  const input = card.locator('.st-num');
  await input.fill(String(n));
  await input.press('Enter');
  return card;
}

(async () => {
  const browser = await chromium.launch();

  console.log('\n1. Carga y datos para Google');
  {
    const { ctx, page } = await nuevaPagina(browser);
    chequear(page.errores.length === 0, 'Sin errores de JavaScript', page.errores.join(' | '));
    const n = await page.evaluate(() => window.DN.PRODS.length);
    chequear(n === 521, 'Están los 521 productos', String(n));
    chequear(await page.$$eval('#grid .card', e => e.length) === 24, 'Muestra 24 productos de entrada');
    const ld = await page.$eval('script[type="application/ld+json"]', e => JSON.parse(e.textContent));
    chequear(ld['@type'] === 'Store' && ld.telephone === '+5491140834591' && ld.address.streetAddress === 'Demóstenes 3209' && ld.openingHoursSpecification[0].opens === '09:30' && ld.sameAs.some(u => u.includes('instagram')), 'JSON-LD de tipo Store con nombre, dirección, teléfono, horarios e Instagram');
    const og = await page.$$eval('meta[property^="og:"]', ms => Object.fromEntries(ms.map(m => [m.getAttribute('property'), m.content])));
    chequear(og['og:title'] && og['og:description'] && /logo\.jpg$/.test(og['og:image']), 'Open Graph con título, descripción y logo');
    const titulo = await page.title(), desc = await page.$eval('meta[name="description"]', m => m.content);
    chequear(/perfumes árabes por mayor/i.test(titulo + desc) && /tubitos de perfume por mayor/i.test(titulo + desc) && /mayorista de perfumes en moreno/i.test(desc), 'Título y descripción con las búsquedas pedidas');
    chequear(!/pency/i.test(await page.evaluate(() => document.body.innerText)), 'No dice "Pency" en ningún texto de la página');
    await ctx.close();
  }

  console.log('\n2. Buscador');
  {
    const { ctx, page } = await nuevaPagina(browser);
    await buscar(page, 'yara');
    let nombres = await nombresVisibles(page);
    chequear(nombres.length > 0 && nombres.every(t => /yara/i.test(t)), `"yara" encuentra solo Yaras (${await conteo(page)})`, nombres.slice(0, 5).join(', '));
    const cYara = await conteo(page);
    await buscar(page, 'YÁRA');
    chequear(await conteo(page) === cYara, 'Sin importar tildes ni mayúsculas ("YÁRA" = "yara")');
    await buscar(page, '9pm');
    nombres = await nombresVisibles(page);
    chequear(nombres.some(t => t === 'Inspirado en 9pm Night Out') && nombres.every(t => /9pm/i.test(t)), `"9pm" encuentra los 9pm, también el que en Pency dice "9 PM" (${await conteo(page)})`, nombres.slice(0, 6).join(', '));
    await buscar(page, 'khamrah');
    nombres = await nombresVisibles(page);
    chequear(nombres.length >= 8 && nombres.some(t => /Khamrah Waha/.test(t)), `"khamrah" encuentra también los que estaban escritos "Khamra" (${await conteo(page)})`);
    await buscar(page, 'phantom');
    chequear((await nombresVisibles(page)).length >= 10, '"phantom" encuentra los que en Pency dicen "PHAMTOM"');
    await buscar(page, 'zzzzqqq');
    chequear(await page.isVisible('#vacio') && /No encontramos/.test(await page.textContent('#vacio')), 'Sin resultados: mensaje amable y botón para consultar');
    await page.click('#limpiarQ');
    await page.waitForTimeout(200);
    chequear((await page.$$eval('#grid .card', e => e.length)) === 24, 'La X del buscador limpia la búsqueda');
    await ctx.close();
  }

  console.log('\n3. Formatos, filtros, orden y "Ver más"');
  {
    const { ctx, page } = await nuevaPagina(browser);
    await page.click('#chipsFormato [data-formato="tubitos"]');
    let formatos = await page.$$eval('#grid .card-formato', e => e.map(x => x.textContent.trim()));
    chequear(formatos.every(f => /^Tubito/.test(f)) && /de 66$/.test(await conteo(page)), `Chip "Tubitos 35 ml" filtra (${await conteo(page)})`);
    chequear(await page.isVisible('#chipsCategoria'), 'Aparecen las categorías originales como subfiltro');
    await page.click('#chipsCategoria [data-categoria="tubitos arabes"]');
    chequear(/de 49$/.test(await conteo(page)), `Subfiltro "Tubitos árabes" (${await conteo(page)})`);
    await page.click('.formato-card[data-ir-formato="extractos"]');
    await page.waitForTimeout(400);
    formatos = await page.$$eval('#grid .card-formato', e => e.map(x => x.textContent.trim()));
    chequear(formatos.every(f => f === 'Extracto') && /de 141$/.test(await conteo(page)), `Tarjeta "Extractos" de "Elegí por formato" filtra (${await conteo(page)})`);
    chequear(await page.getAttribute('#chipsFormato [data-formato="extractos"]', 'aria-pressed') === 'true', 'Y marca el chip correspondiente');
    await page.click('.formato-card[data-ir-formato="cien"]');
    await page.selectOption('#orden', 'menor');
    let precios = await page.$$eval('#grid .card-precio', e => e.map(x => +x.textContent.replace(/\D/g, '')));
    chequear(precios.every((p, i) => !i || precios[i - 1] <= p), 'Orden "Menor precio"');
    await page.selectOption('#orden', 'mayor');
    precios = await page.$$eval('#grid .card-precio', e => e.map(x => +x.textContent.replace(/\D/g, '')));
    chequear(precios[0] === 42500 && precios.every((p, i) => !i || precios[i - 1] >= p), 'Orden "Mayor precio"');
    await page.click('#chipsFormato [data-formato="todos"]');
    await page.click('#btnMas');
    chequear((await page.$$eval('#grid .card', e => e.length)) === 48, '"Ver más" carga 24 más');
    const lazy = await page.$$eval('#grid img', i => i.every(x => x.loading === 'lazy' && x.alt.length > 3));
    chequear(lazy, 'Fotos con carga diferida y texto alternativo');
    await page.waitForTimeout(300);
    const grises = await page.$$eval('#grid .foto', f => f.every(x => !x.querySelector('img') ? x.classList.contains('sin-foto') && x.textContent.trim().length > 2 : true));
    const sinImg = await page.$$eval('#grid .foto.sin-foto', f => f.length);
    chequear(grises && sinImg > 0, `Si la foto no carga queda el recuadro gris con el formato (${sinImg} en pantalla)`);
    await ctx.close();
  }

  console.log('\n4. Reglas de nombres de marcas');
  {
    const { ctx, page } = await nuevaPagina(browser);
    const d = await page.evaluate(() => window.DN.PRODS.map(o => ({ w: o.web, alt: o.alternativa, promo: o.formatoId === 'promos' && o.kit, cat: o.categoria })));
    const alt = d.filter(x => x.alt && !x.promo);
    chequear(alt.length === 421 && alt.every(x => x.w.startsWith('Inspirado en ')), `Las ${alt.length} fragancias alternativas dicen "Inspirado en …"`);
    chequear(!d.some(x => /original|r[eé]plica|copia|igual al|triple ?a|alternativ|tester|tesster/i.test(x.w)), 'Ningún nombre dice original, réplica, copia, triple A, alternativo ni tester');
    chequear(!d.some(x => /pandora|sanrio|labubu|kuromi|kitty|victoria|karseell|mely|aozy|cqk|\bmiu\b/i.test(x.w)), 'Accesorios, vinchas, body splash, cremas y aceites sin marcas ni personajes');
    const aConfirmar = await page.evaluate(() => window.DN.PRODS.filter(o => /BODY SPLASH|Karseell|KIT VICTORIA|MELY/i.test(o.nombre + ' ' + o.categoria)).map(o => ({ w: o.web, foto: o.foto })));
    chequear(aConfirmar.length === 6 && aConfirmar.every(x => !x.foto && /^(Body splash 250 ml|Aceite capilar|Loción corporal|Kit body splash)/.test(x.w)), 'Body splash, aceite, loción y kit: nombre genérico y sin foto con marca hasta confirmar', JSON.stringify(aConfirmar));
    await page.click('#chipsFormato [data-formato="tubitos"]');
    const tags = await page.$$eval('#grid .card', cs => cs.every(c => c.querySelector('.tag-alt') && c.querySelector('.tag-alt').textContent === 'Fragancia alternativa'));
    chequear(tags, 'Las tarjetas de fragancias llevan la etiqueta "Fragancia alternativa"');
    const aclaraciones = await page.$$eval('.js-aclaracion', e => e.map(x => x.textContent));
    chequear(aclaraciones.length === 2 && aclaraciones.every(t => t === 'Las fragancias alternativas e inspiradas no son productos originales ni están asociadas a las marcas mencionadas.'), 'Aclaración arriba del catálogo y en el pie');
    const fs = await page.$eval('.aviso-legal', e => parseFloat(getComputedStyle(e).fontSize));
    chequear(fs >= 14, `Aclaración en letra legible (${fs}px)`);
    const texto = await page.evaluate(() => document.body.innerText);
    const limpio = texto.split('Las fragancias alternativas e inspiradas no son productos originales ni están asociadas a las marcas mencionadas.').join('');
    chequear(!/original|réplica|copia/i.test(limpio), 'Fuera de las aclaraciones, la página no dice original, réplica ni copia');
    await ctx.close();
  }

  console.log('\n5. Carrito, aviso mayorista y que se guarde');
  {
    const { ctx, page } = await nuevaPagina(browser);
    await buscar(page, 'yara moi');
    await cantidadEn(page, 'Inspirado en Yara Moi', 'Tubito 35 ml', 3);
    await page.waitForTimeout(150);
    chequear(await page.textContent('#badge') === '3', 'El ícono del carrito muestra la cantidad');
    chequear(await page.isVisible('#barraPedido') && /\$5\.400/.test(await page.textContent('#barraPedido')), 'Aparece la barra "Ver pedido" con el total');
    await page.click('#btnCarrito');
    chequear(/Te faltan 2 unidades para el precio mayorista/.test(await page.textContent('#carAviso')), 'Con 3 unidades: "Te faltan 2 unidades para el precio mayorista"');
    chequear(await page.isEnabled('#btnEnviar'), 'No bloquea el envío (también venden por menor)');
    await page.click('#carCerrar');
    await cantidadEn(page, 'Inspirado en Yara Moi', 'Tubito 35 ml', 20);
    await buscar(page, '9pm elixir');
    await cantidadEn(page, 'Inspirado en 9pm Elixir', 'Miniatura 30 ml', 9);
    const card = page.locator('#grid .card', { has: page.locator('.card-formato', { hasText: 'Miniatura 30 ml' }) }).first();
    await card.locator('[data-accion="mas"]').click();
    await page.click('#btnCarrito');
    chequear(await page.textContent('#carTotal') === '$74.000' && /30 unidades/.test(await page.textContent('#carUnidades')), 'Suma bien: 20 tubitos + 10 miniaturas = $74.000 (30 unidades)', await page.textContent('#carTotal'));
    chequear(/Llegaste al precio mayorista/.test(await page.textContent('#carAviso')), 'Con 30 unidades: avisa que llegó al precio mayorista');
    const subs = await page.$$eval('#carLista .ci-sub', e => e.map(x => x.textContent));
    chequear(subs.join('|') === '$36.000|$38.000', 'Subtotales por producto', subs.join('|'));
    await page.locator('#carLista .ci').nth(1).locator('[data-accion="menos"]').click();
    chequear(await page.textContent('#carTotal') === '$70.200', 'El − adentro del carrito resta y recalcula', await page.textContent('#carTotal'));
    await page.locator('#carLista .ci').nth(1).locator('[data-accion="mas"]').click();
    await page.reload();
    await page.waitForTimeout(200);
    chequear(await page.textContent('#badge') === '30', 'El carrito se guarda: después de recargar sigue con 30');
    await page.click('#btnCarrito');
    chequear(await page.textContent('#carTotal') === '$74.000', 'Y con el mismo total');

    console.log('\n6. Mensaje de WhatsApp y "Repetir mi último pedido"');
    await page.click('#btnEnviar');
    chequear(!(await page.evaluate(() => window.__abierto)) && /Escribí tu nombre/.test(await page.textContent('#eNombre')), 'Sin datos no manda y pide nombre, localidad y entrega');
    await page.fill('#fNombre', 'Carla');
    await page.fill('#fLocalidad', 'Moreno');
    await page.selectOption('#fProvincia', 'Buenos Aires');
    await page.check('input[name="entrega"][value="Envío"]', { force: true });
    await page.fill('#fComentario', 'Mitad de hombre y mitad de mujer');
    await page.click('#btnEnviar');
    const url = await page.evaluate(() => window.__abierto);
    chequear(url && url.startsWith('https://wa.me/5491140834591?text='), 'Abre wa.me/5491140834591', url && url.slice(0, 50));
    const msg = url ? decodeURIComponent(url.split('?text=')[1]) : '';
    const esperado = [
      'Hola DN Fragancias! Quiero hacer este pedido:',
      '• 20 x Tubito 35 ml Inspirado en Yara Moi — $36.000',
      '• 10 x Miniatura 30 ml Inspirado en 9pm Elixir — $38.000',
      'Total: $74.000 (30 unidades)',
      'Nombre: Carla',
      'Localidad: Moreno, Buenos Aires',
      'Entrega: Envío',
      'Comentario: Mitad de hombre y mitad de mujer',
    ].join('\n');
    chequear(msg === esperado, 'El mensaje sale armado igual al modelo', '\n' + msg);
    console.log('\n' + msg.split('\n').map(l => '      ' + l).join('\n') + '\n');
    chequear(await page.isVisible('#carOk') && await page.textContent('#badge') === '0', 'Después de enviar: carrito vacío y pantalla de listo');
    await page.click('#carOkSeguir');
    await page.reload();
    chequear(await page.isVisible('#btnRepetir'), 'Aparece "Repetir mi último pedido" arriba del catálogo');
    chequear(await page.inputValue('#fNombre') === 'Carla', 'Recuerda el nombre de la clienta para el próximo pedido');
    await page.click('#btnRepetir');
    await page.waitForTimeout(200);
    chequear(await page.textContent('#carTotal') === '$74.000' && (await page.$$eval('#carLista .ci', e => e.length)) === 2, '"Repetir mi último pedido" carga el mismo carrito');
    await ctx.close();
  }

  console.log('\n7. Precio por cantidad');
  {
    const { ctx, page } = await nuevaPagina(browser);
    const r = await page.evaluate(() => [
      window.DN.precioPorCantidad('$11.000 a partir de 5 unidades'),
      window.DN.precioPorCantidad('Cera para el pelo $4mil por mayor apartir de 5 unidades'),
      window.DN.precioPorCantidad('Anillos 5X$20.000 de hombre y mujer'),
    ]);
    chequear(r[0].min === 5 && r[0].precio === 11000 && r[1].precio === 4000 && r[2] === null, 'Lee el precio por cantidad de la descripción');
    // Producto de prueba: tubito con precio x5 más barato
    await page.evaluate(() => { const p = window.DN.PRODS.find(o => o.web === 'Inspirado en Asad Bourbon' && o.cat.formato === 'Tubito 35 ml'); p.tier = { min: 5, precio: 1500 }; });
    await buscar(page, 'asad bourbon');
    await page.click('#chipsFormato [data-formato="tubitos"]');
    const html = await page.innerHTML('#grid');
    chequear(/x5 o más: <b>\$1\.500<\/b> c\/u/.test(html), 'La tarjeta muestra "x5 o más: $1.500 c/u"');
    await cantidadEn(page, 'Inspirado en Asad Bourbon', 'Tubito 35 ml', 4);
    await page.click('#btnCarrito');
    chequear(await page.textContent('#carTotal') === '$7.200' && /Llevando 5 o más pagás \$1\.500/.test(await page.textContent('#carLista')), 'Con 4: precio normal y pista de cuánto pagaría con 5');
    await page.locator('#carLista [data-accion="mas"]').click();
    chequear(await page.textContent('#carTotal') === '$7.500' && /Precio por cantidad aplicado/.test(await page.textContent('#carLista')), 'Con 5: aplica solo $1.500 c/u y lo marca "precio por cantidad aplicado"');
    await ctx.close();
  }

  console.log('\n8. Calculadora');
  {
    const { ctx, page } = await nuevaPagina(browser);
    const leer = async () => ({ inv: await page.textContent('#rInv'), cob: await page.textContent('#rCob'), gan: await page.textContent('#rGan') });
    let v = await leer();
    chequear(v.inv === '$320.000' && v.cob === '$640.000' && v.gan === '$320.000' && await page.inputValue('#calcVenta') === '3200', 'Kit 200 tubitos: venta sugerida $3.200 (el doble), invertís $320.000, cobrás $640.000, ganás $320.000', JSON.stringify(v));
    await page.click('#calcMas');
    v = await leer();
    chequear(v.inv === '$640.000' && v.gan === '$640.000', '2 kits: duplica todo');
    await page.click('#calcMenos');
    await page.fill('#calcVenta', '2500');
    v = await leer();
    chequear(v.gan === '$180.000', 'Precio editable: a $2.500 ganás $180.000', v.gan);
    await page.click('#calcBtn');
    chequear(await page.textContent('#badge') === '1', '"Quiero este kit" lo suma al carrito');
    await page.selectOption('#calcProd', 'f-tubitos');
    v = await leer();
    chequear(v.inv === plata(20 * 1800) && v.cob === plata(20 * 3600) && v.gan === plata(36000), 'Formato tubitos x20: invertís $36.000, cobrás $72.000, ganás $36.000', JSON.stringify(v));
    await page.fill('#calcVenta', '1000');
    chequear(await page.textContent('#rGanaTit') === 'Perdés', 'Si vendés por debajo del costo avisa que perdés');
    chequear(/cálculo de ejemplo; el precio de venta lo definís vos/.test(await page.textContent('#calculadora')), 'Aclaración de cálculo de ejemplo');
    await ctx.close();
  }

  console.log('\n9. Kits, horario, WhatsApp y accesibilidad');
  {
    const { ctx, page } = await nuevaPagina(browser);
    const kits = await page.$$eval('#carrusel .kit-card', ks => ks.map(k => k.querySelector('h3').textContent + ' ' + k.querySelector('.kit-precio').textContent + ' ' + k.querySelector('.kit-cu').textContent));
    chequear(kits.length === 8, 'Carrusel con los 8 kits pedidos', kits.length);
    chequear(kits[0] === '200 tubitos surtidos $320.000 $1.600 c/u', 'Muestra el precio por unidad ("$1.600 c/u")', kits[0]);
    const surtidos = await page.$$eval('#carrusel .kit-surtido', e => e.every(x => x.textContent.includes('Ya vienen surtidos y listos para despachar')));
    chequear(surtidos, 'Cada kit dice "Ya vienen surtidos y listos para despachar"');
    const est = await page.evaluate(() => [
      window.DN.estadoLocal({ dia: 1, min: 10 * 60 }), window.DN.estadoLocal({ dia: 2, min: 8 * 60 }),
      window.DN.estadoLocal({ dia: 0, min: 12 * 60 }), window.DN.estadoLocal({ dia: 6, min: 19 * 60 + 5 }),
    ].map(e => (e.abierto ? 'A:' : 'C:') + e.texto.replace(/<[^>]+>/g, '')));
    chequear(est[0] === 'A:Abierto ahora · cierra a las 19:00', 'Lunes 10:00 → abierto', est[0]);
    chequear(est[1] === 'C:Cerrado · abre hoy a las 9:30', 'Martes 8:00 → abre hoy a las 9:30', est[1]);
    chequear(est[2] === 'C:Cerrado · abre mañana a las 9:30', 'Domingo → abre mañana a las 9:30', est[2]);
    chequear(est[3] === 'C:Cerrado · abre el lunes a las 9:30', 'Sábado 19:05 → abre el lunes a las 9:30', est[3]);
    const flot = decodeURIComponent(await page.getAttribute('#waFlotante', 'href'));
    chequear(flot.includes('wa.me/5491140834591') && flot.endsWith('Hola DN! Tengo una consulta'), 'Botón flotante de WhatsApp con "Hola DN! Tengo una consulta"');
    const consultar = decodeURIComponent(await page.getAttribute('#grid .btn-consultar', 'href'));
    chequear(/Hola DN! Quería consultar por: .+ Inspirado en .+|Hola DN! Quería consultar por: \S/.test(consultar), '"Consultar" abre WhatsApp con el producto', consultar.split('text=')[1]);
    const chicos = await page.$$eval('button, a.btn, a.icono-btn, a.btn-consultar, .chip, summary', els => els.filter(e => {
      const r = e.getBoundingClientRect(); if (!r.width || !r.height) return false;
      const st = getComputedStyle(e); if (st.visibility === 'hidden') return false;
      return r.height < 44 || (r.width < 44);
    }).map(e => (e.id || e.className || e.tagName) + ' ' + Math.round(e.getBoundingClientRect().width) + 'x' + Math.round(e.getBoundingClientRect().height)));
    chequear(chicos.length === 0, 'Todos los botones miden 44 px o más', chicos.slice(0, 8).join(', '));
    const sinAlt = await page.$$eval('img', i => i.filter(x => !x.hasAttribute('alt')).length);
    chequear(sinAlt === 0, 'Todas las imágenes tienen texto alternativo');
    const faq = await page.$$eval('#faq summary', s => s.map(x => x.textContent.trim()));
    chequear(faq.length === 7, 'Siete preguntas frecuentes en acordeón');
    await page.click('#faq details:nth-child(5) summary');
    chequear(/ya surtidas y listas para despachar/.test(await page.textContent('#faq details:nth-child(5)')), 'El acordeón abre la respuesta');
    const contraste = await page.$eval('.btn-neon', b => getComputedStyle(b).color);
    chequear(contraste === 'rgb(4, 32, 43)', 'Botón celeste con texto oscuro');
    await ctx.close();
  }

  console.log('\n10. Sin scroll horizontal');
  for (const w of [320, 360, 375, 414, 768, 1024, 1440]) {
    const { ctx, page } = await nuevaPagina(browser, { viewport: { width: w, height: 900 } });
    await page.click('#chipsFormato [data-formato="tubitos"]');
    const r = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, anchos: Array.from(document.querySelectorAll('body *')).filter(e => { const b = e.getBoundingClientRect(); return b.right > document.documentElement.clientWidth + 1 && !e.closest('.carrusel, .chips') && getComputedStyle(e).position !== 'fixed'; }).slice(0, 3).map(e => e.className) }));
    chequear(r.sw <= r.cw, `${w}px: sin scroll horizontal`, JSON.stringify(r));
    await ctx.close();
  }

  await browser.close();
  console.log(`\n${ok} chequeos bien, ${mal} mal`);
  process.exit(mal ? 1 : 0);
})();
