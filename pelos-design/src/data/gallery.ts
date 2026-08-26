/**
 * Galería y transformaciones.
 *
 * Las fotos son del salón (las envió el propio negocio). Los `alt` describen
 * lo que se ve, sin inventar el servicio exacto que se aplicó.
 *
 * El import estático de cada imagen le da a next/image el ancho y alto reales,
 * así que reserva el espacio antes de cargar y no hay salto de layout (CLS).
 */
import type { StaticImageData } from 'next/image';

import cobreRulos from '@/assets/images/cobre-rulos.jpg';
import tallerColor from '@/assets/images/taller-color.jpg';
import salonInterior from '@/assets/images/salon-interior.jpg';
import ondasCastanas from '@/assets/images/ondas-castanas.jpg';
import lisoCaramelo from '@/assets/images/liso-caramelo.jpg';
import transformacionAntes from '@/assets/images/transformacion-antes.jpg';
import transformacionDespues from '@/assets/images/transformacion-despues.jpg';

export interface GalleryItem {
  id: string;
  image: StaticImageData;
  alt: string;
  /** Rótulo corto que aparece al pasar el cursor y en el lightbox. */
  caption: string;
  /** Peso editorial en la grilla: las destacadas ocupan más lugar. */
  emphasis: 'feature' | 'standard';
}

export const heroImage = {
  image: cobreRulos,
  alt: 'Nuca de una clienta con el pelo teñido en cobre intenso, peinado en rulos definidos.',
};

export const galleryItems: GalleryItem[] = [
  {
    id: 'cobre-rulos',
    image: cobreRulos,
    alt: 'Nuca de una clienta con el pelo teñido en cobre intenso, peinado en rulos definidos.',
    caption: 'Cobre intenso con rulo marcado',
    emphasis: 'feature',
  },
  {
    id: 'taller-color',
    image: tallerColor,
    alt: 'Colorista aplicando color con pincel sobre papel de aluminio en la cabeza de una clienta.',
    caption: 'Aplicación papel por papel',
    emphasis: 'standard',
  },
  {
    id: 'ondas-castanas',
    image: ondasCastanas,
    alt: 'Nuca de una clienta con media melena castaña con reflejos cálidos y ondas sueltas.',
    caption: 'Castaño cálido con movimiento',
    emphasis: 'standard',
  },
  {
    id: 'liso-caramelo',
    image: lisoCaramelo,
    alt: 'Melena larga y lisa en tonos caramelo y rubio oscuro, vista desde atrás sobre una capa naranja.',
    caption: 'Caramelo, largo y liso',
    emphasis: 'feature',
  },
  {
    id: 'salon-interior',
    image: salonInterior,
    alt: 'Interior del salón: espejos con marco de madera y dos pinturas abstractas de gran formato sobre la pared.',
    caption: 'El salón, en Yerbal 880',
    emphasis: 'standard',
  },
];

export const transformation = {
  before: {
    image: transformacionAntes,
    alt: 'Antes: melena oscura con mucho frizz y ondas sin definir.',
    label: 'Antes',
  },
  after: {
    image: transformacionDespues,
    alt: 'Después: la misma melena en castaño cálido, sellada, con brillo y puntas trabajadas.',
    label: 'Después',
  },
  caption: 'Control de frizz y color castaño cálido, en una sola visita.',
};

/**
 * Grilla de Instagram. Hoy se alimenta de las mismas fotos que mandó el salón.
 * Si más adelante se conecta la Instagram Basic Display API, este array pasa a
 * ser el fallback y el componente no cambia.
 */
export const instagramFallbackPosts: GalleryItem[] = galleryItems.slice(0, 4);
