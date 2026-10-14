export type CanalRecorrido = 'gmail' | 'whatsapp';
export type Region = 'CABA' | 'Zona Norte' | 'Zona Oeste' | 'Zona Sur' | 'Otras zonas' | 'Sin zona precisa';
export const ETAPAS: Region[] = ['CABA', 'Zona Norte', 'Zona Oeste', 'Zona Sur'];
export const RECORRIDO_ID = 'b27c1df1-9b30-45ea-a5b3-4bcc86ffeab2';
export type Json = Record<string, unknown>;
export function objeto(v: unknown): Json { return v && typeof v === 'object' && !Array.isArray(v) ? v as Json : {}; }
export function texto(v: unknown): string { return typeof v === 'string' ? v : ''; }
export function normalizar(v: string): string { return v.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); }
export const COMUNAS = [
  ['Retiro', 'San Nicolás', 'Puerto Madero', 'San Telmo', 'Monserrat', 'Constitución'],
  ['Recoleta'], ['Balvanera', 'San Cristóbal'], ['La Boca', 'Barracas', 'Parque Patricios', 'Nueva Pompeya'],
  ['Almagro', 'Boedo'], ['Caballito'], ['Flores', 'Parque Chacabuco'], ['Villa Soldati', 'Villa Riachuelo', 'Villa Lugano'],
  ['Liniers', 'Mataderos', 'Parque Avellaneda'], ['Villa Real', 'Monte Castro', 'Versalles', 'Floresta', 'Vélez Sarsfield', 'Villa Luro'],
  ['Villa General Mitre', 'Villa Devoto', 'Villa del Parque', 'Villa Santa Rita'], ['Coghlan', 'Saavedra', 'Villa Urquiza', 'Villa Pueyrredón'],
  ['Núñez', 'Belgrano', 'Colegiales'], ['Palermo'], ['Chacarita', 'Villa Crespo', 'La Paternal', 'Villa Ortúzar', 'Agronomía', 'Parque Chas'],
];
const BARRIOS = COMUNAS.flat();
const MUNICIPIOS: Partial<Record<Region, string[]>> = {
  'Zona Norte': ['Vicente López', 'San Isidro', 'San Fernando', 'Tigre', 'Pilar', 'Escobar', 'General San Martín', 'San Miguel', 'José C Paz', 'Malvinas Argentinas'],
  'Zona Oeste': ['Morón', 'Haedo', 'Castelar', 'Ramos Mejía', 'La Matanza', 'Merlo', 'Moreno', 'Hurlingham', 'Ituzaingó', 'Caseros', 'Tres de Febrero', 'Ciudad Jardín', 'Lomas del Mirador'],
  'Zona Sur': ['Avellaneda', 'Lanús', 'Quilmes', 'Berazategui', 'Florencio Varela', 'Lomas de Zamora', 'Banfield', 'Temperley', 'Almirante Brown', 'Adrogué', 'Ezeiza', 'Esteban Echeverría', 'Monte Grande'],
};
function contiene(v: string, nombre: string): boolean { return (` ${normalizar(v)} `).includes(` ${normalizar(nombre)} `); }
export interface ContactoRecorrido {
  id: string; rubro: string | null; zona: string | null; city: string | null; entrada: string | null;
  status: string; tags: string[] | null; contacted_at: string | null; datos: Json | null;
}
export interface RubroRecorrido { orden: number; rubro: string; activo: boolean; enviados: number; ultima_vez: string | null }
export interface DiaRecorrido { id: string; titulo: string; estado: string; datos: Json }
export interface PoliticaGeografica { zona_actual?: string; vigente_desde_utc?: string; desde?: string; fases?: string[] }

