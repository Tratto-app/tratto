// Memoria del sistema: un archivo JSONL por tipo de registro, en
// tools/contenido/memoria/ (o CONTENIDO_MEMORIA_DIR). JSONL porque se agrega
// de a una línea, se lee con cualquier herramienta y un renglón roto no
// arruina el resto.
//
// Todo lo que entra se valida contra el esquema del tipo y se limpia
// (caracteres de control, largo máximo). Lo que se guarda es DATO: las
// skills lo leen como contenido de referencia, nunca como instrucciones.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { ErrorEntrada } from './errores.mjs';
import { rutas } from './rutas.mjs';
import { limpiar, normalizar } from './texto.mjs';
import { validar } from './validar.mjs';

const FORMATOS = ['reel', 'carrusel', 'historia', 'publicacion', 'idea', 'perfil'];
const T = (max, requerido = false) => ({ tipo: 'texto', min: 1, max, requerido });
const N = { tipo: 'entero', min: 0, max: 1e10 };

export const TIPOS = {
  contenido: {
    archivo: 'contenidos.jsonl', prefijo: 'c',
    esquema: {
      tipo: 'objeto', extra: false,
      campos: {
        formato: { tipo: 'enum', valores: FORMATOS, requerido: true },
        titulo: T(160, true),
        pilar: T(40), segmento: T(40),
        hook: T(300),
        guion: T(12000),
        cta: T(300),
        estado: { tipo: 'enum', valores: ['idea', 'borrador', 'aprobado', 'publicado', 'descartado'], requerido: true },
        puntaje: { tipo: 'entero', min: 0, max: 100 },
        inspiracion: T(500),
        url: T(500),
        publicado_el: { tipo: 'fecha' },
        notas: T(2000),
      },
    },
    actualizables: ['estado', 'puntaje', 'url', 'publicado_el', 'notas', 'guion', 'hook', 'cta', 'titulo'],
  },
  hook: {
    archivo: 'hooks.jsonl', prefijo: 'h',
    esquema: {
      tipo: 'objeto', extra: false,
      campos: {
        texto: T(300, true),
        categoria: T(40),
        formato: { tipo: 'enum', valores: FORMATOS },
        contenido_id: T(40),
      },
    },
    actualizables: [],
  },
  resultado: {
    archivo: 'resultados.jsonl', prefijo: 'r',
    esquema: {
      tipo: 'objeto', extra: false,
      campos: {
        contenido_id: T(40, true),
        fecha: { tipo: 'fecha', requerido: true },
        fuente: { tipo: 'enum', valores: ['manual', 'instagram_api'], requerido: true },
        alcance: { ...N, min: 1, requerido: true },
        reproducciones: N, me_gusta: N,
        comentarios: { ...N, requerido: true },
        compartidos: { ...N, requerido: true },
        guardados: { ...N, requerido: true },
        visitas_perfil: N, seguidores_nuevos: N, clics_link: N, respuestas: N,
        retencion_promedio_seg: { tipo: 'numero', min: 0, max: 3600 },
        notas: T(1000),
      },
    },
    actualizables: [],
  },
  aprendizaje: {
    archivo: 'aprendizajes.jsonl', prefijo: 'a',
    esquema: {
      tipo: 'objeto', extra: false,
      campos: {
        texto: T(600, true),
        tipo: { tipo: 'enum', valores: ['funciona', 'no_funciona', 'hipotesis'], requerido: true },
        evidencia: T(1000, true),
        contenido_ids: { tipo: 'lista', de: T(40), max: 50 },
      },
    },
    actualizables: ['tipo', 'evidencia'],
  },
  idea: {
    archivo: 'ideas.jsonl', prefijo: 'i',
    esquema: {
      tipo: 'objeto', extra: false,
      campos: {
        texto: T(1000, true),
        formato: { tipo: 'enum', valores: FORMATOS },
        pilar: T(40), segmento: T(40),
        origen: T(300),
        estado: { tipo: 'enum', valores: ['pendiente', 'usada', 'descartada'], requerido: true },
      },
    },
    actualizables: ['estado'],
  },
};

const MAX_LINEA = 40000;

function archivoDe(tipo) {
  const def = TIPOS[tipo];
  if (!def) throw new ErrorEntrada(`Tipo de registro desconocido: "${tipo}". Opciones: ${Object.keys(TIPOS).join(', ')}`);
  return path.join(rutas.memoria, def.archivo);
}

// Limpia recursivamente todos los textos de un registro.
function sanear(v) {
  if (typeof v === 'string') return limpiar(v, 12000);
  if (Array.isArray(v)) return v.map(sanear);
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, sanear(x)]));
  return v;
}

function nuevoId(prefijo, fecha = new Date()) {
  const dia = fecha.toISOString().slice(0, 10).replace(/-/g, '');
  return `${prefijo}-${dia}-${crypto.randomBytes(3).toString('hex')}`;
}

// Devuelve { registros, corruptas: [{ linea, error }] }.
export function leer(tipo) {
  const archivo = archivoDe(tipo);
  if (!fs.existsSync(archivo)) return { registros: [], corruptas: [] };
  const registros = [], corruptas = [];
  fs.readFileSync(archivo, 'utf8').split('\n').forEach((linea, i) => {
    if (!linea.trim()) return;
    try {
      const r = JSON.parse(linea);
      if (!r || typeof r !== 'object' || !r.id) throw new Error('sin id');
      registros.push(r);
    } catch (e) {
      corruptas.push({ linea: i + 1, error: e.message });
    }
  });
  return { registros, corruptas };
}

