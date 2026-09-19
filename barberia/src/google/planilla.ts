/**
 * Proyeccion de la agenda sobre Google Sheets.
 *
 * IMPORTANTE: la planilla NO es la fuente de verdad, es una vista comoda para
 * el barbero. Se escribe siempre desde la base de datos, nunca al reves. Si el
 * barbero edita una celda a mano, el proximo refresco la vuelve a pisar.
 */
import { DateTime } from 'luxon';
import { sheets } from './sheets-api.js';
import type { Contexto } from '../booking/servicio.js';
import { agendaSemanal } from '../booking/servicio.js';
import { turnosRepo } from '../database/repositories/turnos.js';
import { clientesRepo } from '../database/repositories/clientes.js';
import { fechaDe, nombreDia } from '../shared/tiempo.js';
import { formatearPrecio } from '../shared/texto.js';
import type { Turno } from '../booking/tipos.js';

export const HOJA_TURNOS = 'Turnos';
export const HOJA_HOY = 'Hoy';
export const HOJA_SEMANA = 'Agenda semanal';
export const HOJA_CLIENTES = 'Clientes';
export const HOJA_CONFIG = 'Configuración';

export const HOJAS = [HOJA_HOY, HOJA_SEMANA, HOJA_TURNOS, HOJA_CLIENTES, HOJA_CONFIG];

export const ENCABEZADOS_TURNOS = [
  'ID', 'Fecha', 'Día', 'Hora', 'Hora fin', 'Cliente', 'WhatsApp', 'Servicio',
  'Precio', 'Duración', 'Estado', 'Fecha de creación', 'Última modificación', 'Observaciones',
];

const ETIQUETA_ESTADO: Record<string, string> = {
  pendiente: '⏳ sin confirmar',
  reservado: '✅ reservado',
  confirmado: '✅ confirmado',
  cancelado: '❌ cancelado',
  completado: '✔️ completado',
  no_show: '🚫 no vino',
  expirado: '⌛ expirado',
};

function filaDeTurno(t: Turno, zona: string): string[] {
  const dt = DateTime.fromISO(`${t.fecha}T${t.horaInicio}`, { zone: zona });
  const iso = (s: string | null) => (s ? DateTime.fromISO(s, { zone: 'utc' }).setZone(zona).toFormat('dd/LL/yyyy HH:mm') : '');
  return [
    t.id,
    t.fecha,
    dt.isValid ? nombreDia(dt) : '',
    t.horaInicio,
    t.horaFin,
    t.nombreCliente,
    t.telefono,
    t.servicioNombre,
    t.precio > 0 ? String(t.precio) : 'a confirmar',
    `${t.duracionMin} min`,
    ETIQUETA_ESTADO[t.estado] ?? t.estado,
    iso(t.creadoEn),
    iso(t.actualizadoEn),
    t.observaciones,
  ];
}

/** Crea las hojas y los encabezados si todavia no existen. Idempotente. */
export async function asegurarEstructura(spreadsheetId: string): Promise<void> {
  await sheets.asegurarHojas(spreadsheetId, HOJAS);
  const encabezadoActual = await sheets.leer(spreadsheetId, `${HOJA_TURNOS}!A1:N1`);
  if (encabezadoActual.length === 0 || encabezadoActual[0]?.[0] !== 'ID') {
    await sheets.escribir(spreadsheetId, `${HOJA_TURNOS}!A1:N1`, [ENCABEZADOS_TURNOS]);
  }
  const propiedades = await sheets.hojas(spreadsheetId);
  const turnos = propiedades.find((h) => h.title === HOJA_TURNOS);
  if (turnos) {
    await sheets.batchUpdate(spreadsheetId, [
      {
        repeatCell: {
          range: { sheetId: turnos.sheetId, startRowIndex: 0, endRowIndex: 1 },
          cell: {
            userEnteredFormat: {
              textFormat: { bold: true },
              backgroundColor: { red: 0.13, green: 0.13, blue: 0.15 },
              horizontalAlignment: 'LEFT',
            },
          },
          fields: 'userEnteredFormat(textFormat,backgroundColor,horizontalAlignment)',
        },
      },
      {
        repeatCell: {
          range: { sheetId: turnos.sheetId, startRowIndex: 0, endRowIndex: 1 },
          cell: { userEnteredFormat: { textFormat: { bold: true, foregroundColor: { red: 1, green: 1, blue: 1 } } } },
          fields: 'userEnteredFormat.textFormat',
        },
      },
      { updateSheetProperties: { properties: { sheetId: turnos.sheetId, gridProperties: { frozenRowCount: 1 } }, fields: 'gridProperties.frozenRowCount' } },
    ]);
  }
}

