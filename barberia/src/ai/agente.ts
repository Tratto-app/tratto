/**
 * Agente conversacional.
 *
 * Loop manual de tool use (no el tool runner del SDK) porque el sistema
 * necesita controlar cada paso: validar los argumentos con zod, inyectar el
 * telefono del cliente desde el canal y no desde el modelo, cortar por
 * iteraciones y por tiempo, y poder caer al modo menú si algo falla.
 */
import Anthropic from '@anthropic-ai/sdk';
import { claveIA, env } from '../config/env.js';
import { log } from '../shared/log.js';
import { recortar } from '../shared/texto.js';
import { DEFINICIONES, ejecutarHerramienta, type Llamador } from './herramientas.js';
import { promptEstable, promptVolatil, type DatosVolatiles } from './prompt.js';

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
  /** El cliente pidio hablar con una persona. */
  derivar: boolean;
  uso?: { entrada: number; salida: number; cacheLeido: number };
}

let cliente: Anthropic | null = null;

/**
 * Lo minimo que el agente necesita del SDK. Tenerlo como interfaz permite
 * inyectar un doble en los tests y probar el loop de herramientas sin gastar
 * tokens ni depender de la red.
 */
export interface ClienteIA {
  crear(parametros: Anthropic.Beta.MessageCreateParamsNonStreaming): Promise<Anthropic.Beta.BetaMessage>;
}

function obtenerCliente(): ClienteIA {
  if (!claveIA) throw new ErrorIA('sin_credencial', 'no hay AI_API_KEY configurada');
  if (!cliente) {
    cliente = new Anthropic({ apiKey: claveIA, timeout: env.AI_TIMEOUT_MS, maxRetries: 1 });
  }
  const sdk = cliente;
  return { crear: (parametros) => sdk.beta.messages.create(parametros) };
}

export interface TurnoDeConversacion {
  rol: 'cliente' | 'bot';
  texto: string;
}

export type { Anthropic };

export interface PedidoAgente {
  mensaje: string;
  historial: TurnoDeConversacion[];
  datos: DatosVolatiles;
  llamador: Llamador;
}

function aMensajes(historial: TurnoDeConversacion[], mensaje: string): Anthropic.Beta.BetaMessageParam[] {
  const salida: Anthropic.Beta.BetaMessageParam[] = [];
  for (const h of historial) {
    const rol = h.rol === 'cliente' ? 'user' : 'assistant';
    const texto = h.texto.trim();
    if (!texto) continue;
    // La API no acepta dos mensajes seguidos del mismo rol.
    const ultimo = salida[salida.length - 1];
    if (ultimo && ultimo.role === rol) {
      ultimo.content = `${String(ultimo.content)}\n${texto}`;
      continue;
    }
    salida.push({ role: rol, content: texto });
  }
  if (salida.length && salida[salida.length - 1]!.role === 'user') {
    const ultimo = salida[salida.length - 1]!;
    ultimo.content = `${String(ultimo.content)}\n${mensaje}`;
  } else {
    salida.push({ role: 'user', content: mensaje });
  }
  // La conversacion tiene que arrancar con un mensaje del cliente.
  while (salida.length && salida[0]!.role === 'assistant') salida.shift();
  return salida;
}

/** Conversa con el modelo hasta que deja de pedir herramientas. */
export async function responder(pedido: PedidoAgente, clienteInyectado?: ClienteIA): Promise<RespuestaAgente> {
  const anthropic = clienteInyectado ?? obtenerCliente();
  const { datos, llamador } = pedido;
  const herramientasUsadas: string[] = [];
  const mensajes = aMensajes(pedido.historial, pedido.mensaje);
  const arranque = Date.now();

  let iteraciones = 0;
  let textoFinal = '';
  let uso: RespuestaAgente['uso'];

  while (iteraciones < env.AI_MAX_ITERACIONES) {
    iteraciones++;

    const parametros: Anthropic.Beta.MessageCreateParamsNonStreaming = {
      model: env.AI_MODEL,
      max_tokens: env.AI_MAX_TOKENS,
      output_config: { effort: env.AI_EFFORT },
      system: [
        // Bloque estable primero y cacheado: baja mucho el costo por mensaje.
        { type: 'text', text: promptEstable(datos.cfg), cache_control: { type: 'ephemeral' } },
        { type: 'text', text: promptVolatil(datos) },
      ],
      tools: DEFINICIONES as unknown as Anthropic.Beta.BetaToolUnion[],
      messages: mensajes,
      ...(env.AI_FALLBACK_REHUSO ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const } : {}),
    };

    let respuesta: Anthropic.Beta.BetaMessage;
    try {
      respuesta = await anthropic.crear(parametros);
    } catch (e) {
      if (e instanceof Anthropic.APIConnectionTimeoutError) throw new ErrorIA('timeout', 'el modelo tardo demasiado');
      const detalle = e instanceof Error ? e.message : String(e);
      log.error({ err: detalle }, 'error llamando a la API del modelo');
      throw new ErrorIA('api', detalle);
    }

    if (respuesta.usage) {
      uso = {
        entrada: respuesta.usage.input_tokens ?? 0,
        salida: respuesta.usage.output_tokens ?? 0,
        cacheLeido: respuesta.usage.cache_read_input_tokens ?? 0,
      };
    }

    if (respuesta.stop_reason === 'refusal') {
      throw new ErrorIA('rehuso', 'el modelo declino responder');
    }

    const textoDeEsteTurno = respuesta.content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('\n')
      .trim();
    if (textoDeEsteTurno) textoFinal = textoDeEsteTurno;

    const pedidosDeHerramienta = respuesta.content.filter(
      (b): b is Anthropic.Beta.BetaToolUseBlock => b.type === 'tool_use',
    );

    if (respuesta.stop_reason !== 'tool_use' || pedidosDeHerramienta.length === 0) break;

    mensajes.push({ role: 'assistant', content: respuesta.content });

    const resultados: Anthropic.Beta.BetaToolResultBlockParam[] = [];
    for (const pedidoHerramienta of pedidosDeHerramienta) {
      herramientasUsadas.push(pedidoHerramienta.name);
      const r = await ejecutarHerramienta(pedidoHerramienta.name, pedidoHerramienta.input, llamador);
      resultados.push({
        type: 'tool_result',
        tool_use_id: pedidoHerramienta.id,
        content: JSON.stringify(r.datos),
        ...(r.ok ? {} : { is_error: true }),
      });
    }
    mensajes.push({ role: 'user', content: resultados });
  }

  if (!textoFinal) throw new ErrorIA('sin_respuesta', 'el modelo no devolvio texto para el cliente');

  log.debug(
    { iteraciones, herramientas: herramientasUsadas, ms: Date.now() - arranque, uso },
    'respuesta del agente',
  );

  return {
    texto: recortar(limpiarTexto(textoFinal), datos.cfg.agente.max_caracteres_respuesta),
    herramientasUsadas,
    iteraciones,
    derivar: Boolean(llamador.estado.pedidoDerivacion),
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
