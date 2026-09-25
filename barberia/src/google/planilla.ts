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
import { formatearPrecio, telefonoLegible } from '../shared/texto.js';
import { esCancelacionReal, fueReprogramado, nuncaFueTurno, type Turno } from '../booking/tipos.js';
import { log } from '../shared/log.js';
import { ENCABEZADOS_RESUMEN, resumenComoFila, type ResumenSemanal } from '../reportes/semanal.js';
import { ENCABEZADOS_MENSUAL, resumenMensualComoFila, type ResumenMensual } from '../reportes/mensual.js';

export const HOJA_TURNOS = 'Turnos';
export const HOJA_HOY = 'Hoy';
export const HOJA_SEMANA = 'Agenda semanal';
export const HOJA_CLIENTES = 'Clientes';
export const HOJA_CONFIG = 'Configuración';
export const HOJA_BALANCE = 'Balance semanal';
export const HOJA_BALANCE_MES = 'Balance mensual';

export const HOJAS = [HOJA_HOY, HOJA_SEMANA, HOJA_BALANCE, HOJA_BALANCE_MES, HOJA_TURNOS, HOJA_CLIENTES, HOJA_CONFIG];

/**
 * Columnas de la hoja "Turnos", en el orden en que las lee el barbero: cuándo,
 * quién, qué y cuánto primero; los datos de control al final. El ID va último
 * pero es la clave: con él se actualiza la fila en vez de duplicarla.
 */
export const ENCABEZADOS_TURNOS = [
  'Fecha', 'Día', 'Hora', 'Cliente', 'Servicio', 'Precio', 'Descuento', 'Estado',
  'WhatsApp', 'Hora fin', 'Observaciones', 'Creado', 'Modificado', 'ID',
];
const COL_FECHA = 0;
const COL_HORA = 2;
const COL_PRECIO = 5;
const COL_ID = ENCABEZADOS_TURNOS.length - 1;
/** Letra de la última columna (N). */
const ULTIMA = String.fromCharCode(65 + COL_ID);

/** Encabezados de versiones anteriores de la hoja, para pasar sus filas al formato nuevo. */
const NOMBRES_VIEJOS: Record<string, string> = {
  'Fecha de creación': 'Creado',
  'Última modificación': 'Modificado',
};

/**
 * Turnos que ocupan (u ocuparon) la agenda. No entra 'pendiente': un horario
 * apartado mientras alguien confirma todavía no es un turno.
 */
const EN_AGENDA = ['reservado', 'confirmado', 'completado', 'no_show'];

const ETIQUETA_ESTADO: Record<string, string> = {
  pendiente: '⏳ sin confirmar',
  reservado: '✅ reservado',
  confirmado: '✅ confirmado',
  cancelado: '❌ cancelado',
  completado: '✔️ vino',
  no_show: '🚫 no vino',
  expirado: '⌛ expirado',
};

const mayuscula = (s: string) => (s ? s[0]!.toUpperCase() + s.slice(1) : s);

function etiquetaDeEstado(t: Turno): string {
  if (fueReprogramado(t)) return '↪️ reprogramado';
  return ETIQUETA_ESTADO[t.estado] ?? t.estado;
}

function filaDeTurno(t: Turno, zona: string): Array<string | number> {
  const dt = DateTime.fromISO(`${t.fecha}T${t.horaInicio}`, { zone: zona });
  const iso = (s: string | null) => (s ? DateTime.fromISO(s, { zone: 'utc' }).setZone(zona).toFormat('dd/LL/yyyy HH:mm') : '');
  return [
    // La fecha va en formato año-mes-día: ordenada de la A a la Z queda en orden cronológico.
    t.fecha,
    dt.isValid ? `${mayuscula(nombreDia(dt))} ${dt.toFormat('dd/LL')}` : '',
    t.horaInicio,
    t.nombreCliente,
    t.servicioNombre,
    // Número de verdad (se puede sumar); la columna tiene formato de pesos.
    t.precio > 0 ? t.precio : 'a confirmar',
    t.descuentoPorcentaje > 0 ? `${t.descuentoPorcentaje}% (reseña)` : '',
    etiquetaDeEstado(t),
    telefonoLegible(t.telefono),
    t.horaFin,
    t.observaciones,
    iso(t.creadoEn),
    iso(t.actualizadoEn),
    t.id,
  ];
}

