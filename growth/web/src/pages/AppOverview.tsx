import { useEffect, useState } from 'react';
import { Card, Field, PageHeader } from '../components/ui';
import { supabase } from '../lib/supabase';
import type { AppSettings } from '../lib/types';
import { useWs } from '../lib/workspace';

const EVENTOS = [
  { v: 'first_action', l: 'Primera acción (first_action)' }, { v: 'register', l: 'Registro (register)' },
  { v: 'onboarding_complete', l: 'Termina el onboarding (onboarding_complete)' }, { v: 'purchase', l: 'Primer pago (purchase)' },
];

export default function AppOverview() {
  const { ws, app, reloadApp, toast } = useWs();
  const [f, setF] = useState<Partial<AppSettings>>({});
  const [otro, setOtro] = useState(false);
  useEffect(() => { if (app) { setF(app); setOtro(!EVENTOS.some((e) => e.v === app.activation_event)); } }, [app]);
  const set = (k: keyof AppSettings) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  const guardar = async () => {
    const ev = String(f.activation_event || '').trim().toLowerCase();
    if (!/^[a-z0-9_]{2,40}$/.test(ev)) return toast('El evento de activación solo puede tener letras, números y _', true);
    for (const k of ['play_store_url', 'app_store_url', 'website'] as const) {
      if (f[k] && !/^https:\/\//.test(String(f[k]))) return toast(`La URL de ${k} tiene que empezar con https://`, true);
    }
    const { workspace_id: _w, updated_at: _u, ...rest } = f as AppSettings & { updated_at?: string };
    const patch = Object.fromEntries(Object.entries(rest).map(([k, v]) => [k, typeof v === 'string' && v.trim() === '' ? null : v]));
    const { error } = await supabase.from('growth_app_settings').update({ ...patch, app_name: f.app_name || 'Mi app', activation_event: ev, active_window_days: Number(f.active_window_days) || 7 }).eq('workspace_id', ws!.id);
    if (error) toast(error.message, true); else { toast('Guardado'); reloadApp(); }
  };
  return (
    <>
      <PageHeader title="La app" desc="Todo lo que la IA y las métricas saben de la app sale de acá. La IA no usa información que no esté cargada en esta página o en la base de conocimiento."
        actions={<button className="btn primario" onClick={guardar}>Guardar</button>} />
      <div className="grid g2">
        <Card title="La app">
          <div className="grid g2">
            <Field label="Nombre"><input value={f.app_name || ''} onChange={set('app_name')} /></Field>
            <Field label="Categoría"><input value={f.category || ''} onChange={set('category')} /></Field>
            <Field label="Logo (URL)"><input value={f.logo_url || ''} onChange={set('logo_url')} /></Field>
            <Field label="Sitio web"><input value={f.website || ''} onChange={set('website')} placeholder="https://" /></Field>
          </div>
          <div className="grid mt">
            <Field label="Descripción"><textarea rows={3} value={f.description || ''} onChange={set('description')} /></Field>
            <Field label="Para quién es (público)"><textarea rows={2} value={f.audience || ''} onChange={set('audience')} /></Field>
            <Field label="Propuesta de valor" hint="Una oración: qué gana la persona"><textarea rows={2} value={f.value_prop || ''} onChange={set('value_prop')} /></Field>
          </div>
        </Card>
        <Card title="Producto y precio">
          <div className="grid">
            <Field label="Funcionalidades"><textarea rows={3} value={f.features || ''} onChange={set('features')} /></Field>
            <Field label="Beneficios"><textarea rows={2} value={f.benefits || ''} onChange={set('benefits')} /></Field>
            <div className="grid g2">
              <Field label="Precio"><input value={f.price || ''} onChange={set('price')} /></Field>
              <Field label="Modelo de negocio"><input value={f.monetization || ''} onChange={set('monetization')} /></Field>
            </div>
          </div>
        </Card>
        <Card title="Onboarding y activación" className="span2">
          <p className="texto-2" style={{ marginTop: 0 }}>Un usuario se cuenta como <b>activado</b> cuando la app manda este evento por primera vez. Elegí el que mejor indique que la persona ya obtuvo valor (en Tratto: hacer su primer pedido).</p>
          <div className="grid g3">
            <Field label="Evento de activación">
              <select value={otro ? '__otro' : f.activation_event} onChange={(e) => { if (e.target.value === '__otro') setOtro(true); else { setOtro(false); setF({ ...f, activation_event: e.target.value }); } }}>
                {EVENTOS.map((e) => <option key={e.v} value={e.v}>{e.l}</option>)}<option value="__otro">Otro evento…</option>
              </select>
            </Field>
            {otro && <Field label="Nombre del evento"><input value={f.activation_event || ''} onChange={set('activation_event')} placeholder="ej.: first_request" /></Field>}
            <Field label="Días sin uso para dejar de ser activo"><input type="number" min={1} max={90} value={f.active_window_days || 7} onChange={set('active_window_days')} /></Field>
          </div>
          <p className="muted pequeño">Cambiarlo no reescribe el pasado: aplica a los eventos que lleguen desde ahora.</p>
        </Card>
      </div>
    </>
  );
}
