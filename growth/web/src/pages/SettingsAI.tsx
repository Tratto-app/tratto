import { useState } from 'react';
import { Badge, Card, ErrorBox, Loading, PageHeader } from '../components/ui';
import { fn } from '../lib/api';
import { useAsync } from '../lib/hooks';
import { supabase } from '../lib/supabase';
import { useWs } from '../lib/workspace';

const NOMBRES: Record<string, string> = {
  analyze: 'Analizar prospecto', message: 'Escribir primer mensaje', reply: 'Leer respuestas', summary: 'Resumir conversación',
  objection: 'Responder objeciones', score: 'Recomendar score', explain: 'Explicar la app',
};

export default function SettingsAI() {
  const { ws, toast } = useWs();
  const [estado, setEstado] = useState<{ provider: string; model: string | null } | null>(null);
  const prompts = useAsync(async () => {
    const { data, error } = await supabase.from('growth_ai_prompts').select('id,key,instructions').eq('workspace_id', ws!.id).order('key');
    if (error) throw new Error(error.message);
    return data as { id: string; key: string; instructions: string }[];
  }, [ws!.id]);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const probar = async () => {
    try { const r = await fn<{ provider: string; model: string | null }>('growth-ai', { workspace_id: ws!.id, action: 'explain' }); setEstado(r); }
    catch (e) { toast(e instanceof Error ? e.message : String(e), true); }
  };
  const guardar = async (id: string) => {
    const { error } = await supabase.from('growth_ai_prompts').update({ instructions: edits[id], updated_at: new Date().toISOString() }).eq('id', id);
    if (error) toast(error.message, true); else { toast('Instrucción guardada'); prompts.reload(); }
  };
  return (
    <>
      <PageHeader title="Settings · AI" desc="Cómo trabaja el agente. Las reglas de base (no inventar, respetar la baja, español rioplatense, responder en JSON) están fijas en el código y no se pueden quitar desde acá." />
      <div className="grid g2">
        <Card title="Proveedor">
          <p className="texto-2" style={{ marginTop: 0 }}>Se configura con secrets de las Edge Functions (nunca en el navegador):</p>
          <ul className="lista-simple pequeño">
            <li><code>OPENAI_API_KEY</code><span className="muted">clave de OpenAI. Sin ella, la IA responde por reglas (modo simulado).</span></li>
            <li><code>GROWTH_AI_MODEL</code><span className="muted">modelo (por defecto gpt-4o-mini, el mismo que usa n8n en Tratto).</span></li>
          </ul>
          <div className="fila mt"><button className="btn" onClick={probar}>Probar ahora</button>
            {estado && <Badge tone={estado.provider === 'mock' ? 'mock' : 'verde'}>{estado.provider === 'mock' ? 'Simulado: falta OPENAI_API_KEY' : `Conectado · ${estado.model}`}</Badge>}</div>
          <p className="muted pequeño">Cada uso queda registrado en AI Agent → Últimas ejecuciones (proveedor, duración, tokens). Lo que se manda al modelo: datos del prospecto (sin notas internas), la conversación y la base de conocimiento.</p>
        </Card>
        <Card title="Límites de seguridad">
          <ul className="lista-simple pequeño">
            <li>La IA nunca envía nada sola: escribe borradores; envían las automatizaciones o una persona.</li>
            <li>Si detecta que alguien pide la baja, se marca "No contactar" y se cortan las automatizaciones.</li>
            <li>El score que propone la IA se guarda aparte (score IA); el score oficial sale de las reglas salvo que lo fijes a mano.</li>
            <li>Respuestas inválidas del modelo se sanean (score entre 0 y 100, intención dentro de los valores permitidos).</li>
          </ul>
        </Card>
      </div>
      <Card title="Instrucciones por tarea" className="mt">
        <ErrorBox error={prompts.error} />
        {!prompts.data ? (prompts.error ? null : <Loading />) : (
          <div className="grid g2">
            {prompts.data.map((p) => (
              <div key={p.id} className="grid" style={{ gap: 6 }}>
                <b>{NOMBRES[p.key] || p.key}</b>
                <textarea rows={4} value={edits[p.id] ?? p.instructions} onChange={(e) => setEdits({ ...edits, [p.id]: e.target.value })} aria-label={NOMBRES[p.key]} />
                {edits[p.id] !== undefined && edits[p.id] !== p.instructions && <button className="btn chico primario" style={{ justifySelf: 'start' }} onClick={() => guardar(p.id)}>Guardar</button>}
              </div>
            ))}
          </div>
        )}
      </Card>
    </>
  );
}
