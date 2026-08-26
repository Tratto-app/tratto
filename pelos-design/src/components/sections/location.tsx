import { business, formattedAddress, openingHours, primaryContact, weekSchedule } from '@/data/business';
import { OpenNow } from '@/components/ui/open-now';
import { Section, SectionHeading } from '@/components/ui/section';
import { Reveal } from '@/components/ui/reveal';
import { ButtonLink } from '@/components/ui/button';

/**
 * Encontranos.
 *
 * El mapa se carga con `loading="lazy"` y sin API key: el modo `?q=` de Google
 * Maps embebido no la necesita, así que la página no depende de una clave ni
 * suma un script de terceros que bloquee el render.
 *
 * Los horarios salen de la ficha de Google del salón. Se muestran los siete
 * días, incluidos los cerrados: saber cuándo NO abren evita un viaje al pedo.
 */
export function Location() {
  const contact = primaryContact('Hola Pelo’s Design, quería consultar por un turno.');
  const mapQuery = encodeURIComponent(
    `${business.name}, ${business.address.street}, ${business.address.locality}, ${business.address.city}`,
  );

  return (
    <Section id="encontranos" tone="muted" labelledBy="encontranos-titulo">
      <div className="shell">
        <SectionHeading
          id="encontranos-titulo"
          eyebrow="Encontranos"
          title={
            <>
              {business.address.street}, <span className="heading-highlight">Caballito</span>.
            </>
          }
          intro="Sobre Yerbal, a pocas cuadras de Rivadavia. Si te perdés, escribinos y te vamos guiando."
        />

        <div className="mt-14 grid gap-x-[var(--space-gutter)] gap-y-10 lg:grid-cols-12">
          {/* Datos de contacto */}
          <div className="lg:col-span-4">
            <dl className="flex flex-col divide-y divide-border border-y border-border">
              <div className="py-5">
                <dt className="eyebrow">Dirección</dt>
                <dd className="mt-2">
                  <address className="not-italic">
                    {business.address.street}
                    <br />
                    {business.address.locality}, {business.address.city}
                    <br />
                    {business.address.postalCode}, {business.address.countryName}
                  </address>
                </dd>
              </div>

              {business.phone && (
                <div className="py-5">
                  <dt className="eyebrow">Teléfono</dt>
                  <dd className="mt-2">
                    <a
                      href={`tel:${business.phone.replace(/\s/g, '')}`}
                      className="link-underline"
                    >
                      {business.phone}
                    </a>
                  </dd>
                </div>
              )}

              <div className="py-5">
                <dt className="eyebrow">Horarios</dt>
                <dd className="mt-2">
                  {openingHours.length > 0 ? (
                    <>
                      <OpenNow className="mb-3" />
                      <ul aria-label="Horarios de atención por día" className="flex flex-col gap-1.5">
                        {weekSchedule().map(({ day, label, slot }) => (
                          <li
                            key={day}
                            className={`flex justify-between gap-4 text-[0.9375rem] ${
                              slot ? '' : 'text-text-secondary'
                            }`}
                          >
                            <span>{label}</span>
                            <span className={slot ? 'tabular-nums' : ''}>
                              {slot ? `${slot.opens} – ${slot.closes}` : 'Cerrado'}
                            </span>
                          </li>
                        ))}
                      </ul>
                      <p className="mt-3 text-[0.875rem] text-text-secondary">
                        Trabajamos con turno: escribinos antes de venir.
                      </p>
                    </>
                  ) : (
                    <p className="text-text-secondary">
                      Trabajamos con turno. Escribinos y coordinamos día y horario.
                    </p>
                  )}
                </dd>
              </div>

              <div className="py-5">
                <dt className="eyebrow">Instagram</dt>
                <dd className="mt-2">
                  <a
                    href={business.links.instagram}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="link-underline"
                  >
                    {business.links.instagramHandle}
                  </a>
                </dd>
              </div>
            </dl>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap lg:flex-col">
              <ButtonLink href={business.links.directions} variant="primary" external>
                Cómo llegar
              </ButtonLink>
              <ButtonLink href={business.links.googleMaps} variant="secondary" external>
                Abrir en Google Maps
              </ButtonLink>
              <ButtonLink href={contact.href} variant="secondary" external>
                {contact.label}
              </ButtonLink>
            </div>
          </div>

          {/* Mapa */}
          <Reveal className="lg:col-span-8">
            <div className="relative h-[22rem] w-full overflow-hidden border border-border bg-surface sm:h-[28rem] lg:h-full lg:min-h-[30rem]">
              {/* Capa de respaldo: queda DEBAJO del iframe. Si Google no carga
                  —bloqueo de red, extensión, cookies rechazadas— el visitante
                  ve igual la dirección y un camino a Maps, nunca un recuadro
                  vacío. */}
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center">
                <p className="eyebrow">Cómo llegar</p>
                <p className="font-[family-name:var(--font-display)] text-[1.5rem] italic leading-tight">
                  {business.address.street}
                </p>
                <p className="text-[0.9375rem] text-text-secondary">
                  {business.address.locality}, {business.address.city}
                </p>
                <a
                  href={business.links.googleMaps}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="link-underline mt-1 text-[0.9375rem] text-accent"
                >
                  Abrir la ubicación en Google Maps
                </a>
              </div>

              <iframe
                title={`Mapa con la ubicación de ${business.name} en ${formattedAddress}`}
                src={`https://www.google.com/maps?q=${mapQuery}&output=embed&hl=es`}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                className="absolute inset-0 h-full w-full border-0"
              />
            </div>
          </Reveal>
        </div>
      </div>
    </Section>
  );
}
