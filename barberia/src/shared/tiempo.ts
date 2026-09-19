/**
 * Todo el manejo de fechas y horas del sistema pasa por aca.
 *
 * Reglas:
 *  - La base de datos guarda instantes en UTC (ISO 8601 con Z).
 *  - Toda la logica de negocio razona en la zona horaria del negocio
 *    (por defecto America/Argentina/Buenos_Aires). Nunca se asume UTC.
 *  - Las "fechas" del negocio son strings YYYY-MM-DD en hora local,
 *    y las "horas" son strings HH:mm en hora local.
 */
import { DateTime } from 'luxon';

export const ZONA_POR_DEFECTO = 'America/Argentina/Buenos_Aires';

export const DIAS_SEMANA = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'] as const;
export const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
] as const;

export type Fecha = string; // YYYY-MM-DD
export type Hora = string; // HH:mm

export function ahora(zona: string = ZONA_POR_DEFECTO): DateTime {
  return DateTime.now().setZone(zona);
}

export function desdeUTC(iso: string, zona: string = ZONA_POR_DEFECTO): DateTime {
  return DateTime.fromISO(iso, { zone: 'utc' }).setZone(zona);
}

export function aUTC(dt: DateTime): string {
  const iso = dt.toUTC().toISO({ suppressMilliseconds: true });
  if (!iso) throw new Error('fecha invalida al convertir a UTC');
  return iso;
}

/** Combina fecha local + hora local en un instante de la zona del negocio. */
export function desdeFechaHora(fecha: Fecha, hora: Hora, zona: string = ZONA_POR_DEFECTO): DateTime {
  const dt = DateTime.fromISO(`${fecha}T${hora}`, { zone: zona });
  if (!dt.isValid) throw new Error(`fecha/hora invalida: ${fecha} ${hora} (${dt.invalidReason})`);
  return dt;
}

export function esFechaValida(fecha: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(fecha) && DateTime.fromISO(fecha).isValid;
}

export function esHoraValida(hora: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(hora);
}

export function fechaDe(dt: DateTime): Fecha {
  return dt.toFormat('yyyy-MM-dd');
}

export function horaDe(dt: DateTime): Hora {
  return dt.toFormat('HH:mm');
}

/** 1 = lunes ... 7 = domingo (igual que la config del negocio). */
export function diaSemana(dt: DateTime): number {
  return dt.weekday;
}

export function nombreDia(dt: DateTime): string {
  return DIAS_SEMANA[dt.weekday - 1]!;
}

export function nombreMes(dt: DateTime): string {
  return MESES[dt.month - 1]!;
}