/** Va a la hoja "Turnos" solo lo que fue un turno: no los horarios apartados que nadie confirmó. */
function vaALaPlanilla(t: Turno): boolean {
  return !nuncaFueTurno(t);
}

/** Crea las hojas y los encabezados si todavia no existen. Idempotente. */
export async function asegurarEstructura(spreadsheetId: string): Promise<void> {
  await sheets.asegurarHojas(spreadsheetId, HOJAS);
  await ordenarColumnasSiHaceFalta(spreadsheetId);
  const propiedades = await sheets.hojas(spreadsheetId);
  const turnos = propiedades.find((h) => h.title === HOJA_TURNOS);
  if (turnos) {
    const columna = (indice: number) => ({ sheetId: turnos.sheetId, startRowIndex: 1, startColumnIndex: indice, endColumnIndex: indice + 1 });
    await sheets.batchUpdate(spreadsheetId, [
      {
        repeatCell: {
          range: { sheetId: turnos.sheetId, startRowIndex: 0, endRowIndex: 1 },
          cell: {
            userEnteredFormat: {
              textFormat: { bold: true, foregroundColor: { red: 1, green: 1, blue: 1 } },
              backgroundColor: { red: 0.13, green: 0.13, blue: 0.15 },
              horizontalAlignment: 'LEFT',
            },
          },
          fields: 'userEnteredFormat(textFormat,backgroundColor,horizontalAlignment)',
        },
      },
      // Precio en pesos: "$10.000" en pantalla, 10000 para las cuentas.
      {
        repeatCell: {
          range: columna(COL_PRECIO),
          cell: { userEnteredFormat: { numberFormat: { type: 'CURRENCY', pattern: '"$"#,##0' } } },
          fields: 'userEnteredFormat.numberFormat',
        },
      },
      // Encabezado fijo y filtro en todas las columnas, para buscar por cliente, día o estado.
      { updateSheetProperties: { properties: { sheetId: turnos.sheetId, gridProperties: { frozenRowCount: 1 } }, fields: 'gridProperties.frozenRowCount' } },
      { setBasicFilter: { filter: { range: { sheetId: turnos.sheetId, startRowIndex: 0, startColumnIndex: 0, endColumnIndex: ENCABEZADOS_TURNOS.length } } } },
      { autoResizeDimensions: { dimensions: { sheetId: turnos.sheetId, dimension: 'COLUMNS', startIndex: 0, endIndex: ENCABEZADOS_TURNOS.length } } },
    ]);
  }
}

/**
 * Deja el encabezado de "Turnos" como corresponde. Si la hoja venía de una
 * versión anterior (otras columnas u otro orden), pasa cada fila al orden
 * nuevo por el nombre de la columna: no se pierde ningún dato.
 */
async function ordenarColumnasSiHaceFalta(spreadsheetId: string): Promise<void> {
  const todo = await sheets.leer(spreadsheetId, `${HOJA_TURNOS}!A1:Z`);
  const encabezado = (todo[0] ?? []).map((c) => String(c ?? ''));
  if (encabezado.join('|') === ENCABEZADOS_TURNOS.join('|')) return;
  if (encabezado.length === 0 || encabezado.every((c) => !c)) {
    await sheets.escribir(spreadsheetId, `${HOJA_TURNOS}!A1:${ULTIMA}1`, [ENCABEZADOS_TURNOS], { talCual: true });
    return;
  }
  const posicion = new Map(encabezado.map((nombre, i) => [NOMBRES_VIEJOS[nombre] ?? nombre, i]));
  const filas = todo.slice(1).map((fila) =>
    ENCABEZADOS_TURNOS.map((nombre): string | number => {
      const i = posicion.get(nombre);
      const valor = i === undefined ? '' : String(fila[i] ?? '');
      if (nombre === 'Precio' && /^\d+$/.test(valor)) return Number(valor);
      if (nombre === 'Fecha') {
        const dma = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(valor);
        if (dma) return `${dma[3]}-${dma[2]}-${dma[1]}`;
      }
      return valor;
    }),
  );
  await sheets.limpiar(spreadsheetId, `${HOJA_TURNOS}!A:Z`);
  await sheets.escribir(spreadsheetId, `${HOJA_TURNOS}!A1:${ULTIMA}${filas.length + 1}`, [ENCABEZADOS_TURNOS, ...filas], { talCual: true });
  log.info({ filas: filas.length }, 'hoja Turnos pasada al formato nuevo de columnas');
}

