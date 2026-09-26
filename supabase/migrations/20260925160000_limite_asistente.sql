-- Tope de uso del Asistente (n8n → OpenAI). Hoy cualquiera, incluso sin
-- cuenta, puede hacerle preguntas sin límite, y cada una cuesta plata de OpenAI.
--
-- n8n llama a public.asistente_permitido() antes de preguntarle a la IA:
--   * con sesión:  40 preguntas por día por usuario
--   * sin sesión:  15 por día por IP, y 500 por día entre todos los anónimos
--                  (techo de gasto)
-- La IP no se guarda: se guarda un hash con sal (privado.config).

create schema if not exists privado;

create table if not exists privado.uso_asistente (
  clave text not null,
  dia   date not null default current_date,
  n     int  not null default 0,
  primary key (clave, dia)
);
alter table privado.uso_asistente enable row level security;

create table if not exists privado.config (clave text primary key, valor text not null);
alter table privado.config enable row level security;
insert into privado.config (clave, valor)
values ('sal_asistente', encode(extensions.gen_random_bytes(24), 'hex'))
on conflict (clave) do nothing;

create or replace function public.asistente_permitido(p_usuario uuid default null, p_ip text default null)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  sal text; k text; tope int; cuantos int; anonimos int;
begin
  select valor into sal from privado.config where clave = 'sal_asistente';
  if p_usuario is not null then
    k := 'u:' || p_usuario::text; tope := 40;
  else
    k := 'ip:' || encode(extensions.digest(coalesce(nullif(trim(split_part(p_ip, ',', 1)), ''), 'sin-ip') || sal, 'sha256'), 'hex');
    tope := 15;
  end if;

  insert into privado.uso_asistente (clave, dia, n) values (k, current_date, 1)
  on conflict (clave, dia) do update set n = privado.uso_asistente.n + 1
  returning n into cuantos;

  if p_usuario is null then
    select coalesce(sum(n), 0) into anonimos from privado.uso_asistente
     where dia = current_date and clave like 'ip:%';
    if anonimos > 500 then return false; end if;
  end if;

  -- limpieza de días viejos, de vez en cuando
  if random() < 0.02 then
    delete from privado.uso_asistente where dia < current_date - 7;
  end if;

  return cuantos <= tope;
end $$;

revoke all on function public.asistente_permitido(uuid, text) from public, anon, authenticated;
grant execute on function public.asistente_permitido(uuid, text) to service_role;
