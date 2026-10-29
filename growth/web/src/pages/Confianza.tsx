import { useMemo, useState } from 'react';
import { Badge, Card, Empty, ErrorBox, Kpi, Loading, PageHeader } from '../components/ui';
import { rpc } from '../lib/api';
import { useAsync } from '../lib/hooks';
import './confianza.css';

// Trabajo protegido: lo que una persona del equipo decide a mano. Reclamos de
// clientes a los que no les terminaron un trabajo: si quiere seguir, hay que
// conseguirle otra persona de su zona antes del plazo (48 h hábiles); si no,
// o si no se consigue a nadie, se le devuelve la cuota.

type Protegido = { id: string; estado: string; quiere_seguir: boolean | null; plazo_reemplazo: string | null; monto: number;
  cuota: number; rubro: string | null; zona: string | null; cliente_nombre: string | null; proveedor_nombre: string | null;
  reclamo_detalle: string | null; presupuesto_id: number | null; created_at: string; reclamada_at: string | null; version: number };

const pesos = (n: number) => '$' + Math.round(Number(n) || 0).toLocaleString('es-AR');
const fecha = (iso: string | null) => iso ? new Date(iso).toLocaleString('es-AR', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/Argentina/Buenos_Aires' }) : '—';

const ESTADOS: Record<string, { txt: string; tono: string }> = {
  activa: { txt: 'Protegido', tono: 'verde' }, cumplida: { txt: 'Terminado y pagado', tono: '' },
  reclamada: { txt: 'Reclamo abierto', tono: 'rojo' }, reemplazo_conseguido: { txt: 'Reemplazo conseguido', tono: 'azul' },
  devolucion_pendiente: { txt: 'Devolviendo la cuota', tono: 'laton' }, devuelta: { txt: 'Cuota devuelta', tono: '' },
};

const TEXTOS: Record<string, string> = {
  reemplazo_conseguido: 'Te conseguimos otra persona de tu zona para terminar el trabajo. Te va a escribir por el chat de Tratto con su presupuesto.',
  devolver_cuota: 'Te devolvemos la cuota de Trabajo protegido por Mercado Pago, a la misma tarjeta.',
  sigue_el_mismo: 'Quien hacía el trabajo se comprometió a terminarlo y estás de acuerdo. La protección sigue activa.',
};
const ACCIONES: Record<string, string> = {
  reemplazo_conseguido: 'Conseguimos a otra persona', devolver_cuota: 'Devolver la cuota', sigue_el_mismo: 'Sigue el mismo',
};

function FichaProtegido({ t, onListo }: { t: Protegido; onListo: () => void }) {
  const [accion, setAccion] = useState<string | null>(null);
  const [texto, setTexto] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const e = ESTADOS[t.estado] ?? { txt: t.estado, tono: '' };
  const vencido = t.estado === 'reclamada' && t.quiere_seguir && t.plazo_reemplazo && new Date(t.plazo_reemplazo) < new Date();
  const posibles = t.estado === 'reclamada'
    ? (t.quiere_seguir ? ['reemplazo_conseguido', 'devolver_cuota', 'sigue_el_mismo'] : ['devolver_cuota', 'sigue_el_mismo'])
    : t.estado === 'activa' ? ['devolver_cuota'] : [];

  const confirmar = async () => {
    setOcupado(true); setError(null);
    try {
      await rpc('soporte_trabajo_protegido', { p_id: t.id, p_accion: accion, p_texto: texto, p_version: t.version });
      onListo();
    } catch (x) { setError(x instanceof Error ? x.message : 'No se pudo guardar.'); setOcupado(false); }
  };

  return <li className={`conf-prot${t.estado === 'reclamada' ? ' abierto' : ''}`}>
    <div className="conf-cab">
      <div>
        <strong>{t.rubro || 'Trabajo'} · {t.zona || 'sin zona'}</strong>
        <small>Cliente: {t.cliente_nombre || '—'} · Hace el trabajo: {t.proveedor_nombre || '—'} · Presupuesto {pesos(t.monto)} · Cuota {pesos(t.cuota)}</small>
      </div>
      <Badge tone={e.tono}>{e.txt}</Badge>
    </div>
    {t.estado === 'reclamada' && <div className="conf-reclamo">
      <p><b>{t.quiere_seguir ? 'Quiere que lo termine otra persona.' : 'No quiere seguir: hay que devolverle la cuota.'}</b>
        {t.quiere_seguir && <> Plazo: <span className={vencido ? 'conf-vencido' : ''}>{fecha(t.plazo_reemplazo)}{vencido ? ' (vencido: corresponde devolver la cuota)' : ''}</span>.</>}</p>
      {t.reclamo_detalle && <p className="muted">«{t.reclamo_detalle}»</p>}
    </div>}
    {accion && <div className="conf-rechazo">
      <label>Qué le decimos al cliente (queda en su reclamo)
        <textarea value={texto} onChange={x => setTexto(x.target.value)} maxLength={2000} rows={3} />
      </label>
      {accion === 'devolver_cuota' && <p className="muted pequeño">La devolución sale sola por Mercado Pago desde la cuenta de Tratto.</p>}
    </div>}
    {error && <p className="conf-error">{error}</p>}
    {posibles.length > 0 && <div className="conf-acciones">
      {!accion
        ? posibles.map(a => <button key={a} className={`btn${a === 'reemplazo_conseguido' ? ' primario' : ''}`} onClick={() => { setAccion(a); setTexto(TEXTOS[a]); }}>{ACCIONES[a]}</button>)
        : <><button className="btn primario" disabled={ocupado || texto.trim().length < 5} onClick={confirmar}>Confirmar: {ACCIONES[accion].toLowerCase()}</button>
            <button className="btn" disabled={ocupado} onClick={() => setAccion(null)}>Volver</button></>}
    </div>}
  </li>;
}

type Arrepentimiento = { id: number; codigo: string; nombre: string; email: string; que: string; referencia: string | null;
  detalle: string | null; estado: string; nota: string | null; created_at: string };

// Botón de arrepentimiento (Resolución 424/2020): hay que responder por mail
// dentro de las 24 horas. Si es Trabajo protegido sin reclamo, se devuelve la
// cuota desde la ficha del trabajo ("Devolver la cuota").
function FichaArrepentimiento({ a, onListo }: { a: Arrepentimiento; onListo: () => void }) {
  const [nota, setNota] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const vence = new Date(new Date(a.created_at).getTime() + 24 * 3600 * 1000);
  const guardar = async () => {
    setError(null);
    try { await rpc('soporte_arrepentimiento_resolver', { p_id: a.id, p_nota: nota }); onListo(); }
    catch (e) { setError(e instanceof Error ? e.message : 'No se pudo guardar.'); }
  };
  return <li className={`conf-prot${a.estado === 'recibido' ? ' abierto' : ''}`}>
    <div className="conf-cab">
      <div>
        <strong>{a.codigo} · {a.que === 'trabajo_protegido' ? 'Trabajo protegido' : 'Otra contratación'}</strong>
        <small>{a.nombre} · <a href={`mailto:${a.email}?subject=${encodeURIComponent('Tu pedido de arrepentimiento ' + a.codigo)}`}>{a.email}</a> · {fecha(a.created_at)}{a.referencia ? ` · Ref. ${a.referencia}` : ''}</small>
      </div>
      <Badge tone={a.estado === 'recibido' ? 'rojo' : ''}>{a.estado === 'recibido' ? `Responder antes del ${fecha(vence.toISOString())}` : 'Resuelto'}</Badge>
    </div>
    {a.detalle && <p className="muted">«{a.detalle}»</p>}
    {a.nota && <p className="muted pequeño">Qué se hizo: {a.nota}</p>}
    {a.estado === 'recibido' && (nota === null
      ? <div className="conf-acciones"><button className="btn" onClick={() => setNota('Le respondimos por mail y ')}>Marcar resuelto</button></div>
      : <div className="conf-rechazo">
          <label>Qué se hizo (queda anotado)
            <textarea value={nota} onChange={e => setNota(e.target.value)} maxLength={2000} rows={2} />
          </label>
          {error && <p className="conf-error">{error}</p>}
          <div className="conf-acciones">
            <button className="btn primario" disabled={nota.trim().length < 3} onClick={guardar}>Guardar</button>
            <button className="btn" onClick={() => setNota(null)}>Volver</button>
          </div>
        </div>)}
  </li>;
}

export default function Confianza() {
  const prot = useAsync(() => rpc<Protegido[]>('soporte_trabajos_protegidos', {}), []);
  const arr = useAsync(() => rpc<Arrepentimiento[]>('soporte_arrepentimientos', {}), []);

  const k = useMemo(() => {
    const filas = prot.data ?? [];
    const cobradas = filas.filter(t => t.estado !== 'devuelta');
    return {
      activos: filas.filter(t => t.estado === 'activa').length,
      abiertos: filas.filter(t => t.estado === 'reclamada' || t.estado === 'devolucion_pendiente').length,
      cobrado: cobradas.reduce((s, t) => s + Number(t.cuota), 0),
      devuelto: filas.filter(t => t.estado === 'devuelta').reduce((s, t) => s + Number(t.cuota), 0),
    };
  }, [prot.data]);

  return <div className="confianza">
    <PageHeader title="Trabajo protegido" desc="Los trabajos que protegieron los clientes y sus reclamos. Lo que decidas acá lo ve el cliente en su reclamo, en la app."
      actions={<button className="btn" onClick={() => { prot.reload(); arr.reload(); }}>Actualizar</button>} />

    <div className="conf-kpis">
      <Kpi label="Cuotas devueltas" value={k.devuelto} raw={pesos(k.devuelto)} />
      <Kpi label="Reclamos abiertos" value={k.abiertos} highlight={k.abiertos > 0} />
      <Kpi label="Trabajos protegidos activos" value={k.activos} />
      <Kpi label="Cuotas cobradas (sin devolver)" value={k.cobrado} raw={pesos(k.cobrado)} />
    </div>

    <Card title="Trabajos protegidos">
      {prot.loading && !prot.data ? <Loading /> : prot.error ? <ErrorBox error={prot.error} onRetry={prot.reload} />
        : !prot.data?.length ? <Empty title="Todavía no hay trabajos protegidos">Aparecen cuando un cliente paga la cuota del 5 %. Los reclamos van primero, ordenados por plazo.</Empty>
        : <ul className="conf-lista">{prot.data.map(t => <FichaProtegido key={t.id + t.version} t={t} onListo={prot.reload} />)}</ul>}
    </Card>

    <Card title="Botón de arrepentimiento">
      {arr.loading && !arr.data ? <Loading /> : arr.error ? <ErrorBox error={arr.error} onRetry={arr.reload} />
        : !arr.data?.length ? <Empty title="No hay pedidos de arrepentimiento">Cuando alguien lo use, te llega un mail y aparece acá. Hay que responderle dentro de las 24 horas.</Empty>
        : <ul className="conf-lista">{arr.data.map(a => <FichaArrepentimiento key={a.id + a.estado} a={a} onListo={arr.reload} />)}</ul>}
    </Card>
  </div>;
}