/** Busca la fila de un turno por su ID (ultima columna). Devuelve el numero de fila o null. */
async function filaDelTurno(spreadsheetId: string, turnoId: string): Promise<number | null> {
  const columna = await sheets.leer(spreadsheetId, `${HOJA_TURNOS}!${ULTIMA}2:${ULTIMA}`);
  const idx = columna.findIndex((f) => f[0] === turnoId);
  return idx === -1 ? null : idx + 2; // +2: la fila 1 es el encabezado y el indice arranca en 0
}

/** Alta o actualizacion de un turno en la hoja Turnos. */
export async function volcarTurno(spreadsheetId: string, turno: Turno, zona: string): Promise<void> {
  if (!vaALaPlanilla(turno)) return;
  const fila = filaDeTurno(turno, zona);
  const numero = await filaDelTurno(spreadsheetId, turno.id);
  if (numero === null) {
    await sheets.agregar(spreadsheetId, `${HOJA_TURNOS}!A:${ULTIMA}`, [fila], { talCual: true });
  } else {
    await sheets.escribir(spreadsheetId, `${HOJA_TURNOS}!A${numero}:${ULTIMA}${numero}`, [fila], { talCual: true });
  }
}

/** Color de fondo para los clientes con descuento por reseña: verde suave. */
const VERDE_DESCUENTO = { red: 0.78, green: 0.93, blue: 0.82 };
const SIN_COLOR = { red: 1, green: 1, blue: 1 };

interface Celda {
  fila: number;
  columna: number;
}

/**
 * Pinta las celdas de los clientes con descuento.
 *
 * Antes limpia el formato de todo el rango: si no, los colores de la semana
 * pasada quedarian pegados sobre turnos de otra gente.
 */
async function pintarDescuentos(spreadsheetId: string, hoja: string, celdas: Celda[], filas: number, columnas: number): Promise<void> {
  const propiedades = (await sheets.hojas(spreadsheetId)).find((h) => h.title === hoja);
  if (!propiedades) return;

  const pedidos: unknown[] = [
    {
      repeatCell: {
        range: { sheetId: propiedades.sheetId, startRowIndex: 0, endRowIndex: Math.max(filas, 1), startColumnIndex: 0, endColumnIndex: columnas },
        cell: { userEnteredFormat: { backgroundColor: SIN_COLOR } },
        fields: 'userEnteredFormat.backgroundColor',
      },
    },
    ...celdas.map((c) => ({
      repeatCell: {
        range: {
          sheetId: propiedades.sheetId,
          startRowIndex: c.fila,
          endRowIndex: c.fila + 1,
          startColumnIndex: c.columna,
          endColumnIndex: c.columna + 1,
        },
        cell: { userEnteredFormat: { backgroundColor: VERDE_DESCUENTO } },
        fields: 'userEnteredFormat.backgroundColor',
      },
    })),
  ];
  await sheets.batchUpdate(spreadsheetId, pedidos);
}

