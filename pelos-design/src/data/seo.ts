/**
 * Configuración de SEO y contenido orientado a respuestas.
 *
 * Las preguntas de `faqs` cumplen doble función: son la sección de Preguntas
 * frecuentes de la home y alimentan el FAQPage del JSON-LD. Están redactadas
 * en formato "respuesta primero" para que un asistente con IA pueda citarlas
 * sin tener que interpretar.
 */
import { business, formattedAddress, openingHours } from './business';
import { serviceCategories } from './services';

export const siteUrl = (
  process.env.NEXT_PUBLIC_SITE_URL ?? 'https://pelosdesign.com.ar'
).replace(/\/$/, '');

export const defaultMetadata = {
  title: "Pelo's Design | Peluquería en Caballito — color y corte",
  description:
    "Peluquería en Caballito, CABA, especializada en color y corte. Coloración, mechas, balayage, tratamientos y peinados en Yerbal 880. Pedí tu turno.",
} as const;

export interface Faq {
  question: string;
  answer: string;
}

/** Horarios en texto plano; null mientras el salón no los confirme. */
function hoursSentence(): string | null {
  if (openingHours.length === 0) return null;
  const dayNames: Record<string, string> = {
    Monday: 'lunes', Tuesday: 'martes', Wednesday: 'miércoles', Thursday: 'jueves',
    Friday: 'viernes', Saturday: 'sábados', Sunday: 'domingos',
  };
  return openingHours
    .map((slot) => `${slot.days.map((d) => dayNames[d] ?? d).join(', ')} de ${slot.opens} a ${slot.closes}`)
    .join('; ');
}

const categoryNames = serviceCategories.map((c) => c.name.toLowerCase()).join(', ');

export const faqs: Faq[] = [
  {
    question: "¿Dónde queda Pelo's Design?",
    answer: `Pelo's Design está en ${formattedAddress}, en el barrio de Caballito. Es un salón de barrio, sobre Yerbal al 880, a pocas cuadras de Avenida Rivadavia.`,
  },
  {
    question: '¿Qué servicios hacen?',
    answer: `Trabajamos ${categoryNames}. Dentro de color hacemos coloración completa y retoque de raíz, mechas con papel, balayage y tonos cobrizos y rojos. En corte, cortes con capas, movimiento y flequillo. También hidratación, reconstrucción, control de frizz, brushing, ondas y rulos.`,
  },
  {
    question: '¿Cómo saco un turno?',
    answer: business.whatsappNumber
      ? `Escribinos por WhatsApp al ${business.phone ?? business.whatsappNumber} y coordinamos día y horario. También podés mandarnos un mensaje por Instagram a ${business.links.instagramHandle}.`
      : `Mandanos un mensaje por Instagram a ${business.links.instagramHandle} y coordinamos día y horario. Contanos qué querés hacerte y cómo tenés el pelo hoy: con eso te decimos cuánto tiempo reservar.`,
  },
  {
    question: '¿Cuánto sale un color o un corte?',
    answer:
      'La lista de precios completa está publicada en la web como documento descargable, en la sección Precios. La actualizamos ahí para que siempre veas la vigente. Si tu pelo necesita más de un paso, te lo decimos antes de empezar.',
  },
  {
    question: '¿Qué horarios tienen?',
    answer:
      hoursSentence() ??
      `Consultanos los horarios y la disponibilidad por Instagram (${business.links.instagramHandle}) antes de venir: trabajamos con turno.`,
  },
  {
    question: '¿Atienden sin turno?',
    answer:
      'Trabajamos con turno para poder dedicarle a cada clienta el tiempo que necesita, sobre todo en los servicios de color. Escribinos antes de venir y coordinamos.',
  },
  {
    question: '¿Hacen balayage y mechas en el mismo día que el corte?',
    answer:
      'Sí. Lo habitual es hacer primero el color y terminar con el corte y el peinado, así el corte se define sobre el color ya terminado. Avisanos al reservar para calcular el tiempo.',
  },
  {
    question: '¿Cómo llego en transporte público?',
    answer: `El salón está en ${business.address.street}, Caballito. Podés ver la ubicación exacta y armar el recorrido desde la ficha de Google Maps enlazada en la sección Encontranos.`,
  },
];

/** Palabras clave de intención local, sin repetirlas de más en el copy. */
export const localKeywords = [
  'peluquería en Caballito',
  'peluquería femenina en Caballito',
  'coloración en Caballito',
  'balayage en Caballito',
  'corte de pelo en Caballito',
  'mechas en Caballito',
  'peluquería en Yerbal',
] as const;
