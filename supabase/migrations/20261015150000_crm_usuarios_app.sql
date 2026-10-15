-- Sección "Usuarios" del CRM (pedido del fundador, 15/10/2026): todas las
-- personas registradas en la app, quién ofrece servicios y quién es cliente,
-- en qué rubros y en qué zonas.
--
-- Lee la fuente real (auth.users + proveedores + solicitudes), no la copia
-- growth_app_users, así una cuenta borrada desaparece sola de la lista.
-- - Zona de quien ofrece servicios: las zonas de sus servicios publicados.
-- - Zona de un cliente: las zonas de sus pedidos.
-- - Rubro: el de sus servicios; si todavía no publicó, el que eligió al
--   registrarse.
-- - demo: cuentas de demostración de la app. equipo: miembros del CRM.
--   La pantalla las separa de los usuarios reales.
-- Solo responde a miembros del workspace (devuelve mails y teléfonos).

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
  if not public.growth_is_member(p_ws) then
    raise exception 'Sin permiso para ver los usuarios de este espacio de trabajo' using errcode = '42501';
  end if;
  return query
  select
    u.id,
    coalesce(nullif(trim(u.raw_user_meta_data->>'nombre'), ''), split_part(u.email, '@', 1)),
    u.email::text,
    nullif(trim(u.raw_user_meta_data->>'telefono'), ''),
    case
      when u.raw_user_meta_data->>'rol' = 'proveedor' then 'ofrece'
      when u.raw_user_meta_data->>'rol' = 'cliente' then 'cliente'
      when exists (select 1 from public.proveedores p where p.user_id = u.id) then 'ofrece'
      else 'cliente'
    end,
    u.created_at,
    u.last_sign_in_at,
    coalesce(
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
  from auth.users u
  order by u.created_at desc;
end;
$$;

revoke all on function public.crm_usuarios_app(uuid) from public, anon;
grant execute on function public.crm_usuarios_app(uuid) to authenticated;
