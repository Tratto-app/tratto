import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge, Card, Empty, ErrorBox, Loading, PageHeader, Pager } from '../components/ui';
import { rpc } from '../lib/api';
import { accountDate, percentage, type UsersOverview } from '../lib/app-users';
import { useAsync, useDebounced } from '../lib/hooks';
import { useWs } from '../lib/workspace';
import './app-users.css';
const FILTERS = [['', 'Todos'], ['push', 'Con notificaciones'], ['no_push', 'Sin notificaciones'], ['published', 'Con servicio'], ['pending', 'Sin servicio']] as const;
export default function AppUsers() {
  const { ws, kind } = useWs();
  const [query, setQuery] = useState(''), search = useDebounced(query);
  const [stage, setStage] = useState(''), [rubro, setRubro] = useState('');
  const [sort, setSort] = useState<'registrados'|'con_push'|'con_servicio'>('registrados');
  const [page, setPage] = useState(0), [tick, setTick] = useState(0);
  const refresh = () => setTick(t => t + 1);
  useEffect(() => {
    const reload = () => { if (document.visibilityState === 'visible') setTick(t => t + 1); };
    const timer = window.setInterval(reload, 60_000); window.addEventListener('focus', reload);
    return () => { window.clearInterval(timer); window.removeEventListener('focus', reload); };
  }, []);
  useEffect(() => setPage(0), [ws!.id, search, kind]);
  const results = useAsync(() => rpc<UsersOverview>('growth_app_users_overview', {
    p_workspace: ws!.id, p_query: search, p_kind: kind, p_stage: stage || null,
    p_rubro: rubro || null, p_page: page,
  }), [ws!.id, search, kind, stage, rubro, page, tick]);
  const data = results.data, t = data?.totales;
  const rubros = [...(data?.rubros || [])].sort((a,b) => b[sort]-a[sort] || a.rubro.localeCompare(b.rubro));
  const maxRubro = Math.max(1, ...rubros.map(r => r.registrados));
  const maxDay = Math.max(1, ...(data?.altas || []).map(d => d.proveedores+d.clientes+d.sin_tipo));
  const changeStage = (v:string) => { setStage(v); setPage(0); };
  const changeRubro = (v:string) => { setRubro(v); setPage(0); };
  return <div className="app-users-overview">
    <PageHeader title="Usuarios de la app" desc="Todas las cuentas reales, desde el primer registro. Clientes, oferentes y avances de cada perfil en un mismo lugar."
      actions={<button className="btn" onClick={refresh} disabled={results.loading}>↻ {results.loading?'Actualizando…':'Actualizar'}</button>} />
    <ErrorBox error={results.error} onRetry={refresh}/>
    {!data && !results.error && <Loading text="Consultando cuentas y servicios…"/>}
    {data && t && <>
      <div className="au-heading"><span className="au-eyebrow">PANORAMA GENERAL · ACUMULADO</span><span className="muted pequeño">Última lectura {accountDate(data.corte_at)} · Buenos Aires</span></div>
      <div className="au-kpis">
        <Metric label="Cuentas registradas" value={t.usuarios} detail="Sin cuentas demo ni eliminadas"/>
        <Metric label="Oferentes de servicios" value={t.proveedores} detail={`${t.proveedores_pendientes} todavía sin servicio publicado`} tone="gold"/>
        <Metric label="Clientes" value={t.clientes} detail={`${t.clientes_push} con notificaciones push registradas`}/>
        <Metric label="Oferentes con notificaciones" value={t.proveedores_push} detail={`${percentage(t.proveedores_push,t.proveedores)}% de los oferentes`} tone="green"/>
        <Metric label="Oferentes con servicio" value={t.proveedores_publicados} detail={`${t.servicios} servicios publicados en total`} tone="green"/>
        <Metric label="Registros de hoy" value={t.altas_hoy} detail="Altas de cuentas · día de Buenos Aires"/>
      </div>
      {t.sin_tipo>0 && <p className="au-note">Hay {t.sin_tipo} cuentas que aún no tienen un tipo definido.</p>}
      <div className="au-panels">
        <Card title="Qué tan completos están los perfiles">
          <Progress label="Publicaron un servicio" n={t.proveedores_publicados} total={t.proveedores}/>
          <Progress label="Tienen notificaciones push registradas" n={t.proveedores_push} total={t.proveedores}/>
          <Progress label="Mostraron trabajos en su perfil" n={t.proveedores_con_trabajos} total={t.proveedores}/>
          <div className="au-callout"><strong>{t.proveedores_pendientes} oferentes pendientes de publicar</strong><span>Ya tienen cuenta. Todavía falta que ofrezcan un servicio para aparecer en la oferta de la app.</span></div>
          <p className="au-note">Una suscripción guardada no confirma permiso actual del celular ni recepción. Los trabajos del perfil son ejemplos publicados; no equivalen a trabajos cobrados.</p>
        </Card>
        <Card title="Nuevas cuentas · últimos 14 días">
          <div className="au-trend" role="img" aria-label={data.altas.map(d=>`${d.dia}: ${d.proveedores} oferentes, ${d.clientes} clientes, ${d.sin_tipo} sin tipo`).join('; ')}>
            {data.altas.map(d=><div className="au-day" key={d.dia} title={`${d.dia}: ${d.proveedores} oferentes · ${d.clientes} clientes · ${d.sin_tipo} sin tipo`}>
              <span className="au-day-total">{d.proveedores+d.clientes+d.sin_tipo || '·'}</span>
              <div className="au-day-stack"><i className="au-provider" style={{height:`${d.proveedores/maxDay*100}%`}}/><i className="au-customer" style={{height:`${d.clientes/maxDay*100}%`}}/><i className="au-unknown" style={{height:`${d.sin_tipo/maxDay*100}%`}}/></div>
              <span className="au-day-label">{d.dia.slice(8)}</span>
            </div>)}
          </div>
          <div className="au-legend"><span><i className="au-provider"/>Oferentes</span><span><i className="au-customer"/>Clientes</span>{t.sin_tipo>0 && <span><i className="au-unknown"/>Sin tipo</span>}</div>
          <p className="au-note">Altas por fecha de creación de la cuenta, en Buenos Aires. No son visitas ni contactos de marketing.</p>
        </Card>
      </div>
      <Card className="mt" title="Oferentes por rubro" actions={<select aria-label="Ordenar rubros" value={sort} onChange={e=>setSort(e.target.value as typeof sort)}><option value="registrados">Más registrados</option><option value="con_push">Más notificaciones</option><option value="con_servicio">Más servicios publicados</option></select>}>
        {rubros.length ? <div className="au-rubros">{rubros.map(r=><button key={r.rubro} className={`au-rubro ${rubro===r.rubro?'selected':''}`} aria-pressed={rubro===r.rubro} onClick={()=>changeRubro(rubro===r.rubro?'':r.rubro)}>
          <span className="au-rubro-top"><strong>{r.rubro}</strong><b>{r.registrados}</b></span><span className="au-track"><i className="au-provider" style={{width:`${r.registrados/maxRubro*100}%`}}/></span>
          <span className="au-rubro-meta"><span>{r.con_servicio} con servicio</span><span>{r.con_push} con notificaciones</span><span>{percentage(r.con_push,r.registrados)}% con push</span></span>
        </button>)}</div> : <Empty title="Todavía no hay oferentes registrados"/>}
        <p className="au-note">Tocá un rubro para ver sus personas abajo. Si alguien ofrece varios rubros aparece en cada uno; el total de cuentas no se duplica.</p>
      </Card>
      <Card className="mt" title="Personas registradas" actions={<span className="muted pequeño">{data.total_filtrado} en esta selección</span>}>
        <div className="au-filters"><input aria-label="Buscar persona" placeholder="Buscar nombre o email…" value={query} onChange={e=>{setQuery(e.target.value);setPage(0);}}/><select aria-label="Filtrar rubro" value={rubro} onChange={e=>changeRubro(e.target.value)}><option value="">Todos los rubros</option>{data.rubros.map(r=><option key={r.rubro}>{r.rubro}</option>)}</select></div>
        <div className="au-filter-pills" aria-label="Estado del registro">{FILTERS.map(([value,label])=><button className={`btn chico ${stage===value?'primario':''}`} key={value} aria-pressed={stage===value} onClick={()=>changeStage(value)}>{label}</button>)}</div>
        <p className="au-note">El selector superior de clientes / proveedores filtra esta lista. El panorama general muestra siempre el acumulado completo.</p>
        {results.loading ? <Loading text="Actualizando personas…"/> : !data.usuarios.length ? <Empty title="No hay personas con estos filtros"><button className="btn" onClick={()=>{setQuery('');changeStage('');changeRubro('');}}>Limpiar búsqueda y filtros</button></Empty> : <div className="au-people">{data.usuarios.map(u=><article className="au-person" key={u.user_id}>
          <div className="au-person-head"><div className="au-avatar" aria-hidden="true">{u.nombre.slice(0,1).toUpperCase()}</div><div className="au-person-name"><strong>{u.nombre}</strong><span>{u.email||'Sin email'}</span></div><Badge tone={u.tipo==='provider'?'laton':'verde'}>{u.tipo==='provider'?'Oferente':u.tipo==='customer'?'Cliente':'Sin tipo'}</Badge></div>
          <div className="au-person-rubros">{u.rubros.length?u.rubros.join(' · '):'Sin rubro de servicio'}</div>
          <div className="au-person-stats"><div><span>Notificaciones</span><b className={u.dispositivos?'au-ok':'muted'}>{u.dispositivos?`${u.dispositivos} dispositivo${u.dispositivos>1?'s':''}`:'Sin suscripción'}</b></div>{u.tipo==='provider'?<><div><span>Servicios</span><b>{u.servicios?`${u.servicios} publicado${u.servicios>1?'s':''}`:'Pendiente de publicar'}</b></div><div><span>Trabajos en el perfil</span><b>{u.trabajos}</b></div></>:<div><span>Pedidos publicados</span><b>{u.pedidos}</b></div>}</div>
          <div className="au-person-foot"><span>Alta {accountDate(u.registrado_at)}</span>{u.crm_id && <Link to={`/users/${u.crm_id}`}>Ver ficha CRM →</Link>}</div>
        </article>)}</div>}
        <Pager page={page} pageSize={50} total={data.total_filtrado} onPage={setPage}/>
      </Card>
    </>}
  </div>;
}
function Metric({label,value,detail,tone=''}:{label:string;value:number;detail:string;tone?:string}){
  return <div className={`au-metric ${tone}`}><span>{label}</span><strong>{value}</strong><small>{detail}</small></div>;
}
function Progress({label,n,total}:{label:string;n:number;total:number}){
  return <div className="au-progress"><div><span>{label}</span><strong>{n} / {total}</strong></div><div className="au-track" role="progressbar" aria-label={label} aria-valuenow={n} aria-valuemin={0} aria-valuemax={Math.max(1,total)}><i style={{width:`${percentage(n,total)}%`}}/></div></div>;
}
