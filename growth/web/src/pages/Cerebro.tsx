import { useMemo, useState } from 'react';
import { CerebroSvg, tono, ZONAS } from '../components/CerebroSvg';
import { ProbarVideo } from '../components/ProbarVideo';
import { Badge, Card, Empty, ErrorBox, Loading, PageHeader, Segmented } from '../components/ui';
import type { Zona } from '../lib/cerebro-core';
import { fecha, num } from '../lib/format';
import { useAsync } from '../lib/hooks';
import { supabase } from '../lib/supabase';
import { useWs } from '../lib/workspace';

// Cerebro de las piezas: arriba se prueba cualquier video (análisis propio y
// gratis, en el navegador); abajo, cada pieza de Redes con su análisis guardado
// en datos.cerebro (lo hace Redes con `node tools/contenido/cli.mjs cerebro` o
// alguien desde acá) al lado de lo que pasó de verdad (metricas).

interface Analisis {
  estado?: 'hecho' | 'pendiente'; herramienta?: string; fecha?: string; segundos?: string;
  viral?: number; gancho?: number; retencion?: number;
  regiones?: Partial<Record<Zona, number>>;
  informe_url?: string; imagen_url?: string; notas?: string; archivo?: string;
  linea?: number[]; consejos?: string[];
  versiones?: (Analisis & { nombre?: string })[];
}
interface Pieza {
  id: string; tipo: string; canal: string | null; titulo: string; estado: string; fecha_objetivo: string | null; created_at: string;
  datos: { cerebro?: Analisis; puntaje?: number };
  metricas: { reproducciones?: number; alcance?: number; likes?: number; comentarios?: number; compartidos?: number; clics_link?: number };
}

const ESTADO: Record<string, string> = {
  para_aprobar: 'Para aprobar', aprobado: 'Aprobado', programado: 'Programado', publicado: 'Publicado', hecho: 'Hecho', cambios: 'Con cambios', borrador: 'Borrador', idea: 'Idea', descartado: 'Descartado',
};
const VIDEOS = ['reel', 'anuncio'];

function Puntaje({ label, valor }: { label: string; valor?: number }) {
  return (
    <div className="cerebro-puntaje">
      <span>{label}</span>
      <strong>{valor === undefined || valor === null ? '—' : Math.round(valor)}</strong>
      <small>/100</small>
    </div>
  );
}

function Tarjeta({ p }: { p: Pieza }) {
  const c = p.datos.cerebro;
  const hecho = c?.estado !== 'pendiente' && (c?.viral !== undefined || c?.gancho !== undefined || !!c?.regiones);
  const m = p.metricas || {};
  const real = m.reproducciones !== undefined || m.alcance !== undefined;
  return (
    <Card className="cerebro-tarjeta" title={<span className="cerebro-titulo">{p.titulo}</span>}
      actions={<Badge tone={p.estado === 'publicado' ? 'verde' : p.estado === 'para_aprobar' ? 'laton' : ''}>{ESTADO[p.estado] || p.estado}</Badge>}>
      <div className="muted pequeño">{[p.tipo, p.canal].filter(Boolean).join(' · ')} · {fecha(p.fecha_objetivo || p.created_at)}</div>
      {hecho && c?.imagen_url
        ? <img className="cerebro-imagen" src={c.imagen_url} alt="Mapa de activación del cerebro que devolvió el análisis" loading="lazy" />
        : <CerebroSvg regiones={c?.regiones} apagado={!hecho} />}
      {hecho ? (
        <>
          <div className="cerebro-puntajes">
            <Puntaje label="Viral" valor={c?.viral} />
            <Puntaje label="Gancho" valor={c?.gancho} />
            <Puntaje label="Retención" valor={c?.retencion} />
          </div>
          <ul className="cerebro-zonas">
            {ZONAS.map((z) => {
              const v = c?.regiones?.[z.key];
              return (
                <li key={z.key} title={z.que}>
                  <span>{z.nombre}</span>
                  <span className="barra"><span style={{ width: `${Math.min(v ?? 0, 100)}%` }} /></span>
                  <span className="valor">{v === undefined ? '—' : `${Math.round(v)}%`}</span>
                </li>
              );
            })}
          </ul>
          {!!c?.linea?.length && (
            <div className="cerebro-mini" title="Atención segundo a segundo">
              {c.linea.map((v, i) => <span key={i} className={i < 3 ? 'gancho' : ''} style={{ height: `${Math.max(6, v)}%`, background: tono(v) }} />)}
            </div>
          )}
          {!!c?.consejos?.length && <div className="pequeño texto-2">→ {c.consejos[0]}{c.consejos.length > 1 ? ` (y ${c.consejos.length - 1} más)` : ''}</div>}
          <div className="muted pequeño">
            {c?.herramienta || 'Virality Predictor'} · {c?.segundos ? `segundos ${c.segundos}` : 'primeros 15 s'}{c?.fecha ? ` · ${fecha(c.fecha)}` : ''}
            {c?.informe_url && <> · <a href={c.informe_url} target="_blank" rel="noreferrer">Ver informe</a></>}
          </div>
          {c?.notas && <div className="pequeño texto-2">{c.notas}</div>}
          {!!c?.versiones?.length && (
            <div className="pequeño texto-2">Versiones probadas: {c.versiones.map((v, i) => `${v.nombre || `versión ${i + 1}`} (gancho ${v.gancho ?? '—'})`).join(' · ')}</div>
          )}
        </>
      ) : (
        <div className="muted pequeño">Sin análisis todavía{c?.notas ? `: ${c.notas}` : '. Se hace antes de dejarla para aprobar.'}</div>
      )}
      <div className="cerebro-real">
        <strong className="pequeño">Lo que pasó de verdad</strong>
        {real
          ? <div className="pequeño">{num(m.reproducciones)} reproducciones · {num(m.alcance)} de alcance · {num(m.likes)} me gusta · {num(m.clics_link)} clics al link</div>
          : <div className="muted pequeño">{p.estado === 'publicado' ? 'Sin números todavía.' : 'Todavía no se publicó.'}</div>}
      </div>
    </Card>
  );
}

