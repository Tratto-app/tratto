-- Tablero del equipo de marketing separado por tipo (clientes / proveedores).
-- p_kind: null = todos · 'customer' · 'provider'. El gasto en anuncios no se
-- puede separar por tipo: con p_kind viene en null.
-- Aplicada en producción el 8/10/2026.
create or replace function mkt_tablero_tipo(p_ws uuid default null, p_dias int default 7, p_kind text default null)
returns jsonb language sql stable security invoker set search_path = public as $$
  with ws as (select coalesce(p_ws, (select id from growth_workspaces where slug = 'tratto')) as id),
  per as (select now() - make_interval(days => greatest(1, least(p_dias, 365))) as desde),
  pr as (
    select p.*, coalesce(s.name, 'Sin dato') as fuente
    from growth_prospects p left join growth_sources s on s.id = p.source_id
    where p.workspace_id = (select id from ws)
      and not (coalesce(p.tags, '{}') @> array['interno'])
      and (p_kind is null or p.kind = p_kind)
  ),
  gasto as (
    select coalesce(s.name, 'Sin dato') as fuente, sum(g.amount) as monto
    from growth_spend g left join growth_sources s on s.id = g.source_id
    where g.workspace_id = (select id from ws) and p_kind is null and g.spent_on >= (select desde from per)::date
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
    'tipo', p_kind,
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
                          and m.created_at >= (select desde from per)
                          and (p_kind is null or exists (select 1 from pr where pr.id = m.prospect_id))),
      'mails_fallidos', (select count(*) from growth_messages m where m.workspace_id = (select id from ws)
                          and m.direction = 'out' and m.status = 'failed' and m.created_at >= (select desde from per)
                          and (p_kind is null or exists (select 1 from pr where pr.id = m.prospect_id))),
      'clicks', (select count(*) from growth_link_clicks c where c.workspace_id = (select id from ws)
                  and c.created_at >= (select desde from per)
                  and (p_kind is null or exists (select 1 from pr where pr.id = c.prospect_id))),
      'gasto', case when p_kind is null then (select coalesce(sum(monto), 0) from gasto) end
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
    'automatizaciones', coalesce((select jsonb_object_agg(status, n) from (
        select r.status, count(*) n from growth_workflow_runs r where r.workspace_id = (select id from ws)
        and (p_kind is null or exists (select 1 from pr where pr.id = r.prospect_id)) group by 1) x), '{}'::jsonb),
    'cola', coalesce((select jsonb_object_agg(estado, n) from (
        select i.estado, count(*) n from growth_mkt_items i where i.workspace_id = (select id from ws)
        and i.estado not in ('descartado') group by 1) x), '{}'::jsonb),
    'envios_pausados', (select sending_paused from growth_app_settings where workspace_id = (select id from ws))
  )
$$;
revoke execute on function mkt_tablero_tipo(uuid, int, text) from public, anon;
grant execute on function mkt_tablero_tipo(uuid, int, text) to authenticated;
