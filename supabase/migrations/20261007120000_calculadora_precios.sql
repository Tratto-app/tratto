-- Calculadora "¿Te cobraron de más?" (trattoapp.com.ar/calculadora).
--
-- Página pública, fuera de la app, para difundir en reels y TikTok. La
-- persona elige un servicio, su zona y cuánto pagó (o cuánto le
-- presupuestaron), deja su email y ve si el precio está por debajo, dentro o
-- por encima del rango de referencia del mes.
--
-- Cómo está protegido:
--  * La tabla de respuestas no se lee ni se escribe desde afuera (RLS sin
--    políticas y revoke a anon/authenticated). Todo pasa por dos funciones.
--  * calculadora_servicios() devuelve solo la lista de servicios (rubro,
--    servicio, unidad), sin precios.
--  * calculadora_comparar() guarda la respuesta y recién ahí devuelve el
--    rango: el precio de referencia no se ve sin dejar el email.
--  * Límite anti-abuso: 30 consultas por hora por IP y 20 por día por email.
--
-- El email se pide para mandar el resultado. Las novedades publicitarias van
-- aparte (acepta_novedades) y solo se escribe a quien la marcó (Ley 25.326,
-- art. 27). "baja" queda para cuando se conecten los envíos.
--
-- El ajuste por inflación (2 % mensual desde la fecha "relevado") y el
-- redondeo son los mismos que usa el Tasador en n8n (nodo "Configuracion",
-- ajusteMensual). Si se cambia allá, cambiarlo también acá.

