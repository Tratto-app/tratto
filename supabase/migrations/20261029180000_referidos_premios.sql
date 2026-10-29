-- Premio de referidos (aprobado por el fundador el 29/10/2026): cuando la
-- persona invitada hace su primer trabajo pagado por la app, ganan los dos.
--   - Cuenta de cliente: el Trabajo protegido de su próximo trabajo, gratis.
--   - Cuenta de quien ofrece servicios: un cobro por la app sin el 3 %.
-- Un premio por persona invitada para cada uno. Si un Trabajo protegido gratis
-- termina en "no seguir", se le devuelve el premio para otro trabajo.

create table public.creditos (
 id bigint generated always as identity primary key,
 user_id uuid not null references auth.users(id) on delete cascade,
 tipo text not null check(tipo in('protegido_gratis','cobro_sin_comision')),
 referido uuid not null references auth.users(id) on delete cascade,
 created_at timestamptz not null default now(),
 reservado_en bigint,      -- presupuesto para el que se armó un pago sin comisión
 usado_at timestamptz,
 usado_en bigint,          -- presupuesto en el que se usó
 unique(user_id,referido)
);
create index creditos_libres on public.creditos(user_id,tipo) where usado_at is null;
alter table public.creditos enable row level security;
revoke all on public.creditos from public,anon,authenticated;
grant select on public.creditos to authenticated;
grant all on public.creditos to service_role;
create policy creditos_propios on public.creditos for select to authenticated using(user_id=auth.uid());

-- Qué premio le toca a cada cuenta, según su rol.
create or replace function privado.premio_de(u uuid)
returns text language sql stable security definer set search_path='' as $$
 select case when (select x.raw_user_meta_data->>'rol' from auth.users x where x.id=u)='proveedor'
             then 'cobro_sin_comision' else 'protegido_gratis' end;
$$;

-- El primer trabajo pagado de la persona invitada: se marca y se dan los premios.
create or replace function privado.referido_primer_trabajo()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.tipo='presupuesto' and new.pago_estado is not null and old.pago_estado is null then
  with hechos as (
   update public.referidos r set primer_trabajo_at=now()
   where r.primer_trabajo_at is null and r.referido in (
    select s.user_id from public.matches m join public.solicitudes s on s.id=m.solicitud_id where m.id=new.match_id
    union
    select p.user_id from public.matches m join public.proveedores p on p.id=m.proveedor_id where m.id=new.match_id)
   returning r.referido, r.referente)
  insert into public.creditos(user_id,tipo,referido)
  select h.referente, privado.premio_de(h.referente), h.referido from hechos h
  union all
  select h.referido, privado.premio_de(h.referido), h.referido from hechos h
  on conflict do nothing;
  -- Un pago sin comisión reservado para este presupuesto que no se usó (se
  -- pagó por otro camino) vuelve a quedar libre.
  update public.creditos set reservado_en=null where reservado_en=new.id and usado_at is null;
 end if;
 return new;
exception when others then
 raise warning 'referidos: %', sqlerrm;
 return new;
end $$;

-- Trabajo protegido gratis: cuota 0, sin pasar por Mercado Pago.
alter table public.trabajos_protegidos drop constraint trabajos_protegidos_cuota_check;
alter table public.trabajos_protegidos add constraint trabajos_protegidos_cuota_check check(cuota>=0);

create or replace function public.proteccion_cotizar(p_presupuesto_id bigint)
returns jsonb language sql stable security definer set search_path='' as $$
 select (privado.proteccion_chequear(p_presupuesto_id,auth.uid()) - 'proveedor' - 'match_id')
  || jsonb_build_object('gratis', exists(select 1 from public.creditos c
       where c.user_id=auth.uid() and c.tipo='protegido_gratis' and c.usado_at is null));
$$;

create or replace function public.proteccion_activar_gratis(p_presupuesto_id bigint)
returns text language plpgsql security definer set search_path='' as $$
declare c jsonb; k public.creditos;
begin
 if auth.uid() is null then raise exception 'Iniciá sesión.' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended('proteccion:'||p_presupuesto_id::text,0));
 c:=privado.proteccion_chequear(p_presupuesto_id,auth.uid());
 if not (c->>'puede')::boolean then raise exception '%', c->>'motivo';end if;
 select * into k from public.creditos x where x.user_id=auth.uid() and x.tipo='protegido_gratis' and x.usado_at is null
  order by x.id limit 1 for update skip locked;
 if k.id is null then raise exception 'No tenés un Trabajo protegido gratis disponible.';end if;
 insert into public.trabajos_protegidos(presupuesto_id,match_id,cliente,proveedor,monto,cuota,pago_id)
 values(p_presupuesto_id,(c->>'match_id')::bigint,auth.uid(),(c->>'proveedor')::uuid,(c->>'monto')::numeric,0,'credito-'||k.id);
 update public.creditos set usado_at=now(),usado_en=p_presupuesto_id where id=k.id;
 return 'activa';
end $$;

-- Si un Trabajo protegido gratis termina en "no seguir", no hay plata que
-- devolver: queda devuelto y el premio vuelve a estar disponible.
create or replace function privado.proteccion_gratis_devuelta()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.estado='devolucion_pendiente' and new.pago_id like 'credito-%' then
  new.estado:='devuelta'; new.devolucion_id:='credito'; new.resuelta_at:=now();
  update public.creditos set usado_at=null,usado_en=null where id=substr(new.pago_id,9)::bigint;
 end if;
 return new;
end $$;
create trigger proteccion_gratis_devuelta before update of estado on public.trabajos_protegidos
 for each row execute function privado.proteccion_gratis_devuelta();

-- Cobro sin comisión: la función pago-mp (service_role) reserva el premio al
-- armar el pago en Mercado Pago y lo marca usado cuando se confirma.
create or replace function public.credito_cobro_reservar(p_proveedor uuid,p_presupuesto_id bigint)
returns boolean language plpgsql security definer set search_path='' as $$
declare k bigint;
begin
 if not privado.es_servidor() then raise exception 'Solo el servidor.' using errcode='42501';end if;
 select x.id into k from public.creditos x where x.user_id=p_proveedor and x.tipo='cobro_sin_comision'
  and x.usado_at is null and (x.reservado_en is null or x.reservado_en=p_presupuesto_id)
  order by (x.reservado_en=p_presupuesto_id) desc nulls last, x.id limit 1 for update skip locked;
 if k is null then return false;end if;
 update public.creditos set reservado_en=p_presupuesto_id where id=k;
 return true;
end $$;
create or replace function public.credito_cobro_usar(p_presupuesto_id bigint)
returns void language plpgsql security definer set search_path='' as $$
begin
 if not privado.es_servidor() then raise exception 'Solo el servidor.' using errcode='42501';end if;
 update public.creditos set usado_at=now(),usado_en=p_presupuesto_id
 where reservado_en=p_presupuesto_id and usado_at is null;
end $$;

revoke all on function privado.premio_de(uuid),privado.proteccion_gratis_devuelta() from public,anon,authenticated;
revoke all on function public.proteccion_activar_gratis(bigint) from public,anon;
grant execute on function public.proteccion_activar_gratis(bigint) to authenticated;
revoke all on function public.credito_cobro_reservar(uuid,bigint),public.credito_cobro_usar(bigint) from public,anon,authenticated;
grant execute on function public.credito_cobro_reservar(uuid,bigint),public.credito_cobro_usar(bigint) to service_role;
