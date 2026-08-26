'use client';

import { useSyncExternalStore } from 'react';

import { WEEK, DAY_LABELS, hoursForDay, type DayOfWeek } from '@/data/business';

/**
 * Indicador de "abierto ahora".
 *
 * Se calcula en el navegador y no en el servidor: la página es estática, así
 * que un estado renderizado en el build quedaría congelado y mentiría.
 *
 * Se lee con `useSyncExternalStore` porque el reloj es, literalmente, un
 * sistema externo: React se suscribe, obtiene null durante la hidratación
 * —lo que evita cualquier desajuste con el HTML del servidor— y recién
 * después pinta el estado real.
 *
 * La hora se resuelve siempre en el huso de Buenos Aires, no en el del
 * visitante: lo que importa es si el salón está abierto, no qué hora es donde
 * está mirando la clienta.
 */

const TIME_ZONE = 'America/Argentina/Buenos_Aires';

/** Día y minutos transcurridos del día, en hora de Buenos Aires. */
function nowInBuenosAires(): { day: DayOfWeek; minutes: number } | null {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: TIME_ZONE,
      weekday: 'long',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(new Date());

    const weekday = parts.find((part) => part.type === 'weekday')?.value as DayOfWeek | undefined;
    const hour = Number(parts.find((part) => part.type === 'hour')?.value);
    const minute = Number(parts.find((part) => part.type === 'minute')?.value);

    if (!weekday || Number.isNaN(hour) || Number.isNaN(minute)) return null;
    // Intl puede devolver 24 en lugar de 0 para la medianoche.
    return { day: weekday, minutes: (hour % 24) * 60 + minute };
  } catch {
    return null;
  }
}

function toMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return (hours ?? 0) * 60 + (minutes ?? 0);
}

/** Próximo día con atención a partir de `from`, mirando toda la semana. */
function nextOpening(from: DayOfWeek): { label: string; opens: string } | null {
  const start = WEEK.indexOf(from);
  for (let step = 1; step <= 7; step++) {
    const day = WEEK[(start + step) % 7];
    if (!day) continue;
    const slot = hoursForDay(day);
    if (slot) {
      return {
        label: step === 1 ? 'mañana' : DAY_LABELS[day].toLowerCase(),
        opens: slot.opens,
      };
    }
  }
  return null;
}

type Status =
  | { state: 'open'; closes: string }
  | { state: 'closed'; next: { label: string; opens: string } | null }
  | null;

function computeStatus(): Status {
  const now = nowInBuenosAires();
  if (!now) return null;

  const slot = hoursForDay(now.day);
  if (slot) {
    const opens = toMinutes(slot.opens);
    const closes = toMinutes(slot.closes);
    if (now.minutes >= opens && now.minutes < closes) {
      return { state: 'open', closes: slot.closes };
    }
    // Antes de abrir, el próximo turno es hoy mismo.
    if (now.minutes < opens) {
      return { state: 'closed', next: { label: 'hoy', opens: slot.opens } };
    }
  }

  return { state: 'closed', next: nextOpening(now.day) };
}

/**
 * El valor se memoiza por su contenido: `getSnapshot` se llama en cada render
 * y tiene que devolver la misma referencia mientras el estado no cambie, o
 * React entra en un bucle de renders.
 */
let cachedStatus: Status = null;
let cachedKey = '__inicial__';

function getSnapshot(): Status {
  const status = computeStatus();
  const key = JSON.stringify(status);
  if (key !== cachedKey) {
    cachedKey = key;
    cachedStatus = status;
  }
  return cachedStatus;
}

/** En el servidor no hay estado que mostrar: se pinta recién en el cliente. */
function getServerSnapshot(): Status {
  return null;
}

/** Se revisa cada minuto, por si la clienta deja la pestaña abierta. */
function subscribe(onStoreChange: () => void): () => void {
  const timer = setInterval(onStoreChange, 60_000);
  return () => clearInterval(timer);
}

export function OpenNow({ className = '' }: { className?: string }) {
  const status = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  if (!status) return null;

  return (
    <p className={`flex items-center gap-2 text-[0.9375rem] ${className}`} aria-live="polite">
      <span
        aria-hidden="true"
        className={`inline-block h-1.5 w-1.5 rounded-full ${
          status.state === 'open' ? 'bg-success' : 'bg-border-strong'
        }`}
      />
      {status.state === 'open' ? (
        <span>
          <span className="font-medium text-success">Abierto ahora</span>
          <span className="text-text-secondary"> · cierra a las {status.closes}</span>
        </span>
      ) : (
        <span className="text-text-secondary">
          <span className="font-medium text-text-primary">Cerrado</span>
          {status.next && ` · abre ${status.next.label} a las ${status.next.opens}`}
        </span>
      )}
    </p>
  );
}
