import type { ReactNode } from 'react';

import { Breadcrumbs } from '@/components/ui/breadcrumbs';
import { business, primaryContact } from '@/data/business';
import { buildGraph, breadcrumbSchema } from '@/lib/seo/schema';

/**
 * Marco de las páginas legales.
 *
 * Los textos legales NO se inventan: se entregan como marcador visible para
 * que quede claro que faltan, en lugar de rellenarlos con una plantilla que
 * después nadie revisa y que no tiene validez.
 */
export function LegalPage({
  title,
  slug,
  children,
}: {
  title: string;
  slug: string;
  children: ReactNode;
}) {
  const trail = [
    { name: 'Inicio', path: '/' },
    { name: title, path: `/legales/${slug}` },
  ];
  const contact = primaryContact();

  return (
    <div className="shell-narrow py-[clamp(3rem,6vw,6rem)]">
      <Breadcrumbs trail={trail} />
      <h1 className="text-[length:var(--text-h2)]">{title}</h1>

      <div className="mt-8 flex flex-col gap-5 text-text-secondary">{children}</div>

      <p className="mt-12 border-t border-border pt-7 text-[0.9375rem]">
        Cualquier consulta sobre este texto,{' '}
        <a
          href={contact.href}
          target="_blank"
          rel="noopener noreferrer"
          className="link-underline text-text-primary"
        >
          escribinos
        </a>{' '}
        o pasá por {business.address.street}, {business.address.locality}.
      </p>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: buildGraph([breadcrumbSchema(trail)]) }}
      />
    </div>
  );
}

/** Bloque que deja explícito que el contenido está pendiente de redacción. */
export function LegalPlaceholder({ children }: { children: ReactNode }) {
  return (
    <div className="border-l-2 border-accent bg-surface-muted px-6 py-6">
      <p className="eyebrow text-accent">Pendiente de redacción</p>
      <div className="mt-4 flex flex-col gap-4">{children}</div>
    </div>
  );
}
