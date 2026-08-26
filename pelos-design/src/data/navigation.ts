/** Navegación del sitio. Fuente única para header, footer y links internos. */
export interface NavItem {
  label: string;
  href: string;
}

// El orden acompaña el de la página: primero quiénes somos, después qué
// hacemos, cómo queda, qué dicen, cuánto sale y dónde estamos.
export const primaryNav: NavItem[] = [
  { label: 'Nosotros', href: '/#nosotros' },
  { label: 'Servicios', href: '/servicios' },
  { label: 'Trabajos', href: '/#trabajos' },
  { label: 'Opiniones', href: '/#opiniones' },
  { label: 'Precios', href: '/precios' },
  { label: 'Contacto', href: '/#encontranos' },
];