function bloqueDeDia(dia: { fecha: string; abierto: boolean; motivo_cerrado: string; turnos: Turno[]; bloqueos: Array<{ horaInicio: string; horaFin: string; motivo: string }> }, zona: string): { filas: string[][]; conDescuento: number[] } {
  const dt = DateTime.fromISO(dia.fecha, { zone: zona });
  const filas: string[][] = [];
  const conDescuento: number[] = [];
  filas.push([`${nombreDia(dt).toUpperCase()} ${dt.toFormat('dd/LL')}`, 'Cliente', 'Servicio', 'WhatsApp']);
  if (!dia.abierto) {
    filas.push(['Cerrado', dia.motivo_cerrado, '', '']);
    return { filas, conDescuento };
  }
  const vivos = dia.turnos.filter((t) => EN_AGENDA.includes(t.estado));
  const cancelados = dia.turnos.filter(esCancelacionReal);
  if (vivos.length === 0 && dia.bloqueos.length === 0) {
    filas.push(['— sin turnos —', '', '', '']);
  }
  for (const t of vivos) {
    const marca = t.estado === 'completado' ? ' ✓' : t.estado === 'no_show' ? ' (no vino)' : '';
    // Se marca el turno que tiene descuento aplicado: es donde el barbero
    // tiene que cobrar menos.
    const premio = t.descuentoPorcentaje > 0 ? ` 🎁 -${t.descuentoPorcentaje}%` : '';
    if (premio) conDescuento.push(filas.length);
    filas.push([t.horaInicio, `${t.nombreCliente}${marca}${premio}`, t.servicioNombre, telefonoLegible(t.telefono)]);
  }
  for (const b of dia.bloqueos) {
    filas.push([`${b.horaInicio}-${b.horaFin}`, '🔒 BLOQUEADO', b.motivo, '']);
  }
  if (cancelados.length) {
    filas.push([`${cancelados.length} cancelado(s)`, cancelados.map((c) => `${c.horaInicio} ${c.nombreCliente}`).join(', '), '', '']);
  }
  filas.push([`${vivos.length} turno(s)`, '', '', '']);
  return { filas, conDescuento };
}

/** Rehace la hoja "Hoy" con la agenda de hoy y de mañana. */
export async function refrescarHoy(spreadsheetId: string, ctx: Contexto): Promise<void> {
  const zona = ctx.cfg.negocio.timezone;
  const hoy = ctx.ahora();
  const { agendaDelDia } = await import('../booking/servicio.js');
  const dias = [fechaDe(hoy), fechaDe(hoy.plus({ days: 1 })), fechaDe(hoy.plus({ days: 2 }))];
  const filas: string[][] = [[`Actualizado: ${hoy.toFormat('dd/LL/yyyy HH:mm')}`, '', '', '']];
  const celdasPremiadas: Celda[] = [];
  for (const f of dias) {
    const dia = await agendaDelDia(ctx, f);
    filas.push(['', '', '', '']);
    const bloque = bloqueDeDia(dia, zona);
    const desplazamiento = filas.length;
    for (const indice of bloque.conDescuento) celdasPremiadas.push({ fila: desplazamiento + indice, columna: 1 });
    filas.push(...bloque.filas);
  }
  await sheets.limpiar(spreadsheetId, `${HOJA_HOY}!A:D`);
  await sheets.escribir(spreadsheetId, `${HOJA_HOY}!A1:D${filas.length}`, filas, { talCual: true });
  await pintarDescuentos(spreadsheetId, HOJA_HOY, celdasPremiadas, filas.length, 4);
}

/** Rehace la hoja "Agenda semanal": una columna por dia, de lunes a domingo. */
export async function refrescarSemana(spreadsheetId: string, ctx: Contexto, desde?: string): Promise<void> {
  const zona = ctx.cfg.negocio.timezone;
  const semana = await agendaSemanal(ctx, desde);
  const celdasPremiadas: Celda[] = [];
  const columnas: string[][] = semana.map((dia, indiceDia) => {
    const dt = DateTime.fromISO(dia.fecha, { zone: zona });
    const celdas: string[] = [`${mayuscula(nombreDia(dt))} ${dt.toFormat('dd/LL')}`];
    if (!dia.abierto) {
      celdas.push(`Cerrado${dia.motivo_cerrado ? ` (${dia.motivo_cerrado})` : ''}`);
      return celdas;
    }
    const vivos = dia.turnos.filter((t) => EN_AGENDA.includes(t.estado));
    celdas.push(`${vivos.length} turno(s) · ${dia.huecos_libres.length} lugar(es) libre(s)`);
    for (const t of vivos) {
      const marca = t.estado === 'completado' ? ' ✓' : t.estado === 'no_show' ? ' (no vino)' : '';
      const premio = t.descuentoPorcentaje > 0 ? ` 🎁 -${t.descuentoPorcentaje}%` : '';
      // +2 por el título y la fila en blanco que van arriba de la grilla.
      if (premio) celdasPremiadas.push({ fila: celdas.length + 2, columna: indiceDia });
      celdas.push(`${t.horaInicio} ${t.nombreCliente}${marca}${premio} — ${t.servicioNombre}`);
    }
    for (const b of dia.bloqueos) celdas.push(`${b.horaInicio}-${b.horaFin} 🔒 ${b.motivo || 'bloqueado'}`);
    const cancelados = dia.turnos.filter(esCancelacionReal);
    for (const c of cancelados) celdas.push(`❌ ${c.horaInicio} ${c.nombreCliente}`);
    return celdas;
  });

  const alto = Math.max(...columnas.map((c) => c.length), 1);
  const filas: string[][] = [];
  const inicioSemana = semana[0] ? DateTime.fromISO(semana[0].fecha, { zone: zona }).toFormat('dd/LL/yyyy') : '';
  filas.push([`Semana del ${inicioSemana} · actualizado ${ctx.ahora().toFormat('dd/LL HH:mm')}`]);
  filas.push([]);
  for (let i = 0; i < alto; i++) filas.push(columnas.map((c) => c[i] ?? ''));

  await sheets.limpiar(spreadsheetId, `${HOJA_SEMANA}!A:G`);
  await sheets.escribir(spreadsheetId, `${HOJA_SEMANA}!A1:G${filas.length}`, filas, { talCual: true });
  await pintarDescuentos(spreadsheetId, HOJA_SEMANA, celdasPremiadas, filas.length, 7);
}

