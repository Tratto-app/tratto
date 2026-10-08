import { Funnel } from '../components/charts';
import { Card, ErrorBox, Loading, PageHeader } from '../components/ui';
import { rpc } from '../lib/api';
import { num, pct, rate } from '../lib/format';
import { useAsync } from '../lib/hooks';
import { periodLabel } from '../lib/period';
import type { FunnelRow } from '../lib/types';
import { useWs } from '../lib/workspace';

export default function AnalyticsFunnel() {
  const { ws, period, app, kind } = useWs();
  const args = { ws: ws!.id, p_from: period.from, p_to: period.to, p_kind: kind };
  const f = useAsync(() => rpc<FunnelRow[]>('growth_funnel_tipo', args), [ws!.id, period.from, period.to, kind]);
  const a = useAsync(() => rpc<{ stage: string; label: string; n: number }[]>('growth_app_funnel_tipo', args), [ws!.id, period.from, period.to, kind]);

  // Dónde se pierde más gente (con al menos 5 personas en el paso previo)
  const peor = (() => {
    const r = f.data || [];
    let best: { from: FunnelRow; to: FunnelRow; drop: number } | null = null;
    for (let i = 1; i < r.length; i++) {
      if (r[i - 1].n < 5) continue;
      const drop = (r[i - 1].n - r[i].n) / r[i - 1].n;
      if (!best || drop > best.drop) best = { from: r[i - 1], to: r[i], drop };
    }
    return best;
  })();
  const total = f.data?.length ? rate(f.data[f.data.length - 2]?.n, f.data[0].n) : null;

  return (
    <>
      <PageHeader title="Embudo" desc={`Prospectos que entraron en: ${periodLabel(period)}. Cada etapa cuenta a los de esa cohorte que llegaron a ella (o más lejos). "Antes" es el período anterior de igual duración.`} />
      <ErrorBox error={f.error} onRetry={f.reload} />
      <div className="grid g3">
        <Card title="Prospecto → usuario activo" className="span2">{f.data ? <Funnel rows={f.data} /> : !f.error && <Loading />}</Card>
        <Card title="Lectura rápida">
          {!f.data ? (f.error ? null : <Loading />) : (
            <ul className="lista-simple">
              <li><span style={{ flex: 1 }}>De prospecto a activado</span><b className="mono">{pct(total)}</b></li>
              {peor && <li><span style={{ flex: 1 }}>Mayor caída: <b>{peor.from.label} → {peor.to.label}</b></span><b className="mono" style={{ color: 'var(--rojo)' }}>−{pct(peor.drop * 100, 0)}</b></li>}
              <li className="texto-2 pequeño">{peor ? consejo(peor.to.stage) : 'Todavía hay pocos datos para sacar conclusiones.'}</li>
              <li className="muted pequeño">Activación = evento <code>{app?.activation_event || 'first_action'}</code> (se cambia en App Overview).</li>
            </ul>
          )}
        </Card>
      </div>
      <Card title="Dentro de la app (usuarios nuevos del período, vengan o no de un prospecto)" className="mt">
        {!a.data ? (a.error ? null : <Loading />) : <Funnel rows={a.data.map((r) => ({ ...r, prev_n: 0, last_at: null }))} compare={false} />}
        {a.data && a.data[0]?.n === 0 && <p className="muted">La app todavía no mandó eventos en este período.</p>}
      </Card>
      {f.data && <p className="muted pequeño">Total de etapas: {f.data.map((r) => `${r.label} ${num(r.n)}`).join(' · ')}</p>}
    </>
  );
}

function consejo(stage: string): string {
  switch (stage) {
    case 'contacted': return 'Muchos prospectos sin contactar: activá una automatización de bienvenida.';
    case 'replied': return 'Pocos responden: probá otro primer mensaje (mirá qué plantilla convierte más en Analytics).';
    case 'interested': return 'Responden pero no se interesan: revisá la propuesta de valor y las objeciones frecuentes.';
    case 'link_sent': return 'Hay interesados sin link: mandalo apenas muestran interés (la automatización "Interesados" lo hace sola).';
    case 'clicked': return 'No abren el link: mandalo por el mismo canal donde respondieron y con un mensaje corto.';
    case 'installed': return 'Hacen click pero no instalan: revisá la ficha de la tienda (capturas, descripción, reseñas).';
    case 'registered': return 'Instalan pero no se registran: el registro puede ser largo o pedir datos de más.';
    case 'activated': return 'Se registran pero no hacen la primera acción: guialos con un onboarding o un mensaje de ayuda.';
    case 'active': return 'Se activan pero no vuelven: revisá la retención y escribiles a los inactivos.';
    default: return '';
  }
}
