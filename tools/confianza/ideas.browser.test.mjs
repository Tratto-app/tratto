// Funciones nuevas del 29/10/2026 (ideas tomadas del análisis de Clickie),
// probadas en la app real con el backend simulado.
//   node --test tools/confianza/ideas.browser.test.mjs
import {test, before, after} from 'node:test';
import assert from 'node:assert/strict';
import {iniciar, abrir, cliente} from './app-simulada.mjs';

let entorno;
before(async () => { entorno = await iniciar(); });
after(async () => { await entorno?.cerrar(); });

const pedido = (extra = {}) => ({id: 69, created_at: '2026-10-28T12:00:00Z', nombre_cliente: 'Cliente de prueba',
  servicio_necesitado: 'Carpintería y muebles', zona: 'CABA', presupuesto: 30000, urgencia: 'Esta semana',
  descripcion: 'Arreglar la puerta de un placard que se salió', estado: 'pendiente', user_id: cliente, foto_url: null, cupo: 5, ...extra});

test('pedido sin conexiones: sugiere gente del oficio y abre el chat al escribirle', async () => {
  const p = await abrir(entorno, {handler: c => {
    if (c.path.endsWith('/rpc/pedido_sugeridos')) return {json: [
      {proveedor_id: 7, user_id: 'u7', nombre: 'Juan Carpintero', rubro: 'Tapicería y restauración', zona: 'CABA',
       descripcion: 'Restauro muebles', precio_desde: 20000, precio_hasta: 80000, trabajos: 3,
       motivo: 'Ofrece Tapicería y restauración: no publicó exactamente esto, pero puede que lo haga', relacion: 'misma'}]};
    if (c.path.endsWith('/rpc/pedido_conectar')) return {json: 501};
    if (c.path.endsWith('/rest/v1/matches') && c.query.includes('id=eq.501')) return {json: [{id: 501, estado: 'pendiente',
      proveedores: {nombre: 'Juan Carpintero', zona: 'CABA', rubro: 'Tapicería y restauración', descripcion: '', precio_desde: 1, precio_hasta: 2, disponibilidad: ''},
      solicitudes: {user_id: cliente, nombre_cliente: 'Cliente', servicio_necesitado: 'Carpintería y muebles', zona: 'CABA', presupuesto: 1, urgencia: '', descripcion: ''}}]};
    return null;
  }});
  try {
    await p.page.evaluate(p => { misPedidos = [p]; abrirDetalle(69); }, pedido());
    await p.page.waitForSelector('[data-sugerido="7"]');
    const txt = await p.page.locator('#d-sugeridos').innerText();
    assert.match(txt, /gente que puede ayudarte/i);
    assert.match(txt, /no publicó exactamente esto/i);
    await p.page.locator('#d-sugeridos').scrollIntoViewIfNeeded();
    await p.foto('sugeridos');
    await p.page.locator('[data-sugerido="7"]').click();
    await p.page.waitForFunction(() => actual === 'chat');
    const conectar = p.calls.find(c => c.path.endsWith('/rpc/pedido_conectar'));
    assert.deepEqual(conectar.body, {p_solicitud_id: 69, p_proveedor_id: 7});
  } finally { await p.cerrar(); }
});

test('si no hay sugeridos no se muestra la sección', async () => {
  const p = await abrir(entorno, {handler: c => c.path.endsWith('/rpc/pedido_sugeridos') ? {json: []} : null});
  try {
    await p.page.evaluate(p => { misPedidos = [p]; abrirDetalle(69); }, pedido());
    await p.page.waitForTimeout(400);
    assert.equal(await p.page.locator('#d-sugeridos').innerText(), '');
  } finally { await p.cerrar(); }
});