function validarReferencias(tipo, datos, config) {
  const errores = [];
  if (config?.estrategia?.pilares && datos.pilar && !config.estrategia.pilares.some((p) => p.id === datos.pilar)) {
    errores.push(`pilar: "${datos.pilar}" no existe en config/estrategia.json (${config.estrategia.pilares.map((p) => p.id).join(', ')})`);
  }
  if (config?.audiencia?.segmentos && datos.segmento && !config.audiencia.segmentos.some((s) => s.id === datos.segmento)) {
    errores.push(`segmento: "${datos.segmento}" no existe en config/audiencia.json (${config.audiencia.segmentos.map((s) => s.id).join(', ')})`);
  }
  const ids = [];
  if (tipo === 'resultado' || (tipo === 'hook' && datos.contenido_id)) ids.push(datos.contenido_id);
  if (tipo === 'aprendizaje') ids.push(...(datos.contenido_ids || []));
  if (ids.length) {
    const existentes = new Set(leer('contenido').registros.map((c) => c.id));
    for (const id of ids) if (!existentes.has(id)) errores.push(`contenido_id: "${id}" no existe en la memoria (registrá primero el contenido)`);
  }
  if (tipo === 'resultado') {
    for (const c of ['comentarios', 'compartidos', 'guardados']) {
      if (typeof datos[c] === 'number' && typeof datos.alcance === 'number' && datos[c] > datos.alcance * 5) {
        errores.push(`${c}: ${datos[c]} es más de 5 veces el alcance (${datos.alcance}); revisá que no estén invertidos`);
      }
    }
  }
  return errores;
}

// Registra un dato nuevo. Devuelve el registro guardado (con id y creado_en).
// Para hooks, si ya existe uno igual devuelve el existente con duplicado:true.
export function registrar(tipo, datos, { config, ahora = new Date() } = {}) {
  const archivo = archivoDe(tipo);
  const def = TIPOS[tipo];
  if (!datos || typeof datos !== 'object' || Array.isArray(datos)) throw new ErrorEntrada('Los datos tienen que ser un objeto JSON');
  const limpio = sanear(datos);
  if (tipo === 'contenido' && limpio.estado === undefined) limpio.estado = 'borrador';
  if (tipo === 'idea' && limpio.estado === undefined) limpio.estado = 'pendiente';
  if (tipo === 'resultado' && limpio.fuente === undefined) limpio.fuente = 'manual';
  const errores = [...validar(limpio, def.esquema), ...validarReferencias(tipo, limpio, config)];
  if (errores.length) throw new ErrorEntrada(`El ${tipo} no es válido`, errores);

  if (tipo === 'hook') {
    const n = normalizar(limpio.texto);
    const igual = leer('hook').registros.find((h) => normalizar(h.texto) === n);
    if (igual) return { ...igual, duplicado: true };
  }

  const registro = { id: nuevoId(def.prefijo, ahora), creado_en: ahora.toISOString(), ...limpio };
  const linea = JSON.stringify(registro);
  if (linea.length > MAX_LINEA) throw new ErrorEntrada(`El registro es demasiado largo (${linea.length} caracteres; máximo ${MAX_LINEA})`);
  fs.mkdirSync(path.dirname(archivo), { recursive: true });
  fs.appendFileSync(archivo, linea + '\n', 'utf8');

  // El hook de un contenido también queda en el historial de hooks.
  if (tipo === 'contenido' && registro.hook) {
    registrar('hook', { texto: registro.hook, formato: registro.formato, contenido_id: registro.id }, { ahora });
  }
  return registro;
}

// Cambia campos permitidos de un registro existente. Reescribe el archivo de
// forma atómica (archivo temporal + rename) y conserva tal cual las líneas
// que no se pudieron leer.
export function actualizar(tipo, id, cambios, { ahora = new Date() } = {}) {
  const archivo = archivoDe(tipo);
  const def = TIPOS[tipo];
  if (!cambios || typeof cambios !== 'object' || Array.isArray(cambios)) throw new ErrorEntrada('Los cambios tienen que ser un objeto JSON');
  const noPermitidos = Object.keys(cambios).filter((k) => !def.actualizables.includes(k));
  if (noPermitidos.length) throw new ErrorEntrada(`No se pueden cambiar: ${noPermitidos.join(', ')}. Campos actualizables de ${tipo}: ${def.actualizables.join(', ') || 'ninguno'}`);
  if (!fs.existsSync(archivo)) throw new ErrorEntrada(`No hay registros de tipo ${tipo}`);

  const lineas = fs.readFileSync(archivo, 'utf8').split('\n');
  let actualizado = null;
  const nuevas = lineas.map((linea) => {
    if (!linea.trim()) return linea;
    let r;
    try { r = JSON.parse(linea); } catch { return linea; }
    if (r?.id !== id) return linea;
    const { id: _id, creado_en, actualizado_en, ...resto } = r;
    const candidato = { ...resto, ...sanear(cambios) };
    const errores = validar(candidato, def.esquema);
    if (errores.length) throw new ErrorEntrada(`El cambio deja el ${tipo} inválido`, errores);
    actualizado = { id: _id, creado_en, ...candidato, actualizado_en: ahora.toISOString() };
    return JSON.stringify(actualizado);
  });
  if (!actualizado) throw new ErrorEntrada(`No existe un ${tipo} con id "${id}"`);
  const tmp = `${archivo}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, nuevas.join('\n'), 'utf8');
  fs.renameSync(tmp, archivo);
  return actualizado;
}

export function estadoMemoria() {
  const salida = {};
  for (const tipo of Object.keys(TIPOS)) {
    const { registros, corruptas } = leer(tipo);
    salida[tipo] = { total: registros.length, corruptas };
  }
  return salida;
}
