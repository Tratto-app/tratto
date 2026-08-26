import Image from 'next/image';

import { instagramFallbackPosts } from '@/data/gallery';
import { business } from '@/data/business';
import { Section } from '@/components/ui/section';
import { Reveal } from '@/components/ui/reveal';

/**
 * Instagram.
 *
 * Hoy se alimenta de fotos que el salón entregó, guardadas localmente. Es una
 * decisión deliberada: raspar Instagram se rompe cada pocos meses y dejaría
 * la sección vacía sin aviso. Si más adelante se conecta la Instagram Basic
 * Display API, alcanza con pasarle los posts a este componente por props —
 * y si esa llamada falla, sigue mostrando estas fotos.
 */
export function Instagram({ posts = instagramFallbackPosts }) {
  return (
    <Section tone="deep" labelledBy="instagram-titulo">
      <div className="shell">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="eyebrow text-text-inverse-muted">Seguinos en Instagram</p>
            <h2 id="instagram-titulo" className="mt-4 text-[length:var(--text-h2)]">
              Subimos casi todo lo que <span className="heading-highlight">sale de acá</span>.
            </h2>
          </div>

          <a
            href={business.links.instagram}
            target="_blank"
            rel="noopener noreferrer"
            className="link-underline shrink-0 self-start text-[1.0625rem] text-text-inverse sm:self-auto"
          >
            {business.links.instagramHandle}
            <span className="sr-only"> (se abre en una pestaña nueva)</span>
          </a>
        </div>

        <ul className="mt-12 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {posts.map((post, index) => (
            <Reveal as="li" key={post.id} delay={index * 60}>
              <a
                href={business.links.instagram}
                target="_blank"
                rel="noopener noreferrer"
                className="group block overflow-hidden bg-surface-muted/20"
              >
                <Image
                  src={post.image}
                  alt={post.alt}
                  placeholder="blur"
                  loading="lazy"
                  sizes="(min-width: 1024px) 22vw, 48vw"
                  className="w-full object-cover transition-transform duration-[900ms] ease-[var(--ease-editorial)] group-hover:scale-[1.04] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
                  style={{ aspectRatio: '1 / 1' }}
                />
                <span className="sr-only">Ver en Instagram (se abre en una pestaña nueva)</span>
              </a>
            </Reveal>
          ))}
        </ul>
      </div>
    </Section>
  );
}
