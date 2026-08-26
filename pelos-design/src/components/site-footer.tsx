import Link from 'next/link';

import { business, formattedAddress, primaryContact } from '@/data/business';
import { primaryNav } from '@/data/navigation';
import { Wordmark } from '@/components/ui/wordmark';

/**
 * Pie del sitio.
 *
 * Repite el NAP completo (nombre, dirección, teléfono) exactamente igual que
 * en la sección Encontranos y que en el JSON-LD: la consistencia del NAP es
 * uno de los factores que más pesa en SEO local.
 */
export function SiteFooter() {
  const year = new Date().getFullYear();
  const contact = primaryContact();

  return (
    <footer className="border-t border-border bg-background pt-[clamp(3.5rem,6vw,5.5rem)] pb-[calc(6rem+env(safe-area-inset-bottom))] lg:pb-14">
      <div className="shell">
        <div className="grid gap-x-[var(--space-gutter)] gap-y-12 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <Wordmark className="text-[1.6rem]" />
            <p className="mt-5 max-w-[26rem] text-text-secondary">
              Peluquería en Caballito especializada en color y corte.
            </p>

            <address className="mt-6 flex flex-col gap-1 text-[0.9375rem] not-italic">
              <span>{formattedAddress}</span>
              {business.phone && (
                <a
                  href={`tel:${business.phone.replace(/\s/g, '')}`}
                  className="link-underline self-start"
                >
                  {business.phone}
                </a>
              )}
            </address>
          </div>

          <nav aria-label="Navegación del pie" className="lg:col-span-3">
            <h2 className="eyebrow">Secciones</h2>
            <ul className="mt-5 flex flex-col gap-2.5">
              {primaryNav.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className="link-underline text-[0.9375rem]">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div className="lg:col-span-3">
            <h2 className="eyebrow">Seguinos y escribinos</h2>
            <ul className="mt-5 flex flex-col gap-2.5 text-[0.9375rem]">
              <li>
                <a
                  href={business.links.instagram}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="link-underline"
                >
                  Instagram {business.links.instagramHandle}
                </a>
              </li>
              <li>
                <a
                  href={business.links.googleMaps}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="link-underline"
                >
                  Ficha en Google Maps
                </a>
              </li>
              <li>
                <a
                  href={contact.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="link-underline"
                >
                  {contact.label}
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-14 flex flex-col gap-4 border-t border-border pt-7 text-[0.8125rem] text-text-secondary sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {year} {business.name}. Todos los derechos reservados.
          </p>
          <ul className="flex flex-wrap gap-x-6 gap-y-2">
            <li>
              <Link href="/legales/privacidad" className="link-underline">
                Política de privacidad
              </Link>
            </li>
            <li>
              <Link href="/legales/terminos" className="link-underline">
                Términos
              </Link>
            </li>
          </ul>
        </div>
      </div>
    </footer>
  );
}
