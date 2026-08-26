import { Hero } from '@/components/sections/hero';
import { ServicesPreview } from '@/components/sections/services-preview';
import { Gallery } from '@/components/sections/gallery';
import { BeforeAfter } from '@/components/sections/before-after';
import { Salon } from '@/components/sections/salon';
import { Reviews } from '@/components/sections/reviews';
import { Pricing } from '@/components/sections/pricing';
import { Instagram } from '@/components/sections/instagram';
import { Location } from '@/components/sections/location';
import { Faq } from '@/components/sections/faq';
import { Booking } from '@/components/sections/booking';
import { Section, SectionHeading } from '@/components/ui/section';
import { getReviews } from '@/lib/google/places';
import { getPriceList } from '@/lib/prices/sheet';
import { buildGraph, faqSchema } from '@/lib/seo/schema';

/**
 * Se revalida cada 12 horas: las reseñas de Google no cambian tan seguido
 * como para pagar una llamada por visita, pero tampoco conviene congelarlas.
 */
// La home revalida cada 10 minutos para que un cambio de precio en la planilla
// se vea rápido. Las reseñas tienen su propia caché más larga.
export const revalidate = 600;

export default async function HomePage() {
  const [reviews, priceList] = await Promise.all([getReviews(), getPriceList()]);

  return (
    <>
      <Hero />
      <ServicesPreview />

      <Section id="trabajos" labelledBy="trabajos-titulo">
        <div className="shell">
          <SectionHeading
            id="trabajos-titulo"
            eyebrow="Trabajos"
            title={
              <>
                Pelo real, luz de salón, <span className="heading-highlight">sin retoque</span>.
              </>
            }
            intro="Las sacamos acá mismo, el día del servicio, con la luz que hay. Ningún filtro: así te vas a ver cuando salgas."
          />
          <Gallery />

          <div className="mt-[clamp(4rem,8vw,7rem)] border-t border-border pt-[clamp(2.5rem,5vw,4rem)]">
            <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-baseline sm:justify-between">
              <h3 className="text-[length:var(--text-h3)]">
                Antes y después
              </h3>
              <p className="max-w-[26rem] text-[0.9375rem] text-text-secondary">
                La misma clienta, el mismo día. Movés el control y ves las dos.
              </p>
            </div>
            <BeforeAfter />
          </div>
        </div>
      </Section>

      <Reviews summary={reviews} />
      <Salon />
      <Pricing priceList={priceList} />
      <Booking />
      <Instagram />
      <Location />
      <Faq />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: buildGraph([faqSchema()]) }}
      />
    </>
  );
}
