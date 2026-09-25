/**
 * Circuito completo hacia Google Drive.
 *
 * Un cliente reserva por WhatsApp → el turno se guarda en la base → el worker
 * lo escribe en la planilla. Se prueba contra un servidor que hace de Google,
 * así se verifica de verdad (sin credenciales) que la fila llega y con qué datos.
 */
import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// La configuración se lee al importar los módulos: primero el entorno.
const { levantarGoogleFalso } = await import('./google-falso.js');
const google = await levantarGoogleFalso();

process.env.NODE_ENV = 'test';
process.env.GOOGLE_SHEETS_API_URL = google.urlSheets;
process.env.GOOGLE_OAUTH_TOKEN_URL = google.urlToken;
process.env.GOOGLE_SPREADSHEET_ID = 'planilla-de-prueba';
process.env.GOOGLE_CLIENT_ID = 'cliente-falso';
process.env.GOOGLE_CLIENT_SECRET = 'secreto-falso';
process.env.GOOGLE_REFRESH_TOKEN = 'refresh-falso';
process.env.SHEETS_HABILITADO = 'true';

const { crearTurno, cancelarTurno, crearHold, confirmarHold } = await import('../src/booking/servicio.js');
const { procesarMensaje } = await import('../src/conversation/orquestador.js');
const { sincronizarPendientes, resincronizarTodo, reiniciarCacheDeEstructura } = await import('../src/google/sync.js');
const { outboxRepo } = await import('../src/database/repositories/outbox.js');
const { limpiarTurnosViejos } = await import('../src/mantenimiento/tareas.js');
const { contextoDePrueba, SABADO, TELEFONO_A, TELEFONO_B } = await import('./helpers.js');

type Ctx = Awaited<ReturnType<typeof contextoDePrueba>>;

const ENCABEZADOS = [
  'Fecha', 'Día', 'Hora', 'Cliente', 'Servicio', 'Precio', 'Descuento', 'Estado',
  'WhatsApp', 'Hora fin', 'Observaciones', 'Creado', 'Modificado', 'ID',
];
/** Posición de cada columna por su nombre, así los tests no dependen del orden. */
const C = Object.fromEntries(ENCABEZADOS.map((nombre, i) => [nombre, i])) as Record<(typeof ENCABEZADOS)[number], number>;

let ctx: Ctx;

before(() => {
  assert.ok(google.urlSheets.includes('127.0.0.1'), 'el test no debe pegarle a Google de verdad');
});

beforeEach(async () => {
  if (ctx) await ctx.cerrar();
  ctx = await contextoDePrueba();
  google.hojas.clear();
  google.pedidos.length = 0;
  google.fallarProximas = 0;
  google.formatos.length = 0;
  reiniciarCacheDeEstructura();
});

after(async () => {
  await ctx?.cerrar();
  await google.cerrar();
});

/** Fila de la hoja "Turnos" correspondiente a un turno, sin el encabezado. */
function filaDe(id: string): string[] | undefined {
  return google.filas('Turnos').find((f) => f[C.ID] === id);
}

