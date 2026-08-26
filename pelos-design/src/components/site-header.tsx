'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';

import { primaryNav } from '@/data/navigation';
import { business } from '@/data/business';
import { Wordmark } from '@/components/ui/wordmark';

/**
 * Cabecera del sitio.
 *
 * En desktop es una línea fina que se vuelve sólida al hacer scroll.
 * En mobile abre un panel completo con foco atrapado y cierre con Escape.
 */
export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const headerRef = useRef<HTMLElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const pathname = usePathname();

  // Cerrar el menú al cambiar de ruta. Se ajusta durante el render comparando
  // con la ruta anterior, en lugar de un efecto que dispara un segundo render.
  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setOpen(false);
  }

  // El estado de scroll se escribe como atributo en el nodo y se estiliza por
  // CSS. Guardarlo en estado de React obligaría a re-renderizar la cabecera
  // entera cada vez que se cruza el umbral, sin ningún beneficio.
  useEffect(() => {
    const header = headerRef.current;
    if (!header) return;

    const onScroll = () => {
      header.dataset.scrolled = window.scrollY > 24 ? 'true' : 'false';
    };

    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (!open) return;

    // Bloquear el scroll de fondo mientras el panel está abierto.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        toggleRef.current?.focus();
        return;
      }

      // Ciclo de foco dentro del panel.
      if (event.key !== 'Tab' || !panelRef.current) return;
      const focusables = panelRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled])',
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (!first || !last) return;

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    panelRef.current?.querySelector<HTMLElement>('a[href]')?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <header
      ref={headerRef}
      data-scrolled="false"
      data-open={open ? 'true' : 'false'}
      className={
        'sticky top-0 z-50 border-b border-transparent bg-transparent ' +
        'transition-colors duration-500 ease-[var(--ease-editorial)] ' +
        'data-[scrolled=true]:border-border data-[scrolled=true]:bg-background/95 ' +
        'data-[scrolled=true]:backdrop-blur-[6px] ' +
        'data-[open=true]:border-border data-[open=true]:bg-background/95 ' +
        'data-[open=true]:backdrop-blur-[6px]'
      }
    >
      <div className="shell flex h-[4.5rem] items-center justify-between gap-6 lg:h-[5.25rem]">
        <Link href="/" aria-label={`${business.name} — inicio`} className="shrink-0">
          <Wordmark className="text-[1.35rem] lg:text-[1.5rem]" />
        </Link>

        <nav aria-label="Navegación principal" className="hidden lg:block">
          <ul className="flex items-center gap-8">
            {primaryNav.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="link-underline text-[0.9375rem] text-text-secondary hover:text-text-primary"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex items-center gap-3">
          <Link
            href="/#reservar"
            className="hidden bg-surface-deep px-6 py-3 text-[0.875rem] font-medium text-text-inverse transition-colors duration-300 hover:bg-accent-deep lg:inline-flex"
          >
            Reservar turno
          </Link>

          <button
            ref={toggleRef}
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            aria-controls="menu-movil"
            className="-mr-2 flex h-11 w-11 items-center justify-center lg:hidden"
          >
            <span className="sr-only">{open ? 'Cerrar menú' : 'Abrir menú'}</span>
            <span aria-hidden="true" className="relative block h-[11px] w-[22px]">
              <span
                className={`absolute left-0 block h-px w-full bg-text-primary transition-all duration-300 ease-[var(--ease-editorial)] ${
                  open ? 'top-[5px] rotate-45' : 'top-0'
                }`}
              />
              <span
                className={`absolute left-0 block h-px w-full bg-text-primary transition-all duration-300 ease-[var(--ease-editorial)] ${
                  open ? 'top-[5px] -rotate-45' : 'top-[10px]'
                }`}
              />
            </span>
          </button>
        </div>
      </div>

      {/* Panel móvil */}
      <div
        id="menu-movil"
        ref={panelRef}
        hidden={!open}
        className="border-t border-border bg-background lg:hidden"
      >
        <nav aria-label="Navegación principal móvil" className="shell py-8">
          <ul className="flex flex-col">
            {primaryNav.map((item, index) => (
              <li key={item.href} className="border-b border-border last:border-b-0">
                <Link
                  href={item.href}
                  className="block py-4 font-[family-name:var(--font-display)] text-[1.6rem] tracking-[-0.02em]"
                >
                  <span className="accent-type mr-3 text-[0.9rem] text-accent" aria-hidden="true">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>

          <Link
            href="/#reservar"
            className="mt-8 flex items-center justify-center bg-surface-deep px-6 py-4 font-medium text-text-inverse"
          >
            Reservar turno
          </Link>
        </nav>
      </div>
    </header>
  );
}
