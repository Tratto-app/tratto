-- Growth OS · 4/4 · Tareas programadas
--
-- * growth-automations: cada 5 minutos la base llama a la Edge Function que
--   avanza las automatizaciones. Se autentica con un secreto guardado en
--   Vault; la función compara su hash con growth_system.cron_secret_hash.
-- * Usuarios inactivos: una vez por día.
--
-- Antes de aplicar en un proyecto nuevo, guardar la URL de las funciones:
--   insert into public.growth_system (key, value)
--   values ('functions_url', 'https://<proyecto>.supabase.co/functions/v1')
--   on conflict (key) do update set value = excluded.value;

create extension if not exists pg_net;
create extension if not exists pg_cron;

-- Crea el secreto del cron si no existe (en Vault) y guarda su hash.
create or replace function public.growth_setup_cron_secret()
returns void language plpgsql security definer set search_path = '' as $$
declare s text;
begin
  select decrypted_secret into s from vault.decrypted_secrets where name = 'growth_cron_secret';
  if s is null then
    s := encode(extensions.gen_random_bytes(32), 'hex');
    perform vault.create_secret(s, 'growth_cron_secret', 'Growth OS: autentica al cron ante la Edge Function growth-automations');
  end if;
  insert into public.growth_system (key, value)
  values ('cron_secret_hash', encode(extensions.digest(s, 'sha256'), 'hex'))
  on conflict (key) do update set value = excluded.value;
end $$;

create or replace function public.growth_cron_tick()
returns void language plpgsql security definer set search_path = '' as $$
declare url text; sec text;
begin
  select value into url from public.growth_system where key = 'functions_url';
  select decrypted_secret into sec from vault.decrypted_secrets where name = 'growth_cron_secret';
  if url is null or sec is null then return; end if;
  -- Solo si hay algo para procesar
  if not exists (select 1 from public.growth_workflow_runs
                  where status = 'running' or (status = 'waiting' and wait_until <= now())) then
    return;
  end if;
  perform net.http_post(
    url := url || '/growth-automations',
    body := '{}'::jsonb,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-growth-cron', sec),
    timeout_milliseconds := 25000);
end $$;

revoke all on function public.growth_setup_cron_secret(), public.growth_cron_tick() from public, anon, authenticated;

select public.growth_setup_cron_secret();
select cron.schedule('growth-automations', '*/5 * * * *', 'select public.growth_cron_tick()');
select cron.schedule('growth-inactivos', '40 9 * * *', 'select public.growth_check_inactive()');

-- Las Edge Functions usan el rol service_role: necesita poder ejecutar las
-- funciones internas que se les quitaron a public, anon y authenticated.
grant execute on function
  public.growth_record_click(text, text, text, text, text), public.growth_ingest_event(uuid, jsonb),
  public.growth_advance(uuid, text, timestamptz), public.growth_score_for(uuid, jsonb),
  public.growth_check_inactive(), public.growth_check_campaign_goal(uuid), public.growth_recompute_scores(uuid),
  public.growth_check(uuid), public.growth_is_member(uuid)
  to service_role;