describe('un turno reservado termina en la planilla', () => {
  test('la hoja se crea con los encabezados que pidió el negocio', async () => {
    await crearTurno(ctx, { telefono: TELEFONO_A, nombre: 'Ana', servicioId: 'corte', fecha: SABADO, hora: '17:00', origen: 'whatsapp' });
    await sincronizarPendientes(ctx);

    assert.deepEqual(google.filas('Turnos')[0], ENCABEZADOS);
    for (const hoja of ['Hoy', 'Agenda semanal', 'Turnos', 'Clientes', 'Configuración']) {
      assert.ok(google.hojas.has(hoja), `falta la hoja "${hoja}"`);
    }
  });

  test('la fila trae los datos del turno', async () => {
    const t = await crearTurno(ctx, {
      telefono: TELEFONO_A, nombre: 'Agustín', servicioId: 'corte_barba', fecha: SABADO, hora: '17:30', origen: 'whatsapp',
      observaciones: 'viene con el hermano',
    });
    await sincronizarPendientes(ctx);

    const fila = filaDe(t.id);
    assert.ok(fila, 'el turno no llegó a la planilla');
    assert.equal(fila[C.Fecha], SABADO, 'año-mes-día: ordenada A→Z queda en orden cronológico');
    assert.equal(fila[C.Día], 'Sábado 19/09');
    assert.equal(fila[C.Hora], '17:30');
    assert.equal(fila[C['Hora fin']], '18:45');
    assert.equal(fila[C.Cliente], 'Agustín');
    assert.equal(fila[C.WhatsApp], '+54 9 11 3333-4444', 'el teléfono se lee como teléfono, no como número');
    assert.equal(fila[C.Servicio], 'Corte + Barba');
    assert.equal(fila[C.Precio] as unknown, 12000, 'el precio va como número, para poder sumarlo');
    assert.equal(fila[C.Descuento], '');
    assert.match(fila[C.Estado]!, /reservado/);
    assert.equal(fila[C.Observaciones], 'viene con el hermano');
  });

  test('se escribe tal cual: nada de lo que escribe un cliente se interpreta como fórmula', async () => {
    await crearTurno(ctx, {
      telefono: TELEFONO_A, nombre: 'Ana', servicioId: 'corte', fecha: SABADO, hora: '17:00', origen: 'panel',
      observaciones: '=IMPORTXML("http://malo")',
    });
    await sincronizarPendientes(ctx);
    const escrituras = google.pedidos.filter((p) => p.includes('/values/Turnos') && /valueInputOption=/.test(p));
    assert.ok(escrituras.length > 0);
    for (const p of escrituras) assert.match(p, /valueInputOption=RAW/, `escritura interpretada: ${p}`);
  });

  test('un horario apartado que nadie confirmó no aparece en el archivo', async () => {
    const hold = await crearHold(ctx, { telefono: TELEFONO_A, nombre: 'Ana', servicioId: 'corte', fecha: SABADO, hora: '17:00' });
    await cancelarTurno(ctx, hold.id, { telefono: TELEFONO_A, origen: 'whatsapp', forzar: true, motivo: 'cambio de idea' });
    await sincronizarPendientes(ctx);
    await resincronizarTodo(ctx);
    assert.equal(filaDe(hold.id), undefined, 'un horario soltado no es un turno cancelado');
    const semana = google.filas('Agenda semanal').flat().join(' | ');
    assert.doesNotMatch(semana, /❌/, 'tampoco figura como cancelado en la agenda');
  });

  test('si alguien duplicó una fila a mano, resincronizar deja una sola', async () => {
    const t = await crearTurno(ctx, { telefono: TELEFONO_A, nombre: 'Ana', servicioId: 'corte', fecha: SABADO, hora: '17:00', origen: 'whatsapp' });
    await sincronizarPendientes(ctx);
    google.filas('Turnos').push([...filaDe(t.id)!]);
    assert.equal(google.filas('Turnos').filter((f) => f[C.ID] === t.id).length, 2, 'precondición');
    await resincronizarTodo(ctx);
    assert.equal(google.filas('Turnos').filter((f) => f[C.ID] === t.id).length, 1);
  });

  test('una hoja con las columnas viejas se pasa al orden nuevo sin perder filas', async () => {
    google.hojas.set('Turnos', [
      ['ID', 'Fecha', 'Día', 'Hora', 'Hora fin', 'Cliente', 'WhatsApp', 'Servicio', 'Precio', 'Duración', 'Estado', 'Fecha de creación', 'Última modificación', 'Observaciones'],
      ['TUR-VIEJO1', '2026-08-01', 'sábado', '10:00', '10:45', 'Histórico', '5491100000000', 'Corte', '8000', '45 min', '✔️ completado', '01/08/2026 09:00', '01/08/2026 11:00', ''],
    ]);
    await resincronizarTodo(ctx);
    assert.deepEqual(google.filas('Turnos')[0], ENCABEZADOS);
    const viejo = filaDe('TUR-VIEJO1');
    assert.ok(viejo, 'la fila histórica no se puede perder');
    assert.equal(viejo[C.Cliente], 'Histórico');
    assert.equal(viejo[C.Fecha], '2026-08-01');
    assert.equal(viejo[C.Precio] as unknown, 8000);
    assert.equal(viejo[C.Creado], '01/08/2026 09:00');
  });

  test('un turno sacado por WhatsApp, de punta a punta, aparece solo en la planilla', async () => {
    for (const texto of ['1', 'srv_corte', `dia_${SABADO}`, 'hora_11:00', 'Martín', 'sí']) {
      await procesarMensaje(ctx, { telefono: TELEFONO_A, texto, idExterno: `wa-${texto}`, origen: 'whatsapp' });
    }
    await sincronizarPendientes(ctx);

    const fila = google.filas('Turnos').find((f) => f[C.Cliente] === 'Martín');
    assert.ok(fila, 'el turno reservado por WhatsApp no llegó a Drive');
    assert.equal(fila[C.Hora], '11:00');
    assert.equal(fila[C.Servicio], 'Corte');
    assert.equal(google.filas('Turnos').length, 2, 'una sola fila: el horario apartado antes de confirmar no se escribe aparte');
  });

  test('cancelar actualiza la fila existente en vez de agregar otra', async () => {
    const t = await crearTurno(ctx, { telefono: TELEFONO_A, nombre: 'Ana', servicioId: 'corte', fecha: SABADO, hora: '17:00', origen: 'whatsapp' });
    await sincronizarPendientes(ctx);
    await cancelarTurno(ctx, t.id, { telefono: TELEFONO_A, origen: 'whatsapp' });
    await sincronizarPendientes(ctx);

    const deEseId = google.filas('Turnos').filter((f) => f[C.ID] === t.id);
    assert.equal(deEseId.length, 1, 'quedó duplicada la fila');
    assert.match(deEseId[0]![C.Estado]!, /cancelado/);
  });

  test('las vistas Hoy y Agenda semanal se rehacen con los turnos', async () => {
    await crearTurno(ctx, { telefono: TELEFONO_A, nombre: 'Ana', servicioId: 'corte', fecha: SABADO, hora: '17:00', origen: 'whatsapp' });
    await sincronizarPendientes(ctx);

    const semana = google.filas('Agenda semanal').flat().join(' | ');
    assert.match(semana, /Ana/);
    assert.match(semana, /17:00/);
    assert.match(semana, /Sábado/);

    const clientes = google.filas('Clientes').flat().join(' | ');
    assert.match(clientes, /Ana/);
  });
});

