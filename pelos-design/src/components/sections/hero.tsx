import Image from 'next/image';
import Link from 'next/link';

import { heroImage } from '@/data/gallery';
import { business, formattedAddress, primaryContact } from '@/data/business';
import { ButtonLink } from '@/components/ui/button';

/**
 * Hero.
 *
 * Composición asimétrica: el titular ocupa siete columnas y la foto cinco,
 * pero la foto sube por encima de la línea del texto y sangra hasta el borde
 * derecho. Esa tensión —y no un centrado— es lo que le da aire de editorial.
 *
 * La imagen lleva `priority` porque es el LCP de la página.
 */
export function Hero() {
  const contact = primaryContact();

  return (
    <section className="relative overflow-hidden pt-10 pb-[clamp(3rem,6vw,6rem)] lg:pt-16">
      <div className="shell">
        <div className="grid items-end gap-x-[var(--space-gutter)] gap-y-10 lg:grid-cols-12">
          {/* Columna de texto */}
          <div className="lg:col-span-7 lg:pb-8">
            <p className="eyebrow flex flex-wrap items-center gap-x-3 gap-y-1">
              <span>Peluquería en Caballito</span>
              <span aria-hidden="true" className="text-accent">
                ·
              </span>
              <span>{business.address.street}</span>
            </p>

            <h1 className="mt-6 text-[length:var(--text-h1)]">
              El color,
              <br />
              <span className="heading-highlight">hecho a mano.</span>
            </h1>

            <p className="mt-7 max-w-[34rem] text-[length:var(--text-lead)] leading-[1.5] text-text-secondary">
              Cada cabeza pide una fórmula distinta. Miramos tu pelo antes de tocarlo —
              qué base tenés, qué le quedó del color anterior, cuánto aguanta— y recién
              ahí decidimos.
            </p>

            <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
              <ButtonLink href="/#reservar" variant="primary">
                Reservar turno
              </ButtonLink>
              <ButtonLink href={contact.href} variant="secondary" external>
                {contact.label}
              </ButtonLink>
              <Link
                href="/#precios"
                className="link-underline self-start py-2 text-[0.9375rem] text-text-secondary hover:text-accent sm:ml-2 sm:self-center sm:py-0"
              >
                Ver precios
              </Link>
            </div>
          </div>

          {/* Columna de imagen — sangra al borde en desktop */}
          <div className="lg:col-span-5">
            <figure className="relative -mx-[var(--space-gutter)] lg:mx-0 lg:-mr-[max(0px,calc((100vw-90rem)/2))]">
              <Image
                src={heroImage.image}
                alt={heroImage.alt}
                priority
                sizes="(min-width: 1024px) 42vw, 100vw"
                placeholder="blur"
                quality={82}
                className="h-[62vh] w-full object-cover object-center lg:h-[clamp(30rem,58vw,44rem)]"
              />
              <figcaption className="mt-3 px-[var(--space-gutter)] text-[0.8125rem] text-text-secondary lg:px-0">
                Cobre intenso, trabajo del salón.
              </figcaption>
            </figure>
          </div>
        </div>
      </div>

      {/* Franja de contexto: responde "dónde estoy" sin ocupar una sección entera. */}
      <div className="shell mt-[clamp(2.5rem,5vw,4.5rem)]">
        <hr className="rule" />
        <dl className="grid gap-x-8 gap-y-6 py-7 sm:grid-cols-3">
          <div>
            <dt className="eyebrow">Dónde</dt>
            <dd className="mt-2 text-[0.9375rem]">{formattedAddress}</dd>
          </div>
          <div>
            <dt className="eyebrow">Especialidad</dt>
            <dd className="mt-2 text-[0.9375rem]">Color y corte</dd>
          </div>
          <div>
            <dt className="eyebrow">Turnos</dt>
            <dd className="mt-2 text-[0.9375rem]">
              Por {contact.channel === 'whatsapp' ? 'WhatsApp' : 'Instagram'}, con reserva previa
            </dd>
          </div>
        </dl>
        <hr className="rule" />
      </div>
    </section>
  );
}
