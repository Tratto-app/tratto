// Configuración de la cuenta: marca, audiencia y estrategia. Se valida al
// cargar; lo que todavía es hipótesis (validado:false) se informa como
// advertencia para que las skills lo presenten así.
import path from 'node:path';
import { leerJSON } from './conocimiento.mjs';
import { rutas } from './rutas.mjs';
import { validar } from './validar.mjs';

const TEXTO = { tipo: 'texto', min: 1, max: 600 };
const ITEM = { tipo: 'objeto', campos: { texto: { ...TEXTO, requerido: true }, validado: { tipo: 'booleano', requerido: true } } };
const LISTA_ITEMS = { tipo: 'lista', de: ITEM, min: 1, max: 30, requerido: true };

export const ESQUEMAS = {
  marca: {
    tipo: 'objeto',
    campos: {
      nombre: { ...TEXTO, requerido: true },
      que_es: { ...TEXTO, requerido: true },
      propuesta_valor: { ...TEXTO, requerido: true },
      diferenciales: { tipo: 'lista', de: TEXTO, min: 1, requerido: true },
      tono: {
        tipo: 'objeto', requerido: true,
        campos: { descripcion: { ...TEXTO, requerido: true }, rasgos: { tipo: 'lista', de: TEXTO }, evitar: { tipo: 'lista', de: TEXTO } },
      },
      palabras_no: { tipo: 'lista', de: TEXTO, requerido: true },
      restricciones: { tipo: 'lista', de: TEXTO, requerido: true },
      cta_principal: { ...TEXTO, requerido: true },
      rubros: { tipo: 'objeto', campos: { cantidad: { tipo: 'entero', min: 1 }, frase: TEXTO, categorias: { tipo: 'lista', de: TEXTO }, fuente: TEXTO } },
      sesgo_oficios: { tipo: 'objeto', campos: { palabras: { tipo: 'lista', de: { tipo: 'texto', min: 1, max: 80 }, min: 1, requerido: true }, minimo: { tipo: 'entero', min: 1 }, salvo: { tipo: 'lista', de: TEXTO }, motivo: { ...TEXTO, requerido: true } } },
      alertas: {
        tipo: 'lista', max: 30,
        de: { tipo: 'objeto', campos: { palabras: { tipo: 'lista', de: { tipo: 'texto', min: 1, max: 80 }, min: 1, requerido: true }, motivo: { ...TEXTO, requerido: true } } },
      },
    },
  },
  audiencia: {
    tipo: 'objeto',
    campos: {
      segmentos: {
        tipo: 'lista', min: 1, max: 10, requerido: true,
        de: {
          tipo: 'objeto',
          campos: {
            id: { tipo: 'texto', min: 1, max: 40, requerido: true },
            nombre: { ...TEXTO, requerido: true },
            descripcion: { ...TEXTO, requerido: true },
            nivel_conocimiento: { tipo: 'enum', valores: ['frio', 'tibio', 'caliente'], requerido: true },
            objetivo: { ...TEXTO, requerido: true },
            problemas: LISTA_ITEMS, deseos: LISTA_ITEMS, objeciones: LISTA_ITEMS, lenguaje: LISTA_ITEMS,
          },
        },
      },
    },
  },
  estrategia: {
    tipo: 'objeto',
    campos: {
      nicho: { ...TEXTO, requerido: true },
      objetivo_comercial: { ...TEXTO, requerido: true },
      plataformas: { tipo: 'lista', de: TEXTO, min: 1, requerido: true },
      pilares: {
        tipo: 'lista', min: 1, max: 12, requerido: true,
        de: {
          tipo: 'objeto',
          campos: {
            id: { tipo: 'texto', min: 1, max: 40, requerido: true },
            nombre: { ...TEXTO, requerido: true },
            descripcion: { ...TEXTO, requerido: true },
            porcentaje: { tipo: 'entero', min: 0, max: 100, requerido: true },
          },
        },
      },
    },
  },
};

// Devuelve { marca, audiencia, estrategia, errores, advertencias }.
// No lanza: quien llama decide si los errores lo frenan.
export function cargarConfig() {
  const salida = { errores: [], advertencias: [] };
  for (const nombre of Object.keys(ESQUEMAS)) {
    const archivo = path.join(rutas.config, `${nombre}.json`);
    try {
      salida[nombre] = leerJSON(archivo);
    } catch (e) {
      salida.errores.push(e.message);
      continue;
    }
    for (const err of validar(salida[nombre], ESQUEMAS[nombre])) salida.errores.push(`config/${nombre}.json → ${err}`);
  }

  if (salida.audiencia?.segmentos) {
    const ids = new Set();
    for (const s of salida.audiencia.segmentos) {
      if (ids.has(s.id)) salida.errores.push(`config/audiencia.json → segmento repetido: ${s.id}`);
      ids.add(s.id);
      let hipotesis = 0, total = 0;
      for (const campo of ['problemas', 'deseos', 'objeciones', 'lenguaje']) {
        for (const item of s[campo] || []) { total++; if (!item.validado) hipotesis++; }
      }
      if (hipotesis) salida.advertencias.push(`Segmento "${s.id}": ${hipotesis} de ${total} ítems son hipótesis (validado:false). Presentarlos como hipótesis, no como datos.`);
    }
  }

  if (salida.estrategia?.pilares) {
    const suma = salida.estrategia.pilares.reduce((a, p) => a + (p.porcentaje || 0), 0);
    if (suma !== 100) salida.errores.push(`config/estrategia.json → los porcentajes de los pilares suman ${suma}, tienen que sumar 100`);
  }
  return salida;
}

export function segmento(config, id) {
  const segs = config.audiencia?.segmentos || [];
  if (!id) return segs[0];
  return segs.find((s) => s.id === id);
}
