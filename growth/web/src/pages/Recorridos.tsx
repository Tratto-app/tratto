import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge, Card, ErrorBox, Kpi, Loading, PageHeader } from '../components/ui';
import { useAsync } from '../lib/hooks';
import { supabase } from '../lib/supabase';
import { useWs } from '../lib/workspace';
import { actividad, barriosPendientes, contactosDelCanal, ETAPAS, fechaInicial, fechaLocal, normalizar, objeto, ordenRubros, planDelDia, RECORRIDO_ID, regionDe, texto, zonasContadas, type CanalRecorrido, type ContactoRecorrido, type DiaRecorrido, type PoliticaGeografica, type Region, type RubroRecorrido } from '../lib/recorridos';
import './recorridos.css';

async function cargarContactos(ws: string): Promise<ContactoRecorrido[]> {
  const rows = new Map<string, ContactoRecorrido>();
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await supabase.from('growth_prospects')
      .select('id,rubro,zona,city,entrada,status,tags,contacted_at,datos')
      .eq('workspace_id', ws).in('entrada', ['prospeccion', 'whatsapp_manual']).order('id').range(offset, offset + 499);
    if (error) throw error;
    for (const p of (data || []) as ContactoRecorrido[]) rows.set(p.id, p);
    if (!data || data.length < 500) return [...rows.values()];
  }
}
async function cargarDias(ws: string): Promise<DiaRecorrido[]> {
  const rows: DiaRecorrido[] = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await supabase.from('growth_mkt_items').select('id,titulo,estado,datos')
      .eq('workspace_id', ws).eq('datos->>clave', 'recorrido_contactos_dia')
      .eq('datos->>recorrido_id', RECORRIDO_ID).order('id').range(offset, offset + 499);
    if (error) throw error;
    rows.push(...(data || []) as DiaRecorrido[]);
    if (!data || data.length < 500) return rows;
  }
}
function mostrarFecha(v: string): string {
  if (!v) return 'Sin actividad';
  const dia = v.length === 10 ? v : fechaLocal(v);
  return dia ? dia.split('-').reverse().join('/') : 'Sin fecha';
}

