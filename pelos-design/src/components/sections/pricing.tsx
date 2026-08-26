import { serviceCategories } from '@/data/services';
import { primaryContact } from '@/data/business';
import { PRICE_LIST_PATH, priceListAvailable } from '@/lib/price-list';
import { Section, SectionHeading } from '@/components/ui/section';
import { Reveal } from '@/components/ui/reveal';
import { ButtonLink } from '@/components/ui/button';

/**
 * Precios.
 *
 * La lista completa vive en un único documento oficial (/precios.pdf) para
 * que no haya dos verdades. Acá se explica cómo se cotiza y se linkea al
 * archivo; los importes no se duplican en el HTML.
 *
 * Si el archivo no está publicado, la sección no muestra un link roto: pasa
 * a ofrecer el presupuesto por mensaje.
 */
export function Pricing() {
  const available = priceListAvailable();
  const contact = primaryContact('Hola Pelo’s Design, quería consultar precios.');

  return (
    <Section id="precios" labelledBy="precios-titulo">
      <div className="shell">
        <div className="grid gap-x-[var(--space-gutter)] gap-y-12 lg:grid-cols-12">
          <div className="lg:col-span-6">
            <SectionHeading
              id="precios-titulo"
              index="05"
              eyebrow="Precios"
              title={
                <>
                  Los precios, <span className="heading-highlight">sin sorpresas</span>.
                </>
              }
              intro="La lista completa y vigente está en un documento aparte, así siempre ves la última versión y no un número viejo copiado en la web."
            />

            <Reveal className="mt-10 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              {available ? (
                <ButtonLink
                  href={PRICE_LIST_PATH}
                  variant="primary"
                  external
                  aria-describedby="precios-formato"
                >
                  Ver lista completa de precios
                </ButtonLink>
              ) : (
                <ButtonLink href={contact.href} variant="primary" external>
                  Pedir la lista de precios
                </ButtonLink>
              )}

              {available && (
                <a
                  href={PRICE_LIST_PATH}
                  download
                  className="inline-flex items-center justify-center border border-border-strong px-7 py-[0.9rem] text-[0.9375rem] font-medium transition-colors duration-300 hover:border-text-primary hover:bg-surface-muted"
                >
                  Descargar
                  <span className="sr-only"> la lista de precios en PDF</span>
                </a>
              )}
            </Reveal>

            {available && (
              <p id="precios-formato" className="mt-4 text-[0.8125rem] text-text-secondary">
                Documento PDF. Se abre en una pestaña nueva.
              </p>
            )}
          </div>

          <Reveal className="lg:col-span-5 lg:col-start-8">
            <div className="border-t border-border pt-8">
              <h3 className="text-[length:var(--text-h3)]">Cómo cotizamos</h3>
              <dl className="mt-6 flex flex-col gap-6">
                <div>
                  <dt className="eyebrow">Por servicio</dt>
                  <dd className="mt-2 text-text-secondary">
                    {serviceCategories.map((c) => c.name).join(', ')}: cada uno tiene su
                    valor en la lista.
                  </dd>
                </div>
                <div>
                  <dt className="eyebrow">Por largo y densidad</dt>
                  <dd className="mt-2 text-text-secondary">
                    En color, el pelo largo o muy poblado lleva más producto y más tiempo.
                    Eso puede mover el precio, y te lo decimos antes de empezar.
                  </dd>
                </div>
                <div>
                  <dt className="eyebrow">Cuando hace falta más de un paso</dt>
                  <dd className="mt-2 text-text-secondary">
                    Si tu pelo necesita un tratamiento previo o una segunda sesión para
                    llegar al tono que querés, lo hablamos y lo presupuestamos junto.
                  </dd>
                </div>
              </dl>
            </div>
          </Reveal>
        </div>
      </div>
    </Section>
  );
}
