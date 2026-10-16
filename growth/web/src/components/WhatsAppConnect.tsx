import { useCallback, useEffect, useRef, useState } from 'react';
import { Card, ErrorBox } from './ui';
import { supabase } from '../lib/supabase';
import { useWs } from '../lib/workspace';
import { copySetupText, forgetSetup, loadMetaSdk, readMetaSession, recallSetup, rememberSetup, type FacebookSdk, type MetaSession, type WhatsAppSetup as Setup } from '../lib/whatsapp-connect';

type Flow = { setup: Setup; code?: string; session?: MetaSession; busy: boolean; codeAt?: number; launched: boolean };
const cache = () => { try { return window.sessionStorage; } catch { return null; } };

export default function WhatsAppConnect({ onLinked }: { onLinked: () => void }) {
  const { ws, session, toast } = useWs();
  const owner = session?.user.id;
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
    void (async () => {
      try {
        const status = await call('status');
        if (!alive) return;
        setAvailable(true);
        const saved = ws && owner ? recallSetup(cache(), ws.id, owner) : null;
        if (!saved) return;
        if (saved.app_id !== status.app_id || saved.config_id !== status.config_id || saved.callback !== status.callback) { forgetSetup(cache()); return; }
        setBusy(true);
        const restored = await call('resume', { run_id: saved.run_id, state: saved.state });
        if (!alive) return;
        if (restored.restored !== true) { forgetSetup(cache()); return; }
        const next = { ...saved, expires_at: restored.expires_at } as Setup;
        rememberSetup(cache(), ws!.id, owner!, next);
        setSetup(next);
        const facebook = await loadMetaSdk(saved.app_id);
        if (!alive) return;
        setSdk(() => facebook); flow.current = { setup: next, busy: false, launched: false };
      } catch (e) {
        if (alive) {
          forgetSetup(cache());
          if ((e as { status?: number }).status !== 403) { setAvailable(true); setError(e instanceof Error ? e.message : 'No se pudo leer la configuración de conexión.'); }
        }
      } finally { if (alive) setBusy(false); }
    })();
    return () => { alive = false; flow.current = null; };
  }, [call, ws?.id, owner]);
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange(event => { if (event === 'SIGNED_OUT') forgetSetup(cache()); });
    return () => data.subscription.unsubscribe();
  }, []);
  useEffect(() => {
    if (!setup) return;
    const timer = window.setTimeout(() => {
      if (flow.current?.busy || flow.current?.launched) return;
      forgetSetup(cache()); flow.current = null; setSetup(null); setSdk(null);
      setError('La preparación venció. Tocá Preparar conexión para obtener un token nuevo.');
    }, Math.max(0, Date.parse(setup.expires_at) - Date.now()));
    return () => window.clearTimeout(timer);
  }, [setup]);
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
    finally { forgetSetup(cache()); delete current.code; flow.current = null; setBusy(false); setWaiting(false); }
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
    if (!ws || !owner) return;
    setBusy(true); setError(null); setResult(null); setWaiting(false); flow.current = null;
    try {
      const next = await call('begin') as Setup;
      rememberSetup(cache(), ws.id, owner, next);
      setSetup(next);
      const facebook = await loadMetaSdk(next.app_id);
      setSetup(next); setSdk(() => facebook); flow.current = { setup: next, busy: false, launched: false };
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo preparar la conexión.'); }
    finally { setBusy(false); }
  }
  function launch() {
    const current = flow.current;
    if (!sdk || !current || busy || current.launched) return;
    if (Date.parse(current.setup.expires_at) <= Date.now()) { forgetSetup(cache()); setError('La preparación venció. Tocá Preparar conexión nuevamente.'); return; }
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
          forgetSetup(cache());
          setError('Meta no devolvió la confirmación de Coexistencia. No se activó la recepción. Prepará una nueva conexión después de revisar el aviso de Meta.');
        }
      }, 24000);
    }, { config_id: current.setup.config_id, response_type: 'code', override_default_response_type: true, auth_type: 'rerequest', extras: { setup: {}, featureType: 'whatsapp_business_app_onboarding' } });
  }
  async function copy(value: string) {
    if (await copySetupText(value)) toast('Copiado');
    else toast('Mantené presionado el campo y elegí Copiar.', true);
  }
  if (!available) return null;
  return <Card title="Conectar tu WhatsApp Business con Meta">
    <p>Vos seguís escribiendo desde el celular. Esta conexión permite observar mensajes de los negocios de tus listas; no activa campañas ni respuestas automáticas.</p>
    {error && <ErrorBox error={error} />}
    {result && <p role="status">{result}</p>}
    <button className="btn" disabled={busy || waiting} onClick={() => void prepare()}>{busy ? 'Preparando…' : 'Preparar conexión'}</button>
    {setup && <div className="wa-connect-setup">
      <p>Esta preparación se conserva al recargar esta pestaña. Vence a las <strong>{new Date(setup.expires_at).toLocaleTimeString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', hour: '2-digit', minute: '2-digit' })}</strong> (Buenos Aires).</p>
      <p>Usá los botones para copiar. El token va en <strong>Webhooks → Token de verificación</strong> de Meta.</p>
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
