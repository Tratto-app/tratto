import { useEffect, useRef, useState } from 'react';
import { Badge, Card, Empty, ErrorBox, Loading, PageHeader } from '../components/ui';
import { fecha, hace } from '../lib/format';
import { useAsync } from '../lib/hooks';
import { supabase } from '../lib/supabase';
import { useWs } from '../lib/workspace';

// Claude / Codex: el chat entre los dos agentes. Se escriben en la cola
// (growth_mkt_items con datos.clave = 'mensaje_agentes') y se ordenan con la
// pizarra (datos.clave = 'coordinacion_codex_claude'). Acá la persona lee todo
// y puede pausarlos: con la pizarra en "cambios" los dos dejan de trabajar juntos.

type Agente = 'claude' | 'codex';
interface Mensaje {
  id: string; titulo: string; resumen: string | null; cuerpo: string | null; created_at: string;
  datos: { de?: Agente; para?: Agente; texto?: string; leido?: boolean; asunto?: string };
}
interface Latido { at?: string; hizo?: string; ok?: boolean }
interface Pizarra {
  id: string; estado: string; updated_at: string;
  datos: {
    reparto?: { trabajo: string; codex: string; claude: string }[];
    debate?: string[];
    latidos?: Partial<Record<Agente, Latido | string | null>>;
    confirmado?: Partial<Record<Agente, boolean>>;
  };
}

const NOMBRE: Record<Agente, string> = { claude: 'Claude', codex: 'Codex' };

function textoDe(m: Mensaje) {
  return m.datos.texto || m.cuerpo || m.resumen || '';
}

function latidoTexto(l: Latido | string | null | undefined) {
  if (!l) return 'Todavía no corrió con el reparto nuevo.';
  if (typeof l === 'string') return l;
  return `${l.at ? hace(l.at) : ''}${l.hizo ? ` · ${l.hizo}` : ''}${l.ok === false ? ' · terminó con problemas' : ''}`;
}

export default function Agentes() {
  const { ws, toast } = useWs();
  const [guardando, setGuardando] = useState(false);
  const fin = useRef<HTMLDivElement>(null);

  const { data, error, loading, reload } = useAsync(async () => {
    const [m, p] = await Promise.all([
      supabase.from('growth_mkt_items').select('id,titulo,resumen,cuerpo,created_at,datos')
        .eq('workspace_id', ws!.id).eq('datos->>clave', 'mensaje_agentes')
        .order('created_at', { ascending: false }).limit(300),
      supabase.from('growth_mkt_items').select('id,estado,updated_at,datos')
        .eq('workspace_id', ws!.id).eq('datos->>clave', 'coordinacion_codex_claude')
        .order('created_at', { ascending: false }).limit(1).maybeSingle(),
    ]);
    if (m.error) throw new Error(m.error.message);
    if (p.error) throw new Error(p.error.message);
    return { mensajes: ((m.data || []) as Mensaje[]).reverse(), pizarra: p.data as Pizarra | null };
  }, [ws?.id]);

  // Los agentes escriben cuando corren: se refresca solo cada minuto.
  useEffect(() => {
    const t = window.setInterval(reload, 60_000);
    return () => window.clearInterval(t);
  }, [reload]);
  useEffect(() => { fin.current?.scrollIntoView({ block: 'end' }); }, [data?.mensajes.length]);

  if (loading && !data) return <Loading />;
  if (error) return <ErrorBox error={error} onRetry={reload} />;
  const { mensajes, pizarra } = data!;
  const pausado = !!pizarra && pizarra.estado !== 'programado';

  const cambiarPausa = async () => {
    if (!pizarra) return;
    setGuardando(true);
    const { error: e } = await supabase.from('growth_mkt_items').update({ estado: pausado ? 'programado' : 'cambios' }).eq('id', pizarra.id);
    setGuardando(false);
    if (e) { toast(`No se pudo guardar: ${e.message}`, true); return; }
    toast(pausado ? 'Listo: vuelven a trabajar juntos en su próxima corrida.' : 'Pausados: en su próxima corrida no hacen nada del trabajo compartido.');
    reload();
  };

  return (
    <>
      <PageHeader
        title="Claude / Codex"
        desc="El chat entre los dos agentes: se reparten el trabajo, se avisan qué hicieron y debaten cada idea nueva antes de hacerla. Hablan cuando corren sus tareas, no al instante."
        actions={pizarra && (
          <button className={`btn ${pausado ? 'primario' : 'peligro'}`} disabled={guardando} onClick={cambiarPausa}>
            {pausado ? 'Reanudar' : 'Pausarlos'}
          </button>
        )}
      />
      <div className="agentes">
        <Card title={`Chat · ${mensajes.length} mensajes`} className="agentes-chat">
          {mensajes.length === 0
            ? <Empty title="Todavía no se escribieron">Los mensajes aparecen acá cuando corren sus tareas.</Empty>
            : (
              <div className="chat">
                {mensajes.map((m) => {
                  const de = m.datos.de === 'claude' ? 'claude' : 'codex';
                  return (
                    <div key={m.id} className={`burbuja ${de === 'claude' ? 'out' : 'in'} de-${de}`}>
                      <div className="quien">{NOMBRE[de]}</div>
                      <strong className="asunto">{m.titulo.replace(/^(Mensaje (de )?)?(Claude|Codex) a (Claude|Codex)\s*·\s*/i, '')}</strong>
                      <div>{textoDe(m)}</div>
                      <div className="meta">
                        <span>{fecha(m.created_at, true)}</span>
                        <span>{m.datos.leido ? `${NOMBRE[de === 'claude' ? 'codex' : 'claude']} lo leyó` : 'sin leer'}</span>
                      </div>
                    </div>
                  );
                })}
                <div ref={fin} />
              </div>
            )}
        </Card>
        <div className="grid">
          <Card title="Estado">
            {!pizarra && <div className="muted">Todavía no hay reparto acordado.</div>}
            {pizarra && (
              <>
                <div className="fila"><Badge tone={pausado ? 'violeta' : 'verde'}>{pausado ? 'En pausa' : 'Trabajando juntos'}</Badge>
                  <span className="muted pequeño">Cambió {hace(pizarra.updated_at)}</span></div>
                <ul className="lista-simple mt">
                  {(['claude', 'codex'] as Agente[]).map((a) => (
                    <li key={a}><div><strong>{NOMBRE[a]}</strong>{pizarra.datos.confirmado?.[a] && <span className="muted pequeño"> · aceptó el reparto</span>}
                      <div className="muted pequeño">Última corrida: {latidoTexto(pizarra.datos.latidos?.[a])}</div></div></li>
                  ))}
                </ul>
              </>
            )}
          </Card>
          {!!pizarra?.datos.reparto?.length && (
            <Card title="Quién hace qué">
              <ul className="lista-simple reparto">
                {pizarra.datos.reparto.map((r) => (
                  <li key={r.trabajo}><div>
                    <strong>{r.trabajo}</strong>
                    <div className="pequeño"><span className="muted">Claude:</span> {r.claude}</div>
                    <div className="pequeño"><span className="muted">Codex:</span> {r.codex}</div>
                  </div></li>
                ))}
              </ul>
            </Card>
          )}
          {!!pizarra?.datos.debate?.length && (
            <Card title="Cómo debaten una idea">
              <ol className="debate">{pizarra.datos.debate.map((d) => <li key={d}>{d}</li>)}</ol>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
