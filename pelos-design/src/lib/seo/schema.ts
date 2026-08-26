/**
 * JSON-LD del sitio.
 *
 * Regla: un campo que no tenemos verificado no se emite. Es preferible un
 * schema más corto y correcto que uno completo con datos inventados —
 * los datos falsos en structured data son motivo de penalización.
 */
import { business, formattedAddress, openingHours } from '@/data/business';
import {
  formatArs,
  itemPriceRange,
  listPriceRange,
  type PriceList,
} from '@/data/prices';
import { faqs, siteUrl, defaultMetadata } from '@/data/seo';
import type { ReviewsSummary } from '@/data/reviews';

type Json = Record<string, unknown>;

/** Quita claves nulas, indefinidas y arrays vacíos, en profundidad. */
function prune<T extends Json>(input: T): T {
  const output: Json = {};
  for (const [key, value] of Object.entries(input)) {
    if (value === null || value === undefined) continue;
    if (Array.isArray(value)) {
      if (value.length === 0) continue;
      output[key] = value;
      continue;
    }
    if (typeof value === 'object') {
      const nested = prune(value as Json);
      if (Object.keys(nested).length === 0) continue;
      output[key] = nested;
      continue;
    }
    output[key] = value;
  }
  return output as T;
}

const HAIR_SALON_ID = `${siteUrl}/#salon`;
const WEBSITE_ID = `${siteUrl}/#website`;

const postalAddress = {
  '@type': 'PostalAddress',
  streetAddress: business.address.street,
  addressLocality: business.address.locality,
  addressRegion: business.address.region,
  postalCode: business.address.postalCode,
  addressCountry: business.address.country,
};

/**
 * HairSalon es el tipo más específico de LocalBusiness para una peluquería,
 * así que se usa ese en lugar del genérico.
 */
export function hairSalonSchema(reviews?: ReviewsSummary, priceList?: PriceList): Json {
  const hasRealRating =
    reviews && reviews.rating !== null && reviews.total !== null && reviews.total > 0;

  // El rango de precios sale de la lista real del salón. Sin lista, no se
  // emite: un priceRange inventado es tan malo como un puntaje inventado.
  const range = priceList ? listPriceRange(priceList) : null;

  return prune({
    '@type': 'HairSalon',
    '@id': HAIR_SALON_ID,
    name: business.name,
    legalName: business.legalName,
    description: defaultMetadata.description,
    url: siteUrl,
    image: `${siteUrl}/og.jpg`,
    logo: `${siteUrl}/icon.svg`,
    telephone: business.phone,
    priceRange: range ? `${formatArs(range.min)} - ${formatArs(range.max)}` : business.priceRange,
    address: postalAddress,
    geo: business.geo
      ? {
          '@type': 'GeoCoordinates',
          latitude: business.geo.latitude,
          longitude: business.geo.longitude,
        }
      : null,
    hasMap: business.links.googleMaps,
    // Sólo se emite si el salón confirmó horarios reales.
    openingHoursSpecification: openingHours.map((slot) => ({
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: slot.days.map((d) => `https://schema.org/${d}`),
      opens: slot.opens,
      closes: slot.closes,
    })),
    areaServed: business.areaServed.map((name) => ({ '@type': 'Place', name })),
    sameAs: [business.links.instagram, business.links.googleMaps],
    currenciesAccepted: 'ARS',
    // El agregado de puntaje sólo aparece con datos reales de Google.
    aggregateRating: hasRealRating
      ? {
          '@type': 'AggregateRating',
          ratingValue: reviews.rating,
          reviewCount: reviews.total,
          bestRating: 5,
          worstRating: 1,
        }
      : null,
    // El catálogo se arma desde la lista de precios, no desde el listado de
    // servicios: así cada oferta publicada tiene un importe real detrás.
    hasOfferCatalog: priceList ? offerCatalog(priceList) : null,
  });
}

/**
 * Catálogo de servicios con precios reales.
 *
 * Cada servicio se emite con el rango que cubre los cuatro largos de cabello,
 * porque el precio depende genuinamente del largo. Un servicio sin importe
 * cargado se publica sin precio en lugar de estimarlo.
 */
function offerCatalog(priceList: PriceList): Json {
  return {
    '@type': 'OfferCatalog',
    name: 'Servicios de peluquería',
    itemListElement: priceList.groups.map((group) => ({
      '@type': 'OfferCatalog',
      name: group.title,
      itemListElement: group.items.map((item) => {
        const range = itemPriceRange(item);
        return prune({
          '@type': 'Offer',
          priceCurrency: range ? 'ARS' : null,
          priceSpecification: range
            ? {
                '@type': 'PriceSpecification',
                priceCurrency: 'ARS',
                minPrice: range.min,
                maxPrice: range.max,
                valueAddedTaxIncluded: true,
              }
            : null,
          availability: 'https://schema.org/InStock',
          itemOffered: {
            '@type': 'Service',
            name: item.name,
            serviceType: `${group.title} — ${item.name}`,
            provider: { '@id': HAIR_SALON_ID },
            areaServed: { '@type': 'Place', name: business.address.locality },
          },
        });
      }),
    })),
  };
}

export function websiteSchema(): Json {
  return {
    '@type': 'WebSite',
    '@id': WEBSITE_ID,
    url: siteUrl,
    name: business.name,
    inLanguage: 'es-AR',
    publisher: { '@id': HAIR_SALON_ID },
  };
}

export function organizationSchema(): Json {
  return prune({
    '@type': 'Organization',
    '@id': `${siteUrl}/#organization`,
    name: business.name,
    url: siteUrl,
    logo: `${siteUrl}/icon.svg`,
    telephone: business.phone,
    address: postalAddress,
    sameAs: [business.links.instagram, business.links.googleMaps],
  });
}

export function faqSchema(): Json {
  return {
    '@type': 'FAQPage',
    '@id': `${siteUrl}/#faq`,
    mainEntity: faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: { '@type': 'Answer', text: faq.answer },
    })),
  };
}

export function breadcrumbSchema(
  trail: { name: string; path: string }[],
): Json {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: trail.map((crumb, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: crumb.name,
      item: `${siteUrl}${crumb.path}`,
    })),
  };
}

/** Arma un único grafo, que es lo que Google prefiere leer. */
export function buildGraph(nodes: Json[]): string {
  return JSON.stringify({ '@context': 'https://schema.org', '@graph': nodes });
}

export { formattedAddress };
