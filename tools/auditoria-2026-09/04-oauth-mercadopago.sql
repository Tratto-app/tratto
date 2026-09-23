-- Soporte para H-01: tabla de nonces de un solo uso para la conexion de
-- Mercado Pago. La usan los dos workflows nuevos/editados en n8n
-- (mp-iniciar y mp-conectar, ver README.md en esta misma carpeta).
--
-- Nadie autenticado necesita leer ni escribir esta tabla directamente: todo
-- pasa por n8n con la service_role. Por eso no hay policies para
-- anon/authenticated -- RLS activado y sin policies == nadie entra salvo
-- service_role, que las salta.

create table if not exists public.oauth_states (
  nonce      uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  proveedor  text not null default 'mercadopago',
  creado_en  timestamptz not null default now()
);

alter table public.oauth_states enable row level security;

-- Limpieza de nonces vencidos (mas de 10 minutos): se puede llamar desde un
-- cron de n8n, o simplemente dejar que mp-conectar la llame de paso.
create or replace function public.limpiar_oauth_states_vencidos()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.oauth_states where creado_en < now() - interval '10 minutes';
$$;
