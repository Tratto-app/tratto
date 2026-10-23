import { useMemo, useState } from 'react';
import { Badge, Card, ErrorBox, Kpi, Loading, PageHeader, Segmented } from '../components/ui';
import { rpc } from '../lib/api';
import { useAsync } from '../lib/hooks';
import { useWs } from '../lib/workspace';
import { clave, cuando, esNuevo, porRubro, porZona, reales, repetidos, type Conteo, type UsuarioApp } from '../lib/usuarios';
import './usuarios.css';

type Filtro = 'todos' | 'ofrece' | 'cliente';

function Rol({ u }: { u: UsuarioApp }) {
  return u.rol === 'ofrece' ? <Badge tone="laton">Ofrece servicios</Badge> : <Badge tone="verde">Cliente</Badge>;
}

function Estado({ u }: { u: UsuarioApp }) {
  if (u.rol === 'ofrece') return u.servicios ? <span>{u.servicios === 1 ? 'Servicio publicado' : `${u.servicios} servicios publicados`}</span> : <span className="usuarios-falta">Todavía sin servicio publicado</span>;
  return u.pedidos ? <span>{u.pedidos === 1 ? '1 pedido' : `${u.pedidos} pedidos`}</span> : <span className="usuarios-falta">Todavía sin pedidos</span>;
}

function Barras({ filas, total, detalle = true }: { filas: Conteo[]; total: number; detalle?: boolean }) {
  const max = Math.max(1, ...filas.map(f => f.n));
  return <ul className="usuarios-barras">
    {filas.map(f => <li key={f.nombre} title={`${f.nombre}: ${f.n} (${f.ofrece} ofrecen servicios · ${f.cliente} clientes)`}>
      <span className="usuarios-barras-nombre">{f.nombre}</span>
      <span className="usuarios-barras-pista"><i style={{ width: `${(f.n / max) * 100}%` }} /></span>
      <strong>{f.n}</strong>
      {detalle && <small>{[f.ofrece && `${f.ofrece} ofrece${f.ofrece === 1 ? '' : 'n'}`, f.cliente && `${f.cliente} cliente${f.cliente === 1 ? '' : 's'}`].filter(Boolean).join(' · ')}</small>}
    </li>)}
    {!filas.length && <li className="muted">Todavía no hay usuarios.</li>}
    {total > 0 && <li className="usuarios-barras-nota muted">Quien tiene servicios en varias zonas suma en cada una.</li>}
  </ul>;
}

function Ficha({ u, nuevo, repetido }: { u: UsuarioApp; nuevo: boolean; repetido: boolean }) {
  return <li className={`usuarios-ficha${nuevo ? ' nuevo' : ''}`}>
    <div className="usuarios-ficha-cab">
      <div className="usuarios-ficha-nombre">
        <strong>{u.nombre}</strong>
        <small>{[u.email, u.telefono].filter(Boolean).join(' · ')}</small>
      </div>
      <div className="usuarios-ficha-sellos">
        {nuevo && <Badge tone="azul">Nuevo</Badge>}
        {repetido && <Badge tone="rojo" title="Hay otra cuenta con el mismo nombre">Repetido</Badge>}
        {u.equipo && <Badge>Equipo</Badge>}
        {u.demo && <Badge tone="mock">Demo</Badge>}
        <Rol u={u} />
      </div>
    </div>
    <dl className="usuarios-ficha-datos">
      {u.rol === 'ofrece' && <div><dt>Rubro</dt><dd>{u.rubros.join(', ') || 'Sin rubro elegido'}</dd></div>}
      <div><dt>Zona</dt><dd>{u.zonas.join(', ') || <span className="usuarios-falta">Sin zona todavía</span>}</dd></div>
      <div><dt>Se registró</dt><dd>{cuando(u.alta)}</dd></div>
      <div><dt>En la app</dt><dd><Estado u={u} /></dd></div>
      <div><dt>Último ingreso</dt><dd>{u.ultimo_ingreso ? cuando(u.ultimo_ingreso) : <span className="usuarios-falta">Todavía no entró</span>}</dd></div>
    </dl>
  </li>;
}

