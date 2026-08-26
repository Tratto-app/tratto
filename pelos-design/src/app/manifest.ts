import type { MetadataRoute } from 'next';

import { business } from '@/data/business';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${business.name} — Peluquería en Caballito`,
    short_name: business.name,
    description:
      'Peluquería en Caballito, CABA, especializada en color y corte.',
    start_url: '/',
    display: 'standalone',
    background_color: '#fef8f3',
    theme_color: '#fef8f3',
    lang: 'es-AR',
    icons: [
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
      { src: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  };
}
