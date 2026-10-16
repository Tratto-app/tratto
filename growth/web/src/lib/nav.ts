// Menú lateral del panel (lo usan el Layout y el smoke test).
export type IconKey = 'dash' | 'users' | 'flag' | 'source' | 'link' | 'inbox' | 'flow' | 'ai' | 'app' | 'seg' | 'ret' | 'chart' | 'funnel' | 'cohort' | 'store' | 'book' | 'plug' | 'gear' | 'team' | 'agentes' | 'cerebro';

export const NAV: { group: string; items: { to: string; label: string; icon: IconKey }[] }[] = [
  { group: '', items: [{ to: '/', label: 'Inicio', icon: 'dash' }, { to: '/usuarios', label: 'Usuarios', icon: 'users' }, { to: '/equipo', label: 'Equipo de marketing', icon: 'team' }, { to: '/agentes', label: 'Claude / Codex', icon: 'agentes' }, { to: '/cerebro', label: 'Cerebro de las piezas', icon: 'cerebro' }, { to: '/recorridos/mail', label: 'Recorrido por Mail', icon: 'inbox' }, { to: '/recorridos/whatsapp', label: 'Recorrido por WhatsApp', icon: 'flow' }] },
  { group: 'Captación', items: [
    { to: '/prospects', label: 'Contactos', icon: 'users' }, { to: '/campaigns', label: 'Campañas', icon: 'flag' },
    { to: '/sources', label: 'Fuentes', icon: 'source' }, { to: '/links', label: 'Links con nombre', icon: 'link' }] },
  { group: 'Contacto', items: [
    { to: '/inbox', label: 'Mensajes', icon: 'inbox' }, { to: '/whatsapp-seguimiento', label: 'Seguimiento WhatsApp', icon: 'flow' }, { to: '/automations', label: 'Automatizaciones', icon: 'flow' }, { to: '/agent', label: 'Asistente IA', icon: 'ai' }] },
  { group: 'Usuarios', items: [
    { to: '/users', label: 'Usuarios de la app', icon: 'app' }, { to: '/segments', label: 'Segmentos', icon: 'seg' }, { to: '/retention', label: 'Retención', icon: 'ret' }] },
  { group: 'Análisis', items: [
    { to: '/analytics', label: 'Resumen', icon: 'chart' }, { to: '/analytics/funnel', label: 'Embudo', icon: 'funnel' },
    { to: '/analytics/campaigns', label: 'Campañas', icon: 'flag' }, { to: '/analytics/cohorts', label: 'Cohortes', icon: 'cohort' }] },
  { group: 'App', items: [
    { to: '/app', label: 'La app', icon: 'app' }, { to: '/app/stores', label: 'Tiendas', icon: 'store' }, { to: '/app/knowledge', label: 'Base de conocimiento', icon: 'book' }] },
  { group: 'Ajustes', items: [
    { to: '/settings/ai', label: 'IA', icon: 'ai' }, { to: '/settings/integrations', label: 'Integraciones', icon: 'plug' }, { to: '/settings/workspace', label: 'Espacio de trabajo', icon: 'gear' }] },
];
