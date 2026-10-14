import { useId, useMemo, useState } from 'react';
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

// Dibujo del cerebro (vista lateral, la frente a la izquierda): lóbulos, pliegues,
// cerebelo y tronco, con un mapa de calor por zona como el de la herramienta.
const CONTORNO = 'M60 134 C48 100 62 62 96 42 C126 24 168 16 206 24 C244 32 278 56 292 92 C302 118 296 142 280 154 C268 162 252 164 238 160 C228 172 210 180 190 178 C168 186 140 188 120 182 C104 186 88 182 80 172 C70 164 64 150 60 134 Z';
const CEREBELO = 'M214 166 C232 158 268 156 284 168 C296 180 290 202 268 208 C244 214 220 206 212 192 C206 182 206 172 214 166 Z';
const TRONCO = 'M180 168 C184 190 186 206 184 226 L204 226 C202 206 204 188 208 168 Z';
const FISURAS = [
  'M176 22 C170 44 178 62 168 84 C160 102 164 116 158 128',
  'M90 150 C116 140 140 132 166 126 C182 122 194 116 208 104',
  'M108 166 C140 160 172 150 214 136 C232 130 246 126 262 130',
];
const SURCOS = [
  'M76 112 C88 98 84 84 98 72', 'M92 126 C104 116 102 100 116 92 C126 86 124 74 136 66', 'M108 52 C118 62 132 58 142 48',
  'M120 104 C132 98 138 108 150 100 C158 94 156 82 166 76', 'M140 36 C146 48 158 50 160 62', 'M74 140 C82 134 80 124 90 120',
  'M190 40 C196 54 190 66 198 78 C206 90 220 88 226 100', 'M214 34 C222 48 236 50 240 64', 'M236 74 C248 80 262 76 270 86',
  'M196 98 C208 104 222 102 232 112', 'M270 106 C278 116 274 128 284 136', 'M252 140 C262 136 270 144 278 142',
  'M112 176 C130 172 150 174 168 168', 'M178 160 C196 158 212 152 228 150', 'M66 122 C74 112 70 100 78 92',
  'M100 92 C108 84 104 70 116 62', 'M152 112 C160 106 170 110 176 100', 'M246 104 C256 98 262 108 272 100',
];
const FOLIAS = ['M216 176 C236 170 266 170 286 180', 'M212 186 C236 180 266 182 288 192', 'M216 196 C238 192 262 194 282 200', 'M226 204 C244 202 260 204 272 206'];
// Pliegues finos generados con semilla fija: siempre salen iguales.
const GIROS = (() => {
  let x0 = 42;
  const r = () => { x0 = (x0 * 16807) % 2147483647; return (x0 - 1) / 2147483646; };
  const out: string[] = [];
  for (let i = 0; i < 95; i++) {
    let x = 64 + r() * 230, y = 28 + r() * 150, ang = r() * Math.PI * 2;
    let d = `M${x.toFixed(1)} ${y.toFixed(1)}`;
    const n = 3 + Math.floor(r() * 3);
    for (let k = 0; k < n; k++) {
      ang += (r() - 0.5) * 2.2;
      const l = 6 + r() * 8;
      const cx = x + Math.cos(ang) * l * 0.6 + (r() - 0.5) * 6, cy = y + Math.sin(ang) * l * 0.6 + (r() - 0.5) * 6;
      x += Math.cos(ang) * l; y += Math.sin(ang) * l;
      d += ` Q${cx.toFixed(1)} ${cy.toFixed(1)} ${x.toFixed(1)} ${y.toFixed(1)}`;
    }
    out.push(d);
  }
  return out;
})();
// Centro y radio del calor de cada zona (lenguaje: Broca y Wernicke).
const FOCOS: Record<Zona, [number, number, number][]> = {
  atencion: [[132, 74, 42]], foco: [[80, 126, 30]], lenguaje: [[114, 140, 24], [214, 124, 24]],
  auditiva: [[160, 160, 30]], visual: [[272, 116, 34]], memoria: [[202, 172, 26]],
};

// Escala de calor: coral (poco) → latón → amarillo claro (mucho).
function tono(p: number) {
  const t = Math.max(0, Math.min(1, p / 100));
  const st = [[232, 112, 96], [240, 168, 50], [255, 222, 89]];
  const [a, b, k] = t < 0.5 ? [st[0], st[1], t / 0.5] : [st[1], st[2], (t - 0.5) / 0.5];
  return `rgb(${a.map((x, i) => Math.round(x + (b[i] - x) * k)).join(',')})`;
}

