/**
 * Configuracion central del negocio.
 *
 * Toda la informacion comercial (nombre, direccion, servicios, precios, horarios,
 * feriados, reglas y textos) vive en `config/negocio.json`. Este modulo la lee,
 * la valida y la expone tipada. Ningun otro archivo del proyecto debe hardcodear
 * un horario, un precio ni una duracion.
 */
import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';

const HORA = /^([01]\d|2[0-3]):([0-5]\d)$/;
const FECHA = /^\d{4}-\d{2}-\d{2}$/;

const tramoSchema = z
  .tuple([z.string().regex(HORA, 'hora invalida, usar HH:mm'), z.string().regex(HORA, 'hora invalida, usar HH:mm')])
  .refine(([desde, hasta]) => desde < hasta, 'el tramo tiene que terminar despues de empezar');

const diaSchema = z.object({
  abierto: z.boolean(),
  tramos: z.array(tramoSchema),
});

export const servicioSchema = z.object({
  id: z.string().min(1).regex(/^[a-z0-9_]+$/, 'el id del servicio solo admite minusculas, numeros y guion bajo'),
  nombre: z.string().min(1),
  descripcion: z.string().default(''),
  precio: z.number().min(0).default(0),
  duracion_min: z.number().int().positive(),
  activo: z.boolean().default(true),
  alias: z.array(z.string()).default([]),
});

const negocioSchema = z.object({
  negocio: z.object({
    nombre: z.string().min(1),
    direccion: z.string().default(''),
    como_llegar: z.string().default(''),
    telefono: z.string().default(''),
    instagram: z.string().default(''),
    maps: z.string().default(''),
    medios_de_pago: z.array(z.string()).default([]),
    codigo_pais: z.string().regex(/^\d{1,4}$/).default('54'),
    timezone: z.string().default('America/Argentina/Buenos_Aires'),
    moneda: z.string().default('ARS'),
  }),
  horarios: z.object({
    dias: z.record(z.enum(['1', '2', '3', '4', '5', '6', '7']), diaSchema),
    horarios_especiales: z
      .array(z.object({ fecha: z.string().regex(FECHA), tramos: z.array(tramoSchema), motivo: z.string().default('') }))
      .default([]),
    feriados: z.array(z.object({ fecha: z.string().regex(FECHA), motivo: z.string().default('') })).default([]),
    vacaciones: z
      .array(z.object({ desde: z.string().regex(FECHA), hasta: z.string().regex(FECHA), motivo: z.string().default('') }))
      .default([]),
  }),
  servicios: z.array(servicioSchema).min(1),
  reglas: z.object({
    anticipacion_minima_min: z.number().int().min(0).default(60),
    anticipacion_maxima_dias: z.number().int().positive().default(45),
    permite_reservar_mismo_dia: z.boolean().default(true),
    margen_entre_turnos_min: z.number().int().min(0).default(0),
    grilla_min: z.number().int().positive().default(15),
    max_turnos_futuros_por_cliente: z.number().int().positive().default(2),
    cancelacion_minima_horas: z.number().min(0).default(2),
    politica_cancelacion: z.string().default(''),
    hold_minutos: z.number().int().positive().default(10),
    max_opciones_horarios: z.number().int().positive().default(6),
  }),
  recordatorios: z.object({
    activos: z.boolean().default(true),
    avisos: z
      .array(z.object({ id: z.string().min(1), horas_antes: z.number().positive(), activo: z.boolean().default(true) }))
      .default([]),
    no_enviar_antes_de: z.string().regex(HORA).default('09:00'),
    no_enviar_despues_de: z.string().regex(HORA).default('21:00'),
  }),
  mensajes: z.object({
    bienvenida: z.string(),
    fuera_de_horario_comercial: z.string().nullable().default(null),
    error_generico: z.string(),
    error_al_confirmar: z.string(),
    derivacion_humana: z.string(),
    despedida: z.string(),
  }),
  limpieza: z
    .object({
      activa: z.boolean().default(true),
      conservar_dias: z.number().int().min(1).max(3650).default(7),
    })
    .default({ activa: true, conservar_dias: 7 }),
  agente: z.object({
    tono: z.string(),
    nombre_bot: z.string(),
    max_caracteres_respuesta: z.number().int().positive().default(600),
  }),
});

export type ConfigNegocio = z.infer<typeof negocioSchema>;
export type Servicio = z.infer<typeof servicioSchema>;

const RUTA_POR_DEFECTO = path.resolve(process.cwd(), 'config/negocio.json');

