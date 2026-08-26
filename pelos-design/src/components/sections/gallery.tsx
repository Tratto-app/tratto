'use client';

import Image from 'next/image';
import { useCallback, useEffect, useRef, useState } from 'react';

import { galleryItems } from '@/data/gallery';
import { Reveal } from '@/components/ui/reveal';

/**
 * Galería editorial con visor a pantalla completa.
 *
 * La grilla no es uniforme: las fotos marcadas como `feature` ocupan dos
 * columnas y se desfasan verticalmente, de modo que la lectura sea diagonal
 * y no en renglones. En mobile cae a una sola columna, que es donde más
 * importa que las fotos se vean grandes.
 *
 * El visor es un diálogo modal de verdad: atrapa el foco, cierra con Escape,
 * se navega con las flechas y devuelve el foco a la miniatura de origen.
 */
/**
 * Colocación de cada foto en la grilla de escritorio.
 *
 * Se define por índice, explícita y comentada, en lugar de deducirla con
 * selectores `nth-of-type`: así la composición es predecible y no se rompe
 * cuando se agrega o se saca una foto de `galleryItems`.
 *
 * Los desplazamientos verticales están calculados para que el hueco que deja
 * cada columna quede ARRIBA de la foto más baja y no debajo, que es lo que
 * produce esos vacíos raros al pie de la sección.
 */
const LAYOUT = [
  // Fila 1 — la foto que abre, grande, a la izquierda.
  {
    span: 'sm:col-span-2 lg:col-span-7 lg:col-start-1',
    offset: '',
    ratio: '4 / 5',
    sizes: '(min-width: 1024px) 56vw, (min-width: 640px) 92vw, 100vw',
  },
  // Fila 1 — vertical angosta a la derecha, bajada para escalonar la lectura.
  {
    span: 'lg:col-span-4 lg:col-start-9',
    offset: 'lg:mt-28',
    ratio: '3 / 4',
    sizes: '(min-width: 1024px) 32vw, (min-width: 640px) 46vw, 100vw',
  },
  // Fila 2 — vertical media a la izquierda.
  {
    span: 'lg:col-span-5 lg:col-start-1',
    offset: 'lg:mt-24',
    ratio: '4 / 5',
    sizes: '(min-width: 1024px) 40vw, (min-width: 640px) 46vw, 100vw',
  },
  // Fila 2 — segunda foto grande, a la derecha y algo más arriba.
  {
    span: 'sm:col-span-2 lg:col-span-6 lg:col-start-7',
    offset: 'lg:-mt-16',
    ratio: '4 / 5',
    sizes: '(min-width: 1024px) 48vw, (min-width: 640px) 92vw, 100vw',
  },
  // Fila 3 — plano apaisado del salón, encajado con aire a los dos lados.
  {
    span: 'sm:col-span-2 lg:col-span-7 lg:col-start-4',
    offset: 'lg:mt-8',
    ratio: '4 / 3',
    sizes: '(min-width: 1024px) 56vw, (min-width: 640px) 92vw, 100vw',
  },
] as const;

export function Gallery() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const triggersRef = useRef<(HTMLButtonElement | null)[]>([]);

  const close = useCallback(() => {
    const index = openIndex;
    setOpenIndex(null);
    if (index !== null) triggersRef.current[index]?.focus();
  }, [openIndex]);

  const step = useCallback((direction: 1 | -1) => {
    setOpenIndex((current) => {
      if (current === null) return current;
      return (current + direction + galleryItems.length) % galleryItems.length;
    });
  }, []);

  useEffect(() => {
    if (openIndex === null) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        close();
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        step(1);
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        step(-1);
      } else if (event.key === 'Tab' && dialogRef.current) {
        const focusables = dialogRef.current.querySelectorAll<HTMLElement>('button');
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (!first || !last) return;
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener('keydown', onKeyDown);
    dialogRef.current?.querySelector<HTMLElement>('button')?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [openIndex, close, step]);

  const active = openIndex !== null ? galleryItems[openIndex] : null;

  return (
    <>
      <div className="mt-14 grid gap-x-[var(--space-gutter)] gap-y-[clamp(2rem,4vw,3.5rem)] sm:grid-cols-2 lg:mt-20 lg:grid-cols-12">
        {galleryItems.map((item, index) => {
          const layout = LAYOUT[index] ?? LAYOUT[LAYOUT.length - 1]!;

          return (
            <Reveal
              key={item.id}
              delay={index * 60}
              className={`${layout.span} ${layout.offset}`}
            >
              <button
                type="button"
                ref={(node) => {
                  triggersRef.current[index] = node;
                }}
                onClick={() => setOpenIndex(index)}
                className="group block w-full text-left"
              >
                <span className="block overflow-hidden bg-surface-muted">
                  <Image
                    src={item.image}
                    alt={item.alt}
                    placeholder="blur"
                    loading={index < 2 ? 'eager' : 'lazy'}
                    sizes={layout.sizes}
                    className="w-full object-cover transition-transform duration-[900ms] ease-[var(--ease-editorial)] group-hover:scale-[1.03] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
                    style={{ aspectRatio: layout.ratio }}
                  />
                </span>
                <span className="mt-3 flex items-baseline justify-between gap-4">
                  <span className="text-[0.9375rem]">{item.caption}</span>
                  <span
                    className="text-[0.8125rem] text-text-secondary opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-focus-visible:opacity-100"
                    aria-hidden="true"
                  >
                    Ampliar
                  </span>
                </span>
              </button>
            </Reveal>
          );
        })}
      </div>

      {/* Visor */}
      {active && (
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-label={`${active.caption}. Imagen ${(openIndex ?? 0) + 1} de ${galleryItems.length}.`}
          className="on-dark fixed inset-0 z-[90] flex flex-col bg-surface-deep/97 backdrop-blur-sm"
        >
          <div className="flex items-center justify-between gap-4 px-4 py-4 sm:px-8">
            <p className="text-[0.8125rem] text-text-inverse-muted">
              {(openIndex ?? 0) + 1} / {galleryItems.length}
            </p>
            <button
              type="button"
              onClick={close}
              className="flex h-11 items-center px-3 text-[0.9375rem] text-text-inverse"
            >
              Cerrar
              <span aria-hidden="true" className="ml-2 text-[1.2rem] leading-none">
                ×
              </span>
            </button>
          </div>

          <div className="flex min-h-0 flex-1 items-center justify-center px-4 pb-2 sm:px-8">
            <Image
              src={active.image}
              alt={active.alt}
              placeholder="blur"
              sizes="(min-width: 768px) 80vw, 100vw"
              className="max-h-full w-auto max-w-full object-contain"
            />
          </div>

          <div className="flex items-center justify-between gap-4 px-4 py-5 sm:px-8">
            <button
              type="button"
              onClick={() => step(-1)}
              className="flex h-11 items-center px-3 text-[0.9375rem] text-text-inverse"
            >
              <span aria-hidden="true" className="mr-2">
                ←
              </span>
              Anterior
            </button>

            <p className="hidden text-center text-[0.875rem] text-text-inverse-muted sm:block">
              {active.caption}
            </p>

            <button
              type="button"
              onClick={() => step(1)}
              className="flex h-11 items-center px-3 text-[0.9375rem] text-text-inverse"
            >
              Siguiente
              <span aria-hidden="true" className="ml-2">
                →
              </span>
            </button>
          </div>
        </div>
      )}
    </>
  );
}
