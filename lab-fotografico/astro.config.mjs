// Configuración del sitio. Normalmente no hace falta tocar este archivo:
// el contenido se edita en src/data/contenido.yaml
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  // Cuando tengamos el dominio de Donweb, va acá (lo usa Google y el sitemap).
  site: 'https://fotografiadigital-lp.vercel.app',
  trailingSlash: 'ignore',
  build: { inlineStylesheets: 'auto' },
  image: {
    // Los estilos de tamaño de las fotos los maneja el diseño del sitio.
    responsiveStyles: false,
  },
  vite: {
    plugins: [tailwindcss()],
  },
});