test('link con el pedido escrito: avisa al entrar y abre el formulario completo', async () => {
  const ruta = '/?pedir=' + encodeURIComponent('Se me tapó la pileta de la cocina y no baja el agua') + '&zona=CABA&utm_source=prueba';
  const p = await abrir(entorno, {rol: null, ruta});
  try {
    // Sin sesión: aviso en la pantalla de ingreso y el link limpio en la barra.
    assert.match(await p.page.locator('#a-pedido-link').innerText(), /quedó guardado/);
    assert.ok(!(await p.page.evaluate(() => location.search)).includes('pedir='));
    await p.foto('link-ingreso');
    // Entra como cliente: se abre el pedido con rubro adivinado, zona y texto.
    await p.page.evaluate(c => {
      sesion = {access_token: 't', user: {id: c, email: 'x@example.invalid', user_metadata: {rol: 'cliente', nombre: 'Ana'}}};
      modo = 'cliente';
      aplicarPedidoLink();
    }, cliente);
    await p.page.waitForFunction(() => actual === 'nuevo-pedido');
    assert.equal(await p.page.inputValue('#s-servicio'), 'Plomería y destapaciones');
    assert.equal(await p.page.inputValue('#s-zona'), 'CABA');
    assert.match(await p.page.inputValue('#s-desc'), /pileta de la cocina/);
    assert.match(await p.page.locator('#s-aviso').innerText(), /Te dejamos el pedido escrito/);
    // Se usa una sola vez.
    assert.equal(await p.page.evaluate(() => aplicarPedidoLink()), false);
  } finally { await p.cerrar(); }
});

const hoyAR = () => new Date().toLocaleDateString('en-CA', {timeZone: 'America/Argentina/Buenos_Aires'});

test('pedido: "Lo necesito hoy" y la franja se guardan con el día', async () => {
  const p = await abrir(entorno);
  try {
    await p.page.evaluate(() => { $('ir-pedido').click(); });
    await p.page.waitForFunction(() => actual === 'nuevo-pedido');
    await p.page.fill('#s-nombre', 'Ana'); await p.page.fill('#s-email', 'ana@example.invalid'); await p.page.fill('#s-tel', '1155554444');
    await p.page.selectOption('#s-servicio', 'Plomería y destapaciones'); await p.page.selectOption('#s-zona', 'CABA');
    await p.page.fill('#s-desc', 'Pierde agua la canilla de la cocina');
    // Sin elegir para cuándo, no se manda.
    await p.page.click('#s-enviar');
    assert.ok(await p.page.locator('#e-s-urgencia').isVisible());
    // "Elegir el día" sin día tampoco.
    await p.page.click('#s-cuando [data-v="Día"]');
    assert.ok(await p.page.locator('#s-fecha').isVisible());
    await p.page.click('#s-enviar');
    assert.ok(await p.page.locator('#e-s-fecha').isVisible());
    await p.page.click('#s-cuando [data-v="Hoy"]');
    await p.page.click('#s-franjas [data-v="tarde"]');
    assert.ok(!(await p.page.locator('#s-fecha').isVisible()));
    assert.equal(await p.page.locator('#rv-urg').innerText(), 'Hoy · a la tarde');
    await p.page.locator('#s-cuando').scrollIntoViewIfNeeded();
    await p.foto('cuando-pedido');
    await p.page.click('#s-enviar');
    await p.page.waitForFunction(() => actual === 'inicio');
    const post = p.calls.find(c => c.method === 'POST' && c.path.endsWith('/rest/v1/solicitudes'));
    assert.equal(post.body.urgencia, 'Hoy');
    assert.equal(post.body.para_el, hoyAR());
    assert.equal(post.body.franja, 'tarde');
    // El formulario queda limpio para el próximo pedido.
    assert.equal(await p.page.locator('#s-cuando [aria-pressed="true"]').count(), 0);
  } finally { await p.cerrar(); }
});

