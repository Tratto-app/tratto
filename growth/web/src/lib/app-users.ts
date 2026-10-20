export interface AccountRow {
  user_id: string; nombre: string; email: string | null; tipo: 'provider' | 'customer' | 'unknown';
  rubros: string[]; registrado_at: string; servicios: number; trabajos: number; pedidos: number;
  dispositivos: number; crm_id: string | null;
}
export interface UsersOverview {
  corte_at: string;
  totales: { usuarios: number; proveedores: number; clientes: number; sin_tipo: number; proveedores_push: number;
    clientes_push: number; proveedores_publicados: number; proveedores_pendientes: number;
    proveedores_con_trabajos: number; servicios: number; trabajos: number; altas_hoy: number };
  rubros: { rubro: string; registrados: number; con_push: number; con_servicio: number }[];
  altas: { dia: string; proveedores: number; clientes: number; sin_tipo: number }[];
  total_filtrado: number; usuarios: AccountRow[];
}
export const accountDate = (date: string) => new Intl.DateTimeFormat('es-AR', {
  timeZone: 'America/Argentina/Buenos_Aires', dateStyle: 'short', timeStyle: 'short',
}).format(new Date(date));
export const percentage = (n: number, total: number) => total ? Math.round(n * 100 / total) : 0;
