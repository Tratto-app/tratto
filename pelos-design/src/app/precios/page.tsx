import type { Metadata } from 'next';

import { business, primaryContact } from '@/data/business';
import { hasPrices } from '@/data/prices';
import { getPriceList } from '@/lib/prices/sheet';
import { PRICE_LIST_PATH, priceListAvailable } from '@/lib/price-list';
import { PriceTable } from '@/components/sections/price-table';
import { Breadcrumbs } from '@/components/ui/breadcrumbs';
import { ButtonLink } from '@/components/ui/button';
import { Reveal } from '@/components/ui/reveal';
import { buildGraph, breadcrumbSchema } from '@/lib/seo/schema';

/** Un cambio en la planilla se ve en menos de diez minutos. */
export const revalidate = 600;

export const metadata: Metadata = {
  title: 'Lista de precios',
  description:
    'Lista de precios completa de Pelo’s Design, peluquería en Caballito: color, corte, tratamientos y peinados, con el valor para cabello corto, mediano, largo y extra largo.',
  alternates: { canonical: '/precios' },
  openGraph: {
    title: "Lista de precios | Pelo's Design",
    description:
      'Todos los precios del salón, con el valor para cada largo de cabello.',
    url: '/precios',
  },
};

const trail = [
  { name: 'Inicio', path: '/' },
  { name: 'Precios', path: '/precios' },
];

export default async function PreciosPage() {
  const priceList = await getPriceList();
  const contact = primaryContact('Hola Pelo’s Design, quería consultar precios.');
  const pdfAvailable = priceListAvailable();

  return (
    <>
      <div className="shell pt-10 pb-[clamp(2rem,4vw,3rem)] lg:pt-16">
        <Breadcrumbs trail={trail} />

        <p className="eyebrow">Precios</p>
        <h1 className="mt-5 max-w-[18ch] text-[length:var(--text-h1)]">
          Todo lo que hacemos, <span className="heading-highlight">con su precio</span>.
        </h1>
        <p className="mt-7 max-w-[38rem] text-[length:var(--text-lead)] leading-[1.5] text-text-secondary">
          Elegí cómo tenés el pelo y vas a ver exactamente lo que te sale. Si lo tenés muy poblado,
          algún color puede moverse un poco: te lo decimos siempre antes de empezar, nunca después.
        </p>

        <PriceTable list={priceList} />

        <Reveal className="mt-12 border-t border-border pt-8">
          <div className="grid gap-x-[var(--space-gutter)] gap-y-6 lg:grid-cols-12 lg:items-center">
            <div className="lg:col-span-7">
              {priceList.validFrom && (
                <p className="text-[0.9375rem] text-text-secondary">
                  Lista vigente desde {priceList.validFrom}. Si pasó un tiempo, consultanos.
                </p>
              )}
              {!hasPrices(priceList) && (
                <p className="text-[0.9375rem] text-accent">
                  Estamos terminando de cargar la lista. Escribinos y te pasamos el valor de lo
                  que necesites.
                </p>
              )}
            </div>

            <div className="flex flex-col gap-3 sm:flex-row lg:col-span-5 lg:justify-end">
              <ButtonLink href="/#reservar" variant="primary">
                Reservar turno
              </ButtonLink>
              {pdfAvailable ? (
                <a
                  href={PRICE_LIST_PATH}
                  download
                  className="inline-flex items-center justify-center border border-border-strong px-7 py-[0.9rem] text-[0.9375rem] font-medium transition-colors duration-300 hover:border-text-primary hover:bg-surface-muted"
                >
                  Descargar
                  <span className="sr-only"> la lista de precios en PDF</span>
                </a>
              ) : (
                <ButtonLink href={contact.href} variant="secondary" external>
                  {contact.label}
                </ButtonLink>
              )}
            </div>
          </div>
        </Reveal>

        <p className="mt-10 text-[0.875rem] text-text-secondary">
          ¿Querés saber qué incluye cada servicio?{' '}
          <a href="/servicios" className="link-underline text-text-primary">
            Mirá el detalle
          </a>{' '}
          o escribinos por{' '}
          <a
            href={business.links.instagram}
            target="_blank"
            rel="noopener noreferrer"
            className="link-underline text-text-primary"
          >
            Instagram
          </a>
          .
        </p>
      </div>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: buildGraph([breadcrumbSchema(trail)]) }}
      />
    </>
  );
}
