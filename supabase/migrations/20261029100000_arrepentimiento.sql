-- Botón de arrepentimiento (Resolución 424/2020 de la Secretaría de Comercio
-- Interior). Desde que Tratto cobra Trabajo protegido vende un servicio por
-- internet: el consumidor tiene que poder pedir la revocación desde un enlace
-- visible, sin registrarse, y recibir un código de trámite. El código se
-- muestra en el acto; el equipo recibe un mail y lo resuelve desde el CRM.

create table privado.arrepentimientos (
 id bigint generated always as identity primary key,
 codigo text not null unique,
 nombre text not null check(length(nombre) between 2 and 120),
 email text not null check(length(email) between 5 and 160 and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
 que text not null check(que in('trabajo_protegido','otro')),
 referencia text check(referencia is null or length(referencia)<=120),
 detalle text check(detalle is null or length(detalle)<=2000),
 user_id uuid references auth.users(id) on delete set null,
 estado text not null default 'recibido' check(estado in('recibido','resuelto')),
 nota text check(nota is null or length(nota)<=2000),
 created_at timestamptz not null default now(),
 resuelto_at timestamptz
);
create index arrepentimientos_email on privado.arrepentimientos(lower(email),created_at);
alter table privado.arrepentimientos enable row level security;
revoke all on privado.arrepentimientos from public,anon,authenticated;
grant all on privado.arrepentimientos to service_role;

-- Cualquiera puede pedirlo, con o sin cuenta. Tope de 5 por mail por día para
-- que no se use para mandar avisos en masa.
create or replace function public.arrepentimiento_pedir(p_nombre text,p_email text,p_que text,p_referencia text default null,p_detalle text default null)
returns text language plpgsql security definer set search_path='' as $$
declare r privado.arrepentimientos; e text:=lower(trim(coalesce(p_email,'')));
begin
 if p_nombre is null or length(trim(p_nombre)) not between 2 and 120 or p_nombre ~ '[<>]' then raise exception 'Escribí tu nombre.';end if;
 if e !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or length(e)>160 then raise exception 'Revisá el email.';end if;
 if p_que not in('trabajo_protegido','otro') then raise exception 'Elegí qué querés revocar.';end if;
 if coalesce(p_referencia,'') ~ '[<>]' or length(coalesce(p_referencia,''))>120 then raise exception 'Revisá la referencia.';end if;
 if coalesce(p_detalle,'') ~ '[<>]' or length(coalesce(p_detalle,''))>2000 then raise exception 'Revisá el detalle (sin código HTML).';end if;
 perform pg_advisory_xact_lock(hashtextextended('arrepentimiento:'||e,0));
 if (select count(*) from privado.arrepentimientos a where lower(a.email)=e and a.created_at>now()-interval '1 day')>=5 then
  raise exception 'Ya recibimos varios pedidos tuyos hoy. Escribinos a trattoapp1@gmail.com.';end if;
 insert into privado.arrepentimientos(codigo,nombre,email,que,referencia,detalle,user_id)
 values('ARR-'||to_char(now() at time zone 'America/Argentina/Buenos_Aires','YYMMDD')||'-'||upper(substr(md5(random()::text||clock_timestamp()::text),1,6)),
        trim(p_nombre),e,p_que,nullif(trim(coalesce(p_referencia,'')),''),nullif(trim(coalesce(p_detalle,'')),''),auth.uid())
 returning * into r;
 perform privado.avisar('arrepentimiento_'||r.id::text,'Botón de arrepentimiento: '||r.codigo,
  'Alguien pidió revocar '||case when r.que='trabajo_protegido' then 'un Trabajo protegido' else 'una contratación' end
  ||' desde el botón de arrepentimiento. Código '||r.codigo||'. Está en el CRM, sección Trabajo protegido. '
  ||'Hay que responderle por mail dentro de las 24 horas.');
 return r.codigo;
end $$;

create or replace function public.soporte_arrepentimientos()
returns table(id bigint,codigo text,nombre text,email text,que text,referencia text,detalle text,estado text,nota text,created_at timestamptz)
language plpgsql stable security definer set search_path='' as $$
begin
 if not privado.es_soporte() then raise exception 'Solo soporte.' using errcode='42501';end if;
 return query select a.id,a.codigo,a.nombre,a.email,a.que,a.referencia,a.detalle,a.estado,a.nota,a.created_at
  from privado.arrepentimientos a order by (a.estado='recibido') desc,a.created_at desc limit 200;
end $$;

create or replace function public.soporte_arrepentimiento_resolver(p_id bigint,p_nota text)
returns void language plpgsql security definer set search_path='' as $$
begin
 if not privado.es_soporte() then raise exception 'Solo soporte.' using errcode='42501';end if;
 if p_nota is null or length(trim(p_nota)) not between 3 and 2000 then raise exception 'Anotá qué se hizo.';end if;
 update privado.arrepentimientos set estado='resuelto',nota=trim(p_nota),resuelto_at=now() where id=p_id;
end $$;

revoke all on function public.arrepentimiento_pedir(text,text,text,text,text),public.soporte_arrepentimientos(),
 public.soporte_arrepentimiento_resolver(bigint,text) from public,anon,authenticated;
grant execute on function public.arrepentimiento_pedir(text,text,text,text,text) to anon,authenticated;
grant execute on function public.soporte_arrepentimientos(),public.soporte_arrepentimiento_resolver(bigint,text) to authenticated;
