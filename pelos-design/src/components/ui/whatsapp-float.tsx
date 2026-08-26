'use client';

import { useSyncExternalStore } from 'react';

import { primaryContact } from '@/data/business';

/**
 * Botón flotante de contacto.
 *
 * Aparece sólo en escritorio: en mobile ya está la barra fija de abajo, y dos
 * accesos permanentes al mismo canal se pisarían.
 *
 * Se muestra recién después del hero para no tapar la primera pantalla. La
 * posición de scroll se lee con `useSyncExternalStore` porque es estado del
 * navegador, no de React.
 */

function subscribe(onStoreChange: () => void): () => void {
  window.addEventListener('scroll', onStoreChange, { passive: true });
  window.addEventListener('resize', onStoreChange, { passive: true });
  return () => {
    window.removeEventListener('scroll', onStoreChange);
    window.removeEventListener('resize', onStoreChange);
  };
}

function getSnapshot(): boolean {
  return window.scrollY > window.innerHeight * 0.7;
}

/** En el servidor no se muestra: evita cualquier desajuste al hidratar. */
function getServerSnapshot(): boolean {
  return false;
}

export function WhatsappFloat() {
  const visible = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const contact = primaryContact();

  const isWhatsapp = contact.channel === 'whatsapp';

  return (
    <a
      href={contact.href}
      target="_blank"
      rel="noopener noreferrer"
      // Fuera de pantalla no debe ser alcanzable por teclado ni por lectores.
      aria-hidden={!visible}
      tabIndex={visible ? 0 : -1}
      className={`no-print fixed right-6 bottom-6 z-40 hidden h-14 w-14 items-center justify-center rounded-full shadow-[0_6px_24px_rgba(36,28,23,0.22)] transition-all duration-500 ease-[var(--ease-editorial)] hover:scale-105 motion-reduce:transition-none motion-reduce:hover:scale-100 lg:flex ${
        isWhatsapp ? 'bg-[#25D366]' : 'bg-surface-deep'
      } ${visible ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-3 opacity-0'}`}
    >
      <span className="sr-only">
        {isWhatsapp ? 'Escribinos por WhatsApp' : 'Escribinos por Instagram'} (se abre en una
        pestaña nueva)
      </span>

      {isWhatsapp ? (
        <svg viewBox="0 0 24 24" aria-hidden="true" className="h-7 w-7 fill-white">
          <path d="M17.47 14.38c-.3-.15-1.75-.86-2.02-.96-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.16-.17.2-.35.22-.64.07-.3-.15-1.25-.46-2.38-1.47-.88-.78-1.47-1.75-1.65-2.05-.17-.3-.02-.46.13-.6.13-.14.3-.35.45-.53.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.6-.92-2.2-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.01-1.04 2.47s1.06 2.86 1.21 3.06c.15.2 2.1 3.2 5.08 4.49.71.3 1.26.49 1.69.63.71.22 1.36.19 1.87.12.57-.09 1.75-.72 2-1.41.25-.69.25-1.28.17-1.41-.07-.13-.27-.2-.57-.35z" />
          <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.46 1.32 4.96L2 22l5.25-1.38a9.9 9.9 0 0 0 4.79 1.22h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.85 9.85 0 0 0 12.04 2zm0 18.15h-.01a8.2 8.2 0 0 1-4.19-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.22 8.22 0 0 1-1.26-4.38c0-4.54 3.7-8.24 8.25-8.24 2.2 0 4.27.86 5.83 2.42a8.19 8.19 0 0 1 2.41 5.83c0 4.54-3.7 8.23-8.24 8.23z" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" aria-hidden="true" className="h-6 w-6 fill-none stroke-[#FAF6F0]" strokeWidth="1.6">
          <rect x="3" y="3" width="18" height="18" rx="5" />
          <circle cx="12" cy="12" r="4" />
          <circle cx="17.2" cy="6.8" r="1.1" className="fill-[#FAF6F0] stroke-none" />
        </svg>
      )}
    </a>
  );
}
