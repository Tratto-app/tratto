// Sección "Usuarios": quiénes están registrados en la app, qué ofrecen y
// dónde. Los datos vienen de crm_usuarios_app (la fuente real, no la copia
// growth_app_users), así que una cuenta borrada desaparece sola.

export type RolUsuario = 'ofrece' | 'cliente';

export interface UsuarioApp {
  id: string;
  nombre: string;
  email: string | null;
  telefono: string | null;
  rol: RolUsuario;
  alta: string;
  ultimo_ingreso: string | null;
  rubros: string[];
  zonas: string[];
  servicios: number;
  pedidos: number;
  demo: boolean;
  equipo: boolean;
}

export interface Conteo { nombre: string; n: number; ofrece: number; cliente: number }

export const SIN_ZONA = 'Sin zona todavía';
export const SIN_RUBRO = 'Sin rubro elegido';
const DIA = 86_400_000;

// Los usuarios reales: sin cuentas demo ni las del equipo.
export function reales(us: UsuarioApp[]): UsuarioApp[] {
  return us.filter(u => !u.demo && !u.equipo);
}

export function esNuevo(u: UsuarioApp, ahora = new Date(), dias = 7): boolean {
  return ahora.getTime() - new Date(u.alta).getTime() < dias * DIA;
}

// Cuenta cada usuario una vez por valor (alguien con servicios en dos zonas
// suma en las dos) y los que no tienen ninguno van a "sin".
function contar(us: UsuarioApp[], valores: (u: UsuarioApp) => string[], sin: string): Conteo[] {
  const m = new Map<string, Conteo>();
  for (const u of us) {
    const vs = valores(u).filter(Boolean);
    for (const v of vs.length ? vs : [sin]) {
      const c = m.get(v) ?? { nombre: v, n: 0, ofrece: 0, cliente: 0 };
      c.n++;
      c[u.rol]++;
      m.set(v, c);
    }
  }
  return [...m.values()].sort((a, b) => (a.nombre === sin ? 1 : 0) - (b.nombre === sin ? 1 : 0) || b.n - a.n || a.nombre.localeCompare(b.nombre, 'es'));
}

export function porZona(us: UsuarioApp[]): Conteo[] {
  return contar(us, u => u.zonas, SIN_ZONA);
}

// Rubros solo de quienes ofrecen servicios: un cliente no tiene rubro.
export function porRubro(us: UsuarioApp[]): Conteo[] {
  return contar(us.filter(u => u.rol === 'ofrece'), u => u.rubros, SIN_RUBRO);
}

// Nombres que aparecen en más de una cuenta (por ejemplo, alguien que se
// registró dos veces con un mail mal escrito).
export function repetidos(us: UsuarioApp[]): Set<string> {
  const vistos = new Map<string, number>();
  for (const u of us) {
    const k = clave(u.nombre);
    vistos.set(k, (vistos.get(k) ?? 0) + 1);
  }
  return new Set([...vistos].filter(([, n]) => n > 1).map(([k]) => k));
}

export function clave(nombre: string): string {
  return nombre.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

// "hoy", "ayer", "hace 3 días" o la fecha, en hora de Argentina.
export function cuando(iso: string | null, ahora = new Date()): string {
  if (!iso) return 'Nunca';
  const dia = (d: Date) => d.toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' });
  const d = new Date(iso);
  const dif = Math.round((new Date(dia(ahora)).getTime() - new Date(dia(d)).getTime()) / DIA);
  if (dif <= 0) return 'Hoy';
  if (dif === 1) return 'Ayer';
  if (dif < 7) return `Hace ${dif} días`;
  return d.toLocaleDateString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', day: '2-digit', month: '2-digit', year: '2-digit' });
}
