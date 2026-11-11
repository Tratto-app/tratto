// El resto de la app: lectura de datos, acceso del dueño, link de pago, carga
// masiva, cuotas que se repiten, mail de la mañana y límites del plan gratis.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { BASES, crear, enAR } from './ayuda.mjs';
import * as L from '../src/logica.js';
import { leerXlsx } from '../src/xlsx.js';
import { sha256 } from '../src/servicios.js';
import { TANDA } from '../src/nucleo.js';

test('celulares: se llevan al formato de WhatsApp o se rechazan', () => {
  const casos = [
    ['11 5555-4444', '', '5491155554444'], ['011 15-5555-4444', '', '5491155554444'], ['+54 9 11 5555 4444', '', '5491155554444'],
    ['54 11 5555-4444', '', '5491155554444'], ['0351 15 555 4444', '', '5493515554444'], ['15 5555 4444', '11', '5491155554444'],
    ['5555-4444', '11', '5491155554444'], ['5555-4444', '', ''], ['hola', '', ''], ['', '11', ''], ['02302 15 44 3322', '', '5492302443322'],
  ];
  for (const [entrada, area, esperado] of casos) assert.equal(L.normalizarTelefono(entrada, area), esperado, `${entrada} (área ${area || '-'})`);
});

test('montos y fechas escritos como los escribe la gente', () => {
  for (const [t, c] of [['$ 15.000', 1500000], ['15000', 1500000], ['15.000,50', 1500050], ['15,5', 1550], ['1.250.000', 125000000], ['82500.5', 8250050], ['15,000.50', 1500050], [15000, 1500000]]) {
    assert.equal(L.parsearMonto(t), c, String(t));
  }
  for (const t of ['', 'gratis', '-500', '0']) assert.equal(L.parsearMonto(t), null, t);
  for (const [t, f] of [['10/3', '2026-03-10'], ['10/03/2026', '2026-03-10'], ['10-3-26', '2026-03-10'], ['2026-03-10', '2026-03-10'], ['46091', '2026-03-10']]) {
    assert.equal(L.parsearFecha(t, '2026-03-01'), f, t);
  }
  for (const t of ['31/02/2026', 'mañana', '']) assert.equal(L.parsearFecha(t, '2026-03-01'), null, t);
  assert.equal(L.formatearMonto(1500050), '$ 15.000,50');
  assert.equal(L.formatearMonto(125000000), '$ 1.250.000');
});

test('BAJA: solo los pedidos claros', () => {
  for (const t of ['BAJA', 'baja', ' Baja. ', 'baja por favor', 'dar de baja', 'quiero darme de baja', '¡BAJA!']) assert.equal(L.esBaja(t), true, t);
  for (const t of ['bajá el precio', 'baja el precio', 'trabajaba', 'ok', 'no me des de baja la cuenta', '']) assert.equal(L.esBaja(t), false, t);
});

test('una lista pegada se convierte en deudas, con o sin títulos', () => {
  const conTitulos = L.leerFilas(L.partirTexto('Cliente\tWhatsApp\tDetalle\tImporte\tVence\nAna Gómez\t11 5555-4444\tCuota marzo\t$ 15.000\t10/3\nLuis\t\tArreglo\tgratis\t20/3'), { hoy: '2026-03-01' });
  assert.deepEqual(conTitulos[0].datos, { nombre: 'Ana Gómez', telefono: '5491155554444', concepto: 'Cuota marzo', monto: 1500000, vence: '2026-03-10', repite: 'unico', mail: '' });
  assert.equal(conTitulos[0].errores.length, 0);
  assert.match(conTitulos[1].errores[0], /Monto/);
  assert.match(conTitulos[1].avisos[0], /Sin celular/);
  const sinTitulos = L.leerFilas(L.partirTexto('Ana; 5555-4444; Cuota; "15.000,50"; 10/03/2026; mensual; ana@mail.com'), { hoy: '2026-03-01', area: '11' });
  assert.deepEqual(sinTitulos[0].datos, { nombre: 'Ana', telefono: '5491155554444', concepto: 'Cuota', monto: 1500050, vence: '2026-03-10', repite: 'mensual', mail: 'ana@mail.com' });
});

