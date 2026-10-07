-- Equipo de marketing (CMO + 5 departamentos con Claude Code).
-- Aplicada en producción el 7/10/2026.
--
-- growth_mkt_items: la cola de trabajo del equipo. Los agentes dejan acá lo que
-- producen (piezas, anuncios, mails, informes) y la persona lo aprueba o lo
-- descarta desde el CRM (/crm/equipo). Lo aprobado lo ejecuta la siguiente
-- corrida del equipo. Nada se publica sin pasar por "aprobado".
--
-- mkt_tablero(): los números de la semana que leen el CMO y el panel.

create table if not exists growth_mkt_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references growth_workspaces(id) on delete cascade,
  departamento text not null check (departamento in ('cmo','redes','seo_local','contenido','anuncios','operaciones')),
  tipo text not null check (tipo in ('informe','plan','tarea','reel','carrusel','historia','post','articulo','pagina','anuncio','campania','mail','automatizacion','respuesta','aprendizaje','alerta')),
  titulo text not null check (length(titulo) between 1 and 200),
  resumen text,
  cuerpo text,
  canal text,
  estado text not null default 'para_aprobar' check (estado in ('idea','borrador','para_aprobar','cambios','aprobado','programado','publicado','hecho','descartado')),
  prioridad smallint not null default 2 check (prioridad between 1 and 3),
  fecha_objetivo timestamptz,
  link_slug text,
  url text,
  datos jsonb not null default '{}'::jsonb,
  metricas jsonb not null default '{}'::jsonb,
  comentario text,
  creado_por text not null default 'persona',
  aprobado_por uuid references auth.users(id) on delete set null,
  aprobado_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists growth_mkt_items_estado on growth_mkt_items (workspace_id, estado, created_at desc);
create index if not exists growth_mkt_items_depto on growth_mkt_items (workspace_id, departamento, created_at desc);
create index if not exists growth_mkt_items_aprobado_por on growth_mkt_items (aprobado_por);

alter table growth_mkt_items enable row level security;

create policy "miembros del workspace" on growth_mkt_items for all to authenticated
  using ((select growth_is_member(workspace_id)))
  with check ((select growth_is_member(workspace_id)));

-- updated_at y quién aprobó (lo pone la base, no el navegador)
create or replace function growth_mkt_items_touch() returns trigger
language plpgsql set search_path = public as $$
begin
  new.updated_at := now();
  if new.estado = 'aprobado' and (tg_op = 'INSERT' or old.estado is distinct from 'aprobado') then
    new.aprobado_at := now();
    new.aprobado_por := coalesce(auth.uid(), new.aprobado_por);
  end if;
  return new;
end $$;

create trigger growth_mkt_items_touch before insert or update on growth_mkt_items
  for each row execute function growth_mkt_items_touch();