test('presupuesto: viene marcado el día que pidió el cliente y se manda "Puede ir"', async () => {
  const hoy = hoyAR();
  const match = {id: 77, estado: 'pendiente',
    proveedores: {nombre: 'Yo', zona: 'CABA', rubro: 'Plomería y destapaciones', descripcion: '', precio_desde: 1, precio_hasta: 2, disponibilidad: ''},
    solicitudes: {user_id: 'otro-cliente', nombre_cliente: 'Ana', servicio_necesitado: 'Plomería y destapaciones', zona: 'CABA',
      presupuesto: null, urgencia: 'Hoy', para_el: hoy, franja: 'tarde', descripcion: 'Pierde la canilla'}};
  const p = await abrir(entorno, {rol: 'proveedor', handler: c => {
    if (c.path.endsWith('/rest/v1/matches')) return {json: [match]};
    if (c.path.endsWith('/rest/v1/mensajes') && c.method === 'POST') return {status: 201, json: [{id: 900, created_at: new Date().toISOString(),
      match_id: 77, remitente_tipo: 'proveedor', tipo: 'presupuesto', contenido: 'Presupuesto', monto: 45000, incluye: c.body.incluye,
      plazo: c.body.plazo, visita_el: c.body.visita_el, visita_franja: c.body.visita_franja, estado_presupuesto: 'pendiente'}]};
    return null;
  }});
  try {
    await p.page.evaluate(() => abrirChat(77, 'chats'));
    await p.page.waitForFunction(() => actual === 'chat');
    await p.page.click('#ch-presu-abrir');
    assert.match(await p.page.locator('#cp-pidio').innerText(), /Lo pidió para: Hoy · a la tarde/);
    assert.equal(await p.page.getAttribute('#cp-cuando [data-v="hoy"]', 'aria-pressed'), 'true');
    assert.equal(await p.page.getAttribute('#cp-franjas [data-v="tarde"]', 'aria-pressed'), 'true');
    await p.page.fill('#cp-monto', '45000'); await p.page.fill('#cp-incluye', 'Mano de obra y el cuerito');
    await p.page.fill('#cp-plazo', 'Lo dejo listo en el día');
    await p.page.locator('#cp-cuando').scrollIntoViewIfNeeded();
    await p.foto('cuando-presupuesto');
    await p.page.click('#cp-enviar');
    await p.page.waitForSelector('[data-presu="900"]');
    const post = p.calls.find(c => c.method === 'POST' && c.path.endsWith('/rest/v1/mensajes'));
    assert.equal(post.body.visita_el, hoy);
    assert.equal(post.body.visita_franja, 'tarde');
    assert.match(await p.page.locator('[data-presu="900"]').innerText(), /Puede ir\s*Hoy · a la tarde \(el día que lo pidió\)/i);
  } finally { await p.cerrar(); }
});

test('pedidos abiertos: los de hoy se marcan', async () => {
  const p = await abrir(entorno, {rol: 'proveedor', handler: c => c.path.endsWith('/rest/v1/pedidos_abiertos') ? {json: [
    {id: 5, created_at: new Date().toISOString(), servicio_necesitado: 'Plomería y destapaciones', zona: 'CABA', urgencia: 'Hoy',
     para_el: hoyAR(), franja: 'manana', descripcion: 'Se tapó el inodoro', cupo: 5, tomados: 0},
    {id: 6, created_at: new Date().toISOString(), servicio_necesitado: 'Plomería y destapaciones', zona: 'CABA', urgencia: 'Esta semana',
     descripcion: 'Cambiar el flexible', cupo: 5, tomados: 1}]} : null});
  try {
    await p.page.evaluate(() => { misPerfiles = [{id: 1, rubro: 'Plomería y destapaciones'}]; return cargarPedidosAbiertos(); });
    const datos = await p.page.locator('#lista-abiertos .pedido-dato.hoy').allInnerTexts();
    assert.deepEqual(datos.map(t => t.toLowerCase()), ['hoy · a la mañana']);
    assert.match(await p.page.locator('#lista-abiertos').innerText(), /esta semana/i);
  } finally { await p.cerrar(); }
});

