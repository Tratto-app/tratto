-- Referidos (idea del 28/10/2026, tomada de Clickie): "si traés a alguien y
-- hace un trabajo pagado por la app, ganan los dos". Acá va el registro:
--   - cada cuenta tiene un link propio (/?ref=<codigo>);
--   - quien se anota con ese link queda como invitado por esa persona
--     (lo pide la app justo después del alta, una sola vez);
--   - cuando la persona invitada tiene su primer trabajo pagado por la app
--     (como cliente o como quien lo hizo), se marca la fecha.
-- El premio todavía no está: lo define el fundador. Cuando lo defina, se
-- acredita desde primer_trabajo_at.

create table public.referidos_codigos (
 user_id uuid primary key references auth.users(id) on delete cascade,
 codigo text not null unique check(codigo ~ '^[a-z0-9]{8}$'),
 created_at timestamptz not null default now()
);
create table public.referidos (
 referido uuid primary key references auth.users(id) on delete cascade,
 referente uuid not null references auth.users(id) on delete cascade,
 created_at timestamptz not null default now(),
 primer_trabajo_at timestamptz,
 check(referido<>referente)
);
create index referidos_referente on public.referidos(referente);
alter table public.referidos_codigos enable row level security;
alter table public.referidos enable row level security;
revoke all on public.referidos_codigos,public.referidos from public,anon,authenticated;
grant all on public.referidos_codigos,public.referidos to service_role;

-- El código propio; se crea la primera vez que se pide.
create or replace function public.referidos_mi_codigo()
returns text language plpgsql security definer set search_path='' as $$
declare c text;
begin
 if auth.uid() is null then raise exception 'Iniciá sesión.' using errcode='42501';end if;
 select r.codigo into c from public.referidos_codigos r where r.user_id=auth.uid();
 if c is not null then return c;end if;
 loop
  c:=substr(md5(random()::text||clock_timestamp()::text||auth.uid()::text),1,8);
  begin
   insert into public.referidos_codigos(user_id,codigo) values(auth.uid(),c);
   return c;
  exception when unique_violation then
   select r.codigo into c from public.referidos_codigos r where r.user_id=auth.uid();
   if c is not null then return c;end if;
  end;
 end loop;
end $$;

-- Lo llama la cuenta nueva con el código del link por el que llegó. Solo
-- cuentas de hasta 2 días: después ya no se puede "venir invitado".
create or replace function public.referido_registrar(p_codigo text)
returns boolean language plpgsql security definer set search_path='' as $$
declare v_ref uuid; v_alta timestamptz;
begin
 if auth.uid() is null then return false;end if;
 select u.created_at into v_alta from auth.users u where u.id=auth.uid();
 if v_alta is null or v_alta<now()-interval '2 days' then return false;end if;
 select r.user_id into v_ref from public.referidos_codigos r where r.codigo=lower(trim(coalesce(p_codigo,'')));
 if v_ref is null or v_ref=auth.uid() then return false;end if;
 insert into public.referidos(referido,referente) values(auth.uid(),v_ref) on conflict do nothing;
 return found;
end $$;

-- Cuántas personas invitó y cuántas ya hicieron su primer trabajo pagado.
create or replace function public.referidos_resumen()
returns table(invitados integer,con_trabajo integer)
language sql stable security definer set search_path='' as $$
 select count(*)::integer, count(r.primer_trabajo_at)::integer
 from public.referidos r where r.referente=auth.uid();
$$;

-- Primer trabajo pagado por la app: cuenta para el cliente y para quien lo hizo.
create or replace function privado.referido_primer_trabajo()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.tipo='presupuesto' and new.pago_estado is not null and old.pago_estado is null then
  update public.referidos r set primer_trabajo_at=now()
  where r.primer_trabajo_at is null and r.referido in (
   select s.user_id from public.matches m join public.solicitudes s on s.id=m.solicitud_id where m.id=new.match_id
   union
   select p.user_id from public.matches m join public.proveedores p on p.id=m.proveedor_id where m.id=new.match_id);
 end if;
 return new;
exception when others then
 raise warning 'referidos: %', sqlerrm;
 return new;
end $$;
create trigger referido_primer_trabajo after update of pago_estado on public.mensajes
 for each row execute function privado.referido_primer_trabajo();

revoke all on function privado.referido_primer_trabajo() from public,anon,authenticated;
revoke all on function public.referidos_mi_codigo(),public.referido_registrar(text),public.referidos_resumen() from public,anon;
grant execute on function public.referidos_mi_codigo(),public.referido_registrar(text),public.referidos_resumen() to authenticated;
