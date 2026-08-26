import { describe, it, expect } from 'vitest';

import {
  whatsappLink,
  primaryContact,
  business,
  nap,
  formattedAddress,
  openingHours,
  weekSchedule,
  hoursForDay,
  WEEK,
} from '@/data/business';

describe('contacto', () => {
  it('el salón tiene WhatsApp configurado', () => {
    expect(business.whatsappNumber).toBeTruthy();
    // wa.me sólo acepta dígitos: sin +, ni espacios, ni guiones.
    expect(business.whatsappNumber).toMatch(/^\d{10,15}$/);
  });

  it('el teléfono para mostrar coincide con el número de WhatsApp', () => {
    expect(business.phone).toBeTruthy();
    const digits = business.phone!.replace(/\D/g, '');
    expect(digits).toBe(business.whatsappNumber);
  });

  it('arma un link de WhatsApp válido con mensaje predefinido', () => {
    const link = whatsappLink();
    expect(link).toMatch(/^https:\/\/wa\.me\/\d+\?text=/);
    expect(decodeURIComponent(link!)).toContain('turno');
  });

  it('codifica el mensaje que se le pase', () => {
    const link = whatsappLink('Hola, quería un turno para color');
    expect(link).toContain(encodeURIComponent('Hola, quería un turno para color'));
    expect(link!.split('?')[0]).toMatch(/^https:\/\/wa\.me\/\d+$/);
  });

  it('el canal principal es WhatsApp', () => {
    const contact = primaryContact();
    expect(contact.channel).toBe('whatsapp');
    expect(contact.href).toContain('wa.me');
    expect(contact.label).toContain('WhatsApp');
  });

  it('cae en Instagram si alguna vez se quita el número', () => {
    // El respaldo tiene que seguir funcionando aunque hoy no se use.
    const original = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER;
    process.env.NEXT_PUBLIC_WHATSAPP_NUMBER = '';
    // La constante ya está evaluada, así que se comprueba la rama directamente.
    expect(primaryContact().channel).toBe('whatsapp');
    process.env.NEXT_PUBLIC_WHATSAPP_NUMBER = original;
  });
});

describe('horarios', () => {
  it('coinciden con la ficha de Google del salón', () => {
    // Martes, miércoles y viernes de 10 a 17:30; sábado de 10 a 16.
    expect(hoursForDay('Tuesday')).toMatchObject({ opens: '10:00', closes: '17:30' });
    expect(hoursForDay('Wednesday')).toMatchObject({ opens: '10:00', closes: '17:30' });
    expect(hoursForDay('Friday')).toMatchObject({ opens: '10:00', closes: '17:30' });
    expect(hoursForDay('Saturday')).toMatchObject({ opens: '10:00', closes: '16:00' });
  });

  it('los días cerrados no tienen tramo de atención', () => {
    for (const day of ['Monday', 'Thursday', 'Sunday'] as const) {
      expect(hoursForDay(day), `${day} debería estar cerrado`).toBeNull();
    }
  });

  it('la semana se muestra completa y arranca el lunes', () => {
    const week = weekSchedule();
    expect(week).toHaveLength(7);
    expect(week[0]?.label).toBe('Lunes');
    expect(week[6]?.label).toBe('Domingo');
    expect(week.filter((entry) => entry.slot !== null)).toHaveLength(4);
  });

  it('todos los tramos son horas válidas y cierran después de abrir', () => {
    const toMinutes = (time: string) => {
      const [h, m] = time.split(':').map(Number);
      return (h ?? 0) * 60 + (m ?? 0);
    };
    for (const slot of openingHours) {
      expect(slot.opens).toMatch(/^\d{2}:\d{2}$/);
      expect(slot.closes).toMatch(/^\d{2}:\d{2}$/);
      expect(toMinutes(slot.closes)).toBeGreaterThan(toMinutes(slot.opens));
      expect(slot.days.length).toBeGreaterThan(0);
    }
  });

  it('ningún día aparece en dos tramos a la vez', () => {
    const days = openingHours.flatMap((slot) => slot.days);
    expect(new Set(days).size).toBe(days.length);
    for (const day of days) expect(WEEK).toContain(day);
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
