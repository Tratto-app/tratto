// Las micro apps de nicho: Libreta (saldo y entregas a cuenta), Cuotas al día y
// Combi al día (mensaje sin link, con el nombre del chico), Control al día
// ("te toca volver") y la versión que guarda los datos en el celular.
import test from 'node:test';
import assert from 'node:assert/strict';
import { BASES, crear, enAR } from './ayuda.mjs';
import { RUBROS } from '../src/rubros.js';
import { repoMemoria } from '../src/datos.js';
import * as L from '../src/logica.js';

test('fechas: meses que se suman y ciclo de cobro de la libreta', () => {
  assert.equal(L.sumarMeses('2025-08-31', 6), '2026-02-28');
  assert.equal(L.sumarMeses('2026-03-10', 12), '2027-03-10');
  assert.equal(L.sumarMeses('2026-03-10', -6), '2025-09-10');
  assert.equal(L.inicioDeCiclo('2026-03-10', 5), '2026-03-05');
  assert.equal(L.inicioDeCiclo('2026-03-03', 5), '2026-02-05');
  assert.equal(L.inicioDeCiclo('2026-01-02', 28), '2025-12-28');
  assert.equal(L.proximoControl({ ultima: '2025-09-01', cada: 6 }), '2026-03-01');
  assert.equal(L.proximoControl({ ultima: '2025-09-01', cada: 0 }), null);
  assert.equal(L.proximoControl({ ultima: null, cada: 6 }), null);
});

test('una lista pegada de pacientes se lee con o sin títulos', () => {
  const sin = L.leerPacientes(L.partirTexto('Ana Gómez; 11 5555-4444; 10/09/2025\nLuis; ; '), { hoy: '2026-03-10' });
  assert.deepEqual(sin[0].datos, { nombre: 'Ana Gómez', telefono: '5491155554444', ultima: '2025-09-10' });
  assert.equal(sin[1].avisos.length, 2);
  const con = L.leerPacientes(L.partirTexto('Último control\tPaciente\tCelular\n2025-09-10\tAna\t5555-4444'), { hoy: '2026-03-10', area: '11' });
  assert.deepEqual(con[0].datos, { nombre: 'Ana', telefono: '5491155554444', ultima: '2025-09-10' });
});

test('los datos del celular se guardan y se recuperan iguales', async () => {
  const a = repoMemoria();
  const id = await a.insertar('clientes', { nombre: 'Ana', telefono: '5491155554444', creado: 'x' });
  await a.insertar('deudas', { cliente_id: id, concepto: 'cuota', monto: 100, vence: '2026-03-10', token: 't', creado: 'x' });
  await a.guardarConfig({ nombre: 'Mi estudio' });
  const b = repoMemoria(JSON.parse(JSON.stringify(a.exportar())));
  assert.deepEqual(await b.filas('clientes'), await a.filas('clientes'));
  assert.deepEqual(await b.filas('deudas'), await a.filas('deudas'));
  assert.equal((await b.config()).nombre, 'Mi estudio');
  assert.equal(await b.insertar('clientes', { nombre: 'Otro', creado: 'x' }), id + 1, 'los números siguen donde habían quedado');
  await b.actualizar('clientes', id, { nombre: 'Cambiada' });
  assert.equal((await a.fila('clientes', id)).nombre, 'Ana', 'la copia no toca el original');
});