describe('los turnos ya atendidos siguen a la vista', () => {
  test('marcar "vino" no borra el turno de la agenda de la planilla', async () => {
    const { marcarEstadoTurno } = await import('../src/booking/servicio.js');
    const t = await crearTurno(ctx, {
      telefono: TELEFONO_A, nombre: 'Ana', servicioId: 'corte', fecha: SABADO, hora: '17:00', origen: 'whatsapp',
    });
    await marcarEstadoTurno(ctx, t.id, 'completado');
    await sincronizarPendientes(ctx);

    const semana = google.filas('Agenda semanal').flat().join(' | ');
    assert.match(semana, /Ana ✓/, 'el turno atendido tiene que seguir en la agenda, con su marca');
    assert.match(google.filas('Turnos').find((f) => f[C.ID] === t.id)![C.Estado]!, /vino/);
  });

  test('el que no vino también queda anotado', async () => {
    const { marcarEstadoTurno } = await import('../src/booking/servicio.js');
    const t = await crearTurno(ctx, {
      telefono: TELEFONO_B, nombre: 'Beto', servicioId: 'corte', fecha: SABADO, hora: '18:00', origen: 'whatsapp',
    });
    await marcarEstadoTurno(ctx, t.id, 'no_show');
    await sincronizarPendientes(ctx);
    assert.match(google.filas('Agenda semanal').flat().join(' | '), /Beto \(no vino\)/);
  });
});