test('barra de estado: la lista y el detalle dicen en qué paso está y qué sigue', async () => {
  const pedidos = [pedido({id: 69, estado: 'con_match'}), pedido({id: 70, estado: 'pendiente', servicio_necesitado: 'Pintura'})];
  const p = await abrir(entorno, {handler: c => {
    if (c.path.endsWith('/rest/v1/solicitudes')) return {json: pedidos};
    if (c.path.endsWith('/rest/v1/matches') && c.query.includes('solicitud_id=in.')) return {json: [{id: 501, solicitud_id: 69}, {id: 502, solicitud_id: 69}]};
    if (c.path.endsWith('/rest/v1/matches')) return {json: []};
    if (c.path.endsWith('/rest/v1/mensajes') && c.query.includes('tipo=eq.presupuesto')) return {json: [
      {match_id: 501, estado_presupuesto: 'aceptado', pago_estado: 'cobrado', trabajo_estado: null},
      {match_id: 502, estado_presupuesto: 'rechazado', pago_estado: null, trabajo_estado: null}]};
    return null;
  }});
  try {
    await p.page.evaluate(() => cargarPedidos());
    await p.page.waitForFunction(() => /Paso 4 de 5/.test(document.querySelector('[data-pedido="69"]').innerText));
    const item69 = await p.page.locator('[data-pedido="69"]').innerText();
    assert.match(item69, /Trato cerrado/i);
    assert.match(item69, /Coordiná la visita/);
    assert.equal(await p.page.locator('[data-pedido="69"] .barrita i.hecha').count(), 3);
    assert.match(await p.page.locator('[data-pedido="70"]').innerText(), /Paso 1 de 5 · Buscando quién lo haga/);
    await p.foto('etapas-lista');
    await p.page.evaluate(() => abrirDetalle(69));
    await p.page.waitForSelector('#d-etapas li.actual');
    assert.equal(await p.page.locator('#d-etapas li.actual').innerText(), 'TRATO CERRADO');
    assert.match(await p.page.locator('#d-etapas .etapas-sigue').innerText(), /Ya pagaste por la app/);
    await p.foto('etapas-detalle');
  } finally { await p.cerrar(); }
});

