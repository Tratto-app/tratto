import { describe, it, expect } from 'vitest';

import {
  hairSalonSchema,
  websiteSchema,
  organizationSchema,
  faqSchema,
  breadcrumbSchema,
  buildGraph,
} from '@/lib/seo/schema';
import { REVIEWS_UNAVAILABLE } from '@/data/reviews';
import { faqs } from '@/data/seo';
import { localPriceList } from '@/data/prices';

describe('JSON-LD', () => {
  it('usa el tipo más específico para una peluquería', () => {
    expect(hairSalonSchema()['@type']).toBe('HairSalon');
  });

  it('no emite claves vacías ni nulas', () => {
    const schema = hairSalonSchema();
    for (const [key, value] of Object.entries(schema)) {
      expect(value, `la clave ${key} no debería ser nula`).not.toBeNull();
      expect(value, `la clave ${key} no debería ser undefined`).not.toBeUndefined();
      if (Array.isArray(value)) expect(value.length, `${key} vacío`).toBeGreaterThan(0);
    }
  });

  it('NO emite aggregateRating cuando no hay reseñas verificadas', () => {
    // Publicar un puntaje sin respaldo es exactamente lo que hay que evitar.
    expect(hairSalonSchema(REVIEWS_UNAVAILABLE).aggregateRating).toBeUndefined();
    expect(hairSalonSchema().aggregateRating).toBeUndefined();
  });

  it('emite aggregateRating sólo con datos reales', () => {
    const schema = hairSalonSchema({
      rating: 4.9,
      total: 132,
      reviews: [],
      source: 'google-places',
    });
    expect(schema.aggregateRating).toMatchObject({ ratingValue: 4.9, reviewCount: 132 });
  });

  it('emite los horarios reales del salón', () => {
    const spec = hairSalonSchema().openingHoursSpecification as {
      dayOfWeek: string[];
      opens: string;
      closes: string;
    }[];

    expect(spec).toHaveLength(2);
    expect(spec[0]?.dayOfWeek).toEqual([
      'https://schema.org/Tuesday',
      'https://schema.org/Wednesday',
      'https://schema.org/Friday',
    ]);
    expect(spec[0]).toMatchObject({ opens: '10:00', closes: '17:30' });
    expect(spec[1]).toMatchObject({ opens: '10:00', closes: '16:00' });

    // Los días cerrados no se declaran: la especificación describe cuándo abre.
    const declared = spec.flatMap((entry) => entry.dayOfWeek).join(' ');
    for (const closed of ['Monday', 'Thursday', 'Sunday']) {
      expect(declared).not.toContain(closed);
    }
  });

  it('no publica catálogo ni rango de precios sin lista cargada', () => {
    const schema = hairSalonSchema();
    expect(schema.hasOfferCatalog).toBeUndefined();
    expect(schema.priceRange).toBeUndefined();
  });

  it('publica una oferta por servicio de la lista de precios', () => {
    const catalog = hairSalonSchema(undefined, localPriceList).hasOfferCatalog as {
      itemListElement: { name: string; itemListElement: unknown[] }[];
    };

    expect(catalog.itemListElement.map((group) => group.name)).toEqual(
      localPriceList.groups.map((group) => group.title),
    );

    const offers = catalog.itemListElement.flatMap((group) => group.itemListElement);
    const expected = localPriceList.groups.reduce((total, g) => total + g.items.length, 0);
    expect(offers).toHaveLength(expected);
  });

  it('cada oferta lleva el rango de precios real del servicio', () => {
    const catalog = hairSalonSchema(undefined, localPriceList).hasOfferCatalog as {
      itemListElement: {
        itemListElement: {
          priceCurrency?: string;
          priceSpecification?: { minPrice: number; maxPrice: number };
          itemOffered: { name: string };
        }[];
      }[];
    };
    const offers = catalog.itemListElement.flatMap((group) => group.itemListElement);

    // El corte vale igual en los cuatro largos: mínimo y máximo coinciden.
    const corte = offers.find((offer) => offer.itemOffered.name === 'Corte');
    expect(corte?.priceCurrency).toBe('ARS');
    expect(corte?.priceSpecification).toMatchObject({ minPrice: 40000, maxPrice: 40000 });

    // El balayage varía según el largo, y el largo sin precio no cuenta.
    const balayage = offers.find((offer) => offer.itemOffered.name === 'Balayage');
    expect(balayage?.priceSpecification).toMatchObject({ minPrice: 200000, maxPrice: 300000 });
  });

  it('el rango de precios del salón sale de la lista real', () => {
    const schema = hairSalonSchema(undefined, localPriceList);
    // El más barato es el lavado ($15.000) y el más caro el balayage extra
    // largo ($300.000).
    expect(schema.priceRange).toBe('$15.000 - $300.000');
  });

  it('el FAQPage refleja las preguntas reales de la página', () => {
    const schema = faqSchema() as { mainEntity: { name: string }[] };
    expect(schema.mainEntity).toHaveLength(faqs.length);
    expect(schema.mainEntity[0]?.name).toBe(faqs[0]?.question);
  });

  it('arma un grafo válido y parseable', () => {
    const graph = JSON.parse(
      buildGraph([hairSalonSchema(), organizationSchema(), websiteSchema()]),
    );
    expect(graph['@context']).toBe('https://schema.org');
    expect(graph['@graph']).toHaveLength(3);
  });

  it('numera las migas de pan desde 1', () => {
    const schema = breadcrumbSchema([
      { name: 'Inicio', path: '/' },
      { name: 'Servicios', path: '/servicios' },
    ]) as { itemListElement: { position: number; item: string }[] };
    expect(schema.itemListElement[0]?.position).toBe(1);
    expect(schema.itemListElement[1]?.item).toContain('/servicios');
  });
});