/** Busca la fila de un turno por su ID (columna A). Devuelve el numero de fila o null. */
async function filaDelTurno(spreadsheetId: string, turnoId: string): Promise<number | null> {
  const columna = await sheets.leer(spreadsheetId, `${HOJA_TURNOS}!A2:A`);
  const idx = columna.findIndex((f) => f[0] === turnoId);
  return idx === -1 ? null : idx + 2; // +2: la fila 1 es el encabezado y el indice arranca en 0
}

/** Alta o actualizacion de un turno en la hoja Turnos. */
export async function volcarTurno(spreadsheetId: string, turno: Turno, zona: string): Promise<void> {
  const fila = filaDeTurno(turno, zona);
  const numero = await filaDelTurno(spreadsheetId, turno.id);
  if (numero === null) {
    await sheets.agregar(spreadsheetId, `${HOJA_TURNOS}!A:N`, [fila]);
  } else {
    await sheets.escribir(spreadsheetId, `${HOJA_TURNOS}!A${numero}:N${numero}`, [fila]);
  }
}

function bloqueDeDia(dia: { fecha: string; abierto: boolean; motivo_cerrado: string; turnos: Turno[]; bloqueos: Array<{ horaInicio: string; horaFin: string; motivo: string }> }, zona: string): string[][] {
  const dt = DateTime.fromISO(dia.fecha, { zone: zona });
  const filas: string[][] = [];
  filas.push([`${nombreDia(dt).toUpperCase()} ${dt.toFormat('dd/LL')}`, '', '', '']);
  if (!dia.abierto) {
    filas.push(['Cerrado', dia.motivo_cerrado, '', '']);
    return filas;
  }
  const vivos = dia.turnos.filter((t) => ['pendiente', 'reservado', 'confirmado'].includes(t.estado));
  const cancelados = dia.turnos.filter((t) => t.estado === 'cancelado');
  if (vivos.length === 0 && dia.bloqueos.length === 0) {
    filas.push(['— sin turnos —', '', '', '']);
  }
  for (const t of vivos) {
    filas.push([t.horaInicio, t.nombreCliente || '(sin nombre)', t.servicioNombre, t.telefono]);
  }
  for (const b of dia.bloqueos) {
    filas.push([`${b.horaInicio}-${b.horaFin}`, '🔒 BLOQUEADO', b.motivo, '']);
  }
  if (cancelados.length) {
    filas.push([`${cancelados.length} cancelado(s)`, cancelados.map((c) => `${c.horaInicio} ${c.nombreCliente}`).join(', '), '', '']);
  }
  filas.push([`${vivos.length} turno(s)`, '', '', '']);
  return filas;
}

/** Rehace la hoja "Hoy" con la agenda de hoy y de mañana. */
export async function refrescarHoy(spreadsheetId: string, ctx: Contexto): Promise<void> {
  const zona = ctx.cfg.negocio.timezone;
  const hoy = ctx.ahora();
  const { agendaDelDia } = await import('../booking/servicio.js');
  const dias = [fechaDe(hoy), fechaDe(hoy.plus({ days: 1 })), fechaDe(hoy.plus({ days: 2 }))];
  const filas: string[][] = [[`Actualizado: ${hoy.toFormat('dd/LL/yyyy HH:mm')}`, '', '', '']];
  for (const f of dias) {
    const dia = await agendaDelDia(ctx, f);
    filas.push(['', '', '', '']);
    filas.push(...bloqueDeDia(dia, zona));
  }
  await sheets.limpiar(spreadsheetId, `${HOJA_HOY}!A:D`);
  await sheets.escribir(spreadsheetId, `${HOJA_HOY}!A1:D${filas.length}`, filas);
}

