import Image from 'next/image';

import salonInterior from '@/assets/images/salon-interior.jpg';
import tallerColor from '@/assets/images/taller-color.jpg';
import { Section, SectionHeading } from '@/components/ui/section';
import { Reveal } from '@/components/ui/reveal';

/**
 * La experiencia del salón.
 *
 * Es la sección que responde "por qué acá y no en cualquier otra". El ángulo
 * sale de las fotos del propio salón: hay obra colgada en las paredes, y ese
 * detalle dice más de la casa que cualquier adjetivo.
 */
export function Salon() {
  return (
    <Section id="nosotros" labelledBy="nosotros-titulo">
      <div className="shell">
        <div className="grid gap-x-[var(--space-gutter)] gap-y-12 lg:grid-cols-12 lg:items-start">
          <div className="lg:col-span-5 lg:sticky lg:top-32">
            <SectionHeading
              id="nosotros-titulo"
              index="04"
              eyebrow="El salón"
              title={
                <>
                  Un taller de color <span className="accent-type">en Caballito</span>.
                </>
              }
            />

            <div className="mt-8 flex max-w-[34rem] flex-col gap-5 text-[length:var(--text-lead)] leading-[1.55] text-text-secondary">
              <p>
                No somos una cadena. Somos un salón de barrio sobre Yerbal, con espejos de
                madera, sillas rojas y cuadros grandes en las paredes: el color es una
                obsesión de la casa, dentro y fuera de la cabeza.
              </p>
              <p>
                Trabajamos con turno porque el color lleva tiempo y no queremos apurarlo. Vas
                a poder preguntar todo lo que quieras antes de que empecemos: qué te vamos a
                hacer, cuánto va a durar y cómo se mantiene en casa.
              </p>
            </div>
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
                  La aplicación, papel por papel.
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
                  Obra colgada sobre los espejos, en el salón.
                </figcaption>
              </figure>
            </Reveal>
          </div>
        </div>
      </div>
    </Section>
  );
}
