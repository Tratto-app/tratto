/** Formas del payload de la WhatsApp Cloud API que usa el proyecto. */

export interface MensajeWhatsApp {
  id: string;
  from: string;
  timestamp: string;
  type: string;
  text?: { body: string };
  button?: { text: string; payload: string };
  interactive?: {
    type: 'button_reply' | 'list_reply';
    button_reply?: { id: string; title: string };
    list_reply?: { id: string; title: string; description?: string };
  };
  audio?: unknown;
  image?: unknown;
  document?: unknown;
  sticker?: unknown;
  location?: { latitude: number; longitude: number };
  errors?: Array<{ code: number; title: string }>;
}

export interface EstadoMensajeWhatsApp {
  id: string;
  status: 'sent' | 'delivered' | 'read' | 'failed';
  recipient_id: string;
  errors?: Array<{ code: number; title: string; message?: string }>;
}

export interface ValorCambio {
  messaging_product: string;
  metadata?: { display_phone_number: string; phone_number_id: string };
  contacts?: Array<{ profile?: { name?: string }; wa_id: string }>;
  messages?: MensajeWhatsApp[];
  statuses?: EstadoMensajeWhatsApp[];
}

export interface PayloadWebhook {
  object?: string;
  entry?: Array<{ id: string; changes?: Array<{ field: string; value: ValorCambio }> }>;
}
