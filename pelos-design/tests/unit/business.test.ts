import { describe, it, expect } from 'vitest';

import { whatsappLink, primaryContact, business, nap, formattedAddress } from '@/data/business';

describe('contacto', () => {
  it('no arma un link de WhatsApp si no hay número configurado', () => {
    // El entorno de test no define NEXT_PUBLIC_WHATSAPP_NUMBER, que es
    // justamente el estado en el que se entrega el sitio.
    if (!business.whatsappNumber) {
      expect(whatsappLink()).toBeNull();
    } else {
      expect(whatsappLink()).toMatch(/^https:\/\/wa\.me\/\d+\?text=/);
    }
  });

  it('siempre ofrece un canal de contacto usable', () => {
    const contact = primaryContact();
    expect(contact.href).toMatch(/^https:\/\//);
    expect(contact.label.length).toBeGreaterThan(0);
    expect(['whatsapp', 'instagram']).toContain(contact.channel);
  });

  it('cae en Instagram cuando no hay WhatsApp', () => {
    if (!business.whatsappNumber) {
      expect(primaryContact().channel).toBe('instagram');
      expect(primaryContact().href).toBe(business.links.instagram);
    }
  });

  it('codifica el mensaje predefinido en el link de WhatsApp', () => {
    const link = whatsappLink('Hola, quería un turno');
    if (link) {
      expect(link).toContain(encodeURIComponent('Hola, quería un turno'));
      // wa.me sólo acepta dígitos.
      expect(link.split('?')[0]).toMatch(/^https:\/\/wa\.me\/\d+$/);
    }
  });
});

describe('datos del negocio', () => {
  it('no publica datos inventados', () => {
    // Estos campos quedan en null a propósito hasta que el salón los confirme.
    expect(business.geo).toBeNull();
    expect(business.priceRange).toBeNull();
  });

  it('mantiene un NAP consistente con la dirección mostrada', () => {
    expect(nap.name).toBe(business.name);
    expect(nap.address).toBe(formattedAddress);
    expect(formattedAddress).toContain(business.address.street);
    expect(formattedAddress).toContain(business.address.locality);
  });

  it('apunta a los enlaces oficiales del salón', () => {
    expect(business.links.instagram).toContain('instagram.com/pelosdesign');
    expect(business.links.googleMaps).toContain('maps.app.goo.gl');
    expect(business.links.directions).toContain('google.com/maps/dir');
  });
});
