-- Alianzas con inmobiliarias y administraciones de consorcios (idea del
-- 28/10/2026, tomada de Clickie): necesitan oficios todo el tiempo. La página
-- /alianzas.html tiene un formulario; acá se guarda el contacto y el equipo
-- recibe un aviso en la cola del CRM y un mail. Sin cuenta, con tope por mail.

create table privado.alianzas_contactos (
 id bigint generated always as identity primary key,
 nombre text not null check(length(nombre) between 2 and 120),
 empresa text not null check(length(empresa) between 2 and 160),
 tipo text not null check(tipo in('inmobiliaria','consorcios','otro')),
 email text not null check(length(email) between 5 and 160 and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
 telefono text check(telefono is null or length(telefono)<=40),
 zona text check(zona is null or length(zona)<=60),
 mensaje text check(mensaje is null or length(mensaje)<=2000),
 created_at timestamptz not null default now()
);
create index alianzas_contactos_email on privado.alianzas_contactos(lower(email),created_at);
alter table privado.alianzas_contactos enable row level security;
revoke all on privado.alianzas_contactos from public,anon,authenticated;
grant all on privado.alianzas_contactos to service_role;

create or replace function public.alianza_contacto(p_nombre text,p_empresa text,p_tipo text,p_email text,
 p_telefono text default null,p_zona text default null,p_mensaje text default null)
returns boolean language plpgsql security definer set search_path='' as $$
declare e text:=lower(trim(coalesce(p_email,''))); r privado.alianzas_contactos;
begin
 if p_nombre is null or length(trim(p_nombre)) not between 2 and 120 or p_nombre ~ '[<>]' then raise exception 'Escribí tu nombre.';end if;
 if p_empresa is null or length(trim(p_empresa)) not between 2 and 160 or p_empresa ~ '[<>]' then raise exception 'Escribí el nombre de la inmobiliaria o la administración.';end if;
 if p_tipo not in('inmobiliaria','consorcios','otro') then raise exception 'Elegí qué tipo de empresa es.';end if;
 if e !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or length(e)>160 then raise exception 'Revisá el email.';end if;
 if coalesce(p_telefono,'') ~ '[<>]' or length(coalesce(p_telefono,''))>40 then raise exception 'Revisá el teléfono.';end if;
 if coalesce(p_mensaje,'') ~ '[<>]' or length(coalesce(p_mensaje,''))>2000 then raise exception 'Revisá el mensaje (sin código HTML).';end if;
 perform pg_advisory_xact_lock(hashtextextended('alianza:'||e,0));
 if (select count(*) from privado.alianzas_contactos a where lower(a.email)=e and a.created_at>now()-interval '1 day')>=3 then
  raise exception 'Ya recibimos tus datos. Te escribimos pronto.';end if;
 insert into privado.alianzas_contactos(nombre,empresa,tipo,email,telefono,zona,mensaje)
 values(trim(p_nombre),trim(p_empresa),p_tipo,e,nullif(trim(coalesce(p_telefono,'')),''),
        nullif(trim(coalesce(p_zona,'')),''),nullif(trim(coalesce(p_mensaje,'')),''))
 returning * into r;
 insert into public.growth_mkt_items(workspace_id,departamento,tipo,estado,prioridad,creado_por,titulo,resumen,datos)
 values(public.crm_ws(),'operaciones','alerta','para_aprobar',1,'automation',
  'Alianza: '||r.empresa||' ('||case r.tipo when 'consorcios' then 'administración de consorcios' else r.tipo end||')',
  r.nombre||' dejó sus datos en la página de alianzas'||coalesce(' ('||r.zona||')','')||'. Escribile a '||r.email
  ||coalesce(' o al '||r.telefono,'')||'.',
  jsonb_build_object('clave','alianza','contacto_id',r.id));
 perform privado.avisar('alianza_'||r.id::text,'Alianza: '||r.empresa,
  r.nombre||' ('||r.empresa||') dejó sus datos en la página de alianzas. Está en la cola del equipo en el CRM.');
 return true;
end $$;

revoke all on function public.alianza_contacto(text,text,text,text,text,text,text) from public;
grant execute on function public.alianza_contacto(text,text,text,text,text,text,text) to anon,authenticated;