export async function refrescarClientes(spreadsheetId: string, ctx: Contexto): Promise<void> {
  const zona = ctx.cfg.negocio.timezone;
  const clientes = await clientesRepo.listar(ctx.db, 1000);
  const fmt = (s: string | null) => (s ? DateTime.fromISO(s, { zone: 'utc' }).setZone(zona).toFormat('dd/LL/yyyy') : '');
  const filas = [
    ['Cliente', 'WhatsApp', 'Turnos', 'Primera visita', 'Última visita', 'Notas'],
    ...clientes.map((c) => [c.nombre, telefonoLegible(c.telefono), c.totalTurnos, fmt(c.primeraVisita), fmt(c.ultimaVisita), c.notas]),
  ];
  await sheets.limpiar(spreadsheetId, `${HOJA_CLIENTES}!A:F`);
  await sheets.escribir(spreadsheetId, `${HOJA_CLIENTES}!A1:F${filas.length}`, filas, { talCual: true });
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
    ['ID', 'Nombre', 'Precio', 'Duración (interna)', 'Activo'],
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
  await sheets.escribir(spreadsheetId, `${HOJA_CONFIG}!A1:E${filas.length}`, filas, { talCual: true });
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
  const enLaBase = (await turnosRepo.porRangoDeFechas(ctx.db, desde, hasta)).filter(vaALaPlanilla);

  await asegurarEstructura(spreadsheetId);

  // Una sola lectura de la hoja y una sola escritura. Se lee sin formato para
  // que los precios vuelvan como números y se reescriban igual.
  const filasActuales: Array<Array<string | number>> = await sheets.leer(spreadsheetId, `${HOJA_TURNOS}!A2:${ULTIMA}`, { sinFormato: true });
  const indicePorId = new Map<string, number>();
  filasActuales.forEach((fila, i) => {
    const id = String(fila[COL_ID] ?? '');
    // Si la misma ID aparece dos veces (alguien copió una fila a mano), queda una sola.
    if (id && !indicePorId.has(id)) indicePorId.set(id, i);
  });

  let nuevos = 0;
  const filas = filasActuales
    .filter((f, i) => {
      const id = String(f[COL_ID] ?? '');
      return !id || indicePorId.get(id) === i;
    })
    .map((f) => [...f]);
  indicePorId.clear();
  filas.forEach((fila, i) => {
    const id = String(fila[COL_ID] ?? '');
    if (id) indicePorId.set(id, i);
  });
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
  const clave = (f: Array<string | number>) => `${f[COL_FECHA] ?? ''} ${String(f[COL_HORA] ?? '').padStart(5, '0')}`;
  filas.sort((a, b) => clave(a).localeCompare(clave(b)));

  if (filas.length) {
    const ancho = ENCABEZADOS_TURNOS.length;
    await sheets.escribir(
      spreadsheetId,
      `${HOJA_TURNOS}!A2:${ULTIMA}${filas.length + 1}`,
      filas.map((f) => Array.from({ length: ancho }, (_, i) => f[i] ?? '')),
      { talCual: true },
    );
  }
  // Si quedaron menos filas que antes (se sacaron duplicados), se borra lo que sobra abajo.
  if (filas.length < filasActuales.length) {
    await sheets.limpiar(spreadsheetId, `${HOJA_TURNOS}!A${filas.length + 2}:${ULTIMA}`);
  }

  await refrescarHoy(spreadsheetId, ctx);
  await refrescarSemana(spreadsheetId, ctx);
  await refrescarClientes(spreadsheetId, ctx);
  await refrescarConfig(spreadsheetId, ctx);
  return { turnos: filas.length, nuevos };
}

