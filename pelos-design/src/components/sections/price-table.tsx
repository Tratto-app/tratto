'use client';

import { useId, useRef, useState } from 'react';

import type { PriceList } from '@/data/prices';

/**
 * Lista de precios por largo de cabello.
 *
 * Replica la lógica de la lista impresa del salón: primero elegís el largo de
 * tu cabello y después ves los precios de ese largo. Es la forma en que el
 * salón realmente cotiza, así que conviene respetarla.
 *
 * El selector es un tablist con el patrón ARIA completo: flechas para moverse,
 * Inicio y Fin para ir a los extremos. Los cuatro paneles están siempre en el
 * HTML —los no elegidos con el atributo `hidden`— así que los buscadores ven
 * la lista completa aunque en pantalla se muestre uno solo.
 */
export function PriceTable({ list }: { list: PriceList }) {
  const [active, setActive] = useState(0);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const baseId = useId();

  function focusTab(index: number) {
    const next = (index + list.tiers.length) % list.tiers.length;
    setActive(next);
    tabRefs.current[next]?.focus();
  }

  function onKeyDown(event: React.KeyboardEvent, index: number) {
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      focusTab(index + 1);
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      focusTab(index - 1);
    } else if (event.key === 'Home') {
      event.preventDefault();
      focusTab(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      focusTab(list.tiers.length - 1);
    }
  }

  return (
    <div className="mt-12 lg:mt-16">
      {/* Selector de largo */}
      <div className="flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-baseline sm:justify-between">
        <p id={`${baseId}-label`} className="text-[length:var(--text-lead)]">
          ¿Cómo tenés el pelo?
        </p>

        <div
          role="tablist"
          aria-labelledby={`${baseId}-label`}
          className="-mx-1 flex flex-wrap gap-1"
        >
          {list.tiers.map((tier, index) => {
            const selected = index === active;
            return (
              <button
                key={tier}
                ref={(node) => {
                  tabRefs.current[index] = node;
                }}
                type="button"
                role="tab"
                id={`${baseId}-tab-${index}`}
                aria-selected={selected}
                aria-controls={`${baseId}-panel-${index}`}
                tabIndex={selected ? 0 : -1}
                onClick={() => setActive(index)}
                onKeyDown={(event) => onKeyDown(event, index)}
                className={`px-4 py-2.5 text-[0.9375rem] transition-colors duration-300 ease-[var(--ease-editorial)] ${
                  selected
                    ? 'bg-surface-deep text-text-inverse'
                    : 'text-text-secondary hover:bg-surface hover:text-text-primary'
                }`}
              >
                {tier}
              </button>
            );
          })}
        </div>
      </div>

      {/* Un panel por largo. Los ocultos siguen en el HTML. */}
      {list.tiers.map((tier, tierIndex) => (
        <div
          key={tier}
          role="tabpanel"
          id={`${baseId}-panel-${tierIndex}`}
          aria-labelledby={`${baseId}-tab-${tierIndex}`}
          hidden={tierIndex !== active}
          tabIndex={0}
        >
          <p className="sr-only">Precios para cabello {tier.toLowerCase()}.</p>

          <div className="grid gap-x-[clamp(2rem,5vw,4.5rem)] gap-y-10 pt-8 lg:grid-cols-2">
            {/* Columna izquierda: los grupos que no son color */}
            <div className="flex flex-col gap-10">
              {list.groups.slice(0, -1).map((group) => (
                <PriceGroupBlock key={group.title} group={group} tierIndex={tierIndex} />
              ))}
            </div>

            {/* Columna derecha: color, que es la más larga */}
            <div>
              {list.groups.slice(-1).map((group) => (
                <PriceGroupBlock key={group.title} group={group} tierIndex={tierIndex} />
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function PriceGroupBlock({
  group,
  tierIndex,
}: {
  group: PriceList['groups'][number];
  tierIndex: number;
}) {
  return (
    <section aria-label={group.title}>
      <h3 className="text-[length:var(--text-h3)]">{group.title}</h3>

      <dl className="mt-4">
        {group.items.map((item) => {
          const price = item.prices[tierIndex] ?? null;
          return (
            <div
              key={item.name}
              className="flex flex-wrap items-baseline gap-x-3 border-b border-border py-3 last:border-b-0"
            >
              <dt className="shrink-0">{item.name}</dt>

              {/* Guía de puntos: une el servicio con el importe. */}
              <span
                aria-hidden="true"
                className="min-w-6 flex-1 translate-y-[-0.3em] border-b border-dotted border-border-strong/50"
              />

              <dd
                className={`shrink-0 tabular-nums ${
                  price ? 'font-medium' : 'text-[0.9375rem] text-text-secondary italic'
                }`}
              >
                {price ?? 'Consultar'}
              </dd>

              {item.note && (
                <dd className="w-full pt-1 text-[0.8125rem] text-text-secondary">{item.note}</dd>
              )}
            </div>
          );
        })}
      </dl>
    </section>
  );
}
