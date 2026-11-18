// Configuración del sitio. Normalmente no hace falta tocar este archivo:
// el contenido se edita en src/data/contenido.yaml
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  // Cuando tengamos el dominio de Donweb, va acá (lo usan Google y el sitemap).
  site: 'https://once-y-seis.vercel.app',
  trailingSlash: 'ignore',
  build: { inlineStylesheets: 'auto' },
  image: {
    // Los tamaños de las fotos los maneja el diseño del sitio.
    responsiveStyles: false,
  },
  vite: {
    plugins: [tailwindcss()],
  },
});
