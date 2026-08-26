import type { Metadata } from 'next';
import Link from 'next/link';

import { serviceCategories } from '@/data/services';
import { business, primaryContact } from '@/data/business';
import { Breadcrumbs } from '@/components/ui/breadcrumbs';
import { Reveal } from '@/components/ui/reveal';
import { ButtonLink } from '@/components/ui/button';
import { buildGraph, breadcrumbSchema } from '@/lib/seo/schema';

export const metadata: Metadata = {
  title: 'Servicios: color, corte, tratamientos y peinados',
  description:
    'Todos los servicios de Pelo’s Design en Caballito: coloración, mechas, balayage, cobrizos, cortes con capas, flequillo, hidratación, control de frizz, brushing y ondas.',
  alternates: { canonical: '/servicios' },
  openGraph: {
    title: "Servicios | Pelo's Design",
    description:
      'Color, corte, tratamientos y peinados en Yerbal 880, Caballito. Mirá qué incluye cada servicio.',
    url: '/servicios',
  },
};

const trail = [
  { name: 'Inicio', path: '/' },
  { name: 'Servicios', path: '/servicios' },
];

export default function ServiciosPage() {
  const contact = primaryContact();

  return (
    <>
      <div className="shell pt-10 pb-[clamp(3rem,6vw,5rem)] lg:pt-16">
        <Breadcrumbs trail={trail} />

        <p className="eyebrow">Servicios</p>
        <h1 className="mt-5 max-w-[20ch] text-[length:var(--text-h1)]">
          Todo lo que hacemos, <span className="heading-highlight">en detalle</span>.
        </h1>
        <p className="mt-7 max-w-[38rem] text-[length:var(--text-lead)] leading-[1.5] text-text-secondary">
          Cuatro terrenos: {serviceCategories.map((c) => c.name.toLowerCase()).join(', ')}. La
          técnica exacta se define cuando vemos tu pelo, así que tomá esto como un mapa, no
          como un menú cerrado.
        </p>

        <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <ButtonLink href="/#reservar" variant="primary">
            Reservar turno
          </ButtonLink>
          <ButtonLink href="/#precios" variant="secondary">
            Ver precios
          </ButtonLink>
        </div>
      </div>

      {serviceCategories.map((category, categoryIndex) => (
        <section
          key={category.slug}
          id={category.slug}
          aria-labelledby={`${category.slug}-titulo`}
          className={`scroll-mt-28 py-[clamp(3.5rem,6vw,6rem)] ${
            categoryIndex % 2 === 1 ? 'bg-surface-muted' : ''
          }`}
        >
          <div className="shell">
            <div className="grid gap-x-[var(--space-gutter)] gap-y-10 lg:grid-cols-12">
              <div className="lg:col-span-4">
                <div className="lg:sticky lg:top-32">
                  <p className="eyebrow">{category.name}</p>
                  <h2
                    id={`${category.slug}-titulo`}
                    className="mt-3 text-[length:var(--text-h2)]"
                  >
                    {category.name}
                  </h2>
                  <p className="mt-5 max-w-[28rem] text-text-secondary">{category.intro}</p>
                </div>
              </div>

              <div className="lg:col-span-7 lg:col-start-6">
                {/* El <dl> lleva cada par dt/dd dentro de UN solo <div>: es lo
                    único que la especificación permite como agrupador, y axe
                    marca como error cualquier anidado extra. */}
                <dl className="border-t border-border">
                  {category.services.map((service, index) => (
                    <Reveal
                      key={service.slug}
                      delay={index * 50}
                      className="border-b border-border py-7"
                    >
                      <dt className="text-[length:var(--text-h3)]">{service.name}</dt>
                      <dd className="mt-3 flex flex-col gap-2">
                        <p className="text-text-primary">{service.summary}</p>
                        <p className="text-text-secondary">{service.detail}</p>
                      </dd>
                    </Reveal>
                  ))}
                </dl>
              </div>
            </div>
          </div>
        </section>
      ))}

      <section className="py-[clamp(4rem,7vw,7rem)]">
        <div className="shell-narrow text-center">
          <h2 className="text-[length:var(--text-h2)]">
            ¿No sabés qué te conviene?
          </h2>
          <p className="mt-5 text-[length:var(--text-lead)] leading-[1.55] text-text-secondary">
            Contanos cómo tenés el pelo y a dónde querés llegar. Te decimos qué hace falta,
            en cuántas sesiones y cuánto sale, antes de que reserves.
          </p>
          <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row sm:flex-wrap">
            <ButtonLink href={contact.href} variant="primary" external>
              {contact.label}
            </ButtonLink>
            <ButtonLink href="/#trabajos" variant="secondary">
              Ver trabajos
            </ButtonLink>
          </div>
          <p className="mt-8 text-[0.875rem] text-text-secondary">
            También podés{' '}
            <Link href="/#encontranos" className="link-underline text-text-primary">
              ver dónde estamos
            </Link>{' '}
            o mirar el{' '}
            <a
              href={business.links.instagram}
              target="_blank"
              rel="noopener noreferrer"
              className="link-underline text-text-primary"
            >
              Instagram del salón
            </a>
            .
          </p>
        </div>
      </section>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: buildGraph([breadcrumbSchema(trail)]) }}
      />
    </>
  );
}