function CerebroSvg({ regiones, apagado }: { regiones?: Partial<Record<Zona, number>>; apagado?: boolean }) {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const reg = apagado ? {} : regiones || {};
  const zonas = ZONAS.filter((z) => reg[z.key] !== undefined);
  return (
    <svg viewBox="0 0 320 236" className={`cerebro-svg ${apagado ? 'apagado' : ''}`} role="img"
      aria-label={apagado ? 'Sin análisis todavía' : ZONAS.map((z) => `${z.nombre} ${reg[z.key] ?? 'sin dato'}%`).join(', ')}>
      <defs>
        <radialGradient id={`${id}-sup`} cx="35%" cy="28%" r="80%"><stop offset="0" stopColor="#f3f5f2" /><stop offset=".6" stopColor="#dfe5e1" /><stop offset="1" stopColor="#bac6c0" /></radialGradient>
        <radialGradient id={`${id}-cer`} cx="40%" cy="30%" r="80%"><stop offset="0" stopColor="#dfe5e1" /><stop offset="1" stopColor="#a9b6b0" /></radialGradient>
        <clipPath id={`${id}-clip`}><path d={CONTORNO} /></clipPath>
        <filter id={`${id}-calor`} x="-30%" y="-30%" width="160%" height="160%">
          <feTurbulence type="fractalNoise" baseFrequency="0.045" numOctaves={2} seed={7} result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale={30} xChannelSelector="R" yChannelSelector="G" result="d" />
          <feGaussianBlur in="d" stdDeviation="2.2" />
        </filter>
        <filter id={`${id}-sombra`}><feGaussianBlur stdDeviation="6" /></filter>
        {zonas.flatMap((z) => FOCOS[z.key].map((_, i) => {
          const p = reg[z.key]!;
          return (
            <radialGradient key={`${z.key}${i}`} id={`${id}-${z.key}-${i}`}>
              <stop offset="0" stopColor={tono(p)} stopOpacity={(0.55 + 0.42 * p / 100).toFixed(2)} />
              <stop offset=".55" stopColor={tono(p)} stopOpacity={(0.35 + 0.4 * p / 100).toFixed(2)} />
              <stop offset="1" stopColor={tono(p)} stopOpacity="0" />
            </radialGradient>
          );
        }))}
      </defs>
      <ellipse cx="180" cy="222" rx="110" ry="9" fill="#000" opacity=".35" filter={`url(#${id}-sombra)`} />
      <path d={TRONCO} fill={`url(#${id}-cer)`} stroke="#7f8f88" strokeWidth="1.2" />
      <path d={CEREBELO} fill={`url(#${id}-cer)`} stroke="#7f8f88" strokeWidth="1.2" />
      {FOLIAS.map((d) => <path key={d} d={d} fill="none" stroke="#7f8f88" strokeOpacity=".7" strokeWidth="1.1" strokeLinecap="round" />)}
      <path d={CONTORNO} fill={`url(#${id}-sup)`} />
      <g clipPath={`url(#${id}-clip)`}>
        <g filter={`url(#${id}-calor)`}>
          {zonas.flatMap((z) => FOCOS[z.key].map(([x, y, rr], i) => (
            <circle key={`${z.key}${i}`} cx={x} cy={y} r={(rr * (0.75 + reg[z.key]! / 160)).toFixed(1)} fill={`url(#${id}-${z.key}-${i})`} />
          )))}
        </g>
        {GIROS.map((d) => (
          <g key={d}>
            <path d={d} fill="none" stroke="#fff" strokeOpacity=".55" strokeWidth="1.4" strokeLinecap="round" transform="translate(-.7,-.7)" />
            <path d={d} fill="none" stroke="#6a7c75" strokeOpacity=".55" strokeWidth="1.5" strokeLinecap="round" />
          </g>
        ))}
        {SURCOS.map((d) => <path key={d} d={d} fill="none" stroke="#5f716a" strokeOpacity=".55" strokeWidth="1.8" strokeLinecap="round" />)}
        {FISURAS.map((d) => <path key={d} d={d} fill="none" stroke="#56675f" strokeOpacity=".7" strokeWidth="2.2" strokeLinecap="round" />)}
      </g>
      <path d={CONTORNO} fill="none" stroke="#6f817a" strokeWidth="1.6" />
      {zonas.map((z) => {
        const [x, y] = FOCOS[z.key][0];
        return (
          <g key={z.key} transform={`translate(${x},${y})`}>
            <title>{`${z.nombre}: ${Math.round(reg[z.key]!)}%`}</title>
            <rect x="-13" y="-8" width="26" height="16" rx="8" fill="rgba(14,24,21,.78)" />
            <text y="4" textAnchor="middle" className="cerebro-num">{Math.round(reg[z.key]!)}</text>
          </g>
        );
      })}
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