for (const base of BASES) {
  const t = (nombre, fn) => test(`[${base}] ${nombre}`, fn);
  const local = (rubro) => crear(base, { demo: false, local: true, rubro: RUBROS[rubro] });

  t('la versión del celular funciona sin usuario ni servidor', async () => {
    const c = local('cuotas');
    const estado = (await c.pedir('GET', '/api/estado')).datos;
    assert.deepEqual([estado.instalada, estado.sesion, estado.local, estado.rubro, estado.demo], [true, true, true, 'cuotas', false]);
    assert.equal((await c.pedir('GET', '/api/panel', undefined, { 'X-Cobranza': '' })).estado, 200);
    assert.equal((await c.pedir('POST', '/api/config', { nombre: 'Estudio Giro' }, { 'X-Cobranza': '' })).estado, 200);
  });

  t('Cuotas al día: el mensaje nombra al chico, lleva el alias y no lleva link', async () => {
    const c = local('cuotas');
    await c.pedir('POST', '/api/config', { datos_transferencia: 'Alias: estudio.giro' });
    const r = await c.pedir('POST', '/api/deudas', { concepto: 'la cuota de marzo', monto: '28.000', vence: '2026-03-10', repite: 'mensual',
      cliente: { nombre: 'laura méndez', telefono: '11 5555-0001', nota: 'Sofi', grupo: 'Danza jazz', acepta: true } });
    assert.equal(r.estado, 200);
    const [aviso] = (await c.pedir('GET', '/api/avisos')).datos.lista;
    assert.equal(aviso.texto, 'Hola Laura, hoy vence tu pago de $ 28.000 por la cuota de marzo de Sofi. Para transferir: Alias: estudio.giro');
    assert.ok(!aviso.texto.includes('/p/'));
    assert.equal(aviso.detalle, 'la cuota de marzo · $ 28.000');
    const [cliente] = (await c.pedir('GET', '/api/clientes')).datos.clientes;
    assert.deepEqual([cliente.grupo, cliente.nota], ['Danza jazz', 'Sofi']);
    assert.equal((await c.pedir('POST', '/api/avisos/enviado', { deuda_id: aviso.deuda_id, cliente_id: aviso.cliente_id, etapa: aviso.etapa })).estado, 200);
    assert.equal((await c.pedir('GET', '/api/avisos')).datos.lista.length, 0);
  });

  t('entrega a cuenta: paga lo más viejo primero y deja anotado lo que falta', async () => {
    const c = local('cuotas');
    const a = await c.deuda({ nombre: 'Ana', concepto: 'la cuota de febrero', monto: '10.000', vence: '2026-02-10' });
    await c.deuda({ cliente_id: a.cliente_id, concepto: 'la cuota de marzo', monto: '10.000', vence: '2026-03-10' });
    assert.equal((await c.pedir('POST', `/api/clientes/${a.cliente_id}/pago`, { monto: '25.000' })).estado, 400, 'no puede pagar más de lo que debe');
    assert.deepEqual((await c.pedir('POST', `/api/clientes/${a.cliente_id}/pago`, { monto: '13.000', medio: 'transferencia' })).datos, { ok: true, saldo: 700000 });
    const deudas = await c.repo.filas('deudas', { cliente_id: a.cliente_id }, { orden: 'id asc' });
    assert.deepEqual(deudas.map((d) => [d.concepto, d.monto, d.estado]), [
      ['la cuota de febrero', 1000000, 'pagada'], ['la cuota de marzo', 700000, 'pendiente'], ['la cuota de marzo (entrega)', 300000, 'pagada'],
    ]);
    const panel = (await c.pedir('GET', '/api/panel')).datos;
    assert.deepEqual([panel.resumen.entro, panel.resumen.falta], [1300000, 700000]);
  });

  t('Libreta: se reclama el saldo desde el día de cobro, una vez por semana y hasta tres veces', async () => {
    const c = local('libreta');
    await c.pedir('POST', '/api/config', { dia_cobro: 5, datos_transferencia: 'Alias: don.luis' });
    const marta = await c.deuda({ nombre: 'Marta', concepto: 'pan y leche', monto: '4.200', vence: '2026-03-01' });
    await c.deuda({ cliente_id: marta.cliente_id, concepto: 'compra', monto: '1.000', vence: '2026-03-08' });
    await c.deuda({ nombre: 'Carlos', concepto: 'yerba', monto: '2.800', vence: '2026-03-08' });   // anotó después del día de cobro
    const avisos = (await c.pedir('GET', '/api/avisos')).datos;
    assert.equal(avisos.lista.length, 1, 'solo Marta: Carlos anotó después del día de cobro');
    assert.equal(avisos.lista[0].texto, 'Hola Marta, ¿cómo va? Te paso lo que tenés anotado: $ 5.200. Cuando puedas, pasá a arreglarlo. Para transferir: Alias: don.luis');
    assert.equal(avisos.lista[0].etapa, 'saldo');
    const panel = (await c.pedir('GET', '/api/panel')).datos;
    assert.deepEqual(panel.por_cliente.map((x) => [x.cliente, x.saldo, x.cantidad]), [['Marta', 520000, 2], ['Carlos', 280000, 1]]);
    assert.equal(panel.avisos.pendientes, 1);
    const enviar = () => c.pedir('POST', '/api/avisos/enviado', { cliente_id: marta.cliente_id, etapa: 'saldo' });
    assert.equal((await enviar()).estado, 200);
    assert.equal((await enviar()).estado, 409, 'no dos veces el mismo día');
    const salio = [];
    for (const dia of ['2026-03-11', '2026-03-16', '2026-03-17', '2026-03-23', '2026-03-24', '2026-03-31', '2026-04-04', '2026-04-06']) {
      c.poner(enAR(dia));
      if ((await c.pedir('GET', '/api/avisos')).datos.lista.some((x) => x.cliente_id === marta.cliente_id)) { salio.push(dia); assert.equal((await enviar()).estado, 200); }
    }
    assert.deepEqual(salio, ['2026-03-17', '2026-03-24', '2026-04-06'], 'una por semana, tres por mes, y de nuevo el mes siguiente');
    await c.pedir('POST', `/api/clientes/${marta.cliente_id}/pago`, { monto: '5.200' });
    c.poner(enAR('2026-04-14'));
    assert.ok(!(await c.pedir('GET', '/api/avisos')).datos.lista.some((x) => x.cliente_id === marta.cliente_id), 'pagó todo: no se le reclama más');
  });

  t('Control al día: avisa cuando toca volver, insiste cada 14 días y hasta 3 veces', async () => {
    const c = local('control');
    await c.pedir('POST', '/api/config', { nombre: 'Consultorio Dra. Acosta' });
    const ana = (await c.pedir('POST', '/api/clientes', { nombre: 'Ana Gómez', telefono: '11 5555-0001', acepta: true, ultima: '2025-09-01', cada: 6 })).datos.id;
    await c.pedir('POST', '/api/clientes', { nombre: 'Pedro', telefono: '11 5555-0002', acepta: true, ultima: '2026-01-15', cada: 6 });   // le toca en julio
    await c.pedir('POST', '/api/clientes', { nombre: 'Sin permiso', telefono: '11 5555-0003', acepta: false, ultima: '2025-06-01', cada: 6 });
    let avisos = (await c.pedir('GET', '/api/avisos')).datos.lista;
    assert.deepEqual(avisos.map((x) => [x.cliente, x.etapa]), [['Ana Gómez', 'control']]);
    assert.equal(avisos[0].texto, 'Hola Ana, te escribimos de Consultorio Dra. Acosta. Ya pasaron 6 meses de tu último control y te toca el próximo. ¿Querés que te reservemos un turno?');
    const panel = (await c.pedir('GET', '/api/panel')).datos;
    assert.deepEqual(panel.vuelta.map((x) => [x.cliente, x.toca, x.dias]), [['Sin permiso', '2025-12-01', 99], ['Ana Gómez', '2026-03-01', 9]]);
    const enviar = () => c.pedir('POST', '/api/avisos/enviado', { cliente_id: ana, etapa: 'control' });
    assert.equal((await enviar()).estado, 200);
    assert.equal((await enviar()).estado, 409);
    const salio = [];
    for (const dia of ['2026-03-11', '2026-03-23', '2026-03-24', '2026-04-06', '2026-04-07', '2026-04-21', '2026-05-20']) {
      c.poner(enAR(dia));
      const hay = (await c.pedir('GET', '/api/avisos')).datos.lista.find((x) => x.cliente_id === ana);
      if (hay) { salio.push(dia); if (salio.length === 1) assert.match(hay.texto, /de nuevo/); assert.equal((await enviar()).estado, 200); }
    }
    assert.deepEqual(salio, ['2026-03-24', '2026-04-07'], 'tres avisos en total y después no se insiste');
    // Vino: el control vuelve a contar desde hoy.
    await c.pedir('PATCH', `/api/clientes/${ana}`, { ultima: '2026-05-20', cada: 6 });
    const ficha = (await c.pedir('GET', `/api/clientes/${ana}`)).datos;
    assert.deepEqual([ficha.toca, ficha.cliente.av_control], ['2026-11-20', 0]);
    c.poner(enAR('2026-11-20'));
    assert.ok((await c.pedir('GET', '/api/avisos')).datos.lista.some((x) => x.cliente_id === ana), 'a los 6 meses vuelve a avisar');
  });

  t('Control al día: si el mismo día hay cuota y control, sale uno solo', async () => {
    const c = local('control');
    const r = await c.pedir('POST', '/api/deudas', { concepto: 'la cuota de ortodoncia de marzo', monto: '45.000', vence: '2026-03-10', repite: 'mensual',
      cliente: { nombre: 'Mora Díaz', telefono: '11 5555-0009', acepta: true, ultima: '2025-12-01', cada: 3 } });
    const hoy = (await c.pedir('GET', '/api/avisos')).datos.lista;
    assert.deepEqual(hoy.map((x) => x.etapa), ['dia'], 'primero la cuota');
    await c.pedir('POST', '/api/avisos/enviado', { deuda_id: hoy[0].deuda_id, cliente_id: hoy[0].cliente_id, etapa: 'dia' });
    assert.equal((await c.pedir('GET', '/api/avisos')).datos.lista.length, 0);
    c.poner(enAR('2026-03-11'));
    assert.deepEqual((await c.pedir('GET', '/api/avisos')).datos.lista.map((x) => x.etapa), ['control'], 'al día siguiente, el control');
    assert.ok(r.datos.id);
  });
}
