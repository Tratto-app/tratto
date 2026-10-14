import { describe, expect, it } from 'vitest';
import { actividad, barriosPendientes, COMUNAS, confirmadoManual, contactosDelCanal, fechaLocal, regionDe, type ContactoRecorrido } from '../../src/lib/recorridos';
const contacto = (datos: Record<string, unknown> = {}, zona = 'CABA', city: string | null = null): ContactoRecorrido => ({ id: 'p', rubro: 'Herrería y soldadura', zona, city, entrada: 'prospeccion', status: 'contacted', tags: [], contacted_at: '2026-10-14T12:00:00Z', datos });
const enviado = { gmail_thread: 'hilo-real', enviado_at: '2026-10-14T12:00:00Z' };
describe('actividad de los recorridos', () => {
  it('no confunde guardar un candidato o fecha/contacted_at con un envío Gmail', () => {
    expect(actividad([contacto({ prospeccion: { fecha: '2026-10-14' } }), contacto({ prospeccion: { gmail_thread: 'h' } })], 'gmail').iniciales).toBe(0);
  });
  it('separa iniciales, rechazos, demoras pendientes y recordatorios aceptados', () => {
    const a = contacto({ prospeccion: enviado, recontacto_mismo_dia: { estado: 'enviado_aceptado', message_id: 'r' } });
    const b = contacto({ prospeccion: enviado, entrega_temporal: { action: 'delayed', estado: 'demora_temporal' } });
    const c = contacto({ prospeccion: enviado, rebote_definitivo: { action: 'failed' }, entrega_temporal: { action: 'delayed' } });
    const d = contacto({ prospeccion: enviado, recontacto_mismo_dia: { estado: 'reservado', message_id: 'incierto' } });
    expect(actividad([a, b, c, d], 'gmail')).toMatchObject({ iniciales: 4, rechazos: 1, demoras: 1, sinRebote: 2, recordatorios: 1 });
  });
  it('las listas/clics de WhatsApp no equivalen a contacto confirmado', () => {
    const a = contacto({ whatsapp_manual: { fecha_lista: '2026-10-14', estado: 'lista_entregada_no_contactado', clics: 3, contactados_manualmente: null } });
    const b = contacto({ whatsapp_manual: { fecha_lista: '2026-10-14', estado: 'lista_entregada_no_contactado', contactados_manualmente: true } });
    expect(confirmadoManual(a)).toBe(false);
    expect(actividad([a, b], 'whatsapp')).toMatchObject({ iniciales: 2, confirmados: 1 });
    expect(contactosDelCanal([contacto({ whatsapp_manual: { estado: 'reservado', fecha_lista: '2026-10-14' } })], 'whatsapp')).toHaveLength(0);
  });
});
describe('ubicación y fecha real', () => {
  it('preserva las zonas históricas y no convierte AMBA/Buenos Aires en CABA', () => {
    expect(regionDe(contacto({}, 'Buenos Aires'))).toBe('Sin zona precisa');
    expect(regionDe(contacto({}, 'CABA y Gran Buenos Aires', 'CABA y Gran Buenos Aires'))).toBe('Sin zona precisa');
    expect(regionDe(contacto({}, 'GBA Norte', 'Tigre'))).toBe('Zona Norte');
    expect(regionDe(contacto({}, 'CABA y GBA', 'Palermo'))).toBe('CABA');
    expect(regionDe(contacto({}, 'Buenos Aires (interior)', 'Mar del Plata'))).toBe('Otras zonas');
  });
  it('un contacto genérico en CABA no cubre sus 48 barrios', () => {
    expect(COMUNAS.flat()).toHaveLength(48);
    expect(barriosPendientes([contacto({}, 'CABA', 'Comuna 1')])).toHaveLength(48);
    expect(barriosPendientes([contacto({}, 'CABA', 'Palermo')])).toHaveLength(47);
  });
  it('cambia de día a medianoche de Argentina, no a medianoche UTC', () => {
    expect(fechaLocal('2026-10-15T01:00:00Z')).toBe('2026-10-14');
    expect(fechaLocal('2026-10-15T03:00:00Z')).toBe('2026-10-15');
  });
});