test('te lo buscamos: si nadie respondió aparece el botón y queda "Lo estamos buscando"', async () => {
  let pedida = null;
  const p = await abrir(entorno, {handler: c => {
    if (c.path.endsWith('/rpc/pedido_ayuda_estado')) return {json: [{pedida_at: pedida, automatica: false}]};
    if (c.path.endsWith('/rpc/pedido_te_lo_buscamos')) { pedida = new Date().toISOString(); return {json: pedida}; }
    return null;
  }});
  try {
    const hace3h = new Date(Date.now() - 3 * 36e5).toISOString();
    await p.page.evaluate(p => { misPedidos = [p]; abrirDetalle(69); }, pedido({created_at: hace3h}));
    await p.page.waitForSelector('#d-ayuda-pedir');
    assert.match(await p.page.locator('#d-ayuda').innerText(), /Nadie te responde\? Te lo buscamos nosotros/i);
    const wa = await p.page.getAttribute('#d-ayuda a[href^="https://wa.me/"]', 'href');
    assert.ok(wa.startsWith('https://wa.me/5491131549885?text='));
    assert.match(decodeURIComponent(wa), /pedido #69 de Carpintería y muebles/);
    await p.foto('te-lo-buscamos');
    await p.page.click('#d-ayuda-pedir');
    await p.page.waitForFunction(() => /Lo estamos buscando/.test(document.querySelector('#d-ayuda').innerText));
    assert.match(await p.page.locator('#d-ayuda').innerText(), /Nos lo pediste hoy/);
    assert.deepEqual(p.calls.find(c => c.path.endsWith('/rpc/pedido_te_lo_buscamos')).body, {p_solicitud_id: 69});
  } finally { await p.cerrar(); }
});

test('te lo buscamos: recién publicado no aparece', async () => {
  const p = await abrir(entorno, {handler: c => c.path.endsWith('/rpc/pedido_ayuda_estado') ? {json: [{pedida_at: null, automatica: false}]} : null});
  try {
    await p.page.evaluate(p => { misPedidos = [p]; abrirDetalle(69); }, pedido({created_at: new Date().toISOString()}));
    await p.page.waitForSelector('#d-etapas li.actual');
    await p.page.waitForTimeout(400);
    assert.equal(await p.page.locator('#d-ayuda').innerText(), '');
  } finally { await p.cerrar(); }
});

test('pedido guiado: preguntas del rubro y las respuestas van en la descripción', async () => {
  const p = await abrir(entorno);
  try {
    await p.page.evaluate(() => { $('ir-pedido').click(); });
    await p.page.waitForFunction(() => actual === 'nuevo-pedido');
    assert.ok(await p.page.locator('#s-preguntas').isHidden());
    await p.page.selectOption('#s-servicio', 'Pintura');
    assert.match(await p.page.locator('#s-preguntas').innerText(), /3 preguntas rápidas/);
    await p.page.click('#s-preguntas [data-preg="0"][data-v="Interior"]');
    await p.page.click('#s-preguntas [data-preg="1"][data-v="2"]');
    await p.page.click('#s-preguntas [data-preg="1"][data-v="3"]');   // cambia de idea
    await p.page.locator('#s-preguntas').scrollIntoViewIfNeeded();
    await p.foto('preguntas-rubro');
    // Cambiar de rubro borra las respuestas del anterior.
    await p.page.selectOption('#s-servicio', 'Cerrajería');
    assert.match(await p.page.locator('#s-preguntas').innerText(), /Una pregunta rápida/);
    await p.page.selectOption('#s-servicio', 'Pintura');
    await p.page.click('#s-preguntas [data-preg="0"][data-v="Interior"]');
    await p.page.click('#s-preguntas [data-preg="1"][data-v="3"]');
    await p.page.fill('#s-nombre', 'Ana'); await p.page.fill('#s-email', 'ana@example.invalid'); await p.page.fill('#s-tel', '1155554444');
    await p.page.selectOption('#s-zona', 'CABA'); await p.page.fill('#s-desc', 'Pintar el living y un cuarto');
    await p.page.click('#s-cuando [data-v="Esta semana"]');
    await p.page.click('#s-enviar');
    await p.page.waitForFunction(() => actual === 'inicio');
    const post = p.calls.find(c => c.method === 'POST' && c.path.endsWith('/rest/v1/solicitudes'));
    assert.equal(post.body.descripcion, 'Pintar el living y un cuarto\n\nQué: Interior · Ambientes: 3');
    assert.equal(post.body.urgencia, 'Esta semana');
    assert.equal(post.body.para_el, null);
  } finally { await p.cerrar(); }
});

const presu = (extra = {}) => ({id: 900, created_at: new Date().toISOString(), match_id: 77, remitente_tipo: 'proveedor', tipo: 'presupuesto',
  contenido: 'Presupuesto: $45.000', monto: 45000, incluye: 'Mano de obra', plazo: 'En el día', estado_presupuesto: 'pendiente', ...extra});
const matchChat = cliente => ({id: 77, estado: 'pendiente',
  proveedores: {nombre: 'Raúl', zona: 'CABA', rubro: 'Pintura', descripcion: '', precio_desde: 1, precio_hasta: 2, disponibilidad: ''},
  solicitudes: {user_id: cliente, nombre_cliente: 'Ana', servicio_necesitado: 'Pintura', zona: 'CABA', presupuesto: null,
    urgencia: 'Esta semana', descripcion: 'Pintar el living'}});

test('negociar: el cliente propone otro precio desde el presupuesto', async () => {
  let contras = [];
  const p = await abrir(entorno, {handler: c => {
    if (c.path.endsWith('/rest/v1/matches')) return {json: [matchChat(cliente)]};
    if (c.path.endsWith('/rest/v1/mensajes')) return {json: [presu()]};
    if (c.path.endsWith('/rest/v1/contraofertas')) return {json: contras};
    if (c.path.endsWith('/rpc/contraoferta_proponer')) {
      contras = [{id: 1, presupuesto_id: 900, match_id: 77, monto: c.body.p_monto, monto_original: 45000, nota: c.body.p_nota, estado: 'propuesta'}];
      return {json: 1};
    }
    return null;
  }});
  try {
    await p.page.evaluate(() => abrirChat(77, 'chats'));
    await p.page.waitForSelector('[data-contra-abrir="900"]');
    await p.page.click('[data-contra-abrir="900"]');
    // Más caro que el presupuesto: no se manda.
    await p.page.fill('[data-contra-monto]', '50000');
    await p.page.click('[data-contra-enviar="900"]');
    assert.match(await p.page.locator('[data-contra-aviso]').innerText(), /menor a \$\s?45\.000/);
    await p.page.fill('[data-contra-monto]', '40000');
    await p.page.fill('[data-contra-nota]', 'La pintura la compro yo');
    await p.foto('contra-form');
    await p.page.click('[data-contra-enviar="900"]');
    await p.page.waitForFunction(() => /Propusiste/.test(document.querySelector('[data-presu="900"]').innerText));
    const post = p.calls.find(c => c.path.endsWith('/rpc/contraoferta_proponer'));
    assert.deepEqual(post.body, {p_presupuesto_id: 900, p_monto: 40000, p_nota: 'La pintura la compro yo'});
    const card = await p.page.locator('[data-presu="900"]').innerText();
    assert.match(card, /Esperando que responda/);
    assert.equal(await p.page.locator('[data-contra-abrir="900"]').count(), 0);
  } finally { await p.cerrar(); }
});

test('negociar: quien cotizó acepta y el trato se cierra a ese precio', async () => {
  let contras = [{id: 1, presupuesto_id: 900, match_id: 77, monto: 40000, monto_original: 45000, nota: 'La pintura la compro yo', estado: 'propuesta'}];
  let msj = presu();
  const p = await abrir(entorno, {rol: 'proveedor', handler: c => {
    if (c.path.endsWith('/rest/v1/matches')) return {json: [matchChat('otro-cliente')]};
    if (c.path.endsWith('/rest/v1/mensajes')) return {json: [msj]};
    if (c.path.endsWith('/rest/v1/contraofertas')) return {json: contras};
    if (c.path.endsWith('/rpc/contraoferta_responder')) {
      contras = [{...contras[0], estado: 'aceptada'}];
      msj = presu({monto: 40000, contenido: 'Presupuesto: $40.000', estado_presupuesto: 'aceptado'});
      return {json: 'aceptada'};
    }
    return null;
  }});
  try {
    await p.page.evaluate(() => abrirChat(77, 'chats'));
    await p.page.waitForSelector('[data-contra-si="1"]');
    const card = await p.page.locator('[data-presu="900"]').innerText();
    assert.match(card, /Te propone \$\s?40\.000/);
    assert.match(card, /La pintura la compro yo/);
    await p.foto('contra-proveedor');
    await p.page.click('[data-contra-si="1"]');
    await p.page.waitForFunction(() => /Precio acordado/.test(document.querySelector('[data-presu="900"]').innerText));
    assert.deepEqual(p.calls.find(c => c.path.endsWith('/rpc/contraoferta_responder')).body, {p_id: 1, p_acepta: true});
    assert.equal(await p.page.getAttribute('[data-presu="900"]', 'data-estado'), 'aceptado');
    assert.match(await p.page.locator('[data-presu="900"] .presu-monto').innerText(), /40\.000/);
  } finally { await p.cerrar(); }
});

test('presupuesto: consejos para que gane, con la guía completa', async () => {
  const p = await abrir(entorno, {rol: 'proveedor', handler: c => c.path.endsWith('/rest/v1/matches') ? {json: [matchChat('otro-cliente')]} : null});
  try {
    await p.page.evaluate(() => abrirChat(77, 'chats'));
    await p.page.waitForFunction(() => actual === 'chat');
    await p.page.click('#ch-presu-abrir');
    await p.page.click('.presu-consejos summary');
    const txt = await p.page.locator('.presu-consejos').innerText();
    assert.match(txt, /Decí qué incluye y qué no/);
    assert.equal(await p.page.getAttribute('.presu-consejos a', 'href'), '/guias/como-armar-un-presupuesto/');
  } finally { await p.cerrar(); }
});

test('reseña en la App Store: se pide al confirmarse el pago, una vez cada 4 meses', async () => {
  const p = await abrir(entorno, {handler: c => {
    if (c.path.endsWith('/rest/v1/matches')) return {json: [matchChat(cliente)]};
    if (c.path.endsWith('/rest/v1/mensajes')) return {json: [presu({estado_presupuesto: 'aceptado'})]};
    return null;
  }});
  try {
    await p.page.evaluate(() => {
      window.__resenas = 0;
      window.Capacitor = {isNativePlatform: () => true, Plugins: {InAppReview: {requestReview: async () => { window.__resenas++; }}}};
      return abrirChat(77, 'chats');
    });
    await p.page.waitForSelector('[data-presu="900"]');
    const pagado = presu({estado_presupuesto: 'aceptado', pago_estado: 'cobrado'});
    await p.page.evaluate(m => actualizarPresu(m), pagado);
    assert.equal(await p.page.evaluate(() => window.__resenas), 1);
    // Otro pago enseguida: no se vuelve a pedir.
    await p.page.evaluate(m => { presusPintados[m.id].pago_estado = null; actualizarPresu(m); }, pagado);
    assert.equal(await p.page.evaluate(() => window.__resenas), 1);
  } finally { await p.cerrar(); }
});

test('Google y Apple: los botones aparecen solo si están prendidos', async () => {
  const p = await abrir(entorno, {rol: null, handler: c => c.path.endsWith('/auth/v1/settings') ? {json: {external: {google: true, apple: false}}} : null});
  try {
    await p.page.waitForSelector('#a-google:not(.oculto)');
    assert.ok(await p.page.locator('#a-apple').isHidden());
    await p.page.locator('#a-sociales').scrollIntoViewIfNeeded();
    await p.foto('sociales');
  } finally { await p.cerrar(); }
});

test('Google: al volver por primera vez completa la cuenta y entra', async () => {
  let put = null;
  const p = await abrir(entorno, {rol: null, handler: c => {
    if (c.path.endsWith('/auth/v1/settings')) return {json: {external: {google: true, apple: true}}};
    if (c.path.endsWith('/auth/v1/token') && c.query.includes('grant_type=pkce')) return {json: {access_token: 'tk', refresh_token: 'rf',
      user: {id: cliente, email: 'ana@example.invalid', app_metadata: {provider: 'google'}, user_metadata: {full_name: 'Ana Pérez'}}}};
    if (c.path.endsWith('/auth/v1/user') && c.method === 'PUT') { put = c.body;
      return {json: {id: cliente, email: 'ana@example.invalid', app_metadata: {provider: 'google'}, user_metadata: {full_name: 'Ana Pérez', ...c.body.data}}}; }
    return null;
  }});
  try {
    await p.page.evaluate(() => localStorage.setItem('tratto_oauth', JSON.stringify({verificador: 'v'.repeat(43), fecha: Date.now(), rol: null})));
    await p.page.goto(entorno.origin + '/?code=abc123&utm_source=prueba');
    await p.page.waitForSelector('#arranque', {state: 'detached'});
    await p.page.waitForSelector('#p-auth.completando');
    assert.ok(!(await p.page.evaluate(() => location.search)).includes('code='));
    const pkce = p.calls.find(c => c.path.endsWith('/auth/v1/token'));
    assert.deepEqual(pkce.body, {auth_code: 'abc123', code_verifier: 'v'.repeat(43)});
    assert.match(await p.page.locator('#a-completar').innerText(), /Entraste como ana@example\.invalid/);
    assert.ok(await p.page.locator('#a-email').isHidden());
    await p.page.click('#rol-cliente');
    assert.equal(await p.page.inputValue('#a-nombre'), 'Ana Pérez');
    await p.page.fill('#a-tel', '11 5555 4444');
    await p.page.click('#a-legales');
    await p.foto('completar');
    await p.page.click('#a-enviar');
    await p.page.waitForFunction(() => actual === 'inicio');
    assert.equal(put.data.rol, 'cliente');
    assert.equal(put.data.telefono, '11 5555 4444');
    assert.equal(put.data.legales_aceptados, true);
    assert.equal(await p.page.evaluate(() => JSON.parse(localStorage.getItem('tratto_oauth'))), null);
  } finally { await p.cerrar(); }
});

test('pagar con Mercado Pago: arma el pago y va a la página de Mercado Pago', async () => {
  const p = await abrir(entorno, {handler: c => {
    if (c.path.endsWith('/rest/v1/matches')) return {json: [matchChat(cliente)]};
    if (c.path.endsWith('/rest/v1/mensajes')) return {json: [presu({estado_presupuesto: 'aceptado', trabajo_estado: 'terminado'})]};
    if (c.path.endsWith('/functions/v1/pago-mp')) return {json: {link: entorno.origin + '/#mercado-pago-simulado'}};
    return null;
  }});
  try {
    await p.page.evaluate(() => abrirChat(77, 'chats'));
    await p.page.waitForSelector('[data-pagar-mp="900"]');
    assert.ok(await p.page.locator('[data-pagar-presu="900"]').isVisible());
    assert.match(await p.page.locator('[data-presu="900"]').innerText(), /dinero de tu cuenta/);
    await p.page.locator('[data-pagar-mp="900"]').scrollIntoViewIfNeeded();
    await p.foto('pagar-mp');
    await p.page.click('[data-pagar-mp="900"]');
    await p.page.waitForFunction(() => location.hash === '#mercado-pago-simulado');
    const llamada = p.calls.find(c => c.path.endsWith('/functions/v1/pago-mp'));
    assert.deepEqual(llamada.body, {accion: 'preferencia', presupuesto_id: 900});
    assert.deepEqual(await p.page.evaluate(() => { const g = JSON.parse(localStorage.getItem('tratto_pago_mp')); return [g.id, g.match_id]; }), [900, 77]);
  } finally { await p.cerrar(); }
});

test('pagar con Mercado Pago: al volver confirma el pago y abre el chat con el resultado', async () => {
  let pagado = false;
  const p = await abrir(entorno, {rol: null, handler: c => {
    if (c.path.endsWith('/auth/v1/user')) return {json: {id: cliente, email: 'ana@example.invalid', app_metadata: {provider: 'email'},
      user_metadata: {rol: 'cliente', nombre: 'Ana', legales_aceptados: true}}};
    if (c.path.endsWith('/functions/v1/pago-mp')) { pagado = true; return {json: {estado: 'cobrado'}}; }
    if (c.path.endsWith('/rest/v1/matches') && c.query.includes('id=eq.77')) return {json: [matchChat(cliente)]};
    if (c.path.endsWith('/rest/v1/mensajes')) return {json: [presu({estado_presupuesto: 'aceptado', trabajo_estado: 'terminado', pago_estado: pagado ? 'cobrado' : null})]};
    return null;
  }});
  try {
    await p.page.evaluate(() => {
      localStorage.setItem('mkt_sesion', JSON.stringify({access_token: 'tk', refresh_token: 'rf', modo: 'cliente'}));
      localStorage.setItem('tratto_pago_mp', JSON.stringify({id: 900, match_id: 77, fecha: Date.now()}));
    });
    await p.page.goto(entorno.origin + '/?pago_mp=900&payment_id=777&status=approved&external_reference=presu-900');
    await p.page.waitForSelector('#arranque', {state: 'detached'});
    await p.page.waitForFunction(() => actual === 'chat' && /el pago salió/.test(document.querySelector('#ch-aviso').innerText));
    assert.ok(!(await p.page.evaluate(() => location.search)).includes('payment_id'));
    const v = p.calls.find(c => c.path.endsWith('/functions/v1/pago-mp'));
    assert.deepEqual(v.body, {accion: 'verificar', presupuesto_id: 900, pago_id: '777'});
    await p.page.waitForFunction(() => /Pago hecho/i.test(document.querySelector('[data-presu="900"]').innerText));
  } finally { await p.cerrar(); }
});

test('referidos: el link de invitación se anota al entrar y el perfil muestra el propio', async () => {
  const p = await abrir(entorno, {rol: null, ruta: '/?ref=abcd1234&utm_source=prueba', handler: c => {
    if (c.path.endsWith('/rpc/referido_registrar')) return {json: true};
    if (c.path.endsWith('/rpc/referidos_mi_codigo')) return {json: 'zz99yy88'};
    if (c.path.endsWith('/rpc/referidos_resumen')) return {json: [{invitados: 2, con_trabajo: 1}]};
    return null;
  }});
  try {
    assert.ok(!(await p.page.evaluate(() => location.search)).includes('ref='));
    assert.equal(await p.page.evaluate(() => JSON.parse(localStorage.getItem('tratto_ref')).codigo), 'abcd1234');
    await p.page.evaluate(c => {
      sesion = {access_token: 't', user: {id: c, email: 'x@example.invalid', created_at: new Date().toISOString(),
        app_metadata: {provider: 'email'}, user_metadata: {rol: 'cliente', nombre: 'Ana', legales_aceptados: true}}};
      modo = 'cliente'; entrarApp();
    }, cliente);
    await p.page.waitForSelector('#invitar-item:not(.oculto)', {state: 'attached'});
    const reg = p.calls.find(c => c.path.endsWith('/rpc/referido_registrar'));
    assert.deepEqual(reg.body, {p_codigo: 'abcd1234'});
    assert.equal(await p.page.evaluate(() => localStorage.getItem('tratto_ref')), null);
    assert.match(await p.page.locator('#invitar-txt').textContent(), /Se anotaron 2 personas con tu link; 1 ya hizo su primer trabajo/);
    assert.equal(await p.page.evaluate(() => miLinkInvitar), 'https://www.trattoapp.com.ar/?ref=zz99yy88');
  } finally { await p.cerrar(); }
});
