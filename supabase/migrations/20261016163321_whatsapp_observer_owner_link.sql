-- Sólo preparación y observación: no almacena tokens de Meta ni toca envíos.
create table public.growth_wa_setup_sessions (
  id uuid primary key,
  workspace_id uuid not null references public.growth_workspaces(id) on delete cascade,
  user_id uuid not null,
  app_id text not null check (app_id ~ '^[0-9]+$'),
  config_id text not null check (config_id ~ '^[0-9]+$'),
  state_hash text not null check (state_hash ~ '^[a-f0-9]{64}$'),
  verify_hash text not null unique check (verify_hash ~ '^[a-f0-9]{64}$'),
  status text not null default 'pending' check (status in ('pending','processing','completed','failed','uncertain')),
  expires_at timestamptz not null,
  result jsonb,
  created_at timestamptz not null default now()
);
alter table public.growth_wa_setup_sessions enable row level security;
revoke all on public.growth_wa_setup_sessions from public, anon, authenticated;
grant all on public.growth_wa_setup_sessions to service_role;
create index growth_wa_setup_sessions_expiry on public.growth_wa_setup_sessions(expires_at);

create or replace function public.growth_wa_observer_owner_link(
  p_workspace uuid, p_user uuid, p_run uuid,
  p_waba text, p_phone_id text, p_phone text,
  p_receiving boolean, p_missing_fields jsonb
) returns jsonb language plpgsql security invoker set search_path='' as $$
declare
  v_setup public.growth_wa_setup_sessions%rowtype;
  v_settings jsonb;
  v_target text;
  v_state text;
begin
  perform 1 from public.growth_mkt_items
    where workspace_id=p_workspace and datos->>'clave'='coordinacion_codex_claude'
      and estado='programado' for update;
  if not found then raise exception 'coordinacion_pausada'; end if;
  if not exists(select 1 from public.growth_members where workspace_id=p_workspace and user_id=p_user and role='owner') then
    raise exception 'solo_titular';
  end if;
  select * into v_setup from public.growth_wa_setup_sessions where id=p_run for update;
  if not found or v_setup.workspace_id<>p_workspace or v_setup.user_id<>p_user
    or v_setup.status<>'processing' or v_setup.expires_at<clock_timestamp() then
    raise exception 'sesion_vinculacion_invalida';
  end if;
  select valor into v_settings from public.growth_mkt_ajustes
    where workspace_id=p_workspace and clave='whatsapp_seguimiento_meta' for update;
  if v_settings->>'app_id' is distinct from v_setup.app_id
    or v_settings->>'embedded_signup_config_id' is distinct from v_setup.config_id then
    raise exception 'configuracion_cambio';
  end if;
  v_target:=regexp_replace(regexp_replace(v_settings->>'business_phone_objetivo','\D','','g'),'^54911','5411');
  if v_target is null or v_target='' or regexp_replace(regexp_replace(p_phone,'\D','','g'),'^54911','5411')<>v_target
    or p_waba !~ '^[0-9]+$' or p_phone_id !~ '^[0-9]+$' then
    raise exception 'numero_o_cuenta_incorrectos';
  end if;
  if jsonb_typeof(p_missing_fields) is distinct from 'array'
    or (p_receiving and jsonb_array_length(p_missing_fields)>0) then
    raise exception 'webhook_incompleto';
  end if;
  v_state:=case when p_receiving then 'vinculado_pendiente_prueba_real' else 'vinculado_pendiente_webhook' end;
  insert into public.growth_wa_observer_config(
    workspace_id,receiving_enabled,waba_id,phone_number_id,business_phone,
    owner_authorized_at,coexistence_verified_at,coverage_gap,history_shared
  ) values(p_workspace,p_receiving,p_waba,p_phone_id,p_phone,clock_timestamp(),clock_timestamp(),true,false)
  on conflict(workspace_id) do update set
    receiving_enabled=excluded.receiving_enabled,waba_id=excluded.waba_id,
    phone_number_id=excluded.phone_number_id,business_phone=excluded.business_phone,
    owner_authorized_at=excluded.owner_authorized_at,
    coexistence_verified_at=excluded.coexistence_verified_at,
    coverage_gap=true,coverage_since=null,coverage_through=null,
    history_shared=case when growth_wa_observer_config.waba_id=excluded.waba_id
      and growth_wa_observer_config.phone_number_id=excluded.phone_number_id
      then growth_wa_observer_config.history_shared else false end,
    updated_at=clock_timestamp();
  update public.growth_mkt_ajustes set valor=valor||jsonb_build_object(
    'estado',v_state,'receiving_enabled',p_receiving,'habilitado',p_receiving,
    'flujo_meta_completado',true,'coexistencia_verificada',true,'numero_verificado_meta',true,
    'campos_webhook_faltantes',p_missing_fields,'bloqueo',case when p_receiving then 'Falta prueba real de entrada y eco del celular' else 'Completar callback y campos en Meta' end,
    'ultima_verificacion',clock_timestamp()
  ),updated_at=clock_timestamp()
    where workspace_id=p_workspace and clave='whatsapp_seguimiento_meta';
  return jsonb_build_object('estado',v_state,'receiving_enabled',p_receiving,
    'missing_fields',p_missing_fields,'operativo_verificado',false);
end $$;
revoke all on function public.growth_wa_observer_owner_link(uuid,uuid,uuid,text,text,text,boolean,jsonb) from public,anon,authenticated;
grant execute on function public.growth_wa_observer_owner_link(uuid,uuid,uuid,text,text,text,boolean,jsonb) to service_role;
