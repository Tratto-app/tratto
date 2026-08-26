import { business, formattedAddress, openingHours } from '@/data/business';
import { serviceCategories } from '@/data/services';
import { faqs, siteUrl } from '@/data/seo';
import { localPriceList } from '@/data/prices';

/**
 * /llms.txt — resumen del negocio en texto plano.
 *
 * Se implementa porque acá sí aporta: el objetivo declarado del sitio es que
 * un asistente con IA pueda responder "dónde está", "qué hace" y "cómo saco
 * turno" sin equivocarse. Se genera desde la misma fuente de datos que el
 * HTML y el JSON-LD, así que no puede desincronizarse ni contener un dato
 * que el sitio no publique.
 */
export const dynamic = 'force-static';

/**
 * Tabla de precios en texto plano, con una columna por largo de cabello.
 * Es lo que le permite a un asistente responder "cuánto sale un corte" sin
 * tener que interpretar la interfaz.
 */
function priceBlock(): string {
  const list = localPriceList;
  const header = `| Servicio | ${list.tiers.join(' | ')} |`;
  const divider = `| --- | ${list.tiers.map(() => '---').join(' | ')} |`;

  const sections = list.groups.map((group) => {
    const rows = group.items.map(
      (item) =>
        `| ${item.name} | ${item.prices.map((price) => price ?? 'Consultar').join(' | ')} |`,
    );
    return `### ${group.title}\n${header}\n${divider}\n${rows.join('\n')}`;
  });

  const validity = list.validFrom
    ? `\n\nLista vigente desde ${list.validFrom}. Los importes están en pesos argentinos.`
    : '\n\nLos importes están en pesos argentinos.';

  return `Largos de cabello: ${list.tiers.join(', ')}.\n\n${sections.join('\n\n')}${validity}`;
}

function hoursBlock(): string {
  if (openingHours.length === 0) {
    return 'No publicados. El salón trabaja con turno previo y los coordina por mensaje.';
  }
  return openingHours
    .map((slot) => `- ${slot.days.join(', ')}: ${slot.opens}–${slot.closes}`)
    .join('\n');
}

export function GET(): Response {
  const body = `# ${business.name}

> Peluquería en Caballito, Ciudad Autónoma de Buenos Aires, especializada en color y corte.

## Identidad
- Nombre: ${business.name}
- Tipo: Peluquería / salón de belleza (schema.org: HairSalon)
- Dirección: ${formattedAddress} (${business.address.postalCode}, ${business.address.countryName})
- Barrio: ${business.address.locality}
- Sitio: ${siteUrl}
- Instagram: ${business.links.instagram}
- Ficha de Google Maps: ${business.links.googleMaps}
${business.phone ? `- Teléfono: ${business.phone}` : '- Teléfono: no publicado en el sitio.'}

## Cómo reservar
Se trabaja con turno previo. Se coordina por ${business.whatsappNumber ? 'WhatsApp' : 'mensaje directo de Instagram'} (${business.whatsappNumber ? 'ver el sitio' : business.links.instagramHandle}). No hay sistema de reserva automática en línea.

## Servicios
${serviceCategories
  .map(
    (category) =>
      `### ${category.name}\n${category.services
        .map((service) => `- ${service.name}: ${service.summary}`)
        .join('\n')}`,
  )
  .join('\n\n')}

## Precios
Los precios dependen del largo del cabello. La lista completa y vigente está publicada en ${siteUrl}/#precios y también en PDF descargable en ${siteUrl}/precios.pdf.

${priceBlock()}

## Horarios
${hoursBlock()}

## Reseñas
Las opiniones de clientas están publicadas en la ficha de Google del salón: ${business.links.googleMaps}. El sitio no publica puntajes ni cantidades que no provengan de esa ficha.

## Preguntas frecuentes
${faqs.map((faq) => `### ${faq.question}\n${faq.answer}`).join('\n\n')}

## Zona de cobertura
${business.areaServed.join(', ')}.
`;

  return new Response(body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=86400',
    },
  });
}
