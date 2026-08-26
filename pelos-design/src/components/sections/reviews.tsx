import { business } from '@/data/business';
import { hasReviewContent, type ReviewsSummary } from '@/data/reviews';
import { Section, SectionHeading } from '@/components/ui/section';
import { Reveal } from '@/components/ui/reveal';
import { ButtonLink } from '@/components/ui/button';

/**
 * Reseñas de Google.
 *
 * Tres estados, todos diseñados:
 *   1. Con datos de la API  → promedio, estrellas, cantidad y reseñas.
 *   2. Con promedio pero sin textos → sólo el resumen numérico.
 *   3. Sin datos → invitación honesta a leerlas en Google.
 *
 * Nunca se muestra un número que no venga de la ficha real, y nunca se
 * fabrica un testimonio.
 */

function Stars({ rating }: { rating: number }) {
  const rounded = Math.round(rating * 2) / 2;
  return (
    <span className="inline-flex gap-[0.15em] text-accent" aria-hidden="true">
      {[1, 2, 3, 4, 5].map((star) => (
        <span key={star} className="text-[1.05rem] leading-none">
          {rounded >= star ? '★' : rounded >= star - 0.5 ? '⯨' : '☆'}
        </span>
      ))}
    </span>
  );
}

function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat('es-AR', { month: 'long', year: 'numeric' }).format(date);
}

export function Reviews({ summary }: { summary: ReviewsSummary }) {
  const showContent = hasReviewContent(summary);

  return (
    <Section id="opiniones" tone="muted" labelledBy="opiniones-titulo">
      <div className="shell">
        <SectionHeading
          id="opiniones-titulo"
          eyebrow="Lo que dicen nuestras clientas"
          title={
            <>
              Preferimos que lo cuenten <span className="heading-highlight">ellas</span>.
            </>
          }
          intro={
            showContent
              ? 'Reseñas que dejaron clientas en la ficha de Google del salón.'
              : 'Todo lo que dicen de nosotros está en la ficha de Google, donde cualquiera puede leerlo y dejar lo suyo.'
          }
        />

        {summary.rating !== null && (
          <Reveal className="mt-12 flex flex-wrap items-baseline gap-x-6 gap-y-3 border-y border-border py-8">
            <p className="font-[family-name:var(--font-display)] text-[3.5rem] italic leading-none">
              {summary.rating.toFixed(1).replace('.', ',')}
            </p>
            <div className="flex flex-col gap-1">
              <Stars rating={summary.rating} />
              <p className="text-[0.9375rem] text-text-secondary">
                {summary.total !== null
                  ? `Promedio de ${summary.total} reseñas en Google`
                  : 'Promedio en Google'}
              </p>
            </div>
          </Reveal>
        )}

        {summary.reviews.length > 0 && (
          <ul className="mt-12 grid gap-x-[var(--space-gutter)] gap-y-10 md:grid-cols-2 lg:grid-cols-3">
            {summary.reviews.slice(0, 6).map((review, index) => {
              const date = formatDate(review.publishedAt) ?? review.relativeTime;
              return (
                <Reveal as="li" key={review.id} delay={index * 60}>
                  <figure className="flex h-full flex-col gap-4 border-t border-border pt-6">
                    {review.rating > 0 && (
                      <>
                        <Stars rating={review.rating} />
                        <span className="sr-only">{review.rating} de 5 estrellas.</span>
                      </>
                    )}
                    <blockquote className="text-[1.0625rem] leading-[1.6]">
                      {review.text}
                    </blockquote>
                    <figcaption className="mt-auto pt-2 text-[0.875rem] text-text-secondary">
                      <span className="text-text-primary">{review.author}</span>
                      {date && <span> · {date}</span>}
                    </figcaption>
                  </figure>
                </Reveal>
              );
            })}
          </ul>
        )}

        {/* Sin datos verificados, la sección no se queda vacía: explica por qué
            no hay números y usa el ancho completo para llevar a la ficha real. */}
        {!showContent && (
          <Reveal className="mt-12 grid gap-x-[var(--space-gutter)] gap-y-8 border-t border-border pt-10 lg:grid-cols-12">
            <p className="text-[length:var(--text-lead)] leading-[1.55] lg:col-span-5">
              No queremos poner acá un puntaje que no podamos respaldar. Entrá a Google y
              leelas vos misma, que es más honesto.
            </p>

            <dl className="flex flex-col gap-5 lg:col-span-4 lg:col-start-7">
              <div>
                <dt className="eyebrow">Dónde están</dt>
                <dd className="mt-2 text-text-secondary">
                  En la ficha de Google del salón, con el nombre y la fecha de cada clienta.
                </dd>
              </div>
              <div>
                <dt className="eyebrow">Dejá la tuya</dt>
                <dd className="mt-2 text-text-secondary">
                  Si ya viniste, contá cómo te fue. Nos sirve más que cualquier publicidad.
                </dd>
              </div>
            </dl>

            <div className="lg:col-span-3 lg:col-start-11 lg:justify-self-end">
              <ButtonLink href={business.links.googleMaps} variant="secondary" external>
                Ver reseñas
              </ButtonLink>
            </div>
          </Reveal>
        )}

        {showContent && (
          <Reveal className="mt-10 flex flex-wrap gap-3">
            <ButtonLink href={business.links.googleMaps} variant="secondary" external>
              Ver todas las reseñas en Google
            </ButtonLink>
          </Reveal>
        )}
      </div>
    </Section>
  );
}