export default function Usuarios() {
  const { ws } = useWs();
  const { data, error, loading, reload } = useAsync(() => rpc<UsuarioApp[]>('crm_usuarios_app', { p_ws: ws!.id }), [ws?.id]);
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const [buscar, setBuscar] = useState('');
  const [verTodo, setVerTodo] = useState(false);

  const m = useMemo(() => {
    const todos = data ?? [];
    const gente = reales(todos);
    const dup = repetidos(gente);
    const nuevos = gente.filter(u => esNuevo(u));
    const q = clave(buscar);
    const lista = (verTodo ? todos : gente)
      .filter(u => filtro === 'todos' || u.rol === filtro)
      .filter(u => !q || clave([u.nombre, u.email, u.telefono, ...u.rubros, ...u.zonas].filter(Boolean).join(' ')).includes(q));
    return {
      gente, dup, nuevos, lista,
      ofrecen: gente.filter(u => u.rol === 'ofrece').length,
      clientes: gente.filter(u => u.rol === 'cliente').length,
      zonas: porZona(gente), rubros: porRubro(gente),
      fuera: todos.length - gente.length,
    };
  }, [data, filtro, buscar, verTodo]);

  if (loading && !data) return <Loading />;
  if (error) return <ErrorBox error={error} onRetry={reload} />;

  return <div className="usuarios">
    <PageHeader title="Usuarios" desc="Las personas registradas en la app: quién ofrece servicios, quién es cliente, en qué rubros y en qué zonas. No cuenta las cuentas demo ni las del equipo."
      actions={<button className="btn" disabled={loading} onClick={reload}>{loading ? 'Actualizando…' : 'Actualizar'}</button>} />

    <div className="usuarios-kpis">
      <Kpi label="Usuarios" value={m.gente.length} />
      <Kpi label="Ofrecen servicios" value={m.ofrecen} />
      <Kpi label="Clientes" value={m.clientes} />
      <Kpi label="Nuevos en los últimos 7 días" value={m.nuevos.length} highlight />
    </div>

    {m.nuevos.length > 0 && <Card title={`Nuevos · ${m.nuevos.length} en los últimos 7 días`} className="usuarios-nuevos">
      <ul className="usuarios-nuevos-lista">{m.nuevos.map(u => <li key={u.id}>
        <span className="usuarios-nuevos-cuando">{cuando(u.alta)}</span>
        <span className="usuarios-nuevos-nombre"><strong>{u.nombre}</strong><small>{u.rol === 'ofrece' ? (u.rubros.join(', ') || 'Sin rubro elegido') : 'Cliente'}{u.zonas.length ? ` · ${u.zonas.join(', ')}` : ''}</small></span>
        <Rol u={u} />
      </li>)}</ul>
    </Card>}

    <div className="usuarios-conteos">
      <Card title="Por zona"><Barras filas={m.zonas} total={m.gente.length} /></Card>
      <Card title="Por rubro · quienes ofrecen servicios"><Barras filas={m.rubros} total={0} detalle={false} /></Card>
    </div>

    <Card title="Todos los usuarios">
      <div className="usuarios-filtros">
        <Segmented value={filtro} onChange={setFiltro} options={[{ key: 'todos', label: 'Todos' }, { key: 'ofrece', label: 'Ofrecen servicios' }, { key: 'cliente', label: 'Clientes' }]} />
        <label className="usuarios-buscar">Buscar<input id="usuarios-buscar" value={buscar} onChange={e => setBuscar(e.target.value)} placeholder="Nombre, mail, rubro o zona" /></label>
        <label className="usuarios-ver-todo"><input id="usuarios-ver-todo" type="checkbox" checked={verTodo} onChange={e => setVerTodo(e.target.checked)} />Mostrar también las {m.fuera} cuentas demo y del equipo</label>
      </div>
      <p className="muted pequeño">{m.lista.length} {m.lista.length === 1 ? 'usuario' : 'usuarios'}, del más nuevo al más viejo.</p>
      <ul className="usuarios-lista">{m.lista.map(u => <Ficha key={u.id} u={u} nuevo={!u.demo && !u.equipo && esNuevo(u)} repetido={!u.demo && !u.equipo && m.dup.has(clave(u.nombre))} />)}</ul>
      {!m.lista.length && <p className="muted">No hay usuarios que coincidan con la búsqueda.</p>}
    </Card>
  </div>;
}
