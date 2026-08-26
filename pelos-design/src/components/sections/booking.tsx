import { business, primaryContact, whatsappLink } from '@/data/business';
import { Reveal } from '@/components/ui/reveal';
import { ButtonLink } from '@/components/ui/button';

/**
 * Bloque de reserva.
 *
 * Es el destino de todos los "Reservar turno" del sitio, así que tiene que
 * cerrar la venta: dice exactamente qué hacer, por dónde, y qué contar en el
 * primer mensaje para no perder un ida y vuelta.
 */
export function Booking() {
  const contact = primaryContact();
  const hasWhatsapp = whatsappLink() !== null;

  return (
    <section
      id="reservar"
      aria-labelledby="reservar-titulo"
      className="on-dark bg-surface-deep py-[length:var(--space-section)] text-text-inverse"
    >
      <div className="shell">
        <div className="grid gap-x-[var(--space-gutter)] gap-y-12 lg:grid-cols-12 lg:items-end">
          <div className="lg:col-span-7">
            <p className="eyebrow text-text-inverse-muted">Reservar</p>
            <h2 id="reservar-titulo" className="mt-5 text-[length:var(--text-h2)]">
              Contanos qué tenés en la cabeza
              <span className="accent-type text-accent-soft"> y lo pensamos juntas</span>.
            </h2>
            <p className="mt-6 max-w-[34rem] text-[length:var(--text-lead)] leading-[1.55] text-text-inverse-muted">
              Trabajamos con turno. Escribinos y coordinamos día y horario.
            </p>

            <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <ButtonLink href={contact.href} external variant="primary-inverse">
                {contact.label}
              </ButtonLink>

              {hasWhatsapp && (
                <ButtonLink href={business.links.instagram} external variant="secondary-inverse">
                  Escribinos por Instagram
                </ButtonLink>
              )}
            </div>
          </div>

          <Reveal className="lg:col-span-4 lg:col-start-9">
            <p className="eyebrow text-text-inverse-muted">Para agilizar</p>
            <ul className="mt-5 flex flex-col divide-y divide-white/12 border-y border-white/12">
              {[
                'Qué te querés hacer: color, corte, tratamiento o varias cosas.',
                'Cómo tenés el pelo hoy: largo, si está teñido y hace cuánto.',
                'Si te sirve más una mañana o una tarde.',
              ].map((item, index) => (
                <li key={item} className="flex gap-4 py-4 text-[0.9375rem]">
                  <span className="accent-type text-accent-soft" aria-hidden="true">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <span className="text-text-inverse-muted">{item}</span>
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