describe('si Google falla, la reserva no se cae', () => {
  test('el turno se crea igual y el evento queda en la cola', async () => {
    google.fallarProximas = 50; // Google caído
    const t = await crearTurno(ctx, { telefono: TELEFONO_A, nombre: 'Ana', servicioId: 'corte', fecha: SABADO, hora: '17:00', origen: 'whatsapp' });
    assert.equal(t.estado, 'reservado', 'el turno tiene que existir aunque Google esté caído');

    const r = await sincronizarPendientes(ctx);
    assert.equal(r.procesados, 0, 'con Google caído no se puede haber escrito nada');
    assert.ok((await outboxRepo.contar(ctx.db)) > 0, 'el evento no puede perderse');
    assert.equal(google.filas('Turnos').length, 0);
  });

  test('cuando Google vuelve, el turno se escribe sin que nadie haga nada', async () => {
    google.fallarProximas = 50;
    const t = await crearTurno(ctx, { telefono: TELEFONO_A, nombre: 'Ana', servicioId: 'corte', fecha: SABADO, hora: '17:00', origen: 'whatsapp' });
    await sincronizarPendientes(ctx);
    assert.equal(filaDe(t.id), undefined);

    google.fallarProximas = 0;
    // El reintento está agendado con backoff: se adelanta el reloj del contexto.
    const ctxFuturo = { ...ctx, ahora: () => ctx.ahora().plus({ minutes: 10 }) };
    const r = await sincronizarPendientes(ctxFuturo);

    assert.ok(r.procesados >= 1);
    assert.ok(filaDe(t.id), 'al volver Google, el turno tiene que aparecer solo');
    assert.equal(await outboxRepo.contar(ctx.db), 0, 'la cola tiene que quedar vacía');
  });
});

describe('la planilla es el archivo: sobrevive a la limpieza semanal', () => {
  test('un turno viejo se borra de la base pero queda en Drive', async () => {
    // Turno de hace dos semanas (se carga forzado, como lo haría el panel).
    const viejo = await crearTurno(ctx, {
      telefono: TELEFONO_B, nombre: 'Cliente Viejo', servicioId: 'corte', fecha: '2026-09-05', hora: '11:00',
      origen: 'panel', forzar: true,
    });
    const futuro = await crearTurno(ctx, {
      telefono: TELEFONO_A, nombre: 'Cliente Futuro', servicioId: 'corte', fecha: SABADO, hora: '17:00', origen: 'whatsapp',
    });
    await sincronizarPendientes(ctx);
    assert.ok(filaDe(viejo.id), 'precondición: el viejo está en la planilla');

    const borrados = await limpiarTurnosViejos(ctx);
    assert.equal(borrados, 1, 'tiene que borrar solo el turno pasado');

    const enLaBase = await ctx.db.query<{ id: string }>('SELECT id FROM turnos');
    assert.deepEqual(enLaBase.map((f) => f.id), [futuro.id], 'el turno futuro no se puede tocar');

    // Y lo importante: en Drive sigue estando.
    assert.ok(filaDe(viejo.id), 'el historial de Drive no se puede perder');

    // Ni siquiera apretando "Resincronizar" a mano.
    await resincronizarTodo(ctx);
    assert.ok(filaDe(viejo.id), 'resincronizar no puede borrar el historial');
    assert.ok(filaDe(futuro.id));
  });

  test('la ficha del cliente sobrevive a la limpieza', async () => {
    await crearTurno(ctx, {
      telefono: TELEFONO_B, nombre: 'Cliente Viejo', servicioId: 'corte', fecha: '2026-09-05', hora: '11:00',
      origen: 'panel', forzar: true,
    });
    await limpiarTurnosViejos(ctx);

    const clientes = await ctx.db.query<{ nombre: string; total_turnos: number }>('SELECT nombre, total_turnos FROM clientes WHERE telefono = ?', [TELEFONO_B]);
    assert.equal(clientes[0]?.nombre, 'Cliente Viejo', 'el bot tiene que seguir reconociendo al cliente');
    assert.equal(Number(clientes[0]?.total_turnos), 1);
  });
});

