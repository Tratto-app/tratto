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
import { allServices } from '@/data/services';

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

  it('no emite horarios mientras no estén confirmados', () => {
    expect(hairSalonSchema().openingHoursSpecification).toBeUndefined();
  });

  it('publica todos los servicios en el catálogo', () => {
    const catalog = hairSalonSchema().hasOfferCatalog as {
      itemListElement: unknown[];
    };
    expect(catalog.itemListElement).toHaveLength(allServices.length);
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
