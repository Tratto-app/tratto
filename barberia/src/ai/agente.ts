/**
 * Agente conversacional.
 *
 * Loop manual de tool use, no el helper del SDK, porque el sistema necesita
 * controlar cada paso: validar los argumentos con zod, inyectar el teléfono del
 * cliente desde el canal y no desde el modelo, cortar por iteraciones y por
 * tiempo, y poder caer al modo menú si algo falla.
 *
 * El loop es neutral respecto del proveedor: atrás puede haber Claude u OpenAI
 * (ver src/ai/proveedores). Cambiar de uno a otro es cambiar AI_PROVEEDOR.
 */
import { env } from '../config/env.js';
import { log } from '../shared/log.js';
import { recortar } from '../shared/texto.js';
import { DEFINICIONES, ejecutarHerramienta, type Llamador } from './herramientas.js';
import { promptEstable, promptVolatil, type DatosVolatiles } from './prompt.js';
import { proveedorIA } from './proveedores/index.js';
import { ErrorProveedor, type ProveedorIA, type ResultadoDeHerramienta } from './proveedores/tipos.js';

export class ErrorIA extends Error {
  readonly motivo: 'sin_credencial' | 'timeout' | 'api' | 'rehuso' | 'sin_respuesta';
  constructor(motivo: ErrorIA['motivo'], mensaje: string) {
    super(mensaje);
    this.name = 'ErrorIA';
    this.motivo = motivo;
  }
}

export interface RespuestaAgente {
  texto: string;
  herramientasUsadas: string[];
  iteraciones: number;
  /** El cliente pidió hablar con una persona. */
  derivar: boolean;
  proveedor?: string;
  uso?: { entrada: number; salida: number; cacheLeido: number };
}

export interface TurnoDeConversacion {
  rol: 'cliente' | 'bot';
  texto: string;
}

export interface PedidoAgente {
  mensaje: string;
  historial: TurnoDeConversacion[];
  datos: DatosVolatiles;
  llamador: Llamador;
}

/** Conversa con el modelo hasta que deja de pedir herramientas. */
export async function responder(pedido: PedidoAgente, proveedorInyectado?: ProveedorIA): Promise<RespuestaAgente> {
  let proveedor: ProveedorIA;
  try {
    proveedor = proveedorInyectado ?? proveedorIA();
  } catch (e) {
    if (e instanceof ErrorProveedor) throw new ErrorIA(e.motivo === 'rehuso' ? 'api' : e.motivo, e.message);
    throw new ErrorIA('sin_credencial', e instanceof Error ? e.message : String(e));
  }

  const { datos, llamador } = pedido;
  const herramientasUsadas: string[] = [];
  const arranque = Date.now();

  const conversacion = proveedor.iniciar({
    sistemaEstable: promptEstable(datos.cfg),
    sistemaVolatil: promptVolatil(datos),
    historial: pedido.historial,
    mensaje: pedido.mensaje,
    herramientas: DEFINICIONES,
  });

  let iteraciones = 0;
  let textoFinal = '';
  let uso: RespuestaAgente['uso'];

  while (iteraciones < env.AI_MAX_ITERACIONES) {
    iteraciones++;

    let respuesta;
    try {
      respuesta = await conversacion.siguiente();
    } catch (e) {
      if (e instanceof ErrorProveedor) {
        if (e.motivo === 'timeout') throw new ErrorIA('timeout', e.message);
        log.error({ proveedor: proveedor.nombre, err: e.message }, 'error llamando a la API del modelo');
        throw new ErrorIA('api', e.message);
      }
      throw new ErrorIA('api', e instanceof Error ? e.message : String(e));
    }

    if (respuesta.uso) uso = respuesta.uso;
    if (respuesta.motivo === 'rehuso') throw new ErrorIA('rehuso', 'el modelo declinó responder');
    if (respuesta.texto) textoFinal = respuesta.texto;
    if (respuesta.motivo !== 'herramientas' || respuesta.herramientas.length === 0) break;

    const resultados: ResultadoDeHerramienta[] = [];
    for (const pedidoHerramienta of respuesta.herramientas) {
      herramientasUsadas.push(pedidoHerramienta.nombre);
      const r = await ejecutarHerramienta(pedidoHerramienta.nombre, pedidoHerramienta.entrada, llamador);
      resultados.push({ id: pedidoHerramienta.id, contenido: JSON.stringify(r.datos), esError: !r.ok });
    }
    conversacion.agregarResultados(resultados);
  }

  if (!textoFinal) throw new ErrorIA('sin_respuesta', 'el modelo no devolvió texto para el cliente');

  log.debug(
    { proveedor: proveedor.nombre, iteraciones, herramientas: herramientasUsadas, ms: Date.now() - arranque, uso },
    'respuesta del agente',
  );

  return {
    texto: recortar(limpiarTexto(textoFinal), datos.cfg.agente.max_caracteres_respuesta),
    herramientasUsadas,
    iteraciones,
    derivar: Boolean(llamador.estado.pedidoDerivacion),
    proveedor: proveedor.nombre,
    uso,
  };
}

/** Saca restos de markdown y cualquier id interno que se haya escapado. */
function limpiarTexto(texto: string): string {
  return texto
    .replace(/\*\*(.+?)\*\*/g, '*$1*')
    .replace(/\bTUR-[A-Z0-9]{6}\b/g, 'tu turno')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
