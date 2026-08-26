'use client';

import { useEffect, useRef, useState, type ElementType, type ReactNode } from 'react';

/**
 * Aparición suave al entrar en pantalla.
 *
 * Usa IntersectionObserver, no scroll listeners, así que no cuesta nada en el
 * hilo principal. El contenido ya está en el HTML: si el JS no corre, el
 * observer nunca dispara y el CSS de `prefers-reduced-motion` deja todo
 * visible. Para el resto, un fallback marca todo como visible al montar si el
 * navegador no soporta la API.
 */
interface RevealProps {
  children: ReactNode;
  as?: ElementType;
  className?: string;
  /** Escalona elementos hermanos, en milisegundos. */
  delay?: number;
}

export function Reveal({ children, as: Tag = 'div', className = '', delay = 0 }: RevealProps) {
  const ref = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    if (typeof IntersectionObserver === 'undefined') {
      // Sin soporte del observer se marca el nodo directamente. Es una
      // escritura al DOM —sincronizar con un sistema externo, que es para lo
      // que sirve un efecto— y no un setState en cascada.
      node.dataset.visible = 'true';
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setVisible(true);
            observer.disconnect();
          }
        }
      },
      { rootMargin: '0px 0px -12% 0px', threshold: 0.05 },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <Tag
      ref={ref}
      className={`reveal ${className}`}
      data-visible={visible ? 'true' : 'false'}
      style={delay ? ({ '--reveal-delay': `${delay}ms` } as React.CSSProperties) : undefined}
    >
      {children}
    </Tag>
  );
}