/** Rehace la hoja "Agenda semanal": una columna por dia, de lunes a domingo. */
export async function refrescarSemana(spreadsheetId: string, ctx: Contexto, desde?: string): Promise<void> {
  const zona = ctx.cfg.negocio.timezone;
  const semana = await agendaSemanal(ctx, desde);
  const columnas: string[][] = semana.map((dia) => {
    const dt = DateTime.fromISO(dia.fecha, { zone: zona });
    const celdas: string[] = [`${nombreDia(dt)} ${dt.toFormat('dd/LL')}`];
    if (!dia.abierto) {
      celdas.push(`Cerrado${dia.motivo_cerrado ? ` (${dia.motivo_cerrado})` : ''}`);
      return celdas;
    }
    const vivos = dia.turnos.filter((t) => ['pendiente', 'reservado', 'confirmado'].includes(t.estado));
    celdas.push(`${vivos.length} turno(s) · ${dia.huecos_libres.length} lugar(es) libre(s)`);
    for (const t of vivos) celdas.push(`${t.horaInicio} ${t.nombreCliente || '(sin nombre)'} — ${t.servicioNombre}`);
    for (const b of dia.bloqueos) celdas.push(`${b.horaInicio}-${b.horaFin} 🔒 ${b.motivo || 'bloqueado'}`);
    const cancelados = dia.turnos.filter((t) => t.estado === 'cancelado');
    for (const c of cancelados) celdas.push(`❌ ${c.horaInicio} ${c.nombreCliente}`);
    return celdas;
  });

  const alto = Math.max(...columnas.map((c) => c.length), 1);
  const filas: string[][] = [];
  filas.push([`Semana del ${semana[0]?.fecha ?? ''} · actualizado ${ctx.ahora().toFormat('dd/LL HH:mm')}`]);
  filas.push([]);
  for (let i = 0; i < alto; i++) filas.push(columnas.map((c) => c[i] ?? ''));

  await sheets.limpiar(spreadsheetId, `${HOJA_SEMANA}!A:G`);
  await sheets.escribir(spreadsheetId, `${HOJA_SEMANA}!A1:G${filas.length}`, filas);
}

export async function refrescarClientes(spreadsheetId: string, ctx: Contexto): Promise<void> {
  const zona = ctx.cfg.negocio.timezone;
  const clientes = await clientesRepo.listar(ctx.db, 1000);
  const fmt = (s: string | null) => (s ? DateTime.fromISO(s, { zone: 'utc' }).setZone(zona).toFormat('dd/LL/yyyy') : '');
  const filas = [
    ['Cliente', 'WhatsApp', 'Turnos', 'Primera visita', 'Última visita', 'Notas'],
    ...clientes.map((c) => [c.nombre, c.telefono, String(c.totalTurnos), fmt(c.primeraVisita), fmt(c.ultimaVisita), c.notas]),
  ];
  await sheets.limpiar(spreadsheetId, `${HOJA_CLIENTES}!A:F`);
  await sheets.escribir(spreadsheetId, `${HOJA_CLIENTES}!A1:F${filas.length}`, filas);
}

