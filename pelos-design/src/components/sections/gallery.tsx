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
 * La primera versión escalonaba las fotos con desplazamientos verticales. Se
 * cambió por una grilla que cierra pareja: cada foto es una placa con su
 * rótulo abajo, y las alturas de cada fila coinciden.
 *
 * La fila de abajo combina una vertical y una apaisada del doble de ancho:
 * 4:5 sobre una columna mide casi lo mismo que 8:5 sobre dos, así que los
 * rótulos quedan alineados sin forzar nada.
 */
const LAYOUT = [
  {
    span: 'lg:col-span-4',
    ratio: '4 / 5',
    sizes: '(min-width: 1024px) 31vw, (min-width: 640px) 46vw, 100vw',
  },
  {
    span: 'lg:col-span-4',
    ratio: '4 / 5',
    sizes: '(min-width: 1024px) 31vw, (min-width: 640px) 46vw, 100vw',
  },
  {
    span: 'lg:col-span-4',
    ratio: '4 / 5',
    sizes: '(min-width: 1024px) 31vw, (min-width: 640px) 46vw, 100vw',
  },
  {
    span: 'lg:col-span-4',
    ratio: '4 / 5',
    sizes: '(min-width: 1024px) 31vw, (min-width: 640px) 46vw, 100vw',
  },
  {
    span: 'sm:col-span-2 lg:col-span-8',
    ratio: '8 / 5',
    sizes: '(min-width: 1024px) 63vw, (min-width: 640px) 92vw, 100vw',
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
      <div className="mt-14 grid gap-[clamp(1rem,2vw,1.75rem)] sm:grid-cols-2 lg:mt-16 lg:grid-cols-12">
        {galleryItems.map((item, index) => {
          const layout = LAYOUT[index] ?? LAYOUT[LAYOUT.length - 1]!;

          return (
            <Reveal key={item.id} delay={index * 60} className={layout.span}>
              <button
                type="button"
                ref={(node) => {
                  triggersRef.current[index] = node;
                }}
                onClick={() => setOpenIndex(index)}
                className="group block h-full w-full text-left"
              >
                {/* La foto */}
                <span className="relative block overflow-hidden bg-surface-muted">
                  <Image
                    src={item.image}
                    alt={item.alt}
                    placeholder="blur"
                    // Todas diferidas: la galería está bien abajo del pliegue y
                    // cualquier descarga temprana le compite el ancho de banda a
                    // la foto del hero, que es el LCP de la página.
                    loading="lazy" 
                    sizes={layout.sizes}
                    className="w-full object-cover transition-transform duration-[900ms] ease-[var(--ease-editorial)] group-hover:scale-[1.04] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
                    style={{ aspectRatio: layout.ratio }}
                  />

                  {/* Señal de que se puede ampliar, sólo al pasar el cursor. */}
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute right-3 bottom-3 flex h-9 w-9 items-center justify-center bg-background/90 text-[1.1rem] leading-none text-text-primary opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-focus-visible:opacity-100"
                  >
                    +
                  </span>
                </span>

                {/* El rótulo, como en una placa: banda sólida y texto centrado */}
                <span className="block bg-surface-deep px-4 py-4 text-center transition-colors duration-300 group-hover:bg-accent-deep">
                  <span className="block text-[0.75rem] font-medium tracking-[0.14em] text-text-inverse uppercase">
                    {item.caption}
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
