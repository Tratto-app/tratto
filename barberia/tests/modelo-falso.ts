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

      const paso = estado.guion[estado.i++] ?? { texto: 'listo' };
      const responder = (codigo: number, payload: unknown) => {
        res.writeHead(codigo, { 'content-type': 'application/json' });
        res.end(JSON.stringify(payload));
      };

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