/** Vuelca la configuracion vigente para que el barbero la vea. Es solo lectura. */
export async function refrescarConfig(spreadsheetId: string, ctx: Contexto): Promise<void> {
  const cfg = ctx.cfg;
  const filas: string[][] = [
    ['Esta hoja es solo informativa: se genera desde la configuración del sistema.'],
    ['Para cambiar precios, horarios o servicios usá el panel web (o config/negocio.json).'],
    [],
    ['NEGOCIO'],
    ['Nombre', cfg.negocio.nombre],
    ['Dirección', cfg.negocio.direccion],
    ['Teléfono', cfg.negocio.telefono],
    ['Instagram', cfg.negocio.instagram],
    [],
    ['SERVICIOS'],
    ['ID', 'Nombre', 'Precio', 'Duración', 'Activo'],
    ...cfg.servicios.map((s) => [s.id, s.nombre, formatearPrecio(s.precio, cfg.negocio.moneda), `${s.duracion_min} min`, s.activo ? 'sí' : 'no']),
    [],
    ['HORARIOS'],
    ...['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'].map((nombre, i) => {
      const d = cfg.horarios.dias[String(i + 1) as '1'];
      return [nombre, d?.abierto ? d.tramos.map((t) => `${t[0]} a ${t[1]}`).join(' y ') : 'cerrado'];
    }),
    [],
    ['FERIADOS Y VACACIONES'],
    ...cfg.horarios.feriados.map((f) => [f.fecha, f.motivo]),
    ...cfg.horarios.vacaciones.map((v) => [`${v.desde} a ${v.hasta}`, v.motivo]),
    [],
    ['REGLAS'],
    ['Anticipación mínima', `${cfg.reglas.anticipacion_minima_min} min`],
    ['Se reserva hasta', `${cfg.reglas.anticipacion_maxima_dias} días`],
    ['Máx. turnos futuros por cliente', String(cfg.reglas.max_turnos_futuros_por_cliente)],
    ['Cancelación mínima', `${cfg.reglas.cancelacion_minima_horas} h antes`],
  ];
  await sheets.limpiar(spreadsheetId, `${HOJA_CONFIG}!A:E`);
  await sheets.escribir(spreadsheetId, `${HOJA_CONFIG}!A1:E${filas.length}`, filas);
}

/**
 * Vuelca a la planilla todos los turnos que hay en la base y refresca las vistas.
 *
 * IMPORTANTE: no borra filas. La hoja "Turnos" es el ARCHIVO del negocio y
 * sobrevive a la limpieza semanal de la base de datos: los turnos viejos se
 * borran de la base para que arranque liviana, pero en Drive quedan para
 * siempre. Por eso esto hace merge (actualiza los que ya estan por ID y agrega
 * los nuevos) en vez de reconstruir desde cero.
 */
export async function volcarTodo(spreadsheetId: string, ctx: Contexto): Promise<{ turnos: number; nuevos: number }> {
  const zona = ctx.cfg.negocio.timezone;
  const desde = fechaDe(ctx.ahora().minus({ days: 365 }));
  const hasta = fechaDe(ctx.ahora().plus({ days: 365 }));
  const enLaBase = await turnosRepo.porRangoDeFechas(ctx.db, desde, hasta);

  await asegurarEstructura(spreadsheetId);

  // Una sola lectura de la hoja y una sola escritura.
  const filasActuales = await sheets.leer(spreadsheetId, `${HOJA_TURNOS}!A2:N`);
  const indicePorId = new Map<string, number>();
  filasActuales.forEach((fila, i) => {
    if (fila[0]) indicePorId.set(fila[0], i);
  });

  let nuevos = 0;
  const filas = filasActuales.map((f) => [...f]);
  for (const turno of enLaBase) {
    const fila = filaDeTurno(turno, zona);
    const posicion = indicePorId.get(turno.id);
    if (posicion === undefined) {
      filas.push(fila);
      nuevos++;
    } else {
      filas[posicion] = fila;
    }
  }

  // Se ordenan por fecha y hora para que el barbero lea la hoja de corrido.
  filas.sort((a, b) => `${a[1] ?? ''}${a[3] ?? ''}`.localeCompare(`${b[1] ?? ''}${b[3] ?? ''}`));

  if (filas.length) {
    const ancho = ENCABEZADOS_TURNOS.length;
    await sheets.escribir(
      spreadsheetId,
      `${HOJA_TURNOS}!A2:N${filas.length + 1}`,
      filas.map((f) => Array.from({ length: ancho }, (_, i) => f[i] ?? '')),
    );
  }

  await refrescarHoy(spreadsheetId, ctx);
  await refrescarSemana(spreadsheetId, ctx);
  await refrescarClientes(spreadsheetId, ctx);
  await refrescarConfig(spreadsheetId, ctx);
  return { turnos: filas.length, nuevos };
}
