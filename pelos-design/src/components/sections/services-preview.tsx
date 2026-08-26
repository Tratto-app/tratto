import Link from 'next/link';

import { serviceCategories } from '@/data/services';
import { Section, SectionHeading } from '@/components/ui/section';
import { Reveal } from '@/components/ui/reveal';

/**
 * Servicios en la home.
 *
 * A propósito NO son tarjetas: es una lista con reglas finas, como el índice
 * de una revista. Cada categoría se expande al pasar el cursor mostrando lo
 * que incluye, y linkea a la página de servicios.
 */
export function ServicesPreview() {
  return (
    <Section id="servicios" labelledBy="servicios-titulo">
      <div className="shell">
        <SectionHeading
          id="servicios-titulo"
          index="01"
          eyebrow="Qué hacemos"
          title={
            <>
              Color, corte y lo que <span className="heading-highlight">el pelo pida</span>.
            </>
          }
          intro="Cuatro terrenos. Dentro de cada uno, la técnica se elige después de mirarte el pelo, no antes."
        />

        <ul className="mt-14 border-t border-border lg:mt-20">
          {serviceCategories.map((category, index) => (
            <Reveal as="li" key={category.slug} delay={index * 70}>
              <Link
                href={`/servicios#${category.slug}`}
                className="group grid gap-x-8 gap-y-3 border-b border-border py-8 transition-colors duration-300 hover:bg-surface-muted lg:grid-cols-12 lg:items-baseline lg:px-4 lg:py-10"
              >
                <span
                  className="accent-type text-[1.1rem] text-accent lg:col-span-1"
                  aria-hidden="true"
                >
                  {category.index}
                </span>

                <h3 className="text-[length:var(--text-h3)] lg:col-span-3">
                  <span className="link-underline bg-[size:0%_1px] group-hover:bg-[size:100%_1px]">
                    {category.name}
                  </span>
                </h3>

                <p className="text-text-secondary lg:col-span-5">{category.intro}</p>

                {/* Espacios duros dentro de cada nombre: así el salto de línea
                    cae siempre en el separador y nunca parte "Balayage y barrido". */}
                <p className="text-[0.875rem] text-text-secondary lg:col-span-3 lg:text-right">
                  {category.services
                    .map((service) => service.name.replace(/ /g, '\u00A0'))
                    .join(' · ')}
                </p>
              </Link>
            </Reveal>
          ))}
        </ul>

        <Reveal className="mt-10">
          <Link
            href="/servicios"
            className="link-underline inline-block py-1.5 text-[0.9375rem] font-medium text-accent"
          >
            Ver todos los servicios en detalle
          </Link>
        </Reveal>
      </div>
    </Section>
  );
}
