import { useCallback, useEffect, useRef, useState } from 'react';
import { Card, ErrorBox } from './ui';
import { supabase } from '../lib/supabase';
import { useWs } from '../lib/workspace';
import { loadMetaSdk, readMetaSession, type FacebookSdk, type MetaSession } from '../lib/whatsapp-connect';

type Setup = { app_id: string; config_id: string; callback: string; webhook_fields: string[]; run_id: string; state: string; verify_token: string; expires_at: string };
type Flow = { setup: Setup; code?: string; session?: MetaSession; busy: boolean; codeAt?: number; launched: boolean };

export default function WhatsAppConnect({ onLinked }: { onLinked: () => void }) {
  const { ws, toast } = useWs();
  const [available, setAvailable] = useState(false);
  const [setup, setSetup] = useState<Setup | null>(null);
  const [sdk, setSdk] = useState<FacebookSdk | null>(null);
  const [busy, setBusy] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const flow = useRef<Flow | null>(null);
  const call = useCallback(async (action: string, values: Record<string, unknown> = {}) => {
    const response = await supabase.functions.invoke('growth-whatsapp-connect', { body: { action, workspace_id: ws?.id, ...values } });
    if (response.error) {
      let message = 'No se pudo completar la conexión. Tu WhatsApp Business sigue en el celular.';
      try {
        const context = response.error.context;
        if (context instanceof Response) { const body = await context.json(); if (typeof body.error === 'string') message = body.error; }
      } catch { /* No se muestra una respuesta sin validar. */ }
      throw Object.assign(new Error(message), { status: response.error.context instanceof Response ? response.error.context.status : 0 });
    }
    if (response.data?.error) throw new Error(String(response.data.error));
    return response.data;
  }, [ws?.id]);
  useEffect(() => {
    let alive = true; setAvailable(false); setSetup(null); setSdk(null); flow.current = null;
    void call('status').then(() => { if (alive) setAvailable(true); }).catch(e => {
      if (alive && e.status !== 403) { setAvailable(true); setError(e instanceof Error ? e.message : 'No se pudo leer la configuración de conexión.'); }
    });
    return () => { alive = false; flow.current = null; };
  }, [call]);
  const complete = useCallback(async () => {
    const current = flow.current;
    if (!current?.code || !current.session || current.busy) return;
    current.busy = true; setBusy(true);
    try {
      if (!current.codeAt || Date.now() - current.codeAt > 24000) throw new Error('La autorización de Meta venció. Prepará una nueva conexión.');
      const response = await call('complete', { run_id: current.setup.run_id, state: current.setup.state, code: current.code, ...current.session });
      setResult(response.receiving_enabled ? 'Meta confirmó la vinculación y el receptor está habilitado. Falta comprobar una entrada y una respuesta real desde tu celular.' : 'Meta confirmó el número y Coexistencia. Falta completar el callback o los campos del webhook en Meta.');
      setSetup(null); setSdk(null); onLinked();
    } catch (e) { setSetup(null); setSdk(null); setError(e instanceof Error ? e.message : 'No se pudo confirmar la conexión.'); }
    finally { delete current.code; flow.current = null; setBusy(false); setWaiting(false); }
  }, [call, onLinked]);
  useEffect(() => {
    const receive = (event: MessageEvent) => {
      const current = flow.current;
      if (!current?.launched || current.busy) return;
      const session = readMetaSession(event.origin, event.data);
      if (session) { current.session = session; void complete(); }
    };
    window.addEventListener('message', receive);
    return () => window.removeEventListener('message', receive);
  }, [complete]);
  async function prepare() {
    setBusy(true); setError(null); setResult(null); setWaiting(false); flow.current = null;
    try {
      const next = await call('begin') as Setup;
      setSetup(next);
      const facebook = await loadMetaSdk(next.app_id);
      setSetup(next); setSdk(() => facebook); flow.current = { setup: next, busy: false, launched: false };
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo preparar la conexión.'); }
    finally { setBusy(false); }
  }
  function launch() {
    const current = flow.current;
    if (!sdk || !current || busy || current.launched) return;
    if (Date.parse(current.setup.expires_at) <= Date.now()) { setError('La preparación venció. Tocá Preparar conexión nuevamente.'); return; }
    current.launched = true; setWaiting(true); setError(null);
    // FB.login se invoca directamente con el gesto del titular, sin await previo.
    sdk.login(response => {
      if (flow.current !== current) return;
      const code = response.authResponse?.code;
      if (!code) { current.launched = false; setWaiting(false); setError('Meta no completó la autorización. Podés volver a abrir la conexión para ver el requisito pendiente.'); return; }
      current.code = code; current.codeAt = Date.now(); void complete();
      window.setTimeout(() => {
        if (flow.current === current && !current.busy) {
          delete current.code; flow.current = null; setWaiting(false); setSetup(null); setSdk(null);
          setError('Meta no devolvió la confirmación de Coexistencia. No se activó la recepción. Prepará una nueva conexión después de revisar el aviso de Meta.');
        }
      }, 24000);
    }, { config_id: current.setup.config_id, response_type: 'code', override_default_response_type: true, auth_type: 'rerequest', extras: { setup: {}, featureType: 'whatsapp_business_app_onboarding' } });
  }
  async function copy(value: string) {
    try { await navigator.clipboard.writeText(value); toast('Copiado'); } catch { toast('Mantené presionado el campo para copiarlo.', true); }
  }
  if (!available) return null;
  return <Card title="Conectar tu WhatsApp Business con Meta">
    <p>Vos seguís escribiendo desde el celular. Esta conexión permite observar mensajes de los negocios de tus listas; no activa campañas ni respuestas automáticas.</p>
    {error && <ErrorBox error={error} />}
    {result && <p role="status">{result}</p>}
    <button className="btn" disabled={busy || waiting} onClick={() => void prepare()}>{busy ? 'Preparando…' : 'Preparar conexión'}</button>
    {setup && <div className="wa-connect-setup">
      <p>Configuración de Meta: <strong>{setup.config_id}</strong>. Estos datos de verificación vencen en 15 minutos.</p>
      <ol>
        <li>En Meta, abrí el caso de uso de WhatsApp → Configuración. Guardá esta URL de devolución y este token de verificación temporal.</li>
        <li>Suscribí los campos: <strong>{setup.webhook_fields.join(', ')}</strong>.</li>
        <li>En Inicio de sesión con Facebook para empresas → Configurar, habilitá el SDK de JavaScript para <strong>www.trattoapp.com.ar</strong>. La URL del CRM es <strong>https://www.trattoapp.com.ar/crm/whatsapp-seguimiento</strong>.</li>
        <li>Volvé acá y tocá Conectar con Meta. Elegí conservar tu cuenta existente de WhatsApp Business y confirmá desde tu celular. La elegibilidad y los requisitos pendientes los determina Meta.</li>
      </ol>
      <label>URL de devolución<input readOnly value={setup.callback} onFocus={e => e.target.select()} /></label>
      <button className="btn" onClick={() => void copy(setup.callback)}>Copiar URL</button>
      <label>Token temporal para verificar el receptor<input readOnly value={setup.verify_token} onFocus={e => e.target.select()} /></label>
      <button className="btn" onClick={() => void copy(setup.verify_token)}>Copiar token temporal</button>
      <p><a href={`https://developers.facebook.com/apps/${setup.app_id}/`} target="_blank" rel="noopener noreferrer">Abrir la app de Tratto en Meta</a></p>
      <p>No elimines tu cuenta del celular. Esta primera vinculación procesa mensajes nuevos; el historial anterior queda pendiente de una sincronización autorizada.</p>
      <button className="btn primary" disabled={!sdk || busy || waiting} onClick={launch}>{waiting ? 'Esperando que completes Meta…' : 'Conectar con Meta'}</button>
    </div>}
  </Card>;
}