/**
 * Escribe el balance de una semana en la hoja "Balance semanal".
 *
 * Es la copia permanente: la base de datos se limpia todas las semanas, pero
 * acá queda el historial completo, una fila por semana, para comparar meses.
 * Si la semana ya estaba escrita, se actualiza esa fila en vez de duplicarla.
 */
export async function guardarResumenEnPlanilla(ctx: Contexto, resumen: ResumenSemanal): Promise<void> {
  const { env, sheetsConfigurado } = await import('../config/env.js');
  if (!sheetsConfigurado || !env.GOOGLE_SPREADSHEET_ID) return;
  const spreadsheetId = env.GOOGLE_SPREADSHEET_ID;

  await sheets.asegurarHojas(spreadsheetId, [HOJA_BALANCE]);

  const encabezado = await sheets.leer(spreadsheetId, `${HOJA_BALANCE}!A1:K1`);
  if (encabezado.length === 0 || encabezado[0]?.[0] !== ENCABEZADOS_RESUMEN[0]) {
    await sheets.escribir(spreadsheetId, `${HOJA_BALANCE}!A1:K1`, [ENCABEZADOS_RESUMEN]);
  }

  const fila = resumenComoFila(resumen);
  const existentes = await sheets.leer(spreadsheetId, `${HOJA_BALANCE}!A2:A`);
  const posicion = existentes.findIndex((f) => f[0] === fila[0]);
  if (posicion === -1) {
    await sheets.agregar(spreadsheetId, `${HOJA_BALANCE}!A:K`, [fila]);
  } else {
    const numeroDeFila = posicion + 2;
    await sheets.escribir(spreadsheetId, `${HOJA_BALANCE}!A${numeroDeFila}:K${numeroDeFila}`, [fila]);
  }
}

/** Igual que el semanal, pero para el balance del mes. */
export async function guardarResumenMensualEnPlanilla(ctx: Contexto, resumen: ResumenMensual): Promise<void> {
  const { env, sheetsConfigurado } = await import('../config/env.js');
  if (!sheetsConfigurado || !env.GOOGLE_SPREADSHEET_ID) return;
  const spreadsheetId = env.GOOGLE_SPREADSHEET_ID;

  await sheets.asegurarHojas(spreadsheetId, [HOJA_BALANCE_MES]);

  const encabezado = await sheets.leer(spreadsheetId, `${HOJA_BALANCE_MES}!A1:J1`);
  if (encabezado.length === 0 || encabezado[0]?.[0] !== ENCABEZADOS_MENSUAL[0]) {
    await sheets.escribir(spreadsheetId, `${HOJA_BALANCE_MES}!A1:J1`, [ENCABEZADOS_MENSUAL]);
  }

  const fila = resumenMensualComoFila(resumen);
  const existentes = await sheets.leer(spreadsheetId, `${HOJA_BALANCE_MES}!A2:A`);
  const posicion = existentes.findIndex((f) => f[0] === fila[0]);
  if (posicion === -1) {
    await sheets.agregar(spreadsheetId, `${HOJA_BALANCE_MES}!A:J`, [fila]);
  } else {
    const numeroDeFila = posicion + 2;
    await sheets.escribir(spreadsheetId, `${HOJA_BALANCE_MES}!A${numeroDeFila}:J${numeroDeFila}`, [fila]);
  }
}
