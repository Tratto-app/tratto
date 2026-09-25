/**
 * Servidor que imita a los dos proveedores de IA.
 *
 * Permite verificar que los adaptadores hablan bien cada protocolo (qué mandan
 * y cómo leen la respuesta) sin gastar tokens ni necesitar claves reales.
 */
import http from 'node:http';
import type { AddressInfo } from 'node:net';

export interface GuionDeRespuesta {
  texto?: string;
  herramientas?: Array<{ nombre: string; entrada: unknown }>;
  rehusar?: boolean;
}

export interface ModeloFalso {
  urlClaude: string;
  urlOpenAI: string;
  /** Respuestas que va a devolver, en orden. */
  guion: GuionDeRespuesta[];
  /** Cuerpos recibidos, para inspeccionar qué manda cada adaptador. */
  pedidos: Array<{ ruta: string; cuerpo: Record<string, unknown> }>;
  cerrar(): Promise<void>;
}

export async function levantarModeloFalso(): Promise<ModeloFalso> {
  const estado: { guion: GuionDeRespuesta[]; i: number } = { guion: [], i: 0 };
  const pedidos: ModeloFalso['pedidos'] = [];

  const servidor = http.createServer((req, res) => {
    let cuerpo = '';
    req.on('data', (c) => (cuerpo += c));
    req.on('end', () => {
      const ruta = new URL(req.url ?? '/', 'http://x').pathname;
      const datos = cuerpo ? (JSON.parse(cuerpo) as Record<string, unknown>) : {};
      pedidos.push({ ruta, cuerpo: datos });

      const responder = (codigo: number, payload: unknown) => {
        res.writeHead(codigo, { 'content-type': 'application/json' });
        res.end(JSON.stringify(payload));
      };

      // Las dos APIs reales rechazan un resultado de herramienta que no tenga
      // su pedido correspondiente en la entrada. El servidor falso hace lo
      // mismo: sin esta validación, un adaptador que "olvida" reenviar el
      // pedido del modelo pasa los tests y se cae recién en producción (pasó).
      const error = validarPares(ruta, datos);
      if (error) return responder(400, { error: { type: 'invalid_request_error', message: error } });

      const paso = estado.guion[estado.i++] ?? { texto: 'listo' };

      // --- Claude: POST /v1/messages ---
      if (ruta.endsWith('/v1/messages')) {
        if (paso.rehusar) {
          return responder(200, {
            id: 'msg_1', type: 'message', role: 'assistant', model: 'falso',
            content: [], stop_reason: 'refusal', stop_sequence: null,
            usage: { input_tokens: 5, output_tokens: 0 },
          });
        }
        const content: unknown[] = [];
        if (paso.texto) content.push({ type: 'text', text: paso.texto, citations: null });
        for (const [i, h] of (paso.herramientas ?? []).entries()) {
          content.push({ type: 'tool_use', id: `toolu_${estado.i}_${i}`, name: h.nombre, input: h.entrada });
        }
        return responder(200, {
          id: 'msg_1', type: 'message', role: 'assistant', model: 'falso',
          content,
          stop_reason: paso.herramientas?.length ? 'tool_use' : 'end_turn',
          stop_sequence: null,
          usage: { input_tokens: 100, output_tokens: 20, cache_read_input_tokens: 80 },
        });
      }

      // --- OpenAI: POST /responses ---
      if (ruta.endsWith('/responses')) {
        const output: unknown[] = [];
        if (paso.rehusar) {
          output.push({ type: 'message', role: 'assistant', content: [{ type: 'refusal', refusal: 'no puedo' }] });
        } else {
          if (paso.texto) {
            output.push({ type: 'message', role: 'assistant', content: [{ type: 'output_text', text: paso.texto }] });
          }
          for (const [i, h] of (paso.herramientas ?? []).entries()) {
            output.push({
              type: 'function_call',
              id: `fc_${estado.i}_${i}`,
              call_id: `call_${estado.i}_${i}`,
              name: h.nombre,
              arguments: JSON.stringify(h.entrada),
            });
          }
        }
        return responder(200, {
          id: 'resp_1',
          object: 'response',
          model: 'falso',
          output,
          usage: { input_tokens: 100, output_tokens: 20, input_tokens_details: { cached_tokens: 40 } },
        });
      }

      return responder(404, { error: { message: `ruta desconocida: ${ruta}` } });
    });
  });

  await new Promise<void>((resolve) => servidor.listen(0, '127.0.0.1', resolve));
  const puerto = (servidor.address() as AddressInfo).port;

  return {
    urlClaude: `http://127.0.0.1:${puerto}`,
    urlOpenAI: `http://127.0.0.1:${puerto}`,
    get guion() {
      return estado.guion;
    },
    set guion(g: GuionDeRespuesta[]) {
      estado.guion = g;
      estado.i = 0;
    },
    pedidos,
    cerrar: () => new Promise<void>((resolve) => servidor.close(() => resolve())),
  };
}

/** Devuelve el mensaje de error que daría la API real, o null si está bien. */
function validarPares(ruta: string, datos: Record<string, unknown>): string | null {
  if (ruta.endsWith('/responses')) {
    const entrada = (Array.isArray(datos.input) ? datos.input : []) as Array<Record<string, unknown>>;
    const pedidos = new Set<string>();
    for (const item of entrada) {
      if (item.type === 'function_call') pedidos.add(String(item.call_id));
      if (item.type === 'function_call_output' && !pedidos.has(String(item.call_id))) {
        return `No tool call found for function call output with call_id ${String(item.call_id)}.`;
      }
    }
  }
  if (ruta.endsWith('/v1/messages')) {
    const mensajes = (Array.isArray(datos.messages) ? datos.messages : []) as Array<Record<string, unknown>>;
    for (const [i, m] of mensajes.entries()) {
      if (m.role !== 'user' || !Array.isArray(m.content)) continue;
      const resultados = (m.content as Array<Record<string, unknown>>).filter((c) => c.type === 'tool_result');
      if (!resultados.length) continue;
      const anterior = mensajes[i - 1];
      const usos = new Set(
        (Array.isArray(anterior?.content) ? (anterior.content as Array<Record<string, unknown>>) : [])
          .filter((c) => c.type === 'tool_use')
          .map((c) => String(c.id)),
      );
      for (const r of resultados) {
        if (!usos.has(String(r.tool_use_id))) {
          return `messages.${i}: unexpected tool_use_id found in tool_result blocks: ${String(r.tool_use_id)}`;
        }
      }
    }
  }
  return null;
}
