/** Proveedor Claude (Anthropic). Usa el bloque estable del prompt cacheado. */
import Anthropic from '@anthropic-ai/sdk';
import { env } from '../../config/env.js';
import type {
  Conversacion,
  PedidoInicial,
  ProveedorIA,
  RespuestaModelo,
  ResultadoDeHerramienta,
} from './tipos.js';
import { ErrorProveedor } from './tipos.js';

/** Junta el historial respetando la alternancia de roles que pide la API. */
function aMensajes(historial: PedidoInicial['historial'], mensaje: string): Anthropic.Beta.BetaMessageParam[] {
  const salida: Anthropic.Beta.BetaMessageParam[] = [];
  for (const h of historial) {
    const rol = h.rol === 'cliente' ? 'user' : 'assistant';
    const texto = h.texto.trim();
    if (!texto) continue;
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
  while (salida.length && salida[0]!.role === 'assistant') salida.shift();
  return salida;
}

export function crearProveedorClaude(opciones: { apiKey: string; modelo?: string }): ProveedorIA {
  const cliente = new Anthropic({
    apiKey: opciones.apiKey,
    timeout: env.AI_TIMEOUT_MS,
    maxRetries: 1,
    ...(env.AI_BASE_URL ? { baseURL: env.AI_BASE_URL } : {}),
  });
  const modelo = opciones.modelo ?? env.AI_MODEL;

  return {
    nombre: 'claude',
    modelo,
    iniciar(pedido: PedidoInicial): Conversacion {
      const mensajes = aMensajes(pedido.historial, pedido.mensaje);
      let ultimaRespuesta: Anthropic.Beta.BetaMessage | null = null;

      return {
        async siguiente(): Promise<RespuestaModelo> {
          const parametros: Anthropic.Beta.MessageCreateParamsNonStreaming = {
            model: modelo,
            max_tokens: env.AI_MAX_TOKENS,
            output_config: { effort: env.AI_EFFORT },
            system: [
              { type: 'text', text: pedido.sistemaEstable, cache_control: { type: 'ephemeral' } },
              { type: 'text', text: pedido.sistemaVolatil },
            ],
            tools: pedido.herramientas.map((h) => ({
              name: h.nombre,
              description: h.descripcion,
              input_schema: h.esquema as Anthropic.Beta.BetaTool['input_schema'],
            })),
            messages: mensajes,
            ...(env.AI_FALLBACK_REHUSO ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const } : {}),
          };

          let respuesta: Anthropic.Beta.BetaMessage;
          try {
            respuesta = await cliente.beta.messages.create(parametros);
          } catch (e) {
            if (e instanceof Anthropic.APIConnectionTimeoutError) throw new ErrorProveedor('timeout', 'el modelo tardó demasiado');
            throw new ErrorProveedor('api', e instanceof Error ? e.message : String(e));
          }
          ultimaRespuesta = respuesta;

          if (respuesta.stop_reason === 'refusal') {
            return { texto: '', herramientas: [], motivo: 'rehuso' };
          }

          const texto = respuesta.content
            .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')
            .map((b) => b.text)
            .join('\n')
            .trim();

          const herramientas = respuesta.content
            .filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === 'tool_use')
            .map((b) => ({ id: b.id, nombre: b.name, entrada: b.input }));

          return {
            texto,
            herramientas,
            motivo: respuesta.stop_reason === 'tool_use' && herramientas.length > 0 ? 'herramientas' : 'texto',
            uso: respuesta.usage
              ? {
                  entrada: respuesta.usage.input_tokens ?? 0,
                  salida: respuesta.usage.output_tokens ?? 0,
                  cacheLeido: respuesta.usage.cache_read_input_tokens ?? 0,
                }
              : undefined,
          };
        },

        agregarResultados(resultados: ResultadoDeHerramienta[]): void {
          if (!ultimaRespuesta) return;
          mensajes.push({ role: 'assistant', content: ultimaRespuesta.content });
          mensajes.push({
            role: 'user',
            content: resultados.map((r) => ({
              type: 'tool_result' as const,
              tool_use_id: r.id,
              content: r.contenido,
              ...(r.esError ? { is_error: true } : {}),
            })),
          });
        },
      };
    },
  };
}
