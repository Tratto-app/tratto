import Link from 'next/link';

import { primaryContact } from '@/data/business';
import { Section, SectionHeading } from '@/components/ui/section';
import { Reveal } from '@/components/ui/reveal';
import { ButtonLink } from '@/components/ui/button';

/**
 * Precios en la home.
 *
 * A propósito NO muestra la lista: 23 servicios por cuatro largos es una pared
 * de números que corta la lectura de la página. Acá se explica cómo se cobra y
 * se manda a la lista completa, que vive en su propia página.
 */
export function Pricing() {
  const contact = primaryContact('Hola Pelo’s Design, quería consultar precios.');

  return (
    <Section id="precios" tone="muted" labelledBy="precios-titulo">
      <div className="shell">
        <div className="grid gap-x-[var(--space-gutter)] gap-y-12 lg:grid-cols-12 lg:items-start">
          <div className="lg:col-span-6">
            <SectionHeading
              id="precios-titulo"
              eyebrow="Precios"
              title={
                <>
                  Los precios, <span className="heading-highlight">sin sorpresas</span>.
                </>
              }
              intro="Están todos publicados, con el valor para cada largo de pelo. Nada de «consultar por privado»."
            />

            <Reveal className="mt-9 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <ButtonLink href="/precios" variant="primary">
                Ver listado de precios
              </ButtonLink>
              <ButtonLink href={contact.href} variant="secondary" external>
                {contact.label}
              </ButtonLink>
            </Reveal>
          </div>

          <Reveal className="lg:col-span-5 lg:col-start-8">
            <dl className="flex flex-col divide-y divide-border border-y border-border">
              <div className="py-5">
                <dt className="eyebrow">Según el largo</dt>
                <dd className="mt-2 text-text-secondary">
                  El pelo largo lleva más producto y más tiempo, sobre todo en color. Por eso hay
                  un valor para cabello corto, mediano, largo y extra largo.
                </dd>
              </div>
              <div className="py-5">
                <dt className="eyebrow">El corte, uno solo</dt>
                <dd className="mt-2 text-text-secondary">
                  Vale lo mismo tengas el largo que tengas.
                </dd>
              </div>
              <div className="py-5">
                <dt className="eyebrow">Si hace falta más de un paso</dt>
                <dd className="mt-2 text-text-secondary">
                  Cuando tu pelo necesita un tratamiento previo o una segunda sesión para llegar al
                  tono que querés, lo hablamos y lo presupuestamos antes de empezar.
                </dd>
              </div>
            </dl>

            <p className="mt-6 text-[0.875rem] text-text-secondary">
              ¿Dudas con algún servicio?{' '}
              <Link href="/servicios" className="link-underline text-text-primary">
                Mirá qué incluye cada uno
              </Link>
              .
            </p>
          </Reveal>
        </div>
      </div>
    </Section>
  );
}
