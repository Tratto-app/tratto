import { Area, AreaChart, Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { num, pct, rate } from '../lib/format';
import type { FunnelRow } from '../lib/types';

const AX = { stroke: '#74887f', fontSize: 11, fontFamily: 'IBM Plex Mono' };
const TT = { contentStyle: { background: '#172723', border: '1px solid #2e4740', borderRadius: 8, fontSize: 12 }, labelStyle: { color: '#a9bbb3' } };
export const SERIES = ['#2b7e62', '#c9a227', '#7fb1d9', '#b49ae0', '#8fd9bc', '#e07a6b'];

// Funnel horizontal: cada barra es proporcional al primer paso; a la derecha,
// la conversión desde el paso anterior y la caída (dónde se pierde la gente).
export function Funnel({ rows, compare = true }: { rows: FunnelRow[]; compare?: boolean }) {
  if (!rows.length) return null;
  const top = Math.max(1, rows[0].n);
  let peor = -1; let peorCaida = -1;
  rows.forEach((r, i) => {
    if (i === 0) return;
    const prev = rows[i - 1].n;
    const caida = prev ? (prev - r.n) / prev : 0;
    if (prev >= 5 && caida > peorCaida) { peorCaida = caida; peor = i; }
  });
  return (
    <div className="funnel">
      {rows.map((r, i) => {
        const conv = i === 0 ? null : rate(r.n, rows[i - 1].n);
        return (
          <div className="funnel-fila" key={r.stage}>
            <div className="texto-2">{r.label}</div>
            <div className={`funnel-barra ${i === rows.length - 1 ? 'final' : ''}`} title={`${r.label}: ${num(r.n)}`}>
              <i style={{ width: `${Math.max(1.5, (100 * r.n) / top)}%` }} />
              <b>{num(r.n)}</b>
            </div>
            <div className="funnel-meta">
              {conv === null ? 'base' : <span className={i === peor ? 'caida' : ''} title={i === peor ? 'Mayor caída del funnel' : undefined}>{pct(conv)} {i === peor ? '▼' : ''}</span>}
              {compare && r.prev_n !== undefined && <div className="muted">antes: {num(r.prev_n)}</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function Lines({ data, keys, labels, height = 240 }: { data: Record<string, unknown>[]; keys: string[]; labels?: Record<string, string>; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 6, right: 8, left: -18, bottom: 0 }}>
        <defs>
          {keys.map((k, i) => (
            <linearGradient key={k} id={`g-${k}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={SERIES[i % SERIES.length]} stopOpacity={0.35} />
              <stop offset="100%" stopColor={SERIES[i % SERIES.length]} stopOpacity={0} />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid stroke="#233832" vertical={false} />
        <XAxis dataKey="day" tick={AX} tickFormatter={(d: string) => d.slice(5)} minTickGap={18} />
        <YAxis tick={AX} allowDecimals={false} />
        <Tooltip {...TT} />
        <Legend wrapperStyle={{ fontSize: 12 }} formatter={(v: string) => labels?.[v] || v} />
        {keys.map((k, i) => (
          <Area key={k} type="monotone" dataKey={k} name={k} stroke={SERIES[i % SERIES.length]} fill={`url(#g-${k})`} strokeWidth={2} isAnimationActive={false} />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function Bars({ data, x, keys, labels, height = 240, stacked }: { data: Record<string, unknown>[]; x: string; keys: string[]; labels?: Record<string, string>; height?: number; stacked?: boolean }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 6, right: 8, left: -18, bottom: 0 }}>
        <CartesianGrid stroke="#233832" vertical={false} />
        <XAxis dataKey={x} tick={AX} interval={0} angle={data.length > 5 ? -20 : 0} textAnchor={data.length > 5 ? 'end' : 'middle'} height={data.length > 5 ? 50 : 30} />
        <YAxis tick={AX} allowDecimals={false} />
        <Tooltip {...TT} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
        <Legend wrapperStyle={{ fontSize: 12 }} formatter={(v: string) => labels?.[v] || v} />
        {keys.map((k, i) => <Bar key={k} dataKey={k} name={k} fill={SERIES[i % SERIES.length]} radius={[4, 4, 0, 0]} stackId={stacked ? 's' : undefined} isAnimationActive={false} />)}
      </BarChart>
    </ResponsiveContainer>
  );
}
