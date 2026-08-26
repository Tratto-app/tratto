/**
 * FUENTE ÚNICA DE VERDAD del negocio.
 * Ningún componente debe hardcodear estos datos.
 *
 * REGLA: si un dato no está verificado, va en `null` y la interfaz degrada
 * con elegancia. Nunca se inventan teléfonos, horarios, precios ni reseñas.
 */

export type DayOfWeek =
  | 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday'
  | 'Friday' | 'Saturday' | 'Sunday';

export interface OpeningHours {
  /** Días a los que aplica el tramo, en formato schema.org. */
  days: DayOfWeek[];
  /** "HH:MM" en 24 h. */
  opens: string;
  closes: string;
}

/** Lee una variable de entorno pública y devuelve null si está vacía. */
function env(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/**
 * Teléfono confirmado por el salón.
 *
 * Se deja como valor por defecto en código —y no sólo en el entorno— para que
 * el sitio funcione igual en cualquier deploy. La variable de entorno sigue
 * teniendo prioridad, así que cambiarlo no requiere tocar el código.
 */
const WHATSAPP_FALLBACK = '5491167941212';
const PHONE_FALLBACK = '+54 9 11 6794-1212';

/** Número en formato E.164 sin símbolos, tal como lo pide wa.me. */
const whatsappNumber = env(process.env.NEXT_PUBLIC_WHATSAPP_NUMBER) ?? WHATSAPP_FALLBACK;

/** Teléfono para mostrar y para `tel:` / schema.org. */
const phone = env(process.env.NEXT_PUBLIC_PHONE) ?? PHONE_FALLBACK;

/**
 * Horarios de atención, tomados de la ficha de Google del salón.
 *
 * Jueves, domingo y lunes el salón no abre. Los días que no figuran acá se
 * muestran como "Cerrado" y no se emiten en el JSON-LD, que es lo correcto:
 * `openingHoursSpecification` describe cuándo está abierto.
 */
export const openingHours: OpeningHours[] = [
  { days: ['Tuesday', 'Wednesday', 'Friday'], opens: '10:00', closes: '17:30' },
  { days: ['Saturday'], opens: '10:00', closes: '16:00' },
];

/** Los siete días en el orden en que se muestran. */
export const WEEK: DayOfWeek[] = [
  'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday',
];

export const DAY_LABELS: Record<DayOfWeek, string> = {
  Monday: 'Lunes',
  Tuesday: 'Martes',
  Wednesday: 'Miércoles',
  Thursday: 'Jueves',
  Friday: 'Viernes',
  Saturday: 'Sábado',
  Sunday: 'Domingo',
};

/** Tramo de atención de un día, o null si ese día está cerrado. */
export function hoursForDay(day: DayOfWeek): OpeningHours | null {
  return openingHours.find((slot) => slot.days.includes(day)) ?? null;
}

/** La semana completa, lista para renderizar. */
export function weekSchedule(): { day: DayOfWeek; label: string; slot: OpeningHours | null }[] {
  return WEEK.map((day) => ({ day, label: DAY_LABELS[day], slot: hoursForDay(day) }));
}

export const business = {
  name: "Pelo's Design",
  /** Nombre legal / alternativo si difiere. */
  legalName: null as string | null,
  tagline: 'Color y corte en Caballito',

  /** Dirección verificada contra la ficha de Google y directorios locales. */
  address: {
    street: 'Yerbal 880',
    locality: 'Caballito',
    city: 'Ciudad Autónoma de Buenos Aires',
    region: 'CABA',
    postalCode: 'C1405',
    country: 'AR',
    countryName: 'Argentina',
  },

  /**
   * Coordenadas: NO verificadas con precisión. Se dejan en null para no
   * emitir un `geo` incorrecto en el JSON-LD. El mapa embebido usa la
   * dirección por texto, que no depende de esto.
   */
  geo: null as { latitude: number; longitude: number } | null,

  phone,
  whatsappNumber,

  /** Barrios donde el salón capta clientas, para `areaServed`. */
  areaServed: ['Caballito', 'Flores', 'Almagro', 'Villa Crespo', 'Boedo', 'Parque Chacabuco'],

  /**
   * Rango de precios en notación schema.org ($ a $$$$).
   * null hasta que el salón confirme su lista real.
   */
  priceRange: null as string | null,

  links: {
    instagram: 'https://www.instagram.com/pelosdesign/',
    instagramHandle: '@pelosdesign',
    /** Link corto oficial de la ficha de Google que compartió el salón. */
    googleMaps: 'https://maps.app.goo.gl/bU6EvPzkiTfMdYFy8',
    /** Ruta a pie / en auto hacia el salón. */
    directions:
      'https://www.google.com/maps/dir/?api=1&destination=' +
      encodeURIComponent("Pelo's Design, Yerbal 880, Caballito, Ciudad Autónoma de Buenos Aires"),
  },
} as const;

/** Dirección en una línea — se usa igual en la web, el schema y el footer. */
export const formattedAddress = `${business.address.street}, ${business.address.locality}, ${business.address.city}`;

/** NAP consistente: el mismo string en todos lados. */
export const nap = {
  name: business.name,
  address: formattedAddress,
  phone: business.phone,
} as const;

/**
 * Arma el link de WhatsApp con mensaje predefinido.
 * Devuelve null si el número no está configurado, para que la interfaz
 * pueda ofrecer Instagram como alternativa en lugar de un link roto.
 */
export function whatsappLink(
  message = 'Hola Pelo’s Design, quería consultar por un turno.',
): string | null {
  if (!business.whatsappNumber) return null;
  const digits = business.whatsappNumber.replace(/\D/g, '');
  if (!digits) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

/**
 * Canal de contacto principal. Si no hay WhatsApp configurado, cae en el
 * Instagram del salón, que sí está verificado. La página nunca queda sin CTA.
 */
export function primaryContact(message?: string): {
  href: string;
  label: string;
  channel: 'whatsapp' | 'instagram';
} {
  const wa = whatsappLink(message);
  if (wa) return { href: wa, label: 'Consultar por WhatsApp', channel: 'whatsapp' };
  return {
    href: business.links.instagram,
    label: 'Escribinos por Instagram',
    channel: 'instagram',
  };
}
