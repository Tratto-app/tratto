import { describe, it, expect } from 'vitest';
import { readMetaSession } from '../../src/lib/whatsapp-connect';
const session = { type: 'WA_EMBEDDED_SIGNUP', event: 'FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING', data: { waba_id: '111111', phone_number_id: '222222' } };
describe('Confirmación oficial de Coexistencia', () => {
  it('acepta únicamente orígenes exactos de Facebook y sesión completa', () => {
    expect(readMetaSession('https://www.facebook.com', JSON.stringify(session))).toEqual({ ...session.data, event: session.event });
    expect(readMetaSession('https://www.facebook.com.evil.invalid', session)).toBeNull();
    expect(readMetaSession('https://fakefacebook.com', session)).toBeNull();
    expect(readMetaSession('https://www.facebook.com', { ...session, event: 'FINISH' })).toBeNull();
    expect(readMetaSession('https://www.facebook.com', { ...session, data: {} })).toBeNull();
    expect(readMetaSession('https://www.facebook.com', '{broken')).toBeNull();
  });
});