-- Números del período para el CMO y el panel. Respeta RLS (security invoker):
-- desde el panel solo devuelve datos de un workspace del que la persona es miembro.
create or replace function mkt_tablero(p_ws uuid default null, p_dias int default 7)
returns jsonb language sql stable security invoker set search_path = public as $$
  with ws as (select coalesce(p_ws, (select id from growth_workspaces where slug = 'tratto')) as id),
  per as (select now() - make_interval(days => greatest(1, least(p_dias, 365))) as desde),
  pr as (
    select p.*, coalesce(s.name, 'Sin dato') as fuente
    from growth_prospects p left join growth_sources s on s.id = p.source_id
    where p.workspace_id = (select id from ws)
  ),
  gasto as (
    select coalesce(s.name, 'Sin dato') as fuente, sum(g.amount) as monto
    from growth_spend g left join growth_sources s on s.id = g.source_id
    where g.workspace_id = (select id from ws) and g.spent_on >= (select desde from per)::date
    group by 1
  ),
  por_fuente as (
    select fuente,
      count(*) filter (where created_at >= (select desde from per)) as nuevos,
      count(*) filter (where registered_at >= (select desde from per)) as registros,
      count(*) filter (where activated_at >= (select desde from per)) as activados
    from pr group by fuente
  )
  select jsonb_build_object(
    'desde', (select desde from per),
    'hasta', now(),
    'dias', p_dias,
    'totales', jsonb_build_object(
      'contactos', (select count(*) from pr),
      'con_permiso', (select count(*) from pr where consent = 'opt_in' and not coalesce(do_not_contact, false)),
      'bajas', (select count(*) from pr where consent = 'opt_out'),
      'registrados', (select count(*) from pr where registered_at is not null),
      'activados', (select count(*) from pr where activated_at is not null)
    ),
    'periodo', jsonb_build_object(
      'nuevos', (select count(*) from pr where created_at >= (select desde from per)),
      'registros', (select count(*) from pr where registered_at >= (select desde from per)),
      'activados', (select count(*) from pr where activated_at >= (select desde from per)),
      'mails_enviados', (select count(*) from growth_messages m where m.workspace_id = (select id from ws)
                          and m.direction = 'out' and m.channel = 'email' and m.status in ('sent','delivered')
                          and m.created_at >= (select desde from per)),
      'mails_fallidos', (select count(*) from growth_messages m where m.workspace_id = (select id from ws)
                          and m.direction = 'out' and m.status = 'failed' and m.created_at >= (select desde from per)),
      'clicks', (select count(*) from growth_link_clicks c where c.workspace_id = (select id from ws)
                  and c.created_at >= (select desde from per)),
      'gasto', (select coalesce(sum(monto), 0) from gasto)
    ),
    'por_entrada', coalesce((select jsonb_object_agg(e, n) from (
        select coalesce(entrada, 'sin dato') e, count(*) n from pr
        where created_at >= (select desde from per) group by 1) x), '{}'::jsonb),
    'por_fuente', coalesce((select jsonb_agg(jsonb_build_object(
        'fuente', f.fuente, 'nuevos', f.nuevos, 'registros', f.registros, 'activados', f.activados,
        'gasto', coalesce(g.monto, 0),
        'costo_por_registro', case when f.registros > 0 and g.monto > 0 then round(g.monto / f.registros) end)
        order by f.registros desc, f.nuevos desc)
      from por_fuente f left join gasto g on g.fuente = f.fuente
      where f.nuevos + f.registros + f.activados > 0 or g.monto > 0), '[]'::jsonb),
    'por_campania', coalesce((select jsonb_agg(jsonb_build_object('campania', c, 'nuevos', n, 'registros', r) order by n desc) from (
        select utm_campaign c, count(*) n, count(registered_at) r from pr
        where created_at >= (select desde from per) and utm_campaign is not null group by 1) x), '[]'::jsonb),
    'clicks_por_link', coalesce((select jsonb_agg(jsonb_build_object('link', slug, 'clicks', n) order by n desc) from (
        select l.slug, count(*) n from growth_link_clicks c join growth_tracking_links l on l.id = c.link_id
        where c.workspace_id = (select id from ws) and c.created_at >= (select desde from per) group by 1) x), '[]'::jsonb),
    'automatizaciones', coalesce((select jsonb_object_agg(status, n) from (
        select r.status, count(*) n from growth_workflow_runs r where r.workspace_id = (select id from ws) group by 1) x), '{}'::jsonb),
    'cola', coalesce((select jsonb_object_agg(estado, n) from (
        select i.estado, count(*) n from growth_mkt_items i where i.workspace_id = (select id from ws)
        and i.estado not in ('descartado') group by 1) x), '{}'::jsonb),
    'envios_pausados', (select sending_paused from growth_app_settings where workspace_id = (select id from ws))
  )
$$;

revoke execute on function mkt_tablero(uuid, int) from public, anon;
grant execute on function mkt_tablero(uuid, int) to authenticated;

-- Envío a un grupo (lo usa Operaciones para un mail de novedades aprobado):
-- inscribe en una automatización con disparador "manual" a quienes cumplen su
-- filtro, con permiso (opt_in) y sin bloqueo. El tope diario de envíos lo
-- sigue aplicando send.ts. Solo desde la base (MCP / service role).
create or replace function mkt_inscribir(p_workflow uuid, p_max int default 100)
returns int language plpgsql security definer set search_path = '' as $$
declare w public.growth_workflows; n int;
begin
  select * into w from public.growth_workflows where id = p_workflow;
  if w.id is null or not w.active or w.trigger <> 'manual' then
    raise exception 'La automatización tiene que existir, estar activa y tener disparador manual';
  end if;
  insert into public.growth_workflow_runs (workspace_id, workflow_id, prospect_id)
  select p.workspace_id, w.id, p.id
  from public.growth_prospects p
  where p.workspace_id = w.workspace_id
    and p.consent = 'opt_in' and not coalesce(p.do_not_contact, false)
    and p.email is not null
    and public.growth_match(to_jsonb(p), coalesce(w.trigger_filter, '{}'::jsonb))
    and not exists (select 1 from public.growth_workflow_runs r where r.workflow_id = w.id and r.prospect_id = p.id)
  order by p.created_at
  limit greatest(0, least(p_max, 300))
  on conflict do nothing;
  get diagnostics n = row_count;
  return n;
end $$;

revoke execute on function mkt_inscribir(uuid, int) from public, anon, authenticated;
