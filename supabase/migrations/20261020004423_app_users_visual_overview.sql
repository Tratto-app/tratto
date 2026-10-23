-- Cuentas reales, sin depender de la llegada de eventos al CRM.
-- Auth metadata se usa como dato de perfil, NUNCA para autorizar el acceso.
create schema if not exists growth_users_private;
revoke all on schema growth_users_private from public, anon, authenticated;

create or replace function growth_users_private.accounts()
returns table(user_id uuid, nombre text, email text, tipo text, rubros text[],
  registrado_at timestamptz, servicios bigint, trabajos bigint, pedidos bigint,
  dispositivos bigint, crm_id uuid)
language sql stable set search_path = '' as $$
 with services as (
   select p.user_id,count(*) n,array_agg(distinct coalesce(nullif(trim(p.rubro_personalizado),''),nullif(trim(p.rubro),''),'Sin rubro declarado')) rubros,
     min(nullif(trim(p.nombre),'')) nombre
   from public.proveedores p where not coalesce(p.demo,false) group by p.user_id
 ), devices as (
   select p.user_id,count(*) n from public.push_subscripciones p
   where nullif(trim(p.endpoint),'') is not null group by p.user_id
 ), works as (
   select p.user_id,count(*) n from public.publicaciones p
   where p.tipo='trabajo' and p.estado='publicado' group by p.user_id
 ), requests as (
   select p.user_id,count(*) n from public.solicitudes p where not coalesce(p.demo,false) group by p.user_id
 )
 select u.id,coalesce(nullif(trim(u.raw_user_meta_data->>'nombre'),''),s.nombre,'Sin nombre'),u.email,
   case when s.n>0 or u.raw_user_meta_data->>'rol'='proveedor' then 'provider'
        when u.raw_user_meta_data->>'rol'='cliente' then 'customer' else 'unknown' end,
   coalesce(s.rubros,case when u.raw_user_meta_data->>'rol'='proveedor'
     then array[coalesce(nullif(trim(u.raw_user_meta_data->>'rubro'),''),'Sin rubro declarado')] else '{}'::text[] end),
   u.created_at,coalesce(s.n,0),coalesce(w.n,0),coalesce(r.n,0),coalesce(d.n,0),
   (select g.id from public.growth_app_users g where g.workspace_id=public.crm_ws() and g.external_user_id=u.id::text order by g.created_at,g.id limit 1)
 from auth.users u left join services s on s.user_id=u.id left join devices d on d.user_id=u.id
 left join works w on w.user_id=u.id left join requests r on r.user_id=u.id
 where u.deleted_at is null and coalesce(u.raw_app_meta_data->>'demo','false')<>'true'
   and not exists(select 1 from public.proveedores p where p.user_id=u.id and p.demo=true);
$$;
revoke all on function growth_users_private.accounts() from public, anon, authenticated;

create or replace function public.growth_app_users_overview(
  p_workspace uuid, p_query text default '', p_kind text default null,
  p_stage text default null, p_rubro text default null, p_page integer default 0
) returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare result jsonb;
begin
 -- Sólo miembros del CRM real pueden consultar las cuentas de ESTA app.
 if (select auth.uid()) is null or not public.growth_is_member(p_workspace)
    or p_workspace is distinct from public.crm_ws() then
   raise exception 'No tenés permiso para ver usuarios de esta app' using errcode='42501';
 end if;
 if p_page is null or p_page<0 or p_page>100000 then raise exception 'Página inválida'; end if;
 if p_kind is not null and p_kind not in('provider','customer','unknown') then raise exception 'Tipo inválido'; end if;
 if p_stage is not null and p_stage not in('push','no_push','published','pending') then raise exception 'Filtro inválido'; end if;
 with accounts as materialized (select * from growth_users_private.accounts()),
 totals as(select count(*) usuarios,count(*) filter(where tipo='provider') proveedores,
   count(*) filter(where tipo='customer') clientes,count(*) filter(where tipo='unknown') sin_tipo,
   count(*) filter(where tipo='provider' and dispositivos>0) proveedores_push,
   count(*) filter(where tipo='customer' and dispositivos>0) clientes_push,
   count(*) filter(where tipo='provider' and servicios>0) proveedores_publicados,
   count(*) filter(where tipo='provider' and servicios=0) proveedores_pendientes,
   count(*) filter(where tipo='provider' and trabajos>0) proveedores_con_trabajos,
   coalesce(sum(servicios),0) servicios,coalesce(sum(trabajos),0) trabajos,
   count(*) filter(where (registrado_at at time zone 'America/Argentina/Buenos_Aires')::date=(now() at time zone 'America/Argentina/Buenos_Aires')::date) altas_hoy
   from accounts),
 rubros as(select rubro,count(*) registrados,count(*) filter(where dispositivos>0) con_push,
   count(*) filter(where servicios>0) con_servicio from accounts cross join lateral unnest(rubros) rubro where tipo='provider' group by rubro),
 days as(select generate_series((now() at time zone 'America/Argentina/Buenos_Aires')::date-13,
   (now() at time zone 'America/Argentina/Buenos_Aires')::date,'1 day')::date dia),
 trend as(select d.dia,count(a.user_id) filter(where a.tipo='provider') proveedores,
   count(a.user_id) filter(where a.tipo='customer') clientes,count(a.user_id) filter(where a.tipo='unknown') sin_tipo
   from days d left join accounts a on (a.registrado_at at time zone 'America/Argentina/Buenos_Aires')::date=d.dia group by d.dia),
 filtered as(select * from accounts a where (p_kind is null or a.tipo=p_kind)
   and (coalesce(p_query,'')='' or strpos(lower(a.nombre||' '||coalesce(a.email,'')),lower(p_query))>0)
   and (p_rubro is null or p_rubro=any(a.rubros))
   and (p_stage is null or (p_stage='push' and a.dispositivos>0) or (p_stage='no_push' and a.dispositivos=0)
     or (p_stage='published' and a.tipo='provider' and a.servicios>0) or (p_stage='pending' and a.tipo='provider' and a.servicios=0))),
 paged as(select * from filtered order by registrado_at desc,user_id limit 50 offset p_page*50)
 select jsonb_build_object('corte_at',now(),'totales',(select to_jsonb(t) from totals t),
   'rubros',coalesce((select jsonb_agg(to_jsonb(r)order by registrados desc,rubro) from rubros r),'[]'),
   'altas',coalesce((select jsonb_agg(to_jsonb(t)order by dia)from trend t),'[]'),
   'total_filtrado',(select count(*)from filtered),'usuarios',coalesce((select jsonb_agg(to_jsonb(p)order by registrado_at desc,user_id)from paged p),'[]')) into result;
 return result;
end;
$$;
revoke all on function public.growth_app_users_overview(uuid,text,text,text,text,integer) from public,anon;
grant execute on function public.growth_app_users_overview(uuid,text,text,text,text,integer) to authenticated;
comment on function public.growth_app_users_overview(uuid,text,text,text,text,integer) is
 'Lectura de cuentas reales para miembros del CRM Tratto. Excluye demos/eliminados, distingue registro/servicios/trabajos y cuenta dispositivos push sin exponer endpoints ni claves.';
