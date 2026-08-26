import type { ReactNode } from 'react';

import { Reveal } from './reveal';

/**
 * Cabecera de sección.
 *
 * La primera versión numeraba cada sección (01, 02, 03…). Se sacó: la
 * numeración correlativa hace que la página se lea como un índice generado
 * automáticamente y no como algo escrito por alguien. El ritmo lo dan ahora la
 * fotografía, la variación de los bloques y el aire entre secciones.
 */
interface SectionHeadingProps {
  eyebrow: string;
  title: ReactNode;
  intro?: ReactNode;
  /** Alinea el bloque a la derecha en desktop, para romper la simetría. */
  align?: 'left' | 'right';
  id?: string;
}

export function SectionHeading({
  eyebrow,
  title,
  intro,
  align = 'left',
  id,
}: SectionHeadingProps) {
  return (
    <Reveal
      className={`flex flex-col gap-5 ${
        align === 'right' ? 'lg:ml-auto lg:max-w-[38rem] lg:text-right' : 'max-w-[42rem]'
      }`}
    >
      <p className={`eyebrow ${align === 'right' ? 'lg:text-right' : ''}`}>{eyebrow}</p>

      <h2 id={id} className="text-[length:var(--text-h2)]">
        {title}
      </h2>

      {intro && (
        <p className="max-w-[36rem] text-[length:var(--text-lead)] leading-[1.55] text-text-secondary lg:ml-0">
          {intro}
        </p>
      )}
    </Reveal>
  );
}

/** Contenedor de sección con el ritmo vertical del sistema. */
export function Section({
  children,
  className = '',
  id,
  tone = 'default',
  labelledBy,
}: {
  children: ReactNode;
  className?: string;
  id?: string;
  tone?: 'default' | 'muted' | 'deep';
  labelledBy?: string;
}) {
  const tones = {
    default: '',
    muted: 'bg-surface-muted',
    deep: 'bg-surface-deep text-text-inverse on-dark',
  } as const;

  return (
    <section
      id={id}
      aria-labelledby={labelledBy}
      className={`py-[length:var(--space-section)] ${tones[tone]} ${className}`}
    >
      {children}
    </section>
  );
}
