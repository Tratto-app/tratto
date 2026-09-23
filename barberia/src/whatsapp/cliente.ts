/**
 * Cliente de la WhatsApp Cloud API (Meta).
 *
 * Se eligio la API oficial y no automatizar WhatsApp Web: automatizar la web
 * con Selenium/Puppeteer viola los terminos de uso y termina con el numero
 * bloqueado. Acá todo pasa por el endpoint oficial /messages.
 */
import { env, whatsappConfigurado } from '../config/env.js';
import { log, enmascararTelefono } from '../shared/log.js';

const GRAFO = 'https://graph.facebook.com';

export class ErrorWhatsApp extends Error {
  readonly status: number;
  readonly codigo?: number;
  constructor(status: number, mensaje: string, codigo?: number) {
    super(mensaje);
    this.name = 'ErrorWhatsApp';
    this.status = status;
    this.codigo = codigo;
  }
  get reintentable(): boolean {
    return this.status === 0 || this.status === 429 || this.status >= 500;
  }
}

/** Limites de la API; si nos pasamos, Meta rechaza el mensaje entero. */
const LIMITES = { cuerpo: 1024, tituloBoton: 20, tituloFila: 24, descripcionFila: 72, botones: 3, filas: 10, texto: 4096 };

const corta = (s: string, max: number) => (s.length <= max ? s : `${s.slice(0, max - 1)}…`);

async function enviar(payload: Record<string, unknown>, intentos = 2): Promise<string | null> {
  if (!whatsappConfigurado) {
    log.warn({ payload: payload.type }, 'WhatsApp sin configurar: el mensaje no se envía');
    return null;
  }
  const url = `${GRAFO}/${env.WHATSAPP_GRAPH_VERSION}/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`;

  for (let intento = 0; intento <= intentos; intento++) {
    try {
      const r = await fetch(url, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ messaging_product: 'whatsapp', ...payload }),
        signal: AbortSignal.timeout(15_000),
      });

      if (r.ok) {
        const json = (await r.json()) as { messages?: Array<{ id: string }> };
        return json.messages?.[0]?.id ?? null;
      }

      const texto = await r.text().catch(() => '');
      let codigo: number | undefined;
      try {
        codigo = (JSON.parse(texto) as { error?: { code?: number } }).error?.code;
      } catch {
        /* la respuesta no era JSON */
      }
      const error = new ErrorWhatsApp(r.status, `WhatsApp respondio ${r.status}: ${texto.slice(0, 300)}`, codigo);
      if (!error.reintentable || intento === intentos) throw error;
      await new Promise((res) => setTimeout(res, 500 * 2 ** intento));
    } catch (e) {
      if (e instanceof ErrorWhatsApp) {
        if (!e.reintentable || intento === intentos) throw e;
      } else if (intento === intentos) {
        throw new ErrorWhatsApp(0, `no se pudo conectar con WhatsApp: ${e instanceof Error ? e.message : e}`);
      }
      await new Promise((res) => setTimeout(res, 500 * 2 ** intento));
    }
  }
  return null;
}

export const whatsapp = {
  async enviarTexto(para: string, texto: string): Promise<string | null> {
    const id = await enviar({
      recipient_type: 'individual',
      to: para,
      type: 'text',
      text: { preview_url: false, body: corta(texto, LIMITES.texto) },
    });
    log.info({ cliente: enmascararTelefono(para), mensaje: id }, 'mensaje enviado');
    return id;
  },

  /** Hasta 3 botones de respuesta rapida. */
  async enviarBotones(para: string, texto: string, botones: Array<{ id: string; titulo: string }>): Promise<string | null> {
    if (botones.length === 0) return whatsapp.enviarTexto(para, texto);
    return enviar({
      recipient_type: 'individual',
      to: para,
      type: 'interactive',
      interactive: {
        type: 'button',
        body: { text: corta(texto, LIMITES.cuerpo) },
        action: {
          buttons: botones.slice(0, LIMITES.botones).map((b) => ({
            type: 'reply',
            reply: { id: b.id, title: corta(b.titulo, LIMITES.tituloBoton) },
          })),
        },
      },
    });
  },

  /** Lista desplegable: hasta 10 opciones. Ideal para servicios y horarios. */
  async enviarLista(
    para: string,
    texto: string,
    lista: { encabezado: string; boton: string; opciones: Array<{ id: string; titulo: string; descripcion?: string }> },
  ): Promise<string | null> {
    if (lista.opciones.length === 0) return whatsapp.enviarTexto(para, texto);
    return enviar({
      recipient_type: 'individual',
      to: para,
      type: 'interactive',
      interactive: {
        type: 'list',
        body: { text: corta(texto, LIMITES.cuerpo) },
        action: {
          button: corta(lista.boton, LIMITES.tituloBoton),
          sections: [
            {
              title: corta(lista.encabezado, LIMITES.tituloFila),
              rows: lista.opciones.slice(0, LIMITES.filas).map((o) => ({
                id: o.id,
                title: corta(o.titulo, LIMITES.tituloFila),
                ...(o.descripcion ? { description: corta(o.descripcion, LIMITES.descripcionFila) } : {}),
              })),
            },
          ],
        },
      },
    });
  },

  /**
   * Plantilla aprobada por Meta. Hace falta para escribirle a alguien fuera de
   * la ventana de 24 horas (por ejemplo, un recordatorio del dia anterior).
   *
   * Los parametros van por NOMBRE, no por posicion: desde 2025 Meta dejo de
   * aceptar variables numeradas ({{1}}, {{2}}...) en plantillas nuevas y exige
   * nombres en minuscula ({{nombre_cliente}}, {{fecha_turno}}...). El nombre
   * que se manda acá tiene que ser identico al que se escribio en el cuerpo de
   * la plantilla al crearla en Meta, o el envio lo rechaza.
   */
  async enviarPlantilla(
    para: string,
    nombre: string,
    idioma: string,
    parametros: Array<{ nombre: string; valor: string }> = [],
  ): Promise<string | null> {
    return enviar({
      recipient_type: 'individual',
      to: para,
      type: 'template',
      template: {
        name: nombre,
        language: { code: idioma },
        ...(parametros.length
          ? {
              components: [
                {
                  type: 'body',
                  parameters: parametros.map((p) => ({ type: 'text', parameter_name: p.nombre, text: p.valor })),
                },
              ],
            }
          : {}),
      },
    });
  },

  /** Marca el mensaje como leído (los dos tildes azules). Es cosmetico pero se nota. */
  async marcarLeido(idMensaje: string): Promise<void> {
    try {
      await enviar({ status: 'read', message_id: idMensaje }, 0);
    } catch (e) {
      log.debug({ err: e instanceof Error ? e.message : e }, 'no se pudo marcar como leído');
    }
  },
};

/** Manda una respuesta ya armada por el orquestador, eligiendo el mejor formato. */
export async function responderPorWhatsApp(
  para: string,
  respuesta: { texto: string; botones?: Array<{ id: string; titulo: string }>; lista?: { encabezado: string; boton: string; opciones: Array<{ id: string; titulo: string; descripcion?: string }> } },
): Promise<void> {
  if (!respuesta.texto) return;
  if (respuesta.lista && respuesta.lista.opciones.length > 0) {
    await whatsapp.enviarLista(para, respuesta.texto, respuesta.lista);
    return;
  }
  if (respuesta.botones && respuesta.botones.length > 0) {
    await whatsapp.enviarBotones(para, respuesta.texto, respuesta.botones);
    return;
  }
  await whatsapp.enviarTexto(para, respuesta.texto);
}
