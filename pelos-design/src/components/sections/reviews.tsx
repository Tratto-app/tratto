import { business } from '@/data/business';
import { hasReviewContent, type Review, type ReviewsSummary } from '@/data/reviews';
import { Section, SectionHeading } from '@/components/ui/section';
import { Reveal } from '@/components/ui/reveal';
import { ButtonLink } from '@/components/ui/button';

/**
 * Reseñas de Google.
 *
 * Tres estados, los tres diseñados:
 *   1. Promedio + cantidad + reseñas textuales (API de Google o carga manual).
 *   2. Sólo el promedio y la cantidad, sin textos.
 *   3. Sin datos: invitación honesta a leerlas en la ficha real.
 *
 * Nunca se muestra un número que no venga de la ficha, y nunca se fabrica un
 * testimonio. Ver src/data/reviews.ts para cómo cargarlas.
 */

function Stars({ rating, size = 'md' }: { rating: number; size?: 'md' | 'lg' }) {
  const rounded = Math.round(rating * 2) / 2;
  return (
    <span
      className={`inline-flex gap-[0.12em] text-accent ${
        size === 'lg' ? 'text-[1.5rem]' : 'text-[1.05rem]'
      }`}
      aria-hidden="true"
    >
      {[1, 2, 3, 4, 5].map((star) => (
        <span key={star} className="leading-none">
          {rounded >= star ? '★' : rounded >= star - 0.5 ? '⯨' : '☆'}
        </span>
      ))}
    </span>
  );
}

/**
 * Cuántas columnas usar en escritorio.
 *
 * Con cuatro reseñas, tres columnas dejan una sola en la fila de abajo; con
 * dos columnas cierran en un cuadrado. La regla vale también si más adelante
 * la API devuelve otra cantidad.
 */
function columnsFor(count: number): string {
  if (count <= 2 || count === 4) return 'lg:grid-cols-2';
  return 'lg:grid-cols-3';
}

function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat('es-AR', { month: 'long', year: 'numeric' }).format(date);
}

function ReviewCard({ review, index }: { review: Review; index: number }) {
  const date = formatDate(review.publishedAt) ?? review.relativeTime;

  return (
    <Reveal as="li" delay={index * 60} className="h-full">
      <figure className="flex h-full flex-col gap-4 border-t border-border pt-6">
        {review.rating > 0 && (
          <>
            <Stars rating={review.rating} />
            <span className="sr-only">{review.rating} de 5 estrellas.</span>
          </>
        )}

        <blockquote className="text-[1.0625rem] leading-[1.6]">
          <p>
            {review.text}
            {/* En Google esta reseña sigue: se marca el corte en vez de
                completarla, y se ofrece el enlace para leerla entera. */}
            {review.truncated && (
              <>
                <span aria-hidden="true">…</span>{' '}
                <a
                  href={business.links.googleMaps}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="link-underline text-[0.9375rem] whitespace-nowrap text-accent"
                >
                  seguir leyendo
                  <span className="sr-only"> la reseña completa de {review.author} en Google</span>
                </a>
              </>
            )}
          </p>
        </blockquote>

        <figcaption className="mt-auto pt-2 text-[0.875rem] text-text-secondary">
          <span className="text-text-primary">{review.author}</span>
          {date && <span> · {date}</span>}
        </figcaption>
      </figure>
    </Reveal>
  );
}

export function Reviews({ summary }: { summary: ReviewsSummary }) {
  const showContent = hasReviewContent(summary);
  const hasQuotes = summary.reviews.length > 0;

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

        {/* Puntuación */}
        {summary.rating !== null && (
          <Reveal className="mt-12 border-y border-border py-8">
            <div className="flex flex-wrap items-center gap-x-10 gap-y-6">
              <div className="flex items-center gap-5">
                <p className="font-[family-name:var(--font-display)] text-[4rem] leading-none italic">
                  {summary.rating.toFixed(1).replace('.', ',')}
                </p>
                <div className="flex flex-col gap-1.5">
                  <Stars rating={summary.rating} size="lg" />
                  <p className="text-[0.9375rem] text-text-secondary">
                    {summary.total !== null
                      ? `sobre ${summary.total} reseñas en Google`
                      : 'promedio en Google'}
                  </p>
                </div>
              </div>

              <p className="sr-only">
                Puntuación media de {summary.rating.toFixed(1)} sobre 5
                {summary.total !== null ? `, sobre ${summary.total} reseñas` : ''}.
              </p>

              <ButtonLink
                href={business.links.googleMaps}
                variant="secondary"
                external
                className="sm:ml-auto"
              >
                Ver todas en Google
              </ButtonLink>
            </div>
          </Reveal>
        )}

        {/* Reseñas textuales. Las columnas se eligen según cuántas haya, para
            que no quede una sola colgada en la última fila. */}
        {hasQuotes && (
          <ul
            className={`mt-12 grid gap-x-[var(--space-gutter)] gap-y-10 md:grid-cols-2 ${
              columnsFor(summary.reviews.length)
            }`}
          >
            {summary.reviews.slice(0, 6).map((review, index) => (
              <ReviewCard key={review.id} review={review} index={index} />
            ))}
          </ul>
        )}

        {summary.rating !== null && !hasQuotes && (
          <Reveal className="mt-8">
            <p className="max-w-[38rem] text-text-secondary">
              Las reseñas completas, con el nombre y la fecha de cada clienta, están en la
              ficha de Google.
            </p>
          </Reveal>
        )}

        {/* Sin datos verificados: la sección igual dice algo y lleva a Google. */}
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

        {hasQuotes && (
          <Reveal className="mt-10">
            <ButtonLink href={business.links.googleMaps} variant="secondary" external>
              Leer todas las reseñas en Google
            </ButtonLink>
          </Reveal>
        )}
      </div>
    </Section>
  );
}
