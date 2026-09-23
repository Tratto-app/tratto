/**
 * Proveedor OpenAI.
 *
 * Usa la Responses API, que es la que soporta tool calling en los modelos
 * actuales (GPT-6). Las diferencias con Claude que importan acá:
 *   - el prompt de sistema va como `instructions`, no como mensajes;
 *   - los pedidos de herramienta llegan en `output` con `call_id`;
 *   - los resultados se devuelven como items `function_call_output`.
 */
import OpenAI from 'openai';
import { env } from '../../config/env.js';
import type {
  Conversacion,
  PedidoInicial,
  ProveedorIA,
  RespuestaModelo,
  ResultadoDeHerramienta,
} from './tipos.js';
import { ErrorProveedor } from './tipos.js';

type ItemDeEntrada = Record<string, unknown>;

export function crearProveedorOpenAI(opciones: { apiKey: string; modelo?: string }): ProveedorIA {
  const cliente = new OpenAI({
    apiKey: opciones.apiKey,
    timeout: env.AI_TIMEOUT_MS,
    maxRetries: 1,
    ...(env.OPENAI_BASE_URL ? { baseURL: env.OPENAI_BASE_URL } : {}),
  });
  const modelo = opciones.modelo ?? env.OPENAI_MODEL;

  return {
    nombre: 'openai',
    modelo,
    iniciar(pedido: PedidoInicial): Conversacion {
      // El historial va como items de conversación; el sistema va aparte.
      const entrada: ItemDeEntrada[] = [];
      for (const h of pedido.historial) {
        const texto = h.texto.trim();
        if (!texto) continue;
        entrada.push({ role: h.rol === 'cliente' ? 'user' : 'assistant', content: texto });
      }
      entrada.push({ role: 'user', content: pedido.mensaje });

      const herramientas = pedido.herramientas.map((h) => ({
        type: 'function' as const,
        name: h.nombre,
        description: h.descripcion,
        parameters: h.esquema,
        // strict exige que todas las propiedades sean obligatorias; varias de
        // las nuestras son opcionales a propósito, así que queda apagado.
        strict: false,
      }));

      return {
        async siguiente(): Promise<RespuestaModelo> {
          let respuesta: Awaited<ReturnType<typeof cliente.responses.create>>;
          try {
            respuesta = await cliente.responses.create({
              model: modelo,
              instructions: `${pedido.sistemaEstable}\n\n${pedido.sistemaVolatil}`,
              input: entrada as never,
              tools: herramientas as never,
              max_output_tokens: env.AI_MAX_TOKENS,
              store: false,
            });
          } catch (e) {
            if (e instanceof OpenAI.APIConnectionTimeoutError) throw new ErrorProveedor('timeout', 'el modelo tardó demasiado');
            throw new ErrorProveedor('api', e instanceof Error ? e.message : String(e));
          }

          const salida = ((respuesta as { output?: unknown[] }).output ?? []) as Array<Record<string, unknown>>;

          const llamadas = salida
            .filter((item) => item.type === 'function_call')
            .map((item) => {
              let entradaParseada: unknown = {};
              try {
                entradaParseada = JSON.parse(String(item.arguments ?? '{}'));
              } catch {
                // Argumentos rotos: se deja vacío y la validación con zod lo
                // rechaza con un mensaje que el modelo puede leer y corregir.
                entradaParseada = {};
              }
              return { id: String(item.call_id ?? item.id ?? ''), nombre: String(item.name ?? ''), entrada: entradaParseada };
            });

          // El texto puede venir en output_text o dentro de los items message.
          let texto = String((respuesta as { output_text?: string }).output_text ?? '').trim();
          if (!texto) {
            texto = salida
              .filter((item) => item.type === 'message')
              .flatMap((item) => ((item.content ?? []) as Array<Record<string, unknown>>))
              .filter((c) => c.type === 'output_text')
              .map((c) => String(c.text ?? ''))
              .join('\n')
              .trim();
          }

          const rehusado = salida.some((item) => item.type === 'refusal') ||
            salida
              .filter((item) => item.type === 'message')
              .flatMap((item) => ((item.content ?? []) as Array<Record<string, unknown>>))
              .some((c) => c.type === 'refusal');
          if (rehusado && llamadas.length === 0 && !texto) {
            return { texto: '', herramientas: [], motivo: 'rehuso' };
          }

          const uso = (respuesta as { usage?: { input_tokens?: number; output_tokens?: number; input_tokens_details?: { cached_tokens?: number } } }).usage;

          return {
            texto,
            herramientas: llamadas,
            motivo: llamadas.length > 0 ? 'herramientas' : 'texto',
            uso: uso
              ? {
                  entrada: uso.input_tokens ?? 0,
                  salida: uso.output_tokens ?? 0,
                  cacheLeido: uso.input_tokens_details?.cached_tokens ?? 0,
                }
              : undefined,
          };
        },

        agregarResultados(resultados: ResultadoDeHerramienta[]): void {
          for (const r of resultados) {
            entrada.push({ type: 'function_call_output', call_id: r.id, output: r.contenido });
          }
        },
      };
    },
  };
}