export function hhmmAMinutos(hora: Hora): number {
  const [h, m] = hora.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

export function minutosAHhmm(min: number): Hora {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** "sábado 20/09" */
export function fechaHumana(dt: DateTime): string {
  return `${nombreDia(dt)} ${dt.toFormat('dd/LL')}`;
}

/** "sábado 20/09 a las 17:30" */
export function fechaHoraHumana(dt: DateTime): string {
  return `${fechaHumana(dt)} a las ${horaDe(dt)}`;
}

/** "hoy" / "mañana" / "sábado 20/09" segun que tan cerca esta. */
export function fechaRelativaHumana(dt: DateTime, referencia: DateTime): string {
  const dias = dt.startOf('day').diff(referencia.startOf('day'), 'days').days;
  if (dias === 0) return 'hoy';
  if (dias === 1) return 'mañana';
  if (dias === 2) return 'pasado mañana';
  return fechaHumana(dt);
}

export function rangosSeSuperponen(inicioA: DateTime, finA: DateTime, inicioB: DateTime, finB: DateTime): boolean {
  return inicioA < finB && inicioB < finA;
}

/** Fechas YYYY-MM-DD entre dos limites, inclusive. */
export function rangoDeFechas(desde: Fecha, hasta: Fecha, zona: string = ZONA_POR_DEFECTO): Fecha[] {
  const out: Fecha[] = [];
  let cur = DateTime.fromISO(desde, { zone: zona });
  const fin = DateTime.fromISO(hasta, { zone: zona });
  let guarda = 0;
  while (cur <= fin && guarda++ < 400) {
    out.push(fechaDe(cur));
    cur = cur.plus({ days: 1 });
  }
  return out;
}

export function lunesDeLaSemana(fecha: Fecha, zona: string = ZONA_POR_DEFECTO): Fecha {
  return fechaDe(DateTime.fromISO(fecha, { zone: zona }).startOf('week'));
}

const NORMALIZAR = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9/:.\- ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const DIAS_NORMALIZADOS = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'];

export type RangoDelDia = 'mañana' | 'tarde' | 'noche' | null;

export interface FechaInterpretada {
  fecha: Fecha | null;
  rango: RangoDelDia;
  hora: Hora | null;
  desdeHora: Hora | null;
}

/**
 * Interprete deterministico de fechas en lenguaje natural.
 *
 * Lo usa el modo sin IA (fallback) y sirve como red de seguridad para validar
 * lo que devuelve el modelo. No pretende cubrir todo el castellano: cubre las
 * formas que realmente usa la gente para pedir un turno.
 */
export function interpretarFecha(texto: string, referencia: DateTime): FechaInterpretada {
  const t = NORMALIZAR(texto);
  const res: FechaInterpretada = { fecha: null, rango: null, hora: null, desdeHora: null };
  if (!t) return res;

  // Franja del dia
  // Ojo: "mañana" es el dia siguiente, "a la mañana" es la franja horaria.
  // La franja solo se activa cuando viene precedida de articulo/preposicion.
  if (/\b(a la|por la|en la|de|la)\s+ma(ñ|n)ana\b/.test(texto.toLowerCase())) res.rango = 'mañana';
  if (/\b(tarde)\b/.test(t)) res.rango = 'tarde';
  if (/\b(noche|nochecita)\b/.test(t)) res.rango = 'noche';
  if (/\b(temprano)\b/.test(t) && !res.rango) res.rango = 'mañana';

  // Hora explicita: "17:30", "a las 17", "5 de la tarde", "17hs"
  const mHoraMin = t.match(/\b([01]?\d|2[0-3])[:.]([0-5]\d)\b/);
  const mHoraSola = t.match(/\b(?:a las|alas|tipo|sobre las|desde las|despues de las|antes de las)\s+([01]?\d|2[0-3])\b/);
  const mHoraHs = t.match(/\b([01]?\d|2[0-3])\s*(?:hs|h|horas)\b/);
  // "5 de la tarde", "11 de la mañana"
  const mHoraFranja = t.match(/\b([01]?\d|2[0-3])\s+de\s+la\s+(tarde|manana|noche)\b/);
  let horaNum: number | null = null;
  let minNum = 0;
  if (mHoraMin) {
    horaNum = Number(mHoraMin[1]);
    minNum = Number(mHoraMin[2]);
  } else if (mHoraSola) {
    horaNum = Number(mHoraSola[1]);
  } else if (mHoraHs) {
    horaNum = Number(mHoraHs[1]);
  } else if (mHoraFranja) {
    horaNum = Number(mHoraFranja[1]);
  }
  if (horaNum !== null) {
    // "a las 5 de la tarde" -> 17. Si no aclara franja y el numero es chico,
    // se asume horario comercial de tarde (nadie pide turno a las 5 am).
    if (horaNum < 12 && (res.rango === 'tarde' || res.rango === 'noche')) horaNum += 12;
    else if (horaNum >= 1 && horaNum <= 7 && res.rango === null) horaNum += 12;
    if (horaNum >= 0 && horaNum <= 23) {
      const hhmm = minutosAHhmm(horaNum * 60 + minNum);
      if (/\b(desde las|despues de las|a partir de|de las)\b/.test(t)) res.desdeHora = hhmm;
      else res.hora = hhmm;
    }
  }

  const hoy = referencia.startOf('day');

  // ISO directo
  const mISO = t.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (mISO) {
    res.fecha = `${mISO[1]}-${mISO[2]}-${mISO[3]}`;
    return res;
  }

  // Fecha explicita dd/mm o dd/mm/yyyy o dd-mm
  const mDMY = t.match(/\b(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?\b/);
  if (mDMY) {
    const dia = Number(mDMY[1]);
    const mes = Number(mDMY[2]);
    let anio = mDMY[3] ? Number(mDMY[3]) : referencia.year;
    if (anio < 100) anio += 2000;
    const cand = DateTime.fromObject({ year: anio, month: mes, day: dia }, { zone: referencia.zone });
    if (cand.isValid) {
      // Sin año explicito y ya pasó: se entiende el año que viene.
      res.fecha = fechaDe(!mDMY[3] && cand < hoy ? cand.plus({ years: 1 }) : cand);
      return res;
    }
  }

  if (/\bpasado ?manana\b/.test(t)) {
    res.fecha = fechaDe(hoy.plus({ days: 2 }));
    return res;
  }
  if (/\bmanana\b/.test(t)) {
    res.fecha = fechaDe(hoy.plus({ days: 1 }));
    return res;
  }
  if (/\b(hoy|ahora|ya|cuanto antes|lo antes posible)\b/.test(t)) {
    res.fecha = fechaDe(hoy);
    return res;
  }
  const mDentro = t.match(/\b(?:dentro de|en)\s+(un|una|dos|tres|cuatro|cinco|seis|siete|\d{1,2})\s+(dia|dias|semana|semanas)\b/);
  if (mDentro) {
    const palabras: Record<string, number> = { un: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7 };
    const n = palabras[mDentro[1]!] ?? Number(mDentro[1]);
    if (Number.isFinite(n)) {
      res.fecha = fechaDe(mDentro[2]!.startsWith('semana') ? hoy.plus({ weeks: n }) : hoy.plus({ days: n }));
      return res;
    }
  }

  // Dia de la semana: "el sabado", "este sabado", "el sabado que viene"
  const idxDia = DIAS_NORMALIZADOS.findIndex((d) => new RegExp(`\\b${d}s?\\b`).test(t));
  if (idxDia >= 0) {
    const objetivo = idxDia + 1; // 1..7
    const siguiente = /\b(que viene|proximo|proxima|siguiente|la semana que viene)\b/.test(t);
    // "el sabado" / "este sabado" / "el sabado que viene" apuntan todos a la
    // proxima ocurrencia de ese dia; si hoy ya es ese dia, "que viene" salta una semana.
    let delta = (objetivo - referencia.weekday + 7) % 7;
    if (delta === 0 && siguiente) delta = 7;
    res.fecha = fechaDe(hoy.plus({ days: delta }));
    return res;
  }

  if (/\b(la semana que viene|proxima semana)\b/.test(t)) {
    res.fecha = fechaDe(hoy.plus({ days: 7 }));
    return res;
  }

  return res;
}

/** Ventana horaria aproximada de cada franja, usada para filtrar horarios ofrecidos. */
export function ventanaDeRango(rango: RangoDelDia): { desde: Hora; hasta: Hora } | null {
  switch (rango) {
    case 'mañana':
      return { desde: '00:00', hasta: '13:00' };
    case 'tarde':
      return { desde: '13:00', hasta: '19:00' };
    case 'noche':
      return { desde: '18:00', hasta: '23:59' };
    default:
      return null;
  }
}
