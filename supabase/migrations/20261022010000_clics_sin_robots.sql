-- Las entradas de robots no cuentan como clics (fundador, 22/10/2026: "que
-- cuente solo personas"). Al publicar un link en un grupo de Facebook, los
-- robots de Facebook lo abren 8 o 9 veces en el mismo segundo para armar la
-- vista previa y revisar que sea seguro, con navegadores comunes de Windows y
-- Android: inflaban los clics de todos los links del CRM.
--
-- Se separan a growth_link_robots (no se borran) cuando:
-- - el navegador es de un robot conocido (vistas previas de Facebook,
--   WhatsApp, X, LinkedIn, buscadores, curl) o llega con el referrer fijo del
--   robot de Facebook en Android, o
-- - el mismo link recibe 3 o más entradas en 10 segundos (ráfaga): en ese
--   caso también se mueven las anteriores de la ráfaga.
-- Nunca se mueve un clic que ya tiene un contacto o un registro atribuido.
-- Todas las funciones del CRM siguen leyendo growth_link_clicks, que queda
-- solo con personas.

create table if not exists public.growth_link_robots (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  link_id uuid not null references public.growth_tracking_links(id) on delete cascade,
  click_token text,
  device text,
  target text,
  referrer text,
  user_agent text,
  motivo text not null,
  created_at timestamptz not null default now()
);
create index if not exists growth_link_robots_link on public.growth_link_robots (link_id, created_at);
alter table public.growth_link_robots enable row level security;
-- Sin políticas: solo las funciones de abajo.

create or replace function public.growth_es_robot_ua(p_ua text)
returns boolean
language sql
immutable
set search_path to ''
as $$
  select coalesce(p_ua, '') = ''
      or p_ua ~* '(facebookexternalhit|meta-externalagent|facebookcatalog|whatsapp|twitterbot|linkedinbot|slackbot|discordbot|telegrambot|googlebot|bingbot|applebot|duckduckbot|yandex|baiduspider|petalbot|ahrefs|semrush|mj12bot|embedly|crawler|spider|curl/|wget|python-requests|go-http-client|headlesschrome)'
$$;

-- Revisión del mismo día: el robot de Facebook que revisa los links desde
-- Android manda siempre el referrer "http://m.facebook.com" (sin https ni
-- barra final); quien toca el link desde el celular manda "https://…/".
create or replace function public.growth_es_robot_referrer(p_referrer text)
returns boolean
language sql
immutable
set search_path to ''
as $$
  select coalesce(p_referrer, '') = 'http://m.facebook.com'
$$;

create or replace function public.growth_record_click(p_slug text, p_ref text, p_device text, p_ua text, p_referrer text)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  l record; s record; pid uuid; tok text; tgt text; src text; camp text; motivo text;
begin
  select * into l from public.growth_tracking_links where slug = lower(p_slug) and not archived;
  if l.id is null then return null; end if;
  select * into s from public.growth_app_settings where workspace_id = l.workspace_id;
  if p_ref is not null and p_ref ~ '^[a-z0-9]{6,16}$' then
    select id into pid from public.growth_prospects where ref = p_ref and workspace_id = l.workspace_id;
  end if;
  p_device := case when p_device in ('android','ios','desktop') then p_device else 'other' end;
  tgt := case l.destination
    when 'play' then 'play' when 'appstore' then 'appstore' when 'web' then 'web' when 'custom' then 'custom'
    else case p_device when 'android' then 'play' when 'ios' then 'appstore' else 'web' end end;
  if (tgt = 'play' and s.play_store_url is null) or (tgt = 'appstore' and s.app_store_url is null) then
    tgt := 'web';
  end if;
  tok := encode(extensions.gen_random_bytes(12), 'hex');
  select key into src from public.growth_sources where id = l.source_id;
  select name into camp from public.growth_campaigns where id = l.campaign_id;

  -- Un link a la vez, así una ráfaga de robots no se cuela en paralelo
  perform pg_advisory_xact_lock(hashtext('growth_click:' || l.id::text));

  if pid is null then
    if public.growth_es_robot_ua(p_ua) or public.growth_es_robot_referrer(p_referrer) then
      motivo := 'Navegador de robot';
    elsif (select count(*) from public.growth_link_clicks where link_id = l.id and created_at > now() - interval '10 seconds')
        + (select count(*) from public.growth_link_robots where link_id = l.id and created_at > now() - interval '10 seconds') >= 2 then
      motivo := 'Ráfaga: 3 o más entradas al mismo link en 10 segundos';
    end if;
  end if;

  if motivo is not null then
    insert into public.growth_link_robots (workspace_id, link_id, click_token, device, target, referrer, user_agent, motivo)
    values (l.workspace_id, l.id, tok, p_device, tgt, left(p_referrer, 300), left(p_ua, 300), motivo);
    if motivo like 'Ráfaga%' then
      with movidas as (
        delete from public.growth_link_clicks c
         where c.link_id = l.id and c.created_at > now() - interval '10 seconds'
           and c.prospect_id is null
           and not exists (select 1 from public.growth_app_users u where u.click_token = c.click_token)
        returning c.*)
      insert into public.growth_link_robots (workspace_id, link_id, click_token, device, target, referrer, user_agent, motivo, created_at)
      select workspace_id, link_id, click_token, device, target, referrer, user_agent, 'Ráfaga (era parte de la misma)', created_at
        from movidas;
    end if;
  else
    insert into public.growth_link_clicks (workspace_id, link_id, prospect_id, click_token, device, target, referrer, user_agent)
    values (l.workspace_id, l.id, pid, tok, p_device, tgt, left(p_referrer, 300), left(p_ua, 300));
    if pid is not null then
      perform public.growth_advance(pid, 'clicked', now());
      insert into public.growth_timeline (workspace_id, prospect_id, type, title, detail)
      values (l.workspace_id, pid, 'click', 'Hizo click en el link "' || l.name || '"',
              jsonb_build_object('device', p_device, 'target', tgt, 'link_id', l.id));
    end if;
    perform public.growth_check_campaign_goal(l.campaign_id);
  end if;

  return jsonb_build_object(
    'target', tgt, 'token', tok, 'slug', l.slug,
    'play_store_url', s.play_store_url, 'app_store_url', s.app_store_url,
    'website', s.website, 'custom_url', l.custom_url,
    'utm_source', coalesce(src, 'growth'), 'utm_medium', coalesce(l.utm_medium, 'link'),
    'utm_campaign', coalesce(camp, l.slug), 'utm_content', l.utm_content);
end $function$;

-- Lo que ya estaba contado: mismas reglas, mirando 10 segundos antes y después
with robots as (
  select c.id,
         case when public.growth_es_robot_ua(c.user_agent) or public.growth_es_robot_referrer(c.referrer) then 'Navegador de robot'
              else 'Ráfaga: 3 o más entradas al mismo link en 10 segundos' end as motivo
    from public.growth_link_clicks c
   where c.prospect_id is null
     and not exists (select 1 from public.growth_app_users u where u.click_token = c.click_token)
     and (public.growth_es_robot_ua(c.user_agent) or public.growth_es_robot_referrer(c.referrer)
          or (select count(*) from public.growth_link_clicks c2
               where c2.link_id = c.link_id
                 and c2.created_at between c.created_at - interval '10 seconds' and c.created_at + interval '10 seconds') >= 3)),
movidas as (
  delete from public.growth_link_clicks c using robots r where c.id = r.id
  returning c.*, r.motivo)
insert into public.growth_link_robots (workspace_id, link_id, click_token, device, target, referrer, user_agent, motivo, created_at)
select workspace_id, link_id, click_token, device, target, referrer, user_agent, motivo, created_at from movidas;

revoke all on function public.growth_es_robot_ua(text) from public, anon;
revoke all on function public.growth_es_robot_referrer(text) from public, anon;
grant execute on function public.growth_es_robot_ua(text) to authenticated, service_role;
grant execute on function public.growth_es_robot_referrer(text) to authenticated, service_role;
