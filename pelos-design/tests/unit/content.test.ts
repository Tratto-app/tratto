import { describe, it, expect } from 'vitest';
import sharp from 'sharp';
import path from 'node:path';

import { serviceCategories, allServices } from '@/data/services';
import { faqs, localKeywords } from '@/data/seo';
import { galleryItems, transformation, heroImage } from '@/data/gallery';
import { manualReviews, hasReviewContent, REVIEWS_UNAVAILABLE } from '@/data/reviews';

const IMAGE_DIR = path.join(process.cwd(), 'src/assets/images');
const MASTERS = [
  'cobre-rulos.jpg',
  'taller-color.jpg',
  'salon-interior.jpg',
  'ondas-castanas.jpg',
  'liso-caramelo.jpg',
  'transformacion-antes.jpg',
  'transformacion-despues.jpg',
];

describe('servicios', () => {
  it('cada servicio declara de dónde salió', () => {
    for (const service of allServices) {
      expect(service.evidence.length, `${service.name} sin evidencia`).toBeGreaterThan(10);
    }
  });

  it('no hay slugs duplicados', () => {
    const slugs = allServices.map((s) => s.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('cubre las categorías pedidas por el negocio', () => {
    const names = serviceCategories.map((c) => c.slug);
    expect(names).toEqual(
      expect.arrayContaining(['color', 'corte', 'tratamientos', 'peinados']),
    );
  });

  it('ningún servicio publica precios en el código', () => {
    // Los importes viven sólo en el PDF oficial.
    for (const service of allServices) {
      const text = `${service.summary} ${service.detail}`;
      expect(text, `${service.name} menciona un importe`).not.toMatch(/\$\s?\d/);
    }
  });
});

describe('reseñas', () => {
  it('el respaldo manual no trae reseñas ni puntajes inventados', () => {
    expect(manualReviews.rating).toBeNull();
    expect(manualReviews.total).toBeNull();
    expect(manualReviews.reviews).toHaveLength(0);
  });

  it('detecta correctamente cuándo no hay contenido para mostrar', () => {
    expect(hasReviewContent(REVIEWS_UNAVAILABLE)).toBe(false);
    expect(hasReviewContent({ ...REVIEWS_UNAVAILABLE, rating: 4.8 })).toBe(true);
  });
});

describe('galería', () => {
  it('toda imagen tiene alt descriptivo', () => {
    for (const item of [...galleryItems, transformation.before, transformation.after]) {
      expect(item.alt.length, 'alt demasiado corto').toBeGreaterThan(20);
    }
    expect(heroImage.alt.length).toBeGreaterThan(20);
  });

  // Vitest no procesa los imports de imágenes como lo hace Next, así que las
  // dimensiones se verifican sobre los archivos reales del disco. Además de
  // sortear la limitación, esto valida el resultado del script de recorte.
  it('los masters existen y tienen dimensiones reales', async () => {
    for (const name of MASTERS) {
      const meta = await sharp(path.join(IMAGE_DIR, name)).metadata();
      expect(meta.width, `${name} sin ancho`).toBeGreaterThan(0);
      expect(meta.height, `${name} sin alto`).toBeGreaterThan(0);
    }
  });

  it('el antes y el después comparten proporción exacta', async () => {
    const before = await sharp(path.join(IMAGE_DIR, 'transformacion-antes.jpg')).metadata();
    const after = await sharp(path.join(IMAGE_DIR, 'transformacion-despues.jpg')).metadata();
    expect(before.width! / before.height!).toBeCloseTo(after.width! / after.height!, 3);
  });

  it('el screenshot de Instagram quedó recortado sin el chrome del teléfono', async () => {
    // El original medía 1179x2556 (captura de iPhone). Si el recorte falló,
    // la relación de aspecto seguiría siendo la de una pantalla completa.
    const meta = await sharp(path.join(IMAGE_DIR, 'cobre-rulos.jpg')).metadata();
    const ratio = meta.width! / meta.height!;
    expect(ratio).toBeGreaterThan(0.6);
    expect(ratio).toBeLessThan(1);
  });
});

describe('contenido para buscadores', () => {
  it('las preguntas frecuentes responden las dudas reales', () => {
    const questions = faqs.map((f) => f.question.toLowerCase()).join(' ');
    for (const topic of ['dónde', 'servicios', 'turno', 'sale', 'horarios']) {
      expect(questions, `falta cubrir "${topic}"`).toContain(topic);
    }
  });

  it('cada respuesta es autosuficiente', () => {
    for (const faq of faqs) {
      expect(faq.answer.length, `respuesta corta: ${faq.question}`).toBeGreaterThan(60);
    }
  });

  it('cada keyword lleva intención local', () => {
    // Vale el barrio o la calle: las dos anclan la búsqueda a la zona.
    for (const keyword of localKeywords) {
      expect(keyword.toLowerCase(), `sin ancla local: ${keyword}`).toMatch(
        /caballito|yerbal/,
      );
    }
  });

  it('al menos la mitad de las keywords nombran el barrio', () => {
    const withNeighbourhood = localKeywords.filter((k) =>
      k.toLowerCase().includes('caballito'),
    );
    expect(withNeighbourhood.length).toBeGreaterThanOrEqual(localKeywords.length / 2);
  });
});
