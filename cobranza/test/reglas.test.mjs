// Las cuatro reglas que no se pueden romper, probadas en modo automático con
// WhatsApp simulado, sobre las dos bases (memoria y SQLite como la de Cloudflare):
//   1. Al pagar se cortan los mensajes.
//   2. Nadie recibe dos mensajes el mismo día.
//   3. No sale nada fuera de horario (lunes a sábado, 9 a 20).
//   4. "BAJA" funciona.
import test from 'node:test';
import assert from 'node:assert/strict';
import { BASES, crear, enAR } from './ayuda.mjs';
import { hmac } from '../src/servicios.js';
import { TANDA } from '../src/nucleo.js';

for (const base of BASES) {
  const t = (nombre, fn) => test(`[${base}] ${nombre}`, fn);

  // ── 1. Al pagar se cortan los mensajes ───────────────────────────────────
  t('1 · una deuda pagada a mano no recibe más avisos', async () => {
    const c = crear(base);
    await c.automatico();
    const { id } = await c.deuda({ vence: '2026-03-13' });
    await c.correr();                                   // 10/03: aviso previo
    assert.equal(c.red.enviados.length, 1);
    assert.equal(c.red.enviados[0].template.name, 'recordatorio_previo');
    assert.equal((await c.pedir('PATCH', `/api/deudas/${id}`, { accion: 'pagar', medio: 'efectivo' })).estado, 200);
    for (const dia of ['2026-03-13', '2026-03-16', '2026-03-20', '2026-03-27']) {
      c.poner(enAR(dia));
      await c.correr();
    }
    assert.equal(c.red.enviados.length, 1, 'después del pago no salió nada más');
  });

  t('1 · el pago por Mercado Pago corta los avisos solo', async () => {
    const c = crear(base, { env: { MP_WEBHOOK_SECRET: 'secreto-mp' } });
    await c.automatico();
    const { id } = await c.deuda({ vence: '2026-03-10', monto: '15.000' });
    const [deuda] = await c.repo.filas('deudas', { id });
    await c.correr();
    assert.equal(c.red.enviados.length, 1);
    c.red.pagos.set('9001', { id: 9001, status: 'approved', external_reference: deuda.token, transaction_amount: 15000 });
    const firma = await hmac('secreto-mp', 'id:9001;request-id:req-1;ts:1700000000;');
    const r = await c.pedir('POST', '/webhook/mp?data.id=9001&type=payment', { type: 'payment', data: { id: '9001' } },
      { 'x-signature': `ts=1700000000,v1=${firma}`, 'x-request-id': 'req-1' });
    assert.equal(r.estado, 200);
    const [pagada] = await c.repo.filas('deudas', { id });
    assert.equal(pagada.estado, 'pagada');
    assert.equal(pagada.medio, 'mercadopago');
    for (const dia of ['2026-03-13', '2026-03-17', '2026-03-24']) { c.poner(enAR(dia)); await c.correr(); }
    assert.equal(c.red.enviados.length, 1, 'después del pago no salió nada más');
  });

  t('1 · un aviso de pago con firma falsa o monto menor no marca nada', async () => {
    const c = crear(base, { env: { MP_WEBHOOK_SECRET: 'secreto-mp' } });
    const { id } = await c.deuda({ monto: '15.000' });
    const [deuda] = await c.repo.filas('deudas', { id });
    c.red.pagos.set('9002', { id: 9002, status: 'approved', external_reference: deuda.token, transaction_amount: 15000 });
    const falsa = await c.pedir('POST', '/webhook/mp?data.id=9002&type=payment', { type: 'payment', data: { id: '9002' } },
      { 'x-signature': 'ts=1700000000,v1=deadbeef', 'x-request-id': 'req-2' });
    assert.equal(falsa.estado, 401);
    assert.equal((await c.repo.fila('deudas', id)).estado, 'pendiente');
    c.red.pagos.set('9003', { id: 9003, status: 'approved', external_reference: deuda.token, transaction_amount: 100 });
    const firma = await hmac('secreto-mp', 'id:9003;request-id:req-3;ts:1700000000;');
    await c.pedir('POST', '/webhook/mp?data.id=9003&type=payment', { type: 'payment', data: { id: '9003' } },
      { 'x-signature': `ts=1700000000,v1=${firma}`, 'x-request-id': 'req-3' });
    assert.equal((await c.repo.fila('deudas', id)).estado, 'pendiente', 'pagó de menos: sigue pendiente');
  });

  // ── 2. Nadie recibe dos el mismo día ─────────────────────────────────────
  t('2 · un cliente con dos deudas recibe un solo aviso por día', async () => {
    const c = crear(base);
    await c.automatico();
    const a = await c.deuda({ nombre: 'Ana', telefono: '11 5555-0001', vence: '2026-03-10', concepto: 'la cuota de marzo' });
    await c.deuda({ cliente_id: a.cliente_id, vence: '2026-03-09', concepto: 'la matrícula' });
    for (const hora of ['09:00', '09:15', '12:30', '19:45']) { c.poner(enAR('2026-03-10', hora)); await c.correr(); }
    assert.equal(c.red.enviados.length, 1, 'cuatro tandas el mismo día, un solo mensaje');
    assert.equal(c.red.enviados[0].template.components[0].parameters[2].text, 'la matrícula', 'primero la deuda más vieja');
    c.poner(enAR('2026-03-11', '09:00'));
    await c.correr();
    await c.correr();
    assert.equal(c.red.enviados.length, 2, 'al día siguiente sale el de la otra deuda, una sola vez');
    const porDia = new Map();
    for (const m of await c.repo.filas('mensajes')) porDia.set(`${m.cliente_id}|${m.dia}`, (porDia.get(`${m.cliente_id}|${m.dia}`) || 0) + 1);
    assert.ok([...porDia.values()].every((n) => n === 1));
  });

  t('2 · si ya le escribí con un toque, el automático no le manda otro ese día', async () => {
    const c = crear(base);
    const { id } = await c.deuda({ vence: '2026-03-10' });
    assert.equal((await c.pedir('POST', '/api/avisos/enviado', { deuda_id: id })).estado, 200);
    assert.equal((await c.pedir('POST', '/api/avisos/enviado', { deuda_id: id })).estado, 409, 'no se puede marcar dos veces');
    await c.automatico();
    await c.correr();
    assert.equal(c.red.enviados.length, 0);
  });

  // ── 3. Nada fuera de horario ─────────────────────────────────────────────
  t('3 · no sale nada antes de las 9, desde las 20 ni los domingos', async () => {
    const c = crear(base);
    await c.automatico();
    await c.deuda({ vence: '2026-03-10' });
    await c.deuda({ vence: '2026-03-14' });
    await c.deuda({ vence: '2026-03-15' });
    for (const [dia, hora] of [['2026-03-10', '00:10'], ['2026-03-10', '08:59'], ['2026-03-10', '20:00'], ['2026-03-10', '23:59']]) {
      c.poner(enAR(dia, hora));
      const r = await c.correr();
      assert.equal(c.red.enviados.length, 0, `nada a las ${hora}`);
      assert.match(r.envio.motivo, /9 a 20/);
    }
    c.poner(enAR('2026-03-15', '12:00'));               // domingo
    assert.match((await c.correr()).envio.motivo, /domingos/);
    assert.equal(c.red.enviados.length, 0, 'nada el domingo');
    c.poner(enAR('2026-03-16', '09:00'));               // lunes 9:00
    await c.correr();
    assert.equal(c.red.enviados.length, 3, 'el lunes a las 9 salen los que quedaron');
  });

  t('3 · a las 9:00 y a las 19:59 de un sábado sí sale', async () => {
    const c = crear(base);
    await c.automatico();
    await c.deuda({ vence: '2026-03-14' });
    c.poner(enAR('2026-03-14', '19:59'));
    await c.correr();
    assert.equal(c.red.enviados.length, 1);
  });

  t('3 · el modo un toque tampoco deja marcar envíos fuera de horario', async () => {
    const c = crear(base);
    const { id } = await c.deuda({ vence: '2026-03-10' });
    c.poner(enAR('2026-03-10', '21:30'));
    const r = await c.pedir('POST', '/api/avisos/enviado', { deuda_id: id });
    assert.equal(r.estado, 409);
    assert.match(r.datos.error, /9 a 20/);
  });

  // ── 4. BAJA ──────────────────────────────────────────────────────────────
  t('4 · quien responde BAJA no recibe más avisos automáticos', async () => {
    const c = crear(base);
    await c.automatico();
    const { cliente_id } = await c.deuda({ telefono: '11 5555-7777', vence: '2026-03-10' });
    await c.correr();
    assert.equal(c.red.enviados.length, 1);
    assert.equal(c.red.enviados[0].to, '5491155557777');
    assert.equal((await c.escribe('5491155557777', ' Baja. ')).estado, 200);
    assert.equal((await c.repo.fila('clientes', cliente_id)).baja, 1);
    assert.equal(c.red.textos.length, 1, 'se le confirma la baja una vez');
    for (const dia of ['2026-03-13', '2026-03-17', '2026-03-24']) { c.poner(enAR(dia)); await c.correr(); }
    assert.equal(c.red.enviados.length, 1, 'después de BAJA no salió nada más');
    const ficha = await c.pedir('GET', `/api/clientes/${cliente_id}`);
    assert.equal(ficha.datos.respuestas[0].texto, 'Baja.', 'la respuesta queda en la ficha');
    assert.equal(ficha.datos.puede, false);
  });

  t('4 · una respuesta cualquiera no es una baja, y un aviso sin firma se rechaza', async () => {
    const c = crear(base);
    await c.automatico();
    const { cliente_id } = await c.deuda({ telefono: '11 5555-8888', vence: '2026-03-10' });
    await c.escribe('5491155558888', 'Bajá el precio y te pago');
    await c.escribe('5491155558888', 'ya te transferí');
    assert.equal((await c.repo.fila('clientes', cliente_id)).baja, 0);
    const sinFirma = await c.pedir('POST', '/webhook/whatsapp', { entry: [{ changes: [{ value: { messages: [{ id: 'x', from: '5491155558888', type: 'text', text: { body: 'BAJA' } }] } }] }] });
    assert.equal(sinFirma.estado, 401);
    assert.equal((await c.repo.fila('clientes', cliente_id)).baja, 0);
    await c.correr();
    assert.equal(c.red.enviados.length, 1, 'sigue recibiendo avisos');
  });

  // ── El resto de las reglas de envío ──────────────────────────────────────
  t('la secuencia completa es previo, día, vencido, último y después nada', async () => {
    const c = crear(base);
    await c.automatico();
    await c.deuda({ vence: '2026-03-13' });             // viernes
    const dias = ['2026-03-09', '2026-03-10', '2026-03-11', '2026-03-12', '2026-03-13', '2026-03-14', '2026-03-16', '2026-03-17',
      '2026-03-18', '2026-03-19', '2026-03-20', '2026-03-21', '2026-03-23', '2026-03-30', '2026-04-15', '2026-06-01'];
    const salio = [];
    for (const dia of dias) {
      c.poner(enAR(dia));
      const antes = c.red.enviados.length;
      await c.correr();
      if (c.red.enviados.length > antes) salio.push(`${dia} ${c.red.enviados.at(-1).template.name}`);
    }
    assert.deepEqual(salio, [
      '2026-03-10 recordatorio_previo', '2026-03-13 recordatorio_dia', '2026-03-16 recordatorio_vencido', '2026-03-20 recordatorio_ultimo',
    ]);
  });

  t('no se le escribe a quien no aceptó, está en pausa o no tiene celular', async () => {
    const c = crear(base);
    await c.automatico();
    await c.deuda({ nombre: 'Sin permiso', acepta: false });
    const pausa = await c.deuda({ nombre: 'En pausa' });
    await c.pedir('PATCH', `/api/clientes/${pausa.cliente_id}`, { pausado: true });
    await c.deuda({ nombre: 'Sin celular', telefono: '' });
    await c.deuda({ nombre: 'Sí recibe', telefono: '11 5555-9999' });
    await c.correr();
    assert.deepEqual(c.red.enviados.map((m) => m.to), ['5491155559999']);
    const avisos = await c.pedir('GET', '/api/avisos');
    assert.equal(avisos.datos.sin_aviso.length, 3, 'la app le explica al dueño por qué no les escribe');
    await c.pedir('PATCH', `/api/clientes/${pausa.cliente_id}`, { pausado: false });
    await c.correr();
    assert.equal(c.red.enviados.length, 2, 'al sacar la pausa vuelve a recibir');
  });

  t(`salen de a ${TANDA} por tanda y un error de la cuenta frena todo sin quemar avisos`, async () => {
    const c = crear(base);
    await c.automatico();
    for (let i = 0; i < TANDA + 5; i++) await c.deuda({ telefono: `11 4000-${String(1000 + i)}` });
    await c.correr();
    assert.equal(c.red.enviados.length, TANDA);
    c.red.errorWa = { code: 132001, message: 'Template name does not exist in the translation' };
    c.poner(enAR('2026-03-10', '10:15'));
    const r = await c.correr();
    assert.equal(r.envio.enviados, 0);
    assert.match((await c.pedir('GET', '/api/panel')).datos.alerta, /frenó/);
    c.red.errorWa = null;
    c.poner(enAR('2026-03-10', '10:30'));
    await c.correr();
    assert.equal(c.red.enviados.length, TANDA + 5, 'cuando se arregla, salen los que faltaban');
    assert.equal((await c.pedir('GET', '/api/panel')).datos.mensajes_mes.auto, TANDA + 5);
  });

  t('un número que WhatsApp rechaza queda como fallido y no traba a los demás', async () => {
    const c = crear(base);
    await c.automatico();
    const mal = await c.deuda({ nombre: 'Número malo' });
    c.red.errorWa = { code: 131026, message: 'Message undeliverable' };
    await c.correr();
    const ficha = await c.pedir('GET', `/api/clientes/${mal.cliente_id}`);
    assert.equal(ficha.datos.mensajes[0].estado, 'fallido');
    c.red.errorWa = null;
    await c.correr();
    assert.equal(c.red.enviados.length, 0, 'no se reintenta el mismo aviso el mismo día');
  });

  t('Meta avisa que se entregó o falló y queda en el registro', async () => {
    const c = crear(base);
    await c.automatico();
    const { cliente_id } = await c.deuda();
    await c.correr();
    const estado = async (status, extra = {}) => {
      const cuerpo = JSON.stringify({ entry: [{ changes: [{ value: { statuses: [{ id: 'wamid.1', status, ...extra }] } }] }] });
      return c.pedir('POST', '/webhook/whatsapp', cuerpo, { 'x-hub-signature-256': `sha256=${await hmac('secreto-wa', cuerpo)}` });
    };
    await estado('read');
    await estado('delivered');
    assert.equal((await c.pedir('GET', `/api/clientes/${cliente_id}`)).datos.mensajes[0].estado, 'leido', 'un aviso viejo no pisa uno nuevo');
  });
}