function validarCoherencia(cfg: ConfigNegocio): string[] {
  const problemas: string[] = [];
  const ids = new Set<string>();
  for (const s of cfg.servicios) {
    if (ids.has(s.id)) problemas.push(`servicio duplicado: "${s.id}"`);
    ids.add(s.id);
    if (s.duracion_min % cfg.reglas.grilla_min !== 0) {
      // No es un error: solo desalinea la grilla y genera menos huecos aprovechables.
      problemas.push(
        `el servicio "${s.id}" dura ${s.duracion_min} min y la grilla es de ${cfg.reglas.grilla_min} min: ` +
          `los horarios ofrecidos van a quedar desalineados (aviso, no bloquea)`,
      );
    }
  }
  if (!cfg.servicios.some((s) => s.activo)) problemas.push('no hay ningun servicio activo');
  for (const [dia, cfgDia] of Object.entries(cfg.horarios.dias)) {
    if (!cfgDia.abierto) continue;
    const ordenados = [...cfgDia.tramos].sort((a, b) => a[0].localeCompare(b[0]));
    for (let i = 1; i < ordenados.length; i++) {
      const previo = ordenados[i - 1]!;
      const actual = ordenados[i]!;
      if (actual[0] < previo[1]) problemas.push(`el dia ${dia} tiene tramos horarios superpuestos`);
    }
    if (cfgDia.tramos.length === 0) problemas.push(`el dia ${dia} figura abierto pero no tiene tramos horarios`);
  }
  for (const v of cfg.horarios.vacaciones) {
    if (v.hasta < v.desde) problemas.push(`vacaciones invalidas: ${v.desde} > ${v.hasta}`);
  }
  return problemas;
}

let cache: { cfg: ConfigNegocio; mtimeMs: number; ruta: string } | null = null;

export function cargarConfigNegocio(ruta: string = RUTA_POR_DEFECTO): ConfigNegocio {
  const crudo = JSON.parse(fs.readFileSync(ruta, 'utf8'));
  const parsed = negocioSchema.safeParse(crudo);
  if (!parsed.success) {
    const detalle = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`config/negocio.json invalido:\n${detalle}`);
  }
  return parsed.data;
}

/**
 * Devuelve la config viva. Relee el archivo si cambio en disco, asi el barbero
 * puede editar precios u horarios sin reiniciar el servidor.
 */
export function negocio(ruta: string = RUTA_POR_DEFECTO): ConfigNegocio {
  const stat = fs.statSync(ruta);
  if (!cache || cache.mtimeMs !== stat.mtimeMs || cache.ruta !== ruta) {
    cache = { cfg: cargarConfigNegocio(ruta), mtimeMs: stat.mtimeMs, ruta };
  }
  return cache.cfg;
}

export function invalidarCacheNegocio(): void {
  cache = null;
}

/**
 * Guarda la configuracion validada. La escritura es atomica (archivo temporal
 * + rename) para que un corte de luz no deje el JSON a medias.
 */
export function guardarConfigNegocio(nueva: unknown, ruta: string = RUTA_POR_DEFECTO): ConfigNegocio {
  const parsed = negocioSchema.safeParse(nueva);
  if (!parsed.success) {
    const detalle = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Configuración inválida: ${detalle}`);
  }
  const problemas = validarCoherencia(parsed.data);
  const bloqueantes = problemas.filter((p) => !p.includes('(aviso, no bloquea)'));
  if (bloqueantes.length) throw new Error(`Configuración incoherente: ${bloqueantes.join('; ')}`);

  const temporal = `${ruta}.tmp`;
  fs.writeFileSync(temporal, `${JSON.stringify(parsed.data, null, 2)}\n`, 'utf8');
  fs.renameSync(temporal, ruta);
  invalidarCacheNegocio();
  return parsed.data;
}

export function revisarConfig(ruta: string = RUTA_POR_DEFECTO): string[] {
  return validarCoherencia(cargarConfigNegocio(ruta));
}

export function servicioPorId(cfg: ConfigNegocio, id: string): Servicio | undefined {
  return cfg.servicios.find((s) => s.id === id);
}

export function serviciosActivos(cfg: ConfigNegocio): Servicio[] {
  return cfg.servicios.filter((s) => s.activo);
}

/** Resuelve un servicio a partir de texto libre del cliente ("corte y barba", "la barba"). */
export function resolverServicio(cfg: ConfigNegocio, texto: string): Servicio | undefined {
  const norm = (s: string) =>
    s
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9 ]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  const t = norm(texto);
  if (!t) return undefined;
  const activos = serviciosActivos(cfg);
  for (const s of activos) {
    if (norm(s.id) === t || norm(s.nombre) === t) return s;
    if (s.alias.some((a) => norm(a) === t)) return s;
  }
  // Coincidencia parcial: el alias/nombre mas largo que aparezca en el texto gana,
  // asi "corte y barba" no matchea "corte" antes que "corte + barba".
  let mejor: { s: Servicio; largo: number } | undefined;
  for (const s of activos) {
    for (const candidato of [s.nombre, ...s.alias]) {
      const c = norm(candidato);
      if (c.length >= 4 && t.includes(c) && (!mejor || c.length > mejor.largo)) mejor = { s, largo: c.length };
    }
  }
  return mejor?.s;
}
