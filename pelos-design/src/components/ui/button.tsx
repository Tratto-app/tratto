import Link from 'next/link';
import type { ComponentPropsWithoutRef } from 'react';

/**
 * Botones del sitio.
 *
 * Decisión de dirección de arte: rectángulos, no píldoras. El primario es un
 * bloque de tinta; el secundario, sólo una regla fina. Nada de sombras ni de
 * esquinas redondeadas grandes — eso es lo que hace que un sitio parezca
 * plantilla. Ver DESIGN.md.
 */

type Variant = 'primary' | 'secondary' | 'quiet' | 'primary-inverse' | 'secondary-inverse';

const base =
  'inline-flex items-center justify-center gap-2 px-7 py-[0.9rem] text-[0.9375rem] ' +
  'font-medium tracking-[0.01em] transition-all duration-300 ease-[var(--ease-editorial)] ' +
  'disabled:opacity-50 disabled:pointer-events-none text-center';

const variants: Record<Variant, string> = {
  primary:
    'bg-surface-deep text-text-inverse hover:bg-accent-deep ' +
    'active:translate-y-px',
  secondary:
    'border border-border-strong text-text-primary hover:border-text-primary ' +
    'hover:bg-surface-muted active:translate-y-px',
  quiet:
    'px-0 py-1 text-text-secondary hover:text-accent underline underline-offset-[6px] ' +
    'decoration-border-strong hover:decoration-accent',
  // Variantes para las secciones sobre fondo oscuro. Son variantes propias y no
  // clases sueltas encima de `primary`: dos utilidades de Tailwind del mismo
  // tipo (dos `bg-*`) se resuelven por el orden del CSS generado, no por el
  // orden en el atributo class, así que un override así queda a la suerte.
  'primary-inverse':
    'bg-accent-soft text-text-primary hover:bg-background active:translate-y-px',
  'secondary-inverse':
    'border border-text-inverse-muted text-text-inverse hover:border-text-inverse ' +
    'hover:bg-white/8 active:translate-y-px',
};

interface ButtonLinkProps extends ComponentPropsWithoutRef<'a'> {
  href: string;
  variant?: Variant;
  /** Los links externos abren en pestaña nueva y avisan al lector de pantalla. */
  external?: boolean;
}

export function ButtonLink({
  href,
  variant = 'primary',
  external = false,
  className = '',
  children,
  ...rest
}: ButtonLinkProps) {
  const classes = `${base} ${variants[variant]} ${className}`;

  if (external || href.startsWith('http') || href.startsWith('tel:')) {
    return (
      <a
        href={href}
        className={classes}
        {...(href.startsWith('http')
          ? { target: '_blank', rel: 'noopener noreferrer' }
          : {})}
        {...rest}
      >
        {children}
        {href.startsWith('http') && <span className="sr-only"> (se abre en una pestaña nueva)</span>}
      </a>
    );
  }

  return (
    <Link href={href} className={classes} {...rest}>
      {children}
    </Link>
  );
}
