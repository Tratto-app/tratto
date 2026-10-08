import { useMemo, useState } from 'react';
import { Badge, Card, Empty, ErrorBox, Field, Kpi, Loading, Modal, PageHeader, Segmented } from '../components/ui';
import { rpc } from '../lib/api';
import { ars, fecha, hace, num } from '../lib/format';
import { useAsync } from '../lib/hooks';
import { supabase } from '../lib/supabase';
import { useWs } from '../lib/workspace';

// Equipo de marketing: un CMO y cinco departamentos que trabajan con Claude Code
// (skill equipo-marketing + subagentes mkt-*). Ellos dejan su trabajo en la cola
// (growth_mkt_items); acá la persona lo aprueba, pide cambios o lo descarta.

type Depto = 'cmo' | 'redes' | 'seo_local' | 'contenido' | 'anuncios' | 'operaciones';
type Estado = 'idea' | 'borrador' | 'para_aprobar' | 'cambios' | 'aprobado' | 'programado' | 'publicado' | 'hecho' | 'descartado';

interface Item {
  id: string; departamento: Depto; tipo: string; titulo: string; resumen: string | null; cuerpo: string | null;
  canal: string | null; estado: Estado; prioridad: number; fecha_objetivo: string | null; link_slug: string | null;
  url: string | null; datos: Record<string, unknown>; metricas: Record<string, unknown>; comentario: string | null;
  creado_por: string; aprobado_at: string | null; created_at: string; updated_at: string;
}
interface Tablero {
  periodo: { nuevos: number; registros: number; activados: number; mails_enviados: number; mails_fallidos: number; clicks: number; gasto: number };
  totales: { contactos: number; con_permiso: number; bajas: number; registrados: number; activados: number };
  por_fuente: { fuente: string; nuevos: number; registros: number; activados: number; gasto: number; costo_por_registro: number | null }[];
  por_entrada: Record<string, number>;
  envios_pausados: boolean | null;
}

const DEPTOS: { key: Exclude<Depto, 'cmo'>; nombre: string; hace: string; con: string[]; mano?: string[] }[] = [
  { key: 'redes', nombre: 'Redes', hace: 'Reels, carruseles e historias para TikTok e Instagram. Los programa y trae los resultados.', con: ['Metricool', 'Canva', 'Videos'] },
  { key: 'seo_local', nombre: 'SEO local', hace: 'Que aparezcamos cuando alguien busca un servicio en su zona: páginas de precios, perfil de Google, reseñas.', con: ['Web', 'Sitemap'], mano: ['Perfil de Google'] },
  { key: 'contenido', nombre: 'Contenido', hace: 'Guías útiles, promociones y el mail de novedades para quienes dieron permiso.', con: ['Web', 'CRM'] },
  { key: 'anuncios', nombre: 'Anuncios', hace: 'Campañas de Meta y Google listas para cargar, con links por anuncio. Mide el costo por registro.', con: ['CRM'], mano: ['Meta Ads', 'Google Ads'] },
  { key: 'operaciones', nombre: 'Operaciones', hace: 'El CRM: mails automáticos, seguimientos para que nadie se enfríe, bajas y salud de los envíos.', con: ['CRM', 'Brevo'] },
];
const NOMBRE: Record<Depto, string> = { cmo: 'CMO', redes: 'Redes', seo_local: 'SEO local', contenido: 'Contenido', anuncios: 'Anuncios', operaciones: 'Operaciones' };
const ESTADO: Record<Estado, { label: string; tone: string }> = {
  idea: { label: 'Idea', tone: '' }, borrador: { label: 'Borrador', tone: '' }, para_aprobar: { label: 'Para aprobar', tone: 'laton' },
  cambios: { label: 'Con cambios pedidos', tone: 'violeta' }, aprobado: { label: 'Aprobado', tone: 'verde' }, programado: { label: 'Programado', tone: 'azul' },
  publicado: { label: 'Publicado', tone: 'verde' }, hecho: { label: 'Hecho', tone: 'verde' }, descartado: { label: 'Descartado', tone: 'mock' },
};
const TIPO: Record<string, string> = {
  informe: 'Informe', plan: 'Plan', tarea: 'Tarea', reel: 'Reel', carrusel: 'Carrusel', historia: 'Historias', post: 'Post', articulo: 'Guía',
  pagina: 'Página', anuncio: 'Anuncio', campania: 'Campaña', mail: 'Mail', automatizacion: 'Automatización', respuesta: 'Respuesta', aprendizaje: 'Aprendizaje', alerta: 'Alerta',
};
const VISTAS = [
  { key: 'curso', label: 'En curso', estados: ['cambios', 'aprobado', 'programado'] },
  { key: 'ideas', label: 'Pedidos e ideas', estados: ['idea', 'borrador'] },
  { key: 'listo', label: 'Publicado y hecho', estados: ['publicado', 'hecho'] },
  { key: 'descartado', label: 'Descartado', estados: ['descartado'] },
] as const;
type VistaKey = (typeof VISTAS)[number]['key'];

