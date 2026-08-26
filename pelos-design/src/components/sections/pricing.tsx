import { primaryContact } from '@/data/business';
import { hasPrices, type PriceList } from '@/data/prices';
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
          intro="Está toda acá abajo y también en un PDF que podés descargar. La actualizamos nosotros, así que lo que ves es lo que sale."
        />

        {/* La lista */}
        <div className="mt-14 grid gap-x-[clamp(2rem,5vw,5rem)] gap-y-12 lg:mt-16 lg:grid-cols-2">
          {priceList.groups.map((group, index) => (
            <Reveal as="section" key={group.title} delay={index * 60} aria-label={group.title}>
              <h3 className="text-[length:var(--text-h3)]">{group.title}</h3>

              <dl className="mt-5">
                {group.items.map((item) => (
                  <div
                    key={item.name}
                    className="flex items-baseline gap-3 border-b border-border py-3.5 last:border-b-0"
                  >
                    <dt className="shrink-0">{item.name}</dt>

                    {/* Guía de puntos: une el nombre con el importe sin tabla. */}
                    <span
                      aria-hidden="true"
                      className="min-w-6 flex-1 translate-y-[-0.28em] border-b border-dotted border-border-strong/60"
                    />

                    <dd
                      className={`shrink-0 tabular-nums ${
                        item.price ? 'font-medium' : 'text-text-secondary italic'
                      }`}
                    >
                      {item.price ?? 'Consultar'}
                    </dd>

                    {item.note && (
                      <dd className="w-full text-[0.8125rem] text-text-secondary">
                        {item.note}
                      </dd>
                    )}
                  </div>
                ))}
              </dl>
            </Reveal>
          ))}
        </div>

        {/* Pie de la lista */}
        <Reveal className="mt-14 border-t border-border pt-8">
          <div className="grid gap-x-[var(--space-gutter)] gap-y-8 lg:grid-cols-12">
            <div className="lg:col-span-7">
              <p className="max-w-[38rem] text-text-secondary">
                En color, el largo y lo poblado que tengas el pelo pueden mover el valor
                final: llevan más producto y más tiempo. Te lo decimos siempre antes de
                empezar, nunca después.
              </p>
              {priceList.validFrom && (
                <p className="mt-3 text-[0.875rem] text-text-secondary">
                  Precios vigentes desde {priceList.validFrom}.
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