export default function Cerebro() {
  const { ws } = useWs();
  const [vista, setVista] = useState<'videos' | 'todas'>('videos');
  const { data, error, loading, reload } = useAsync(async () => {
    const r = await supabase.from('growth_mkt_items').select('id,tipo,canal,titulo,estado,fecha_objetivo,created_at,datos,metricas')
      .eq('workspace_id', ws!.id).eq('departamento', 'redes').in('tipo', ['reel', 'anuncio', 'carrusel', 'post', 'historia'])
      .neq('estado', 'descartado').order('created_at', { ascending: false }).limit(120);
    if (r.error) throw new Error(r.error.message);
    return (r.data || []) as Pieza[];
  }, [ws?.id]);
  const piezas = useMemo(() => (data || []).filter((p) => vista === 'todas' || VIDEOS.includes(p.tipo)), [data, vista]);
  const conAnalisis = piezas.filter((p) => p.datos.cerebro && p.datos.cerebro.estado !== 'pendiente').length;
  const opciones = useMemo(() => (data || []).filter((p) => VIDEOS.includes(p.tipo)).map((p) => ({
    id: p.id, etiqueta: `${p.titulo} · ${p.canal || p.tipo} · ${ESTADO[p.estado] || p.estado}`,
  })), [data]);

  if (loading && !data) return <Loading />;
  if (error) return <ErrorBox error={error} onRetry={reload} />;
  return (
    <>
      <PageHeader
        title="Cerebro de las piezas"
        desc="Subí un video y mirá qué zonas activaría, cuánto engancha el arranque y cuánta gente seguiría mirando, segundo a segundo. Es un análisis propio y gratis por señales del video; sirve para elegir entre versiones antes de publicar, no garantiza que algo se haga viral."
        actions={<Segmented value={vista} onChange={setVista} options={[{ key: 'videos', label: 'Videos' }, { key: 'todas', label: 'Todas las piezas' }]} />}
      />
      <ProbarVideo opciones={opciones} onGuardado={reload} />
      <h2 className="cerebro-seccion">Piezas de la cola</h2>
      <div className="fila muted pequeño" style={{ marginBottom: 12 }}>
        <span>{conAnalisis} de {piezas.length} con análisis</span>
        <span className="cerebro-leyenda"><span className="frio" /> menos activación <span className="calido" /> más activación</span>
      </div>
      {piezas.length === 0
        ? <Empty title="Todavía no hay piezas">Cuando Redes arme videos, aparecen acá con su cerebro.</Empty>
        : <div className="cerebro-grilla">{piezas.map((p) => <Tarjeta key={p.id} p={p} />)}</div>}
    </>
  );
}