function lugares(p: ContactoRecorrido): string[] {
  const d = objeto(p.datos), mail = objeto(d.prospeccion), wa = objeto(d.whatsapp_manual);
  return [texto(wa.barrio), texto(mail.barrio), p.city || '', p.zona || '', texto(wa.zona), texto(mail.zona)].filter(Boolean);
}
export function regionDe(p: ContactoRecorrido): Region {
  const campos = lugares(p);
  // Una cobertura mixta no identifica dónde está el negocio.
  const precisos = campos.filter(v => !(/\bcaba\b|capital federal|ciudad autonoma/.test(normalizar(v)) && /\bgba\b|gran buenos aires|provincia|zona norte|zona oeste|zona sur|amba/.test(normalizar(v))));
  for (const v of precisos) {
    for (const region of ETAPAS.slice(1)) if (contiene(v, region) || contiene(v, region.replace('Zona', 'GBA'))) return region;
    for (const [region, ciudades] of Object.entries(MUNICIPIOS)) if (ciudades.some(n => contiene(v, n))) return region as Region;
    if (/\bcaba\b|capital federal|ciudad autonoma de buenos aires/.test(normalizar(v)) || BARRIOS.some(b => contiene(v, b)) || /\bcomuna (?:[1-9]|1[0-5])\b/.test(normalizar(v))) return 'CABA';
    if (/interior|provincia|mar del plata|bahia blanca|tandil|la plata|lujan/.test(normalizar(v))) return 'Otras zonas';
  }
  return 'Sin zona precisa';
}
export function barrioDe(p: ContactoRecorrido): string | null {
  if (regionDe(p) !== 'CABA') return null;
  for (const v of lugares(p)) { const b = BARRIOS.find(b => contiene(v, b)); if (b) return b; }
  return null;
}
export function fechaLocal(v: string | Date): string {
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Buenos_Aires', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}
export function fechaInicial(p: ContactoRecorrido, canal: CanalRecorrido): string {
  const d = objeto(p.datos), m = objeto(d.prospeccion), w = objeto(d.whatsapp_manual);
  if (canal === 'gmail') return texto(m.enviado_at) && texto(m.gmail_thread) ? texto(m.enviado_at) : '';
  return texto(w.fecha_lista) && texto(w.estado).startsWith('lista_entregada') ? texto(w.fecha_lista) : '';
}
export function confirmadoManual(p: ContactoRecorrido): boolean {
  const w = objeto(objeto(p.datos).whatsapp_manual);
  return w.contactados_manualmente === true || (typeof w.contactados_manualmente === 'number' && w.contactados_manualmente > 0) || w.contactado_manualmente === true || !!texto(w.contactado_at) || w.estado === 'contactado_manualmente';
}
export function reboteDe(p: ContactoRecorrido): boolean { return (p.tags || []).includes('rebote') || !!objeto(p.datos).rebote_definitivo; }
export function demoraDe(p: ContactoRecorrido): boolean {
  if (reboteDe(p)) return false;
  const d = objeto(p.datos), e = objeto(d.entrega_temporal), viejo = objeto(d.demora_entrega);
  const actual = Object.keys(e).length ? e : viejo;
  if (actual.resuelto === true || /resuelt|entregad|definitiv/.test(texto(actual.estado))) return false;
  return actual.action === 'delayed' || /pendiente|temporal/.test(texto(actual.estado));
}
export function recordatorioDe(p: ContactoRecorrido): boolean {
  const r = objeto(objeto(p.datos).recontacto_mismo_dia);
  return r.estado === 'enviado_aceptado' && !!(texto(r.message_id) || texto(r.messageID));
}
export interface Actividad {
  iniciales: number; rechazos: number; demoras: number; sinRebote: number; recordatorios: number; confirmados: number; ultima: string;
}
export function actividad(contactos: ContactoRecorrido[], canal: CanalRecorrido): Actividad {
  const a: Actividad = { iniciales: 0, rechazos: 0, demoras: 0, sinRebote: 0, recordatorios: 0, confirmados: 0, ultima: '' };
  for (const p of contactos) {
    const f = fechaInicial(p, canal);
    // Un prospecto guardado/reservado nunca es un envío ni una lista entregada.
    if (!f && !(canal === 'whatsapp' && confirmadoManual(p))) continue;
    a.iniciales++;
    if (f > a.ultima) a.ultima = f;
    if (canal === 'gmail') { if (reboteDe(p)) a.rechazos++; else if (demoraDe(p)) a.demoras++; if (recordatorioDe(p)) a.recordatorios++; }
    else if (confirmadoManual(p)) a.confirmados++;
  }
  a.sinRebote = a.iniciales - a.rechazos - a.demoras;
  return a;
}
export function contactosDelCanal(contactos: ContactoRecorrido[], canal: CanalRecorrido): ContactoRecorrido[] {
  return contactos.filter(p => canal === 'gmail' ? !!fechaInicial(p, canal) : !!objeto(p.datos).whatsapp_manual && (!!fechaInicial(p, canal) || confirmadoManual(p)));
}
export function zonasContadas(contactos: ContactoRecorrido[]): { nombre: string; n: number }[] {
  const counts = new Map<string, number>();
  for (const p of contactos) {
    const nombre = barrioDe(p) || p.city || p.zona || 'Sin zona precisa';
    counts.set(nombre, (counts.get(nombre) || 0) + 1);
  }
  return [...counts].map(([nombre, n]) => ({ nombre, n })).sort((a, b) => b.n - a.n || a.nombre.localeCompare(b.nombre, 'es'));
}
export function barriosPendientes(contactos: ContactoRecorrido[]): string[] {
  const vistos = new Set(contactos.map(barrioDe).filter(Boolean));
  return BARRIOS.filter(b => !vistos.has(b));
}
export function ordenRubros(rubros: RubroRecorrido[], canal: CanalRecorrido): RubroRecorrido[] {
  return [...rubros].sort((a, b) => canal === 'gmail' ? a.orden - b.orden : b.orden - a.orden);
}
export function planDelDia(dias: DiaRecorrido[], canal: CanalRecorrido, hoy: string): Json {
  return objeto(dias.find(d => d.datos.fecha === hoy)?.datos[canal === 'gmail' ? 'gmail' : 'whatsapp']);
}
