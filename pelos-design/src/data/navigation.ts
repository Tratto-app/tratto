/** Navegación del sitio. Fuente única para header, footer y links internos. */
export interface NavItem {
  label: string;
  href: string;
}

export const primaryNav: NavItem[] = [
  { label: 'Servicios', href: '/servicios' },
  { label: 'Trabajos', href: '/#trabajos' },
  { label: 'Opiniones', href: '/#opiniones' },
  { label: 'Nosotros', href: '/#nosotros' },
  { label: 'Precios', href: '/#precios' },
  { label: 'Contacto', href: '/#encontranos' },
];
