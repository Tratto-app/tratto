import { primaryContact } from '@/data/business';
import { hasPrices, type PriceList } from '@/data/prices';
import { PriceTable } from '@/components/sections/price-table';
import { PRICE_LIST_PATH, priceListAvailable } from '@/lib/price-list';
import { Section, SectionHeading } from '@/components/ui/section';
import { Reveal } from '@/components/ui/reveal';
import { ButtonLink } from '@/components/ui/button';

/**
 * Precios.
 *
 * La lista se muestra completa en la página —que es lo que la gente viene a
 * buscar— y además se puede descargar en PDF.
 *
 * Los datos salen de la planilla de Google que edita el salón; si no está
 * configurada o falla, cae en la copia local. Un servicio sin importe
 * confirmado se muestra como "Consultar" en vez de inventar un número.
 */
export function Pricing({ priceList }: { priceList: PriceList }) {
  const pdfAvailable = priceListAvailable();
  const withPrices = hasPrices(priceList);
  const contact = primaryContact('Hola Pelo’s Design, quería consultar precios.');

  return (
    <Section id="precios" tone="muted" labelledBy="precios-titulo">
      <div className="shell">
        <SectionHeading
          id="precios-titulo"
          eyebrow="Precios"
          title={
            <>
              Los precios, <span className="heading-highlight">sin sorpresas</span>.
            </>
          }
          intro="Los precios dependen del largo de tu pelo, así que elegí el tuyo y vas a ver exactamente lo que te sale. Está todo acá; también podés bajarte el PDF."
        />

        <PriceTable list={priceList} />

        {/* Pie de la lista */}
        <Reveal className="mt-14 border-t border-border pt-8">
          <div className="grid gap-x-[var(--space-gutter)] gap-y-8 lg:grid-cols-12">
            <div className="lg:col-span-7">
              <p className="max-w-[38rem] text-text-secondary">
                Si tenés el pelo muy poblado, algún color puede moverse un poco de lo que
                figura acá: lleva más producto y más tiempo. Te lo decimos siempre antes de
                empezar, nunca después.
              </p>
              {priceList.validFrom && (
                <p className="mt-3 text-[0.875rem] text-text-secondary">
                  Lista vigente desde {priceList.validFrom}. Si pasó un tiempo, consultanos.
                </p>
              )}
              {!withPrices && (
                <p className="mt-3 text-[0.875rem] text-accent">
                  Estamos terminando de cargar la lista. Escribinos y te pasamos el valor
                  de lo que necesites.
                </p>
              )}
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-start lg:col-span-5 lg:justify-end">
              {pdfAvailable ? (
                <>
                  {/* Abrir y descargar son dos cosas distintas: en el celular
                      mucha gente prefiere verlo antes de guardarlo. */}
                  <ButtonLink href={PRICE_LIST_PATH} variant="primary" external>
                    Ver la lista en PDF
                  </ButtonLink>
                  <a
                    href={PRICE_LIST_PATH}
                    download
                    className="inline-flex items-center justify-center border border-border-strong px-7 py-[0.9rem] text-[0.9375rem] font-medium transition-colors duration-300 hover:border-text-primary hover:bg-surface"
                  >
                    Descargar
                    <span className="sr-only"> la lista de precios en PDF</span>
                  </a>
                </>
              ) : (
                <ButtonLink href={contact.href} variant="primary" external>
                  {contact.label}
                </ButtonLink>
              )}
            </div>
          </div>
        </Reveal>
      </div>
    </Section>
  );
}