export default function Equipo() {
  const { ws, toast, kind } = useWs();
  const [dias, setDias] = useState<'7' | '28'>('7');
  const [depto, setDepto] = useState<Depto | null>(null);
  const [vista, setVista] = useState<VistaKey>('curso');
  const [pedido, setPedido] = useState(false);

  const data = useAsync(async () => {
    const [items, tablero] = await Promise.all([
      supabase.from('growth_mkt_items').select('*').eq('workspace_id', ws!.id).order('created_at', { ascending: false }).limit(300),
      rpc<Tablero>('mkt_tablero_tipo', { p_ws: ws!.id, p_dias: Number(dias), p_kind: kind }),
    ]);
    if (items.error) throw new Error(items.error.message);
    return { items: (items.data || []) as Item[], tablero };
  }, [ws!.id, dias, kind]);

  const items = data.data?.items || [];
  const t = data.data?.tablero;
  const informe = items.find((i) => i.departamento === 'cmo' && i.tipo === 'informe');
  const filtro = (i: Item) => !depto || i.departamento === depto;
  const paraAprobar = items.filter((i) => i.estado === 'para_aprobar' && filtro(i))
    .sort((a, b) => a.prioridad - b.prioridad || (a.fecha_objetivo || '9').localeCompare(b.fecha_objetivo || '9'));
  const cola = items.filter((i) => (VISTAS.find((v) => v.key === vista)!.estados as readonly string[]).includes(i.estado) && filtro(i) && !(i.tipo === 'informe' && i.departamento === 'cmo'));

  const cuenta = useMemo(() => {
    const c: Record<string, { aprobar: number; curso: number; hechos: number; ultimo: string | null }> = {};
    for (const d of [...DEPTOS.map((x) => x.key), 'cmo']) c[d] = { aprobar: 0, curso: 0, hechos: 0, ultimo: null };
    const mes = Date.now() - 30 * 86_400_000;
    for (const i of items) {
      const x = c[i.departamento];
      if (i.estado === 'para_aprobar') x.aprobar++;
      else if (['cambios', 'aprobado', 'programado'].includes(i.estado)) x.curso++;
      else if (['publicado', 'hecho'].includes(i.estado) && new Date(i.updated_at).getTime() > mes) x.hechos++;
      if (!x.ultimo || i.updated_at > x.ultimo) x.ultimo = i.updated_at;
    }
    return c;
  }, [items]);

  const cambiar = async (i: Item, estado: Estado, comentario?: string) => {
    const cambios: Partial<Item> = { estado };
    if (comentario !== undefined) cambios.comentario = comentario;
    const { error } = await supabase.from('growth_mkt_items').update(cambios).eq('id', i.id);
    if (error) { toast(error.message, true); return; }
    toast(estado === 'aprobado' ? 'Aprobado: el equipo lo ejecuta en la próxima corrida.' : estado === 'cambios' ? 'Listo, el equipo lo rehace con tu comentario.' : 'Descartado.');
    data.reload();
  };

  return (
    <>
      <PageHeader title="Equipo de marketing"
        desc="Un CMO y cinco departamentos que trabajan con Claude Code, todos los días. Ellos preparan; vos aprobás. Nada se publica, se envía ni se gasta sin tu OK."
        actions={<>
          <Segmented value={dias} onChange={setDias} options={[{ key: '7', label: '7 días' }, { key: '28', label: '28 días' }]} />
          <button className="btn primario" onClick={() => setPedido(true)}>+ Pedido al equipo</button>
        </>} />
      <ErrorBox error={data.error} onRetry={data.reload} />
      {!data.data ? (data.error ? null : <Loading />) : (
        <>
          <section className="organigrama" aria-label="Organigrama del equipo">
            <button className={`nodo cmo ${depto === 'cmo' ? 'activo' : ''}`} onClick={() => setDepto(depto === 'cmo' ? null : 'cmo')}>
              <span className="nodo-sello" aria-hidden="true">CMO</span>
              <span className="nodo-texto">
                <strong>Director de marketing</strong>
                <span>Lee los números del CRM, arma el plan de la semana, reparte el trabajo y te escribe el informe.</span>
                <span className="mono pequeño">{informe ? `Último informe ${hace(informe.created_at)}` : 'Todavía sin informe'} · en Claude Code: <b>/equipo-marketing</b></span>
              </span>
            </button>
            <div className="ramas" aria-hidden="true"><i /></div>
            <div className="deptos">
              {DEPTOS.map((d) => {
                const c = cuenta[d.key];
                return (
                  <button key={d.key} className={`nodo ${depto === d.key ? 'activo' : ''}`} onClick={() => setDepto(depto === d.key ? null : d.key)} aria-pressed={depto === d.key}>
                    <span className="nodo-cab"><strong>{d.nombre}</strong>{c.aprobar > 0 && <span className="sello-n" title="Para aprobar">{c.aprobar}</span>}</span>
                    <span className="nodo-hace">{d.hace}</span>
                    <span className="chips">
                      {d.con.map((x) => <Badge key={x} tone="verde">{x}</Badge>)}
                      {d.mano?.map((x) => <Badge key={x} tone="mock" title="Sin conexión: el equipo lo deja listo y lo cargás vos">{x} · a mano</Badge>)}
                    </span>
                    <span className="nodo-pie mono">{num(c.curso)} en curso · {num(c.hechos)} hechos en 30 días</span>
                  </button>
                );
              })}
            </div>
          </section>

          {t && (
            <div className="grid g6 mt">
              <Kpi label="Contactos nuevos" value={t.periodo.nuevos} help="Personas que entraron al CRM en el período (calculadora, registro, pedidos)." />
              <Kpi label="Registros" value={t.periodo.registros} highlight />
              <Kpi label="Primer pedido" value={t.periodo.activados} help="Activaciones: primer pedido o servicio publicado." />
              <Kpi label="Mails enviados" value={t.periodo.mails_enviados} help={t.periodo.mails_fallidos ? `${t.periodo.mails_fallidos} fallaron` : undefined} />
              <Kpi label="Clicks en links" value={t.periodo.clicks} />
              <Kpi label="Gasto en anuncios" value={t.periodo.gasto} format={ars} help="Lo que cargues en Fuentes. Sin gasto cargado no hay costo por registro." />
            </div>
          )}

          <div className="grid g2 mt">
            <Card title={`Para aprobar${depto ? ` · ${NOMBRE[depto]}` : ''}`} actions={depto && <button className="btn chico fantasma" onClick={() => setDepto(null)}>Ver todo</button>}>
              {paraAprobar.length === 0
                ? <Empty title="Nada para aprobar">Cuando el equipo prepare algo (una pieza, una campaña, un mail) aparece acá.</Empty>
                : paraAprobar.map((i) => <Pieza key={i.id} i={i} onCambiar={cambiar} />)}
            </Card>
            <Card title="Informe del CMO" actions={informe && <span className="muted pequeño">{fecha(informe.created_at, true)}</span>}>
              {informe ? (
                <>
                  <h2 style={{ marginBottom: 6 }}>{informe.titulo}</h2>
                  {informe.resumen && <p className="texto-2" style={{ marginTop: 0 }}>{informe.resumen}</p>}
                  <div className="texto-largo">{informe.cuerpo}</div>
                </>
              ) : <Empty title="Todavía no hay informe">El CMO escribe el plan cada lunes y lo deja acá. También lo podés pedir cuando quieras en Claude Code con <b>/equipo-marketing semanal</b>.</Empty>}
            </Card>
          </div>

          {t && t.por_fuente.length > 0 && (
            <Card title="De dónde vino la gente" className="mt">
              <div className="tabla-wrap">
                <table>
                  <thead><tr><th>Medio</th><th className="num">Nuevos</th><th className="num">Registros</th><th className="num">Primer pedido</th><th className="num">Gasto</th><th className="num">Costo por registro</th></tr></thead>
                  <tbody>
                    {t.por_fuente.map((f) => (
                      <tr key={f.fuente}><td>{f.fuente}</td><td className="num mono">{num(f.nuevos)}</td><td className="num mono">{num(f.registros)}</td><td className="num mono">{num(f.activados)}</td>
                        <td className="num mono">{f.gasto ? ars(f.gasto) : '—'}</td><td className="num mono">{f.costo_por_registro ? ars(f.costo_por_registro) : '—'}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="muted pequeño" style={{ marginBottom: 0 }}>
                {num(t.totales.contactos)} contactos en total · {num(t.totales.con_permiso)} con permiso para recibir mails · {num(t.totales.bajas)} bajas
                {t.envios_pausados ? ' · los envíos están pausados' : ''}
              </p>
            </Card>
          )}

          <Card className="mt cola-equipo" title={`Trabajo del equipo${depto ? ` · ${NOMBRE[depto]}` : ''}`} actions={<Segmented value={vista} onChange={setVista} options={VISTAS.map((v) => ({ key: v.key, label: v.label }))} />}>
            {cola.length === 0 ? <div className="muted">No hay nada en esta vista.</div> : cola.map((i) => <Pieza key={i.id} i={i} onCambiar={cambiar} />)}
          </Card>
        </>
      )}
      {pedido && <NuevoPedido onClose={() => setPedido(false)} onDone={() => { setPedido(false); data.reload(); toast('Pedido cargado: el CMO lo toma en la próxima corrida.'); }} />}
    </>
  );
}

const autor = (c: string) => (c === 'persona' ? 'Pedido tuyo' : c.startsWith('agente:') ? NOMBRE[c.slice(7) as Depto] || c.slice(7) : c);

function Pieza({ i, onCambiar }: { i: Item; onCambiar: (i: Item, e: Estado, c?: string) => void }) {
  const [abierto, setAbierto] = useState(false);
  const [pidiendo, setPidiendo] = useState(false);
  const [texto, setTexto] = useState('');
  const est = ESTADO[i.estado];
  const metricas = Object.entries(i.metricas || {}).filter(([, v]) => typeof v === 'number' || typeof v === 'string');
  return (
    <article className={`pieza ${i.prioridad === 1 ? 'urgente' : ''}`}>
      <div className="fila pequeño">
        <Badge>{NOMBRE[i.departamento]}</Badge>
        <Badge tone={i.tipo === 'alerta' ? 'rojo' : ''}>{TIPO[i.tipo] || i.tipo}</Badge>
        {i.canal && <span className="muted">{i.canal}</span>}
        {i.fecha_objetivo && <span className="mono muted">{fecha(i.fecha_objetivo, true)}</span>}
        <span style={{ marginLeft: 'auto' }}><Badge tone={est.tone}>{est.label}</Badge></span>
      </div>
      <h4>{i.titulo}</h4>
      {i.resumen && <p className="texto-2">{i.resumen}</p>}
      {i.comentario && <p className="comentario"><b>Tu comentario:</b> {i.comentario}</p>}
      {metricas.length > 0 && <div className="chips">{metricas.map(([k, v]) => <Badge key={k} tone="azul">{k.replace(/_/g, ' ')}: {typeof v === 'number' ? num(v) : String(v)}</Badge>)}</div>}
      {abierto && i.cuerpo && <div className="texto-largo">{i.cuerpo}</div>}
      <div className="fila" style={{ marginTop: 8 }}>
        {i.cuerpo && <button className="btn chico fantasma" onClick={() => setAbierto(!abierto)}>{abierto ? 'Ocultar' : 'Ver completo'}</button>}
        {i.url && /^https:\/\//.test(i.url) && <a className="btn chico fantasma" href={i.url} target="_blank" rel="noreferrer">Abrir</a>}
        {i.link_slug && <span className="mono muted pequeño">link: {i.link_slug}</span>}
        <span className="muted pequeño" style={{ marginLeft: 'auto' }}>{autor(i.creado_por)} · {hace(i.created_at)}</span>
      </div>
      {i.estado === 'para_aprobar' && !pidiendo && (
        <div className="fila" style={{ marginTop: 8 }}>
          <button className="btn primario chico" onClick={() => onCambiar(i, 'aprobado')}>Aprobar</button>
          <button className="btn chico" onClick={() => setPidiendo(true)}>Pedir cambios</button>
          <button className="btn chico peligro" onClick={() => onCambiar(i, 'descartado')}>Descartar</button>
        </div>
      )}
      {pidiendo && (
        <div style={{ marginTop: 8 }}>
          <textarea rows={3} value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="¿Qué cambiarías? Ej.: más corto, otro rubro, sin precio…" style={{ width: '100%' }} autoFocus />
          <div className="fila" style={{ marginTop: 6 }}>
            <button className="btn primario chico" disabled={!texto.trim()} onClick={() => onCambiar(i, 'cambios', texto.trim())}>Enviar al equipo</button>
            <button className="btn chico fantasma" onClick={() => setPidiendo(false)}>Cancelar</button>
          </div>
        </div>
      )}
    </article>
  );
}

function NuevoPedido({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const { ws } = useWs();
  const [f, setF] = useState({ departamento: 'cmo' as Depto, titulo: '', detalle: '', prioridad: 2 });
  const [error, setError] = useState<string | null>(null);
  const guardar = async () => {
    if (!f.titulo.trim()) return setError('Escribí qué necesitás.');
    const { error: e } = await supabase.from('growth_mkt_items').insert({
      workspace_id: ws!.id, departamento: f.departamento, tipo: 'tarea', titulo: f.titulo.trim().slice(0, 200),
      cuerpo: f.detalle.trim() || null, estado: 'idea', prioridad: f.prioridad, creado_por: 'persona',
    });
    if (e) setError(e.message); else onDone();
  };
  return (
    <Modal title="Pedido al equipo" onClose={onClose} footer={<><button className="btn" onClick={onClose}>Cancelar</button><button className="btn primario" onClick={guardar}>Cargar pedido</button></>}>
      <ErrorBox error={error} />
      <div className="grid">
        <Field label="Para"><select value={f.departamento} onChange={(e) => setF({ ...f, departamento: e.target.value as Depto })}>
          <option value="cmo">El CMO (que decida quién)</option>
          {DEPTOS.map((d) => <option key={d.key} value={d.key}>{d.nombre}</option>)}
        </select></Field>
        <Field label="Qué necesitás"><input value={f.titulo} onChange={(e) => setF({ ...f, titulo: e.target.value })} placeholder="Ej.: un reel sobre cuánto sale un flete" autoFocus /></Field>
        <Field label="Detalle (opcional)"><textarea rows={4} value={f.detalle} onChange={(e) => setF({ ...f, detalle: e.target.value })} placeholder="Para quién es, qué rubro, fecha, presupuesto, ideas…" /></Field>
        <Field label="Prioridad"><select value={f.prioridad} onChange={(e) => setF({ ...f, prioridad: Number(e.target.value) })}>
          <option value={1}>Alta</option><option value={2}>Normal</option><option value={3}>Cuando se pueda</option>
        </select></Field>
      </div>
      <p className="muted pequeño">El equipo lo toma en la próxima corrida (todos los días a la mañana) y te deja lo que prepare en "Para aprobar".</p>
    </Modal>
  );
}
