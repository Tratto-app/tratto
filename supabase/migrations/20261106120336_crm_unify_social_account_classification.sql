-- Unifica las listas del CRM con la clasificación ya existente de la misma cuenta.
-- Prioridad: servicios reales y rol declarado; luego la ficha CRM vinculada por Auth ID.
-- Es una clasificación de presentación: no completa el alta, acepta términos,
-- cambia Auth, crea servicios ni habilita permisos o mensajes.
create or replace function growth_users_private.accounts()
returns table(user_id uuid, nombre text, email text, tipo text, rubros text[],
  registrado_at timestamptz, servicios bigint, trabajos bigint, pedidos bigint,
  dispositivos bigint, crm_id uuid)
language sql stable set search_path = '' as $$
 with crm as (
   select distinct on (g.external_user_id) g.external_user_id,g.id,g.name,
     coalesce(p.kind,g.kind) kind,p.rubro,
     nullif(trim(concat_ws(' ',p.first_name,p.last_name)),'') prospect_name
   from public.growth_app_users g
   left join public.growth_prospects p on p.id=g.prospect_id and p.workspace_id=g.workspace_id
   where g.workspace_id=public.crm_ws()
   order by g.external_user_id,g.created_at,g.id
 ), services as (
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
 select u.id,coalesce(nullif(trim(u.raw_user_meta_data->>'nombre'),''),s.nombre,nullif(trim(u.raw_user_meta_data->>'full_name'),''),nullif(trim(u.raw_user_meta_data->>'name'),''),nullif(trim(c.name),''),c.prospect_name,'Nombre no informado'),u.email,
   case when s.n>0 or u.raw_user_meta_data->>'rol'='proveedor' then 'provider'
        when u.raw_user_meta_data->>'rol'='cliente' then 'customer'
        when c.kind in ('provider','customer') then c.kind else 'unknown' end,
   coalesce(s.rubros,case when u.raw_user_meta_data->>'rol'='proveedor'
     then array[coalesce(nullif(trim(u.raw_user_meta_data->>'rubro'),''),'Sin rubro declarado')]
     when c.kind='provider' then array[coalesce(nullif(trim(c.rubro),''),'Sin rubro declarado')] else '{}'::text[] end),
   u.created_at,coalesce(s.n,0),coalesce(w.n,0),coalesce(r.n,0),coalesce(d.n,0),
   c.id
 from auth.users u left join crm c on c.external_user_id=u.id::text left join services s on s.user_id=u.id left join devices d on d.user_id=u.id
 left join works w on w.user_id=u.id left join requests r on r.user_id=u.id
 where u.deleted_at is null and coalesce(u.raw_app_meta_data->>'demo','false')<>'true'
   and not exists(select 1 from public.proveedores p where p.user_id=u.id and p.demo=true);
$$;
revoke all on function growth_users_private.accounts() from public, anon, authenticated;


create or replace function public.crm_usuarios_app(p_ws uuid)
returns table (
  id uuid,
  nombre text,
  email text,
  telefono text,
  rol text,
  alta timestamptz,
  ultimo_ingreso timestamptz,
  rubros text[],
  zonas text[],
  servicios int,
  pedidos int,
  demo boolean,
  equipo boolean
)
language plpgsql
stable
security definer
set search_path to ''
as $$
begin
  if (select auth.uid()) is null or p_ws is distinct from public.crm_ws() or not public.growth_is_member(p_ws) then
    raise exception 'Sin permiso para ver los usuarios de este espacio de trabajo' using errcode = '42501';
  end if;
  return query
  select
    u.id,
    coalesce(a.nombre,nullif(trim(u.raw_user_meta_data->>'nombre'), ''),nullif(trim(u.raw_user_meta_data->>'full_name'), ''),nullif(trim(u.raw_user_meta_data->>'name'), ''),'Nombre no informado'),
    u.email::text,
    nullif(trim(u.raw_user_meta_data->>'telefono'), ''),
    case
      when a.tipo='provider' then 'ofrece'
      when a.tipo='customer' then 'cliente'
      when u.raw_user_meta_data->>'rol' = 'proveedor' then 'ofrece'
      when u.raw_user_meta_data->>'rol' = 'cliente' then 'cliente'
      when exists (select 1 from public.proveedores p where p.user_id = u.id) then 'ofrece'
      else 'cliente'
    end,
    u.created_at,
    u.last_sign_in_at,
    coalesce(
      nullif(a.rubros,'{}'::text[]),
      (select array_agg(distinct coalesce(nullif(p.rubro_personalizado, ''), p.rubro)) from public.proveedores p where p.user_id = u.id),
      case when nullif(u.raw_user_meta_data->>'rubro', '') is not null then array[u.raw_user_meta_data->>'rubro'] end,
      '{}'::text[]),
    coalesce(
      (select array_agg(distinct p.zona) from public.proveedores p where p.user_id = u.id and p.zona is not null),
      (select array_agg(distinct s.zona) from public.solicitudes s where s.user_id = u.id and s.zona is not null),
      '{}'::text[]),
    (select count(*)::int from public.proveedores p where p.user_id = u.id),
    (select count(*)::int from public.solicitudes s where s.user_id = u.id),
    coalesce((select bool_or(p.demo) from public.proveedores p where p.user_id = u.id), false)
      or u.email like 'trattoapp1+demo-%',
    exists (select 1 from public.growth_members m where m.workspace_id = p_ws and m.user_id = u.id)
  from auth.users u left join growth_users_private.accounts() a on a.user_id=u.id
  where u.deleted_at is null
  order by u.created_at desc;
end;
$$;

revoke all on function public.crm_usuarios_app(uuid) from public, anon;
grant execute on function public.crm_usuarios_app(uuid) to authenticated;
