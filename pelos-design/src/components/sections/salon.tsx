import Image from 'next/image';

import salonInterior from '@/assets/images/salon-interior.jpg';
import tallerColor from '@/assets/images/taller-color.jpg';
import { Section } from '@/components/ui/section';
import { Reveal } from '@/components/ui/reveal';

/**
 * La experiencia del salón.
 *
 * Es el centro emocional de la página: la sección que contesta "por qué acá".
 * Está escrita en primera persona y a propósito con menos estructura que el
 * resto —sin ojo de sección, sin bajada, con la firma al pie— para que se lea
 * como alguien hablando y no como otro bloque más del sistema.
 */
export function Salon() {
  return (
    <Section id="nosotros" labelledBy="nosotros-titulo">
      <div className="shell">
        <div className="grid gap-x-[var(--space-gutter)] gap-y-12 lg:grid-cols-12 lg:items-start">
          <div className="lg:col-span-5 lg:sticky lg:top-32">
            <Reveal>
              <h2 id="nosotros-titulo" className="text-[length:var(--text-h2)]">
                Pasá, ponete cómoda.
              </h2>

              <div className="mt-7 flex max-w-[34rem] flex-col gap-5 text-[length:var(--text-lead)] leading-[1.6] text-text-secondary">
                <p>
                  Somos un salón chico sobre Yerbal. Espejos de madera, sillas rojas y unos
                  cuadros enormes que colgamos hace años y ya son parte de la casa. Nos vas a
                  reconocer por eso.
                </p>
                <p>
                  Acá nadie te apura. El color lleva el tiempo que lleva, y preferimos
                  atender de a poco antes que amontonar turnos. Mientras esperás que tome,
                  charlamos.
                </p>
                <p className="text-text-primary">
                  Preguntá todo lo que quieras antes de que empecemos: qué te vamos a hacer,
                  cuánto te va a durar y cómo lo mantenés en casa. Si algo no te cierra, lo
                  pensamos de nuevo.
                </p>
              </div>

              <p className="accent-type mt-8 text-[1.5rem] leading-none text-accent">
                Te esperamos.
              </p>
            </Reveal>
          </div>

          <div className="grid gap-[clamp(1.5rem,3vw,2.5rem)] lg:col-span-6 lg:col-start-7">
            <Reveal>
              <figure>
                <Image
                  src={tallerColor}
                  alt="Colorista del salón aplicando color con pincel sobre un papel, junto a la sien de una clienta."
                  placeholder="blur"
                  loading="lazy"
                  sizes="(min-width: 1024px) 48vw, 100vw"
                  className="w-full object-cover"
                  style={{ aspectRatio: '4 / 3' }}
                />
                <figcaption className="mt-3 text-[0.875rem] text-text-secondary">
                  Papel por papel. Es lento a propósito.
                </figcaption>
              </figure>
            </Reveal>

            <Reveal delay={80} className="lg:ml-[12%]">
              <figure>
                <Image
                  src={salonInterior}
                  alt="Interior del salón con espejos de marco de madera y dos pinturas abstractas de gran formato colgadas sobre la pared."
                  placeholder="blur"
                  loading="lazy"
                  sizes="(min-width: 1024px) 42vw, 100vw"
                  className="w-full object-cover"
                  style={{ aspectRatio: '1 / 1' }}
                />
                <figcaption className="mt-3 text-[0.875rem] text-text-secondary">
                  Los cuadros que nos delatan.
                </figcaption>
              </figure>
            </Reveal>
          </div>
        </div>
      </div>
    </Section>
  );
}
