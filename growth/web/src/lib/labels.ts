// Textos y colores de cada estado: un solo lugar para todo el panel.
export const STATUS: Record<string, { label: string; tone: string }> = {
  new: { label: 'Nuevo', tone: '' },
  uncontacted: { label: 'Sin contactar', tone: '' },
  contacted: { label: 'Contactado', tone: 'azul' },
  replied: { label: 'Respondió', tone: 'azul' },
  interested: { label: 'Interesado', tone: 'violeta' },
  link_sent: { label: 'Link enviado', tone: 'violeta' },
  clicked: { label: 'Hizo click', tone: 'laton' },
  installed: { label: 'Instaló', tone: 'verde' },
  registered: { label: 'Se registró', tone: 'verde' },
  activated: { label: 'Activado', tone: 'verde' },
  active: { label: 'Usuario activo', tone: 'verde' },
  not_interested: { label: 'No interesado', tone: 'rojo' },
  no_response: { label: 'Sin respuesta', tone: 'rojo' },
};
export const STATUS_ORDER = ['new', 'uncontacted', 'contacted', 'replied', 'interested', 'link_sent', 'clicked',
  'installed', 'registered', 'activated', 'active', 'not_interested', 'no_response'];

export const INTEREST: Record<string, string> = { unknown: 'Sin datos', none: 'Ninguno', low: 'Bajo', medium: 'Medio', high: 'Alto' };
export const CONSENT: Record<string, string> = { unknown: 'Sin dato', opt_in: 'Aceptó mensajes', opt_out: 'Pidió la baja' };

export const CHANNELS: Record<string, string> = {
  instagram: 'Instagram', whatsapp: 'WhatsApp', email: 'Email', sms: 'SMS', tiktok: 'TikTok', facebook: 'Facebook', other: 'Otro',
};

export const MSG_STATUS: Record<string, { label: string; tone: string }> = {
  sent: { label: 'Enviado', tone: 'verde' }, delivered: { label: 'Entregado', tone: 'verde' }, read: { label: 'Leído', tone: 'verde' },
  mock_sent: { label: 'Simulado', tone: 'mock' }, blocked: { label: 'Bloqueado', tone: 'rojo' }, failed: { label: 'Falló', tone: 'rojo' },
  received: { label: 'Recibido', tone: 'azul' }, queued: { label: 'En cola', tone: '' }, draft: { label: 'Borrador', tone: '' },
};

export const STEP_TYPES: Record<string, { label: string; desc: string }> = {
  send_message: { label: 'Enviar mensaje', desc: 'Manda un mensaje por un canal (plantilla o escrito por la IA).' },
  send_link: { label: 'Enviar link de descarga', desc: 'Manda el link personal trackeado del prospecto.' },
  wait: { label: 'Esperar', desc: 'Pausa la secuencia un tiempo.' },
  wait_reply: { label: 'Esperar respuesta', desc: 'Espera hasta que responda o se cumpla el plazo, y sigue por una rama u otra.' },
  condition: { label: 'Condición', desc: 'Evalúa una regla sobre el prospecto y sigue por "sí" o "no".' },
  ai_analyze: { label: 'Analizar con IA', desc: 'La IA estima score, segmento y próxima acción.' },
  set_score: { label: 'Fijar score', desc: 'Pone un score manual.' },
  add_score: { label: 'Sumar/restar score', desc: 'Ajusta el score manualmente.' },
  set_status: { label: 'Cambiar estado', desc: 'Mueve al prospecto de etapa.' },
  add_tag: { label: 'Agregar etiqueta', desc: 'Suma una etiqueta.' },
  create_task: { label: 'Crear tarea', desc: 'Te deja una tarea para hacer a mano.' },
  notify: { label: 'Notificar', desc: 'Crea una notificación en el panel.' },
  webhook: { label: 'Webhook', desc: 'Avisa a otro sistema (solo https).' },
};

export const TRIGGERS: Record<string, string> = {
  prospect_created: 'Cuando se crea un prospecto',
  status_changed: 'Cuando cambia el estado (con filtro)',
  reply_received: 'Cuando responde',
  manual: 'Manual (la iniciás vos)',
};