create table if not exists public.calculadora_respuestas (
  id               bigint generated always as identity primary key,
  creado_en        timestamptz not null default now(),
  email            text not null check (length(email) <= 200 and email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  acepta_novedades boolean not null default false,
  rubro            text not null,
  servicio         text not null,
  zona             text not null check (length(zona) between 2 and 80),
  estado           text not null check (estado in ('pagado', 'presupuestado')),
  precio           integer not null check (precio between 100 and 100000000),
  ref_min          integer not null,
  ref_max          integer not null,
  unidad           text not null,
  veredicto        text not null,
  diferencia_pct   integer not null,
  origen           text check (length(origen) <= 60),
  campana          text check (length(campana) <= 80),
  ip_hash          text,
  baja             boolean not null default false
);

alter table public.calculadora_respuestas enable row level security;
revoke all on public.calculadora_respuestas from anon, authenticated;

create index if not exists calculadora_respuestas_email on public.calculadora_respuestas (lower(email));
create index if not exists calculadora_respuestas_ip on public.calculadora_respuestas (ip_hash, creado_en);
create index if not exists calculadora_respuestas_servicio on public.calculadora_respuestas (rubro, servicio);

-- Lista de servicios para los desplegables (sin precios).
create or replace function public.calculadora_servicios()
returns table (rubro text, servicio text, unidad text)
language sql
stable
security definer
set search_path = public
as $$
  select p.rubro, p.servicio, p.unidad
  from public.precios_referencia p
  order by p.rubro, p.servicio;
$$;

revoke all on function public.calculadora_servicios() from public;
grant execute on function public.calculadora_servicios() to anon, authenticated;

-- Guarda la respuesta y devuelve el rango de referencia y el veredicto.
create or replace function public.calculadora_comparar(
  p_email text,
  p_acepta_novedades boolean,
  p_rubro text,
  p_servicio text,
  p_zona text,
  p_estado text,
  p_precio integer,
  p_origen text default null,
  p_campana text default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_email   text := lower(btrim(coalesce(p_email, '')));
  v_zona    text := btrim(coalesce(p_zona, ''));
  v_ref     public.precios_referencia%rowtype;
  v_hoy     date := (now() at time zone 'America/Argentina/Buenos_Aires')::date;
  v_meses   integer;
  v_factor  numeric;
  v_min     integer;
  v_max     integer;
  v_medio   numeric;
  v_dif     integer;
  v_posicion integer;
  v_veredicto text;
  v_ip      text;
  v_ip_hash text;
  v_aportes integer;
begin
  if v_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' or length(v_email) > 200 then
    return jsonb_build_object('ok', false, 'error', 'email');
  end if;
  if length(v_zona) < 2 or length(v_zona) > 80 then
    return jsonb_build_object('ok', false, 'error', 'zona');
  end if;
  if p_estado not in ('pagado', 'presupuestado') then
    return jsonb_build_object('ok', false, 'error', 'estado');
  end if;
  if p_precio is null or p_precio < 100 or p_precio > 100000000 then
    return jsonb_build_object('ok', false, 'error', 'precio');
  end if;

  select * into v_ref from public.precios_referencia
   where rubro = p_rubro and servicio = p_servicio;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'servicio');
  end if;

  -- Límite anti-abuso por IP (hasheada, no se guarda la IP) y por email.
  begin
    v_ip := split_part(coalesce(current_setting('request.headers', true)::json ->> 'x-forwarded-for', ''), ',', 1);
  exception when others then
    v_ip := '';
  end;
  v_ip_hash := case when v_ip = '' then null else encode(extensions.digest('calculadora:' || v_ip, 'sha256'), 'hex') end;

  if v_ip_hash is not null and (
       select count(*) from public.calculadora_respuestas
        where ip_hash = v_ip_hash and creado_en > now() - interval '1 hour') >= 30 then
    return jsonb_build_object('ok', false, 'error', 'limite');
  end if;
  if (select count(*) from public.calculadora_respuestas
       where lower(email) = v_email and creado_en > now() - interval '1 day') >= 20 then
    return jsonb_build_object('ok', false, 'error', 'limite');
  end if;

  -- Rango ajustado por inflación desde el relevamiento (igual que el Tasador).
  v_meses  := greatest(0, (extract(year from v_hoy)::int - extract(year from v_ref.relevado)::int) * 12
                        + (extract(month from v_hoy)::int - extract(month from v_ref.relevado)::int));
  v_factor := power(1.02, v_meses);
  v_min := case when v_ref.precio_min * v_factor < 20000 then round(v_ref.precio_min * v_factor / 500) * 500
                else round(v_ref.precio_min * v_factor / 1000) * 1000 end;
  v_max := case when v_ref.precio_max * v_factor < 20000 then round(v_ref.precio_max * v_factor / 500) * 500
                else round(v_ref.precio_max * v_factor / 1000) * 1000 end;

  v_medio := (v_min + v_max) / 2.0;
  v_dif := round((p_precio - v_medio) / v_medio * 100);
  -- Posición en una escala donde el rango ocupa del 25 al 75.
  v_posicion := greatest(0, least(100, round(25 + (p_precio - v_min)::numeric / greatest(1, v_max - v_min) * 50)));

  v_veredicto := case
    when p_precio > v_max * 1.25 then 'muy_caro'
    when p_precio > v_max        then 'caro'
    when p_precio < v_min * 0.75 then 'muy_barato'
    when p_precio < v_min        then 'barato'
    else 'justo' end;

  insert into public.calculadora_respuestas
    (email, acepta_novedades, rubro, servicio, zona, estado, precio, ref_min, ref_max, unidad,
     veredicto, diferencia_pct, origen, campana, ip_hash)
  values
    (v_email, coalesce(p_acepta_novedades, false), v_ref.rubro, v_ref.servicio, v_zona, p_estado, p_precio,
     v_min, v_max, v_ref.unidad, v_veredicto, v_dif, left(p_origen, 60), left(p_campana, 80), v_ip_hash);

  select count(*) into v_aportes from public.calculadora_respuestas
   where rubro = v_ref.rubro and servicio = v_ref.servicio;

  return jsonb_build_object(
    'ok', true,
    'min', v_min,
    'max', v_max,
    'unidad', v_ref.unidad,
    'veredicto', v_veredicto,
    'diferencia_pct', v_dif,
    'posicion', v_posicion,
    'aportes', v_aportes
  );
end;
$$;

revoke all on function public.calculadora_comparar(text, boolean, text, text, text, text, integer, text, text) from public;
grant execute on function public.calculadora_comparar(text, boolean, text, text, text, text, integer, text, text) to anon, authenticated;
