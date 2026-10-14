import { useMemo, useState } from 'react';
import { Badge, Card, Empty, ErrorBox, Loading, PageHeader, Segmented } from '../components/ui';
import { fecha, num } from '../lib/format';
import { useAsync } from '../lib/hooks';
import { supabase } from '../lib/supabase';
import { useWs } from '../lib/workspace';

// Cerebro de las piezas: antes de proponer un video, Redes lo pasa por un
// simulador de respuesta cerebral (Virality Predictor de Higgsfield, hasta 15 s)
// y guarda el resultado en datos.cerebro del item. Acá se ve qué zonas activa
// cada pieza al lado de lo que pasó de verdad (metricas).

type Zona = 'visual' | 'atencion' | 'auditiva' | 'foco' | 'lenguaje' | 'memoria';
interface Analisis {
  estado?: 'hecho' | 'pendiente'; herramienta?: string; fecha?: string; segundos?: string;
  viral?: number; gancho?: number; retencion?: number;
  regiones?: Partial<Record<Zona, number>>;
  informe_url?: string; imagen_url?: string; notas?: string;
  versiones?: (Analisis & { nombre?: string })[];
}
interface Pieza {
  id: string; tipo: string; canal: string | null; titulo: string; estado: string; fecha_objetivo: string | null; created_at: string;
  datos: { cerebro?: Analisis; puntaje?: number };
  metricas: { reproducciones?: number; alcance?: number; likes?: number; comentarios?: number; compartidos?: number; clics_link?: number };
}

const ZONAS: { key: Zona; nombre: string; que: string }[] = [
  { key: 'visual', nombre: 'Visual', que: 'Lo que se ve: movimiento, colores, caras' },
  { key: 'atencion', nombre: 'Atención', que: 'Cuánto engancha y sostiene la mirada' },
  { key: 'auditiva', nombre: 'Auditiva', que: 'Voz, música y sonidos' },
  { key: 'foco', nombre: 'Dispersión del foco', que: 'Momentos en que la atención se va (focus drift)' },
  { key: 'lenguaje', nombre: 'Lenguaje', que: 'Lo que se dice o se lee y se entiende' },
  { key: 'memoria', nombre: 'Memoria', que: 'Lo que queda grabado: marca y mensaje' },
];
const ESTADO: Record<string, string> = {
  para_aprobar: 'Para aprobar', aprobado: 'Aprobado', programado: 'Programado', publicado: 'Publicado', hecho: 'Hecho', cambios: 'Con cambios', borrador: 'Borrador', idea: 'Idea', descartado: 'Descartado',
};
const VIDEOS = ['reel', 'anuncio'];

// Zonas del esquema (vista lateral, la frente a la izquierda).
const FORMAS: Record<Zona, { d: string; lx: number; ly: number }> = {
  atencion: { d: 'M38 58 C40 30 70 14 104 14 C122 14 134 18 142 24 L128 62 L58 74 Z', lx: 88, ly: 40 },
  foco: { d: 'M26 92 C24 76 30 64 38 58 L58 74 L60 104 L34 112 Z', lx: 40, ly: 88 },
  lenguaje: { d: 'M58 74 L128 62 L136 92 L96 104 L60 104 Z', lx: 98, ly: 86 },
  auditiva: { d: 'M60 104 L96 104 L136 92 L150 116 C130 130 96 134 70 128 C56 124 42 120 34 112 Z', lx: 98, ly: 118 },
  memoria: { d: 'M136 92 L128 62 L172 70 L178 104 L150 116 Z', lx: 153, ly: 90 },
  visual: { d: 'M142 24 C172 30 196 52 198 80 C199 92 192 102 178 104 L172 70 L128 62 Z', lx: 172, ly: 58 },
};
// Surcos de adorno, para que se lea como un cerebro.
const SURCOS = [
  'M52 44 C62 50 60 60 70 64', 'M78 26 C84 36 80 46 90 52', 'M108 22 C112 32 106 42 116 50', 'M150 34 C146 44 154 52 150 62',
  'M176 50 C168 58 176 68 170 78', 'M44 96 C52 90 50 82 58 80', 'M74 116 C84 110 92 116 102 110', 'M112 96 C120 88 128 96 134 88',
  'M160 98 C166 90 160 82 168 78', 'M186 92 C180 98 186 104 180 108',
];
const CONTORNO = 'M26 92 C22 60 52 16 104 14 C150 12 194 36 198 80 C200 98 192 108 176 112 C170 126 150 136 120 136 C96 138 70 132 50 122 C36 116 28 106 26 92 Z';

function color(p: number | undefined) {
  if (p === undefined || p === null) return 'rgba(143, 160, 153, 0.12)';
  const a = 0.18 + 0.82 * Math.min(Math.max(p, 0), 100) / 100;
  return `rgba(227, 196, 92, ${a.toFixed(2)})`;
}

function CerebroSvg({ regiones, apagado }: { regiones?: Partial<Record<Zona, number>>; apagado?: boolean }) {
  return (
    <svg viewBox="0 0 224 160" className={`cerebro-svg ${apagado ? 'apagado' : ''}`} role="img"
      aria-label={apagado ? 'Sin análisis todavía' : ZONAS.map((z) => `${z.nombre} ${regiones?.[z.key] ?? 'sin dato'}%`).join(', ')}>
      <defs><clipPath id="cerebro-recorte"><path d={CONTORNO} /></clipPath></defs>
      <g clipPath="url(#cerebro-recorte)">
        {ZONAS.map((z) => (
          <path key={z.key} d={FORMAS[z.key].d} fill={apagado ? 'rgba(143, 160, 153, 0.10)' : color(regiones?.[z.key])} stroke="rgba(14, 24, 21, 0.85)" strokeWidth="1.5" />
        ))}
        {SURCOS.map((d) => <path key={d} d={d} fill="none" stroke="rgba(14, 24, 21, 0.45)" strokeWidth="1.2" strokeLinecap="round" />)}
      </g>
      <path d={CONTORNO} fill="none" stroke="var(--verde-luz)" strokeOpacity="0.55" strokeWidth="1.6" />
      <path d="M150 126 C156 138 166 146 178 146 C186 146 190 140 188 132 C184 122 172 114 160 116" fill="rgba(143, 160, 153, 0.10)" stroke="var(--verde-luz)" strokeOpacity="0.35" strokeWidth="1.2" />
      <path d="M128 136 L132 156" stroke="var(--verde-luz)" strokeOpacity="0.35" strokeWidth="6" strokeLinecap="round" />
      {!apagado && ZONAS.map((z) => regiones?.[z.key] !== undefined && (
        <text key={z.key} x={FORMAS[z.key].lx} y={FORMAS[z.key].ly} className="cerebro-num" textAnchor="middle">{Math.round(regiones![z.key]!)}</text>
      ))}
    </svg>
  );
}

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

  if (loading && !data) return <Loading />;
  if (error) return <ErrorBox error={error} onRetry={reload} />;
  return (
    <>
      <PageHeader
        title="Cerebro de las piezas"
        desc="Antes de proponer un video, Redes lo pasa por un simulador que estima cómo respondería un cerebro (Virality Predictor de Higgsfield, mira los primeros 15 segundos). Acá ves qué zonas activa cada pieza y cómo le fue de verdad. Sirve para elegir entre versiones, no garantiza que algo se haga viral."
        actions={<Segmented value={vista} onChange={setVista} options={[{ key: 'videos', label: 'Videos' }, { key: 'todas', label: 'Todas las piezas' }]} />}
      />
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
