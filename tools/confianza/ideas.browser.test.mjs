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
