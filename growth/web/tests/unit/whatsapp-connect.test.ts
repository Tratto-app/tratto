import { describe, it, expect } from 'vitest';
import { forgetSetup, readMetaSession, recallSetup, rememberSetup, type WhatsAppSetup } from '../../src/lib/whatsapp-connect';
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

const prepared: WhatsAppSetup = { app_id: '111111', config_id: '222222', callback: 'https://example.invalid/observer', webhook_fields: ['messages'], run_id: '00000000-0000-4000-a000-000000000001', state: 'a'.repeat(64), verify_token: 'b'.repeat(64), expires_at: '2026-10-16T18:00:00Z' };
const now = Date.parse('2026-10-16T17:50:00Z');
function memory() {
  const values = new Map<string, string>();
  return { getItem: (key: string) => values.get(key) || null, setItem: (key: string, value: string) => { values.set(key, value); }, removeItem: (key: string) => { values.delete(key); }, values };
}
describe('Preparación de Meta al volver desde otra pestaña', () => {
  it('recupera la misma preparación vigente y nunca persiste el código ni el token de acceso de Meta', () => {
    const storage = memory();
    rememberSetup(storage, 'workspace', 'owner', { ...prepared, code: 'no-persistir', access_token: 'tampoco-persistir' } as WhatsAppSetup);
    expect(recallSetup(storage, 'workspace', 'owner', now)).toEqual(prepared);
    expect([...storage.values.values()].join()).not.toContain('persistir');
  });
  it('borra el token vencido en lugar de renovar una autorización en silencio', () => {
    const storage = memory(); rememberSetup(storage, 'workspace', 'owner', prepared);
    expect(recallSetup(storage, 'workspace', 'owner', Date.parse(prepared.expires_at))).toBeNull();
    expect(storage.values.size).toBe(0);
  });
  it.each([['otro-workspace', 'owner'], ['workspace', 'otro-owner']])('no recupera una preparación ajena: %s / %s', (workspace, owner) => {
    const storage = memory(); rememberSetup(storage, 'workspace', 'owner', prepared);
    expect(recallSetup(storage, workspace, owner, now)).toBeNull();
    expect(storage.values.size).toBe(0);
  });
  it('descarta datos incompletos y permite limpiar la preparación al cerrar sesión', () => {
    const storage = memory(); rememberSetup(storage, 'workspace', 'owner', { ...prepared, state: '' });
    expect(recallSetup(storage, 'workspace', 'owner', now)).toBeNull();
    rememberSetup(storage, 'workspace', 'owner', prepared); forgetSetup(storage);
    expect(recallSetup(storage, 'workspace', 'owner', now)).toBeNull();
    expect(recallSetup(null, 'workspace', 'owner', now)).toBeNull();
  });
});