export default function Recorridos({ canal }: { canal: CanalRecorrido }) {
  const { ws } = useWs();
  const [zona, setZona] = useState<Region | 'Todas'>('CABA');
  const [busqueda, setBusqueda] = useState('');
  const [filtro, setFiltro] = useState('todos');
  const [hoy, setHoy] = useState(() => fechaLocal(new Date()));
  const { data, error, loading, reload } = useAsync(async () => {
    if (!ws) return null;
    const [contactos, dias, rubros, politica] = await Promise.all([
      cargarContactos(ws.id), cargarDias(ws.id),
      supabase.from('growth_mkt_rotacion').select('orden,rubro,activo,enviados,ultima_vez').eq('workspace_id', ws.id).eq('activo', true).order('orden'),
      supabase.from('growth_mkt_ajustes').select('valor').eq('workspace_id', ws.id).eq('clave', 'prospeccion_geografia').maybeSingle(),
    ]);
    if (rubros.error) throw rubros.error;
    if (politica.error) throw politica.error;
    return { contactos, dias, rubros: (rubros.data || []) as RubroRecorrido[], politica: objeto(politica.data?.valor) as PoliticaGeografica, actualizado: new Date() };
  }, [ws?.id]);
  useEffect(() => {
    const id = window.setInterval(() => { setHoy(fechaLocal(new Date())); reload(); }, 60_000);
    return () => window.clearInterval(id);
  }, [reload]);
  const modelo = useMemo(() => {
    if (!data) return null;
    const contactos = contactosDelCanal(data.contactos, canal);
    const caba = contactos.filter(p => regionDe(p) === 'CABA');
    const elegidos = zona === 'Todas' ? contactos : contactos.filter(p => regionDe(p) === zona);
    const deHoy = contactos.filter(p => fechaLocal(fechaInicial(p, canal).length === 10 ? `${fechaInicial(p, canal)}T12:00:00Z` : fechaInicial(p, canal)) === hoy);
    const filas = ordenRubros(data.rubros, canal).map(r => {
      const propios = elegidos.filter(p => normalizar(p.rubro || '') === normalizar(r.rubro));
      return { ...r, contactos: propios, a: actividad(propios, canal) };
    }).filter(r => (!busqueda || normalizar(r.rubro).includes(normalizar(busqueda))) && (filtro === 'todos' || (filtro === 'actividad' ? r.a.iniciales > 0 : r.a.iniciales === 0)));
    return { contactos, caba, elegidos, filas, hoy: actividad(deHoy, canal), hoyCaba: deHoy.filter(p => regionDe(p) === 'CABA').length, total: actividad(contactos, canal), actual: planDelDia(data.dias, canal, hoy) };
  }, [data, canal, zona, busqueda, filtro, hoy]);
  const mail = canal === 'gmail';
  if (loading && !data) return <Loading />;
  if (error) return <ErrorBox error={error} onRetry={reload} />;
  if (!data || !modelo) return <Loading />;
  const actual = texto(modelo.actual.rubro) || 'Sin rubro programado';
  const activa = data.politica.zona_actual || 'Sin zona configurada';
  return <div className="recorridos">
    <PageHeader title={`Recorrido por ${mail ? 'Mail' : 'WhatsApp'}`} desc={mail ? 'Rubros en orden del 1 al 46. Primeros contactos y recordatorios se cuentan por separado.' : 'Rubros en orden del 46 al 1. Listas preparadas para contacto manual.'}
      actions={<button className="btn" disabled={loading} onClick={reload}>{loading ? 'Actualizando…' : 'Actualizar'}</button>} />
    <nav className="recorrido-canales" aria-label="Recorridos de contacto">
      <Link className={mail ? 'activo' : ''} to="/recorridos/mail">Por Mail</Link><Link className={!mail ? 'activo' : ''} to="/recorridos/whatsapp">Por WhatsApp</Link>
    </nav>
    <Card className="recorrido-actual">
      <div><Badge tone="verde">Zona actual: {activa}</Badge><h2>Hoy · {mostrarFecha(hoy)}</h2><p className="recorrido-rubro-hoy">{actual}</p>
        <p className="muted">Datos nuevos sólo de CABA. Las zonas siguientes quedan pendientes hasta que avancemos a esa etapa.</p></div>
      <div className="recorrido-hoy-num"><strong>{modelo.hoy.iniciales}</strong><span>{mail ? 'primeros contactos hoy' : 'contactos en listas de hoy'}</span>
        <small>{modelo.hoyCaba} en CABA · El total de hoy conserva la actividad anterior al cambio de zona.</small>
        {!mail && <small>Contacto manual: {modelo.hoy.confirmados ? `${modelo.hoy.confirmados} confirmados` : 'sin confirmación registrada'}</small>}
        {mail && <small>Recordatorio 18:30 · {texto(objeto(modelo.actual.recontacto).estado) === 'enviado' ? 'ver resultado del día' : 'según tarea del día'}</small>}
      </div>
    </Card>
    <div className="recorrido-etapas" aria-label="Etapas geográficas">
      {ETAPAS.map((r, i) => <div key={r} className={r === activa ? 'activa' : ''}><span className="recorrido-paso">{i + 1}</span><div><strong>{r}</strong><small>{r === activa ? 'En curso · única zona habilitada' : 'Pendiente · etapa posterior'}</small></div></div>)}
    </div>
    <div className="recorrido-kpis">
      <Kpi label={mail ? 'Primeros contactos · historial' : 'Contactos listados · historial'} value={modelo.total.iniciales} />
      <Kpi label={mail ? 'Primeros contactos en CABA' : 'Contactos listados en CABA'} value={modelo.caba.length} highlight />
      <Kpi label={mail ? 'Recordatorios registrados' : 'Contactos manuales confirmados'} value={mail ? modelo.total.recordatorios : modelo.total.confirmados} />
      <Kpi label={mail ? 'Rubros con envíos en CABA' : 'Rubros con lista en CABA'} value={new Set(modelo.caba.map(p => p.rubro)).size} raw={`${new Set(modelo.caba.map(p => p.rubro)).size} / ${data.rubros.length}`} />
    </div>
    <p className="muted pequeño">{mail ? 'Envíos registrados en CRM con hilo y fecha. “Sin rebote observado” no confirma entrega final. Las demoras siguen pendientes.' : 'Entregar una lista o abrir un enlace no acredita un envío. Los contactos se cuentan sólo con confirmación manual registrada.'} El historial conserva los contactos anteriores de Provincia.</p>
    <Card title="Todos los rubros">
      <div className="recorrido-filtros">
        <label>Buscar rubro<input value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Ej. Carpintería" /></label>
        <label>Zona del historial<select value={zona} onChange={e => setZona(e.target.value as Region | 'Todas')}><option value="Todas">Todas las zonas</option>{[...ETAPAS, 'Otras zonas', 'Sin zona precisa'].map(r => <option key={r}>{r}</option>)}</select></label>
        <label>Mostrar<select value={filtro} onChange={e => setFiltro(e.target.value)}><option value="todos">Todos los rubros</option><option value="actividad">Con actividad registrada</option><option value="pendientes">Sin actividad registrada</option></select></label>
      </div>
      <p className="muted pequeño">{modelo.filas.length} rubros · {zona}. Tener contactos en una zona no significa haberla cubierto completa.</p>
      <div className="recorrido-lista">
        {modelo.filas.map(r => {
          const proximo = data.dias.filter(d => texto(d.datos.fecha) >= hoy && objeto(d.datos[mail ? 'gmail' : 'whatsapp']).orden === r.orden).sort((a, b) => texto(a.datos.fecha).localeCompare(texto(b.datos.fecha)))[0];
          return <details key={r.orden} className="recorrido-item">
            <summary><span className="recorrido-orden">{r.orden.toString().padStart(2, '0')}</span><div className="recorrido-nombre"><strong>{r.rubro}</strong><small>{r.a.iniciales ? `Última actividad: ${mostrarFecha(r.a.ultima)}` : 'Sin actividad en esta zona'}{proximo && ` · Próximo: ${mostrarFecha(texto(proximo.datos.fecha))}`}</small></div>
              <div className="recorrido-cantidad"><strong>{r.a.iniciales}</strong><small>{mail ? 'primeros contactos' : 'en listas'}</small></div>
              <Badge tone={r.a.iniciales ? 'verde' : ''}>{r.a.iniciales ? mail ? 'Con envíos' : 'Lista entregada' : 'Pendiente'}</Badge></summary>
            <div className="recorrido-detalle">
              {mail ? <p>Sin rebote observado: <strong>{r.a.sinRebote}</strong> · Rechazos: <strong>{r.a.rechazos}</strong> · Demoras: <strong>{r.a.demoras}</strong> · Recordatorios: <strong>{r.a.recordatorios}</strong></p> : <p>Contactos manuales confirmados: <strong>{r.a.confirmados}</strong> · Restantes sin confirmación: <strong>{r.a.iniciales - r.a.confirmados}</strong></p>}
              <strong>Zonas y barrios registrados</strong><div className="recorrido-zonas">{zonasContadas(r.contactos).map(z => <span key={z.nombre}>{z.nombre} <b>{z.n}</b></span>)}{!r.contactos.length && <span className="muted">Todavía sin actividad registrada.</span>}</div>
              <details className="recorrido-pendientes-rubro"><summary>CABA · barrios sin actividad registrada en este rubro</summary><div className="recorrido-zonas pendientes">{barriosPendientes(modelo.caba.filter(p => normalizar(p.rubro || '') === normalizar(r.rubro))).map(b => <span key={b}>{b}</span>)}</div></details>
              <Link to="/prospects">Ver contactos en el CRM</Link>
            </div>
          </details>;
        })}
        {!modelo.filas.length && <p className="muted">No hay rubros que coincidan con los filtros.</p>}
      </div>
    </Card>
    <div className="recorrido-barrios">
      <Card title="CABA · barrios con actividad registrada"><div className="recorrido-zonas">{zonasContadas(modelo.caba).map(z => <span key={z.nombre}>{z.nombre} <b>{z.n}</b></span>)}{!modelo.caba.length && <p className="muted">Todavía sin actividad de este canal en CABA.</p>}</div><p className="muted pequeño">Los registros genéricos de CABA o de una comuna no se asignan a barrios por suposición.</p></Card>
      <Card title="CABA · barrios sin actividad registrada"><div className="recorrido-zonas pendientes">{barriosPendientes(modelo.caba).map(b => <span key={b}>{b}</span>)}</div><p className="muted pequeño">Pendientes de relevamiento específico. No equivalen a una garantía de ausencia de contactos.</p></Card>
    </div>
    <p className="muted pequeño">Actualizado {data.actualizado.toLocaleTimeString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', hour: '2-digit', minute: '2-digit' })} · Hora de Argentina · Se actualiza cada minuto.</p>
  </div>;
}