export const NOTIF: Record<string, { label: string; tone: string }> = {
  high_intent: { label: 'Alta intención', tone: 'laton' }, reply: { label: 'Respuesta', tone: 'azul' },
  install: { label: 'Instalación', tone: 'verde' }, registration: { label: 'Registro', tone: 'verde' },
  activation: { label: 'Activación', tone: 'laton' }, inactive_user: { label: 'Inactivo', tone: 'rojo' },
  campaign_goal: { label: 'Meta de campaña', tone: 'laton' }, automation_error: { label: 'Error', tone: 'rojo' },
  info: { label: 'Aviso', tone: '' },
};

export const GOALS: Record<string, string> = {
  prospects: 'Prospectos', contacted: 'Contactados', replies: 'Respuestas', clicks: 'Clicks',
  installs: 'Instalaciones', registrations: 'Registros', activations: 'Activaciones',
};

export const FIELDS_PROSPECT: { key: string; label: string; type: 'text' | 'number' | 'date' | 'tags' | 'enum'; options?: string[] }[] = [
  { key: 'status', label: 'Estado', type: 'enum', options: STATUS_ORDER },
  { key: 'score', label: 'Score', type: 'number' },
  { key: 'interest', label: 'Interés', type: 'enum', options: Object.keys(INTEREST) },
  { key: 'consent', label: 'Consentimiento', type: 'enum', options: Object.keys(CONSENT) },
  { key: 'city', label: 'Ciudad', type: 'text' },
  { key: 'country', label: 'País', type: 'text' },
  { key: 'company', label: 'Empresa', type: 'text' },
  { key: 'email', label: 'Email', type: 'text' },
  { key: 'phone', label: 'Teléfono', type: 'text' },
  { key: 'instagram', label: 'Instagram', type: 'text' },
  { key: 'tags', label: 'Etiquetas', type: 'tags' },
  { key: 'contact_count', label: 'Veces contactado', type: 'number' },
  { key: 'created_at', label: 'Alta', type: 'date' },
  { key: 'last_contact_at', label: 'Último contacto', type: 'date' },
  { key: 'replied_at', label: 'Respondió', type: 'date' },
  { key: 'interested_at', label: 'Interesado', type: 'date' },
  { key: 'clicked_at', label: 'Hizo click', type: 'date' },
  { key: 'installed_at', label: 'Instaló', type: 'date' },
  { key: 'registered_at', label: 'Se registró', type: 'date' },
  { key: 'activated_at', label: 'Activado', type: 'date' },
];
export const FIELDS_APP_USER: typeof FIELDS_PROSPECT = [
  { key: 'platform', label: 'Plataforma', type: 'enum', options: ['android', 'ios', 'web', 'other'] },
  { key: 'sessions_count', label: 'Sesiones', type: 'number' },
  { key: 'revenue', label: 'Ingresos', type: 'number' },
  { key: 'is_paying', label: 'Paga', type: 'enum', options: ['true', 'false'] },
  { key: 'installed_at', label: 'Instaló', type: 'date' },
  { key: 'registered_at', label: 'Se registró', type: 'date' },
  { key: 'onboarded_at', label: 'Onboarding', type: 'date' },
  { key: 'first_action_at', label: 'Primera acción', type: 'date' },
  { key: 'activated_at', label: 'Activado', type: 'date' },
  { key: 'last_seen_at', label: 'Último uso', type: 'date' },
  { key: 'email', label: 'Email', type: 'text' },
];
export const OPS: Record<string, { label: string; for: string[] }> = {
  eq: { label: 'es', for: ['text', 'number', 'enum'] },
  neq: { label: 'no es', for: ['text', 'number', 'enum'] },
  in: { label: 'es alguno de', for: ['enum', 'text'] },
  nin: { label: 'no es ninguno de', for: ['enum', 'text'] },
  gt: { label: 'mayor que', for: ['number'] },
  gte: { label: 'mayor o igual a', for: ['number'] },
  lt: { label: 'menor que', for: ['number'] },
  lte: { label: 'menor o igual a', for: ['number'] },
  contains: { label: 'contiene', for: ['text'] },
  has_tag: { label: 'tiene la etiqueta', for: ['tags'] },
  is_set: { label: 'tiene dato', for: ['text', 'number', 'date', 'tags', 'enum'] },
  is_null: { label: 'no tiene dato', for: ['text', 'number', 'date', 'tags', 'enum'] },
  within_days: { label: 'en los últimos N días', for: ['date'] },
  older_than_days: { label: 'hace más de N días', for: ['date'] },
};
