-- Sincroniza identidad de presentación; no cambia roles ni autoriza envíos.
create or replace function growth_users_private.sync_identity_name()
returns trigger language plpgsql security definer set search_path='' as $$
declare current_name text; previous_name text;
begin
 if new.deleted_at is not null or coalesce(new.raw_app_meta_data->>'demo','false')='true'
    or exists(select 1 from public.proveedores p where p.user_id=new.id and p.demo=true) then return new;end if;
 current_name:=coalesce(nullif(trim(new.raw_user_meta_data->>'nombre'),''),nullif(trim(new.raw_user_meta_data->>'full_name'),''),nullif(trim(new.raw_user_meta_data->>'name'),''));
 if current_name is null then return new;end if;
 if tg_op='UPDATE' then
  previous_name:=coalesce(nullif(trim(old.raw_user_meta_data->>'nombre'),''),nullif(trim(old.raw_user_meta_data->>'full_name'),''),nullif(trim(old.raw_user_meta_data->>'name'),''));
 end if;
 begin
  update public.growth_app_users g set name=current_name
  where g.workspace_id=public.crm_ws() and g.external_user_id=new.id::text
    and (nullif(trim(g.name),'') is null or g.name=previous_name)
    and g.name is distinct from current_name;
 exception when others then
  raise warning 'CRM identity sync [%]',sqlstate;
 end;
 return new;
end;
$$;
revoke all on function growth_users_private.sync_identity_name() from public,anon,authenticated;
-- El nombre ordena este trigger después del capturador crm_registro existente.
drop trigger if exists zz_crm_identity_name on auth.users;
create trigger zz_crm_identity_name after insert or update of raw_user_meta_data on auth.users
for each row execute function growth_users_private.sync_identity_name();

-- Recuperación de nombres disponibles de cuentas ya existentes. Sin tocar Auth.
update public.growth_app_users g set name=n.nombre
from auth.users u cross join lateral(select coalesce(nullif(trim(u.raw_user_meta_data->>'nombre'),''),nullif(trim(u.raw_user_meta_data->>'full_name'),''),nullif(trim(u.raw_user_meta_data->>'name'),'')) nombre) n
where g.workspace_id=public.crm_ws() and g.external_user_id=u.id::text
 and nullif(trim(g.name),'') is null and n.nombre is not null
 and u.deleted_at is null and coalesce(u.raw_app_meta_data->>'demo','false')<>'true'
 and not exists(select 1 from public.proveedores p where p.user_id=u.id and p.demo=true);

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
 select u.id,coalesce(nullif(trim(u.raw_user_meta_data->>'nombre'),''),s.nombre,nullif(trim(u.raw_user_meta_data->>'full_name'),''),nullif(trim(u.raw_user_meta_data->>'name'),''),(select nullif(trim(g.name),'') from public.growth_app_users g where g.workspace_id=public.crm_ws() and g.external_user_id=u.id::text order by g.created_at,g.id limit 1),'Nombre no informado'),u.email,
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