describe('el balance semanal queda en Drive', () => {
  test('el cierre del domingo escribe una fila en "Balance semanal"', async () => {
    const { DateTime } = await import('luxon');
    const { cierreSemanal } = await import('../src/mantenimiento/tareas.js');
    const domingo = DateTime.fromISO('2026-09-20T20:30:00', { zone: 'America/Argentina/Buenos_Aires' });
    const ctxDomingo = Object.assign(ctx, { ahora: () => domingo });

    await crearTurno(ctxDomingo, {
      telefono: TELEFONO_A, nombre: 'Ana', servicioId: 'corte', fecha: '2026-09-15', hora: '10:00',
      origen: 'panel', forzar: true,
    });
    await crearTurno(ctxDomingo, {
      telefono: TELEFONO_B, nombre: 'Beto', servicioId: 'corte_barba', fecha: '2026-09-18', hora: '16:00',
      origen: 'panel', forzar: true,
    });

    const r = await cierreSemanal(ctxDomingo);
    assert.equal(r.corrio, true);

    const balance = google.filas('Balance semanal');
    assert.equal(balance[0]?.[0], 'Semana', 'falta el encabezado');
    const fila = balance.find((f) => f[0] === '2026-09-14 al 2026-09-20');
    assert.ok(fila, 'no se escribió la fila de la semana');
    assert.equal(fila[1], '2', 'turnos atendidos');
    assert.equal(fila[2], '2', 'clientes');
    assert.equal(fila[5], String(8000 + 12000), 'facturado');

    // Y los turnos ya no están en la base, pero el balance sí.
    const enLaBase = await ctxDomingo.db.query<{ n: number }>('SELECT COUNT(*) AS n FROM turnos');
    assert.equal(Number(enLaBase[0]!.n), 0);
    assert.ok(google.filas('Balance semanal').length >= 2);
  });

  test('cerrar dos veces la misma semana no duplica la fila', async () => {
    const { DateTime } = await import('luxon');
    const { cierreSemanal } = await import('../src/mantenimiento/tareas.js');
    const domingo = DateTime.fromISO('2026-09-20T20:30:00', { zone: 'America/Argentina/Buenos_Aires' });
    const ctxDomingo = Object.assign(ctx, { ahora: () => domingo });

    await crearTurno(ctxDomingo, {
      telefono: TELEFONO_A, nombre: 'Ana', servicioId: 'corte', fecha: '2026-09-15', hora: '10:00',
      origen: 'panel', forzar: true,
    });
    await cierreSemanal(ctxDomingo);
    await cierreSemanal(ctxDomingo, { forzar: true });

    const filas = google.filas('Balance semanal').filter((f) => f[0] === '2026-09-14 al 2026-09-20');
    assert.equal(filas.length, 1, 'la semana tiene que figurar una sola vez');
  });
});

describe('el cliente con descuento se ve distinto en la planilla', () => {
  test('sale con 🎁 y la celda pintada en la agenda semanal', async () => {
    const { registrarResenaDeCliente } = await import('../src/conversation/resenas.js');
    const { conversacionesRepo } = await import('../src/database/repositories/conversaciones.js');

    // Se le pide la reseña y avisa que la dejó.
    const ahoraIso = ctx.ahora().toUTC().toISO()!;
    const conv = await conversacionesRepo.obtener(ctx.db, TELEFONO_A);
    (conv.estado as Record<string, unknown>).esperandoResena = { turnoId: 'X', ts: ctx.ahora().toMillis() };
    await conversacionesRepo.guardar(ctx.db, conv, ahoraIso);
    await registrarResenaDeCliente(ctx, TELEFONO_A, ctx.ahora().toMillis());

    await crearTurno(ctx, { telefono: TELEFONO_B, nombre: 'Común', servicioId: 'corte', fecha: SABADO, hora: '16:00', origen: 'whatsapp' });
    await sincronizarPendientes(ctx);
    google.formatos.length = 0;

    // Este cliente tiene el descuento vigente, así que se marca.
    await crearHold(ctx, { telefono: TELEFONO_A, nombre: 'Premiado', servicioId: 'corte', fecha: SABADO, hora: '17:00' });
    const holdId = (await ctx.db.query<{ id: string }>("SELECT id FROM turnos WHERE estado = 'pendiente'"))[0]!.id;
    await confirmarHold(ctx, holdId, { telefono: TELEFONO_A, nombre: 'Premiado' });
    await sincronizarPendientes(ctx);

    const semana = google.filas('Agenda semanal').flat().join(' | ');
    assert.match(semana, /Premiado 🎁/, 'el cliente con descuento se marca con el regalito');
    assert.ok(!/Común 🎁/.test(semana), 'el cliente sin descuento no');

    const pintadas = google.formatos.filter((f) => f.hoja === 'Agenda semanal');
    assert.ok(pintadas.length >= 1, 'la celda del cliente premiado tiene que quedar pintada');
    assert.ok(pintadas[0]!.color.green > pintadas[0]!.color.red, 'el color es verdoso, distinto del resto');
  });
});
