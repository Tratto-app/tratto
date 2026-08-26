'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { primaryContact } from '@/data/business';

/**
 * Barra fija de acción en mobile.
 *
 * Aparece recién después del hero para no tapar la primera pantalla, y se
 * esconde cuando el pie está a la vista, así no compite con el CTA del footer.
 */
export function MobileCtaBar() {
  const [visible, setVisible] = useState(false);
  const contact = primaryContact();

  useEffect(() => {
    const onScroll = () => {
      const scrolledPastHero = window.scrollY > window.innerHeight * 0.75;
      const nearBottom =
        window.innerHeight + window.scrollY > document.body.offsetHeight - 320;
      setVisible(scrolledPastHero && !nearBottom);
    };

    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, []);

  return (
    <div
      className={`no-print fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/97 backdrop-blur-[6px] transition-transform duration-500 ease-[var(--ease-editorial)] lg:hidden ${
        visible ? 'translate-y-0' : 'translate-y-full'
      }`}
      // Fuera de pantalla no debe ser alcanzable por teclado ni por lectores.
      aria-hidden={!visible}
      inert={!visible}
    >
      <div
        className="flex gap-3 px-4 py-3"
        style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}
      >
        <Link
          href="/#reservar"
          className="flex flex-1 items-center justify-center bg-surface-deep px-4 py-3.5 text-[0.9375rem] font-medium text-text-inverse"
        >
          Reservar turno
        </Link>
        <a
          href={contact.href}
          target="_blank"
          rel="noopener noreferrer"
          className="flex flex-1 items-center justify-center border border-border-strong px-4 py-3.5 text-[0.9375rem] font-medium"
        >
          {contact.channel === 'whatsapp' ? 'WhatsApp' : 'Instagram'}
        </a>
      </div>
    </div>
  );
}
