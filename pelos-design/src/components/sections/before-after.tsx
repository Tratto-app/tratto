'use client';

import Image from 'next/image';
import { useCallback, useId, useRef, useState } from 'react';

import { transformation } from '@/data/gallery';

/**
 * Comparador antes / después.
 *
 * Se maneja con mouse, con dedo y con teclado. La versión accesible del
 * control es un `input[type=range]` real, superpuesto y transparente: eso
 * nos da gratis el rol de slider, el valor anunciado, las flechas, Home/End
 * y el soporte de lectores de pantalla, sin construir ARIA a mano.
 *
 * Además, las dos fotos están siempre en el DOM con su `alt`, así que quien
 * no pueda usar el control igual accede a la descripción de ambas.
 */
export function BeforeAfter() {
  const [position, setPosition] = useState(50);
  const containerRef = useRef<HTMLDivElement>(null);
  const labelId = useId();

  const setFromPointer = useCallback((clientX: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return;
    const ratio = ((clientX - rect.left) / rect.width) * 100;
    setPosition(Math.min(100, Math.max(0, ratio)));
  }, []);

  return (
    <figure className="mt-12 lg:mt-16">
      <div
        ref={containerRef}
        className="relative touch-pan-y select-none overflow-hidden bg-surface-muted"
        style={{ aspectRatio: '554 / 992', maxHeight: '80vh', margin: '0 auto', maxWidth: '32rem' }}
        onPointerDown={(event) => {
          // Sólo arrastre con el botón principal; el teclado usa el range.
          if (event.button !== 0) return;
          event.currentTarget.setPointerCapture(event.pointerId);
          setFromPointer(event.clientX);
        }}
        onPointerMove={(event) => {
          if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
          setFromPointer(event.clientX);
        }}
      >
        {/* Después: capa de fondo, siempre completa */}
        <Image
          src={transformation.after.image}
          alt={transformation.after.alt}
          placeholder="blur"
          sizes="(min-width: 640px) 32rem, 100vw"
          className="absolute inset-0 h-full w-full object-cover"
        />

        {/* Antes: recortado por la posición del control */}
        <div
          className="absolute inset-0 overflow-hidden"
          style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}
        >
          <Image
            src={transformation.before.image}
            alt={transformation.before.alt}
            placeholder="blur"
            sizes="(min-width: 640px) 32rem, 100vw"
            className="absolute inset-0 h-full w-full object-cover"
          />
        </div>

        {/* Rótulos */}
        <span className="pointer-events-none absolute top-4 left-4 bg-surface-deep/80 px-3 py-1.5 text-[0.75rem] font-medium tracking-[0.12em] text-text-inverse uppercase">
          {transformation.before.label}
        </span>
        <span className="pointer-events-none absolute top-4 right-4 bg-surface-deep/80 px-3 py-1.5 text-[0.75rem] font-medium tracking-[0.12em] text-text-inverse uppercase">
          {transformation.after.label}
        </span>

        {/* Línea divisoria y tirador visual */}
        <div
          className="pointer-events-none absolute inset-y-0 w-px bg-background/90"
          style={{ left: `${position}%` }}
          aria-hidden="true"
        >
          <span className="absolute top-1/2 left-1/2 flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-background/80 bg-surface-deep/80 text-text-inverse backdrop-blur-[2px]">
            <span className="text-[0.85rem] tracking-[-0.15em]">◀▶</span>
          </span>
        </div>

        {/* Control real: invisible pero completamente operable */}
        <label htmlFor={labelId} className="sr-only">
          Comparar antes y después: deslizá para revelar cada foto
        </label>
        <input
          id={labelId}
          type="range"
          min={0}
          max={100}
          step={1}
          value={Math.round(position)}
          onChange={(event) => setPosition(Number(event.target.value))}
          aria-valuetext={`${Math.round(position)}% del antes visible`}
          className="absolute inset-0 h-full w-full cursor-ew-resize opacity-0"
        />
      </div>

      <figcaption className="mx-auto mt-4 max-w-[32rem] text-[0.9375rem] text-text-secondary">
        {transformation.caption}
      </figcaption>
    </figure>
  );
}