test('una planilla de Excel se lee sin librerías', async () => {
  const buf = await readFile(new URL('./ejemplo.xlsx', import.meta.url));
  const filas = await leerXlsx(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
  assert.deepEqual(filas[0], ['Nombre', 'Celular', 'Concepto', 'Monto', 'Vencimiento', 'Repite']);
  const deudas = L.leerFilas(filas, { hoy: '2026-03-01' });
  assert.deepEqual(deudas[0].datos, { nombre: 'Ana Gómez', telefono: '5491155554444', concepto: 'Cuota marzo', monto: 1500000, vence: '2026-03-10', repite: 'mensual', mail: '' });
  assert.equal(deudas[1].datos.nombre, 'Luis & Hnos <SRL>');
  assert.equal(deudas[1].datos.telefono, '5491144443333');
  assert.equal(deudas[1].datos.monto, 8250050);
  assert.equal(deudas[1].datos.vence, '2026-03-20');
  await assert.rejects(leerXlsx(new TextEncoder().encode('no soy un excel').buffer), /planilla/);
});

test('las cuotas mensuales respetan el día y el nombre del mes', () => {
  assert.equal(L.siguienteVencimiento('2026-01-31', 'mensual', 31), '2026-02-28');
  assert.equal(L.siguienteVencimiento('2026-02-28', 'mensual', 31), '2026-03-31');
  assert.equal(L.siguienteVencimiento('2026-12-10', 'mensual', 10), '2027-01-10');
  assert.equal(L.siguienteVencimiento('2026-03-10', 'semanal'), '2026-03-17');
  assert.equal(L.conceptoSiguiente('Cuota Marzo', '2026-03-10', '2026-04-10'), 'Cuota Abril');
  assert.equal(L.conceptoSiguiente('Pilates', '2026-03-10', '2026-04-10'), 'Pilates');
});

test('el mensaje de un toque lleva el nombre, el monto y el link', () => {
  const deuda = { concepto: 'la cuota de marzo', monto: 1500000, vence: '2026-03-10' };
  const t = L.textoAviso('previo', deuda, { nombre: 'ana gómez' }, 'https://x.test/p/abc');
  assert.equal(t, 'Hola Ana, te recordamos que el 10 de marzo vence tu pago de $ 15.000 por la cuota de marzo. Lo podés pagar acá: https://x.test/p/abc');
  for (const etapa of L.ETAPAS) {
    assert.ok(L.textoAviso(etapa, deuda, { nombre: 'Ana' }, 'https://x.test/p/abc').includes('https://x.test/p/abc'));
    const variables = L.variablesPlantilla(etapa, deuda, { nombre: 'Ana' });
    assert.equal(variables.length, (L.CUERPO_PLANTILLA[etapa].match(/\{\{\d\}\}/g) || []).length, `variables de ${etapa}`);
    assert.equal(variables.length, L.EJEMPLO_PLANTILLA[etapa].length);
    assert.ok(!/\{\{\d\}\}[.!?]?$/.test(L.CUERPO_PLANTILLA[etapa]), 'Meta rechaza los textos que terminan en una variable');
  }
  assert.ok(L.PIE_PLANTILLA.length <= 60 && L.BOTON_PLANTILLA.length <= 25);
});

for (const base of BASES) {
  const t = (nombre, fn) => test(`[${base}] ${nombre}`, fn);

  t('sin entrar no se ve nada; la instalación pide la clave y el acceso frena los intentos', async () => {
    const c = crear(base, { demo: false, env: { CLAVE_INSTALACION: 'clave-de-fabrica' } });
    assert.equal((await c.pedir('GET', '/api/estado')).datos.instalada, false);
    for (const ruta of ['/api/panel', '/api/clientes', '/api/config', '/api/avisos']) assert.equal((await c.pedir('GET', ruta)).estado, 401, ruta);
    assert.equal((await c.pedir('POST', '/api/deudas', { concepto: 'x' })).estado, 401);
    const datos = { usuario: 'Dueña', sal: 'a'.repeat(32), derivada: 'b'.repeat(64), nombre: 'Estudio Sur' };
    assert.equal((await c.pedir('POST', '/api/instalar', { ...datos, clave_instalacion: 'otra' })).estado, 403);
    const alta = await c.pedir('POST', '/api/instalar', { ...datos, clave_instalacion: 'clave-de-fabrica' });
    assert.equal(alta.estado, 200);
    const galleta = alta.cabeceras.get('set-cookie');
    assert.match(galleta, /HttpOnly; Secure; SameSite=Strict/);
    const sesion = { Cookie: galleta.split(';')[0] };
    assert.equal((await c.pedir('GET', '/api/panel', undefined, sesion)).estado, 200);
    assert.equal((await c.pedir('POST', '/api/instalar', { ...datos, clave_instalacion: 'clave-de-fabrica' })).estado, 409, 'no se puede instalar dos veces');
    assert.equal((await c.pedir('POST', '/api/config', { nombre: 'X' }, { ...sesion, 'X-Cobranza': '' })).estado, 403, 'sin la cabecera propia se rechaza');
    const cfg = await c.repo.config();
    assert.equal(cfg.clave_hash, await sha256('b'.repeat(64)), 'se guarda un resumen, nunca la contraseña');
    assert.ok(!JSON.stringify((await c.pedir('GET', '/api/config', undefined, sesion)).datos).includes('clave'), 'las claves no viajan al navegador');
    // Entrar
    assert.equal((await c.pedir('POST', '/api/entrar', { usuario: 'dueña', derivada: 'b'.repeat(64) })).estado, 200);
    for (let i = 0; i < 5; i++) assert.equal((await c.pedir('POST', '/api/entrar', { usuario: 'dueña', derivada: 'c'.repeat(64) })).estado, 401);
    assert.equal((await c.pedir('POST', '/api/entrar', { usuario: 'dueña', derivada: 'b'.repeat(64) })).estado, 429, 'después de 5 errores se bloquea 15 minutos');
    c.poner(enAR('2026-03-10', '10:16'));
    assert.equal((await c.pedir('POST', '/api/entrar', { usuario: 'dueña', derivada: 'b'.repeat(64) })).estado, 200);
    // Salir y vencimiento de la sesión
    assert.equal((await c.pedir('POST', '/api/salir', {}, sesion)).estado, 200);
    assert.equal((await c.pedir('GET', '/api/panel', undefined, sesion)).estado, 401);
  });

  t('el link de pago muestra el monto, arma el cobro una sola vez y registra el pago al volver', async () => {
    const c = crear(base);
    const { id } = await c.deuda({ nombre: 'Ana <b>Gómez</b>', concepto: 'la cuota de marzo', monto: '15.000' });
    const [deuda] = await c.repo.filas('deudas', { id });
    const pagina = await c.pedir('GET', `/p/${deuda.token}`);
    assert.equal(pagina.estado, 200);
    assert.match(pagina.datos, /\$ 15\.000/);
    assert.match(pagina.datos, /Hola Ana/);
    assert.ok(!pagina.datos.includes('<b>'), 'los datos del cliente van escapados');
    assert.equal(c.red.preferencias.length, 0, 'abrir el link no crea nada en Mercado Pago');
    const ir = await c.pedir('GET', `/p/${deuda.token}/pagar`);
    assert.equal(ir.estado, 302);
    assert.equal(ir.cabeceras.get('location'), 'https://mp.test/pagar/pref1');
    await c.pedir('GET', `/p/${deuda.token}/pagar`);
    assert.equal(c.red.preferencias.length, 1, 'el cobro se arma una sola vez');
    assert.equal(c.red.preferencias[0].items[0].unit_price, 15000);
    assert.equal(c.red.preferencias[0].notification_url, 'https://app.test/webhook/mp');
    c.red.pagos.set('777', { id: 777, status: 'approved', external_reference: deuda.token, transaction_amount: 15000 });
    const vuelta = await c.pedir('GET', `/p/${deuda.token}?payment_id=777&status=approved`);
    assert.match(vuelta.datos, /Gracias/);
    assert.equal((await c.repo.fila('deudas', id)).estado, 'pagada');
    assert.equal((await c.pedir('GET', '/p/no-existe')).estado, 404);
    assert.equal((await c.pedir('GET', '/api/panel')).datos.resumen.entro, 1500000);
  });

  t('sin Mercado Pago el link muestra los datos para transferir', async () => {
    const c = crear(base, { env: { MP_ACCESS_TOKEN: '' } });
    await c.pedir('POST', '/api/config', { datos_transferencia: 'Alias: estudio.sur.mp' });
    const { id } = await c.deuda();
    const [deuda] = await c.repo.filas('deudas', { id });
    const pagina = await c.pedir('GET', `/p/${deuda.token}`);
    assert.match(pagina.datos, /estudio\.sur\.mp/);
    assert.ok(!pagina.datos.includes('Mercado Pago'));
    await c.pedir('PATCH', `/api/deudas/${id}`, { accion: 'anular' });
    assert.equal((await c.pedir('GET', `/p/${deuda.token}`)).estado, 404, 'una deuda anulada deja de mostrarse');
  });

  t('la carga masiva crea clientes y deudas y avisa qué fila falló', async () => {
    const c = crear(base);
    const r = await c.pedir('POST', '/api/importar', { filas: [
      { nombre: 'Ana', telefono: '11 5555-4444', concepto: 'Cuota marzo', monto_centavos: 1500000, vence: '2026-03-10', repite: 'mensual', acepta: true },
      { nombre: 'Ana', telefono: '11 5555-4444', concepto: 'Matrícula', monto_centavos: 500000, vence: '2026-03-05', acepta: true },
      { nombre: '', concepto: 'Sin nombre', monto_centavos: 100, vence: '2026-03-10' },
    ] });
    assert.deepEqual(r.datos, { creadas: 2, errores: [{ indice: 2, error: 'Falta el nombre del cliente.' }] });
    assert.equal((await c.repo.filas('clientes')).length, 1, 'el mismo celular es el mismo cliente');
    const panel = (await c.pedir('GET', '/api/panel')).datos;
    assert.equal(panel.resumen.falta, 2000000);
    assert.equal(panel.resumen.vencido, 500000);
    assert.deepEqual(panel.deudores.map((d) => d.dias), [5, 0], 'ordenados por días de atraso');
    assert.equal((await c.pedir('POST', '/api/importar', { filas: Array(11).fill({}) })).estado, 400);
  });

  t('una cuota mensual genera la del mes siguiente una semana antes y se puede cortar', async () => {
    const c = crear(base);
    const { id, cliente_id } = await c.deuda({ vence: '2026-03-31', concepto: 'Cuota marzo', repite: 'mensual' });
    c.poner(enAR('2026-04-22'));
    await c.pedir('GET', '/api/panel');
    assert.equal((await c.repo.filas('deudas', { cliente_id })).length, 1, 'todavía falta más de una semana');
    c.poner(enAR('2026-04-23'));
    await c.pedir('GET', '/api/panel');
    await c.pedir('GET', '/api/panel');
    const deudas = await c.repo.filas('deudas', { cliente_id });
    assert.deepEqual(deudas.map((d) => [d.concepto, d.vence]), [['Cuota marzo', '2026-03-31'], ['Cuota abril', '2026-04-30']]);
    await c.pedir('PATCH', `/api/deudas/${deudas[1].id}`, { accion: 'no_repetir' });
    c.poner(enAR('2026-06-30'));
    await c.pedir('GET', '/api/panel');
    assert.equal((await c.repo.filas('deudas', { cliente_id })).length, 2, 'cortada la repetición, no se crean más');
    assert.ok(id);
  });

  t('en modo un toque el dueño recibe un mail a la mañana, una vez y nunca en domingo', async () => {
    const c = crear(base, { env: { RESEND_API_KEY: 're_x' } });
    await c.pedir('POST', '/api/config', { mail_dueno: 'duena@mail.com', nombre: 'Estudio Sur' });
    await c.deuda({ nombre: 'Ana', vence: '2026-03-10' });
    c.poner(enAR('2026-03-10', '08:15'));
    await c.correr();
    assert.equal(c.red.mails.length, 0, 'antes de las 8:30 no');
    c.poner(enAR('2026-03-10', '08:30'));
    await c.correr();
    await c.correr();
    assert.equal(c.red.mails.length, 1);
    assert.deepEqual(c.red.mails[0].to, ['duena@mail.com']);
    assert.match(c.red.mails[0].subject, /1 aviso/);
    assert.equal(c.red.enviados.length, 0, 'en modo un toque no sale nada solo por WhatsApp');
    c.poner(enAR('2026-03-15', '09:00'));
    await c.correr();
    assert.equal(c.red.mails.length, 1, 'domingo: sin mail');
  });

  t('editar la fecha reinicia los avisos y editar el monto rearma el cobro', async () => {
    const c = crear(base);
    const { id } = await c.deuda({ vence: '2026-03-10', monto: '15.000' });
    await c.pedir('POST', '/api/avisos/enviado', { deuda_id: id });
    const [deuda] = await c.repo.filas('deudas', { id });
    await c.pedir('GET', `/p/${deuda.token}/pagar`);
    await c.pedir('PATCH', `/api/deudas/${id}`, { accion: 'editar', vence: '20/03/2026', monto: '18.000' });
    const nueva = await c.repo.fila('deudas', id);
    assert.deepEqual([nueva.vence, nueva.monto, nueva.av_dia, nueva.mp_link], ['2026-03-20', 1800000, null, null]);
  });
}

test('[d1] una tanda completa entra en las 50 consultas por ejecución del plan gratis', async () => {
  const c = crear('d1');
  await c.automatico();
  for (let i = 0; i < TANDA + 3; i++) await c.deuda({ telefono: `11 4000-${String(2000 + i)}` });
  const antes = c.d1.consultas;
  await c.correr();
  const usadas = c.d1.consultas - antes;
  assert.equal(c.red.enviados.length, TANDA);
  assert.ok(usadas < 50, `usó ${usadas} consultas`);
  const panelAntes = c.d1.consultas;
  await c.pedir('GET', '/api/panel');
  assert.ok(c.d1.consultas - panelAntes < 12, `el panel usó ${c.d1.consultas - panelAntes} consultas`);
});
