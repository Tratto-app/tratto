import { useState } from 'react';
import { Badge, Card, ErrorBox, Loading, PageHeader } from '../components/ui';
import { rpc } from '../lib/api';
import { useAsync } from '../lib/hooks';
import { SUPABASE_URL, supabase } from '../lib/supabase';
import { useWs } from '../lib/workspace';

// Qué hace cada integración, qué secrets necesita y qué tan real es hoy.
const INFO: Record<string, { name: string; env: string[]; estado: string; nota: string }> = {
  email: { name: 'Email (Brevo)', env: ['BREVO_API_KEY', 'GROWTH_EMAIL_FROM', 'GROWTH_EMAIL_FROM_NAME'], estado: 'Implementado, sin probar en vivo', nota: 'API transaccional de Brevo (la misma cuenta que usa Tratto). Agrega la línea para darse de baja.' },
  whatsapp: { name: 'WhatsApp Cloud API', env: ['WHATSAPP_TOKEN', 'WHATSAPP_PHONE_NUMBER_ID', 'WHATSAPP_API_VERSION'], estado: 'Implementado, sin probar en vivo', nota: 'Necesita un número aprobado por Meta. Fuera de las 24 h desde el último mensaje del usuario solo se pueden mandar plantillas aprobadas. Requiere opt-in.' },
  sms: { name: 'SMS (Twilio)', env: ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_FROM'], estado: 'Implementado, sin probar en vivo', nota: 'Requiere opt-in.' },
  instagram: { name: 'Instagram Messaging', env: ['INSTAGRAM_TOKEN', 'INSTAGRAM_ACCOUNT_ID'], estado: 'Parcial', nota: 'La API de Meta solo permite responder a quien te escribió primero (IGSID). No permite mandar el primer DM: eso se hace a mano y la respuesta se carga en el Inbox.' },
  tiktok: { name: 'TikTok', env: [], estado: 'Simulado', nota: 'TikTok no tiene una API pública para mensajes directos.' },
  openai: { name: 'OpenAI', env: ['OPENAI_API_KEY', 'GROWTH_AI_MODEL'], estado: 'Implementado', nota: 'Sin clave, la IA funciona por reglas (modo simulado).' },
  google_play: { name: 'Google Play Console', env: [], estado: 'No implementado', nota: 'Las métricas de la consola (instalaciones de la ficha, reseñas) requieren una cuenta de servicio. Hoy se usan los eventos de la app.' },
  app_store: { name: 'App Store Connect', env: [], estado: 'No implementado', nota: 'Requiere API key de App Store Connect. Hoy se usan los eventos de la app.' },
  google_ads: { name: 'Google Ads', env: [], estado: 'No implementado', nota: 'El gasto se carga a mano en Fuentes (o por CSV) hasta conectar la API.' },
  analytics: { name: 'Analytics (GA4 / Firebase)', env: [], estado: 'No implementado', nota: 'La app manda sus eventos directo a growth-event.' },
  attribution: { name: 'Atribución (Install Referrer)', env: [], estado: 'Lado app', nota: 'Los links pasan el id del click a Google Play (referrer=…gid=). La app lo lee con la Install Referrer API y lo manda como click_token.' },
};

export default function SettingsIntegrations() {
  const { ws, toast } = useWs();
  const [clave, setClave] = useState<string | null>(null);
  const data = useAsync(async () => {
    const [i, w] = await Promise.all([
      supabase.from('growth_integrations').select('provider,mode,updated_at').eq('workspace_id', ws!.id).order('provider'),
      supabase.from('growth_workspaces').select('ingest_key_hash').eq('id', ws!.id).single(),
    ]);
    if (i.error) throw new Error(i.error.message);
    return { rows: i.data as { provider: string; mode: string }[], hasKey: !!w.data?.ingest_key_hash };
  }, [ws!.id]);
  const modo = async (provider: string, mode: string) => {
    const { error } = await supabase.from('growth_integrations').update({ mode, updated_at: new Date().toISOString() }).eq('workspace_id', ws!.id).eq('provider', provider);
    if (error) toast(error.message, true); else { toast(mode === 'live' ? 'Modo real: si faltan los secrets, igual queda simulado' : 'Guardado'); data.reload(); }
  };
  const generar = async () => {
    if (data.data?.hasKey && !confirm('Generar una clave nueva invalida la anterior (la app deja de poder mandar eventos hasta que la actualices). ¿Seguir?')) return;
    try { setClave(await rpc<string>('growth_rotate_ingest_key', { ws: ws!.id })); data.reload(); }
    catch (e) { toast(e instanceof Error ? e.message : String(e), true); }
  };
  const ejemplo = `curl -X POST ${SUPABASE_URL}/functions/v1/growth-event \\
  -H "content-type: application/json" \\
  -H "x-growth-key: ${clave || '<clave de ingesta>'}" \\
  -d '{"event":"register","external_user_id":"<id del usuario>","email":"…","click_token":"<gid del referrer>","platform":"android"}'`;

  return (
    <>
      <PageHeader title="Ajustes · Integraciones" desc="Ninguna credencial se guarda en el panel ni en la base: van como secrets de las Edge Functions (supabase secrets set …). Un canal en modo 'real' sin sus secrets sigue simulando y lo avisa." />
      <Card title="Conectar la app (eventos de usuarios)">
        <p className="texto-2" style={{ marginTop: 0 }}>La app (o su backend) manda cada evento a <code>growth-event</code> con la clave de ingesta del workspace. Eventos con efecto: <code>install</code>, <code>open</code>, <code>register</code>, <code>onboarding_complete</code>, <code>first_action</code>, <code>session_start</code>, <code>purchase</code> (con <code>amount</code>). También acepta <code>sign_up</code> y <code>first_open</code>, y lotes de hasta 50 con <code>{'{"events":[…]}'}</code>.</p>
        <div className="fila"><button className="btn primario" onClick={generar}>{data.data?.hasKey ? 'Generar clave nueva' : 'Generar clave de ingesta'}</button>
          {data.data?.hasKey && !clave && <Badge tone="verde">Hay una clave activa</Badge>}</div>
        {clave && <div className="aviso mt">Copiala ahora: no se vuelve a mostrar (solo se guarda su hash).<div className="mono" style={{ marginTop: 6, wordBreak: 'break-all' }}>{clave}</div></div>}
        <pre className="mono mt" style={{ background: 'var(--tinta)', padding: 12, borderRadius: 8, overflowX: 'auto', fontSize: 12 }}>{ejemplo}</pre>
        <p className="muted pequeño">La clave identifica al workspace: guardala del lado servidor si podés. Si se filtra, generá otra. Los eventos se pueden repetir sin duplicarse usando <code>idempotency_key</code>.</p>
      </Card>
      <Card title="Canales y servicios" className="mt">
        <ErrorBox error={data.error} />
        {!data.data ? (data.error ? null : <Loading />) : (
          <div className="tabla-wrap"><table>
            <thead><tr><th>Integración</th><th>Estado del código</th><th>Secrets necesarios</th><th>Modo</th></tr></thead>
            <tbody>{data.data.rows.map((r) => {
              const i = INFO[r.provider] || { name: r.provider, env: [], estado: '', nota: '' };
              return (
                <tr key={r.provider}>
                  <td><b>{i.name}</b><div className="muted pequeño">{i.nota}</div></td>
                  <td><Badge tone={i.estado.startsWith('Implementado') ? 'verde' : i.estado === 'Parcial' || i.estado === 'Lado app' ? 'laton' : 'mock'}>{i.estado}</Badge></td>
                  <td className="pequeño">{i.env.length ? i.env.map((e) => <div key={e}><code>{e}</code></div>) : '—'}</td>
                  <td><select style={{ width: 130 }} value={r.mode} onChange={(e) => modo(r.provider, e.target.value)} aria-label={`Modo de ${i.name}`}>
                    <option value="mock">Simulado</option><option value="live">Real</option><option value="off">Apagado</option></select></td>
                </tr>
              );
            })}</tbody>
          </table></div>
        )}
      </Card>
    </>
  );
}
