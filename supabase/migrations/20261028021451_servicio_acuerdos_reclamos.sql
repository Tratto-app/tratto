-- Acuerdos de visita, adicionales y retiro; reclamos y resguardo mínimo.
-- No verifica identidades, no cambia el presupuesto original y no genera pagos.
-- Las escrituras pasan por RPC con identidad derivada de las partes del match.
create schema if not exists privado;

create table public.servicio_acuerdos (
 id uuid primary key default gen_random_uuid(),
 match_id bigint not null references public.matches(id) on delete cascade,
 tipo text not null check(tipo in ('visita','adicional','retiro')),
 datos jsonb not null check(jsonb_typeof(datos)='object' and octet_length(datos::text)<=16000),
 estado text not null default 'propuesta' check(estado in ('propuesta','aceptado','rechazado','reemplazado','en_camino','llego','visita_confirmada','retiro_realizado','devolucion_informada','devuelto')),
 version integer not null default 1 check(version>0),
 propuesto_por uuid not null,
 respondido_por uuid,
 reemplaza_id uuid references public.servicio_acuerdos(id) on delete set null,
 presupuesto_id bigint references public.mensajes(id) on delete set null,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), respondido_at timestamptz
);
create index servicio_acuerdos_match_idx on public.servicio_acuerdos(match_id,created_at);
create index servicio_acuerdos_autor_idx on public.servicio_acuerdos(propuesto_por,created_at);
create table public.servicio_reclamos (
 id uuid primary key default gen_random_uuid(),
 match_id bigint not null references public.matches(id) on delete cascade,
 reportante uuid not null,
 motivo text not null check(length(motivo) between 3 and 120),
 detalle text not null check(length(detalle) between 10 and 4000),
 fotos jsonb not null default '[]' check(jsonb_typeof(fotos)='array' and jsonb_array_length(fotos)<=5),
 estado text not null default 'recibido' check(estado in ('recibido','en_revision','resuelto','cerrado')),
 version integer not null default 1,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index servicio_reclamos_match_idx on public.servicio_reclamos(match_id,created_at);
create index servicio_reclamos_autor_idx on public.servicio_reclamos(reportante,created_at);
create table public.servicio_reclamo_eventos (
 id uuid primary key default gen_random_uuid(), reclamo_id uuid not null references public.servicio_reclamos(id) on delete cascade,
 autor uuid, tipo text not null check(tipo in ('comentario','soporte')),
 texto text not null check(length(texto) between 1 and 4000),
 fotos jsonb not null default '[]' check(jsonb_typeof(fotos)='array' and jsonb_array_length(fotos)<=5),
 created_at timestamptz not null default now()
);
create index servicio_reclamo_eventos_caso_idx on public.servicio_reclamo_eventos(reclamo_id,created_at);

create table privado.servicio_resguardos (
 id uuid primary key default gen_random_uuid(), referencia uuid not null, tipo text not null,
 expediente jsonb not null, created_at timestamptz not null default now(),
 eliminar_at timestamptz not null default (now()+interval '180 days'),
 unique(referencia,tipo)
);
create index servicio_resguardos_caducidad_idx on privado.servicio_resguardos(eliminar_at);
create table privado.servicio_archivos_por_borrar (
 nombre text primary key, created_at timestamptz not null default now()
);

alter table public.servicio_acuerdos enable row level security;
alter table public.servicio_reclamos enable row level security;
alter table public.servicio_reclamo_eventos enable row level security;
alter table privado.servicio_resguardos enable row level security;
alter table privado.servicio_archivos_por_borrar enable row level security;
revoke all on public.servicio_acuerdos,public.servicio_reclamos,public.servicio_reclamo_eventos from public,anon,authenticated;
revoke all on privado.servicio_resguardos,privado.servicio_archivos_por_borrar from public,anon,authenticated;
grant select on public.servicio_acuerdos,public.servicio_reclamos,public.servicio_reclamo_eventos to authenticated;
grant all on public.servicio_acuerdos,public.servicio_reclamos,public.servicio_reclamo_eventos,privado.servicio_resguardos,privado.servicio_archivos_por_borrar to service_role;

create function privado.servicio_es_parte(mid bigint)
returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from auth.users u where u.id=auth.uid() and u.deleted_at is null)
 and exists(select 1 from public.matches m join public.solicitudes s on s.id=m.solicitud_id join public.proveedores p on p.id=m.proveedor_id where m.id=mid and auth.uid() in(s.user_id,p.user_id));
$$;
create function privado.servicio_exigir_parte(mid bigint, escritura boolean default true)
returns text language plpgsql security definer set search_path='' as $$
declare c uuid;p uuid;
begin
 if auth.uid() is null or not exists(select 1 from auth.users where id=auth.uid() and deleted_at is null) then raise exception 'Iniciá sesión.' using errcode='42501';end if;
 select s.user_id,v.user_id into c,p from public.matches m join public.solicitudes s on s.id=m.solicitud_id join public.proveedores v on v.id=m.proveedor_id where m.id=mid for update of m;
 if c is null or p is null or c=p or (auth.uid()<>c and auth.uid()<>p) then raise exception 'No sos parte de este trabajo.' using errcode='42501';end if;
 if escritura and privado.hay_bloqueo(c,p) then raise exception 'Esta conversación está cerrada. Podés abrir un reclamo.';end if;
 return case when auth.uid()=c then 'cliente' else 'proveedor' end;
end $$;
create policy servicio_acuerdos_lectura on public.servicio_acuerdos for select to authenticated using(privado.servicio_es_parte(match_id));
create policy servicio_reclamos_lectura on public.servicio_reclamos for select to authenticated using(privado.servicio_es_parte(match_id));
create policy servicio_eventos_lectura on public.servicio_reclamo_eventos for select to authenticated using(exists(select 1 from public.servicio_reclamos r where r.id=reclamo_id and privado.servicio_es_parte(r.match_id)));

-- Evidencia privada: no URLs externas ni bucket público. La creación exige dueño y match.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('servicio-evidencias','servicio-evidencias',false,5242880,array['image/jpeg','image/png','image/webp'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
create function privado.servicio_ref_match(ref text)
returns bigint language plpgsql immutable set search_path='' as $$
begin
 if ref is null or ref !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[1-9][0-9]{0,17}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|jpeg|png|webp)$' then return null;end if;
 return split_part(ref,'/',2)::bigint;
end $$;
create policy servicio_evidencia_leer on storage.objects for select to authenticated using(bucket_id='servicio-evidencias' and privado.servicio_es_parte(privado.servicio_ref_match(name)));
create function privado.servicio_puede_subir(ref text)
returns boolean language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or split_part(ref,'/',1)<>auth.uid()::text or not privado.servicio_es_parte(privado.servicio_ref_match(ref)) then return false;end if;
 perform pg_advisory_xact_lock(hashtextextended('servicio-fotos:'||auth.uid()::text,0));
 return (select count(*) from storage.objects where bucket_id='servicio-evidencias' and split_part(name,'/',1)=auth.uid()::text and created_at>now()-interval '1 day')<20
 and (select count(*) from storage.objects where bucket_id='servicio-evidencias' and split_part(name,'/',1)=auth.uid()::text)<150;
end $$;
create policy servicio_evidencia_subir on storage.objects for insert to authenticated with check(bucket_id='servicio-evidencias' and privado.servicio_puede_subir(name));
-- No UPDATE: un archivo de evidencia no se sustituye manteniendo el mismo nombre.
create function privado.servicio_ref_usada(ref text)
returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.servicio_acuerdos a where a.datos->>'foto_ref'=ref or coalesce(a.datos->'fotos','[]') ? ref)
 or exists(select 1 from public.servicio_reclamos r where r.fotos ? ref)
 or exists(select 1 from public.servicio_reclamo_eventos e where e.fotos ? ref);
$$;
create policy servicio_evidencia_borrar_borrador on storage.objects for delete to authenticated using(bucket_id='servicio-evidencias' and split_part(name,'/',1)=auth.uid()::text and not privado.servicio_ref_usada(name));
create function privado.servicio_validar_fotos(mid bigint,fotos jsonb)
returns void language plpgsql security definer set search_path='' as $$
declare f text;
begin
 if fotos is null or jsonb_typeof(fotos)<>'array' or jsonb_array_length(fotos)>5 then raise exception 'Adjuntá hasta cinco fotos.';end if;
 for f in select jsonb_array_elements_text(fotos) loop
  if privado.servicio_ref_match(f) is distinct from mid or split_part(f,'/',1) is distinct from auth.uid()::text
   or exists(select 1 from privado.servicio_archivos_por_borrar where nombre=f)
   or not exists(select 1 from storage.objects where bucket_id='servicio-evidencias' and name=f) then raise exception 'Foto no válida para este trabajo.';end if;
 end loop;
end $$;
create function privado.servicio_texto(datos jsonb,k text,minimo integer,maximo integer,obligatorio boolean default true)
returns void language plpgsql immutable set search_path='' as $$
declare t text:=datos->>k;
begin
 if not obligatorio and (t is null or t='') then return;end if;
 if jsonb_typeof(datos->k) is distinct from 'string' or length(trim(t)) not between minimo and maximo or t ~ '[<>]' then raise exception 'Revisá el campo %.',k;end if;
end $$;
create function privado.servicio_validar_datos(mid bigint,tipo text,datos jsonb)
returns void language plpgsql security definer set search_path='' as $$
declare d date;keys text[];k text; importe numeric;
begin
 if datos is null or jsonb_typeof(datos)<>'object' or octet_length(datos::text)>16000 then raise exception 'Revisá los datos del acuerdo.';end if;
 case tipo
 when 'visita' then
  keys:=array['nombre_visitante','foto_ref','dia','franja','nota'];
  perform privado.servicio_texto(datos,'nombre_visitante',2,120);perform privado.servicio_texto(datos,'franja',2,80);
  perform privado.servicio_texto(datos,'nota',0,1000,false);
  if datos ? 'foto_ref' and nullif(datos->>'foto_ref','') is not null then perform privado.servicio_validar_fotos(mid,jsonb_build_array(datos->>'foto_ref'));end if;
  d:=(datos->>'dia')::date;
  if d is null or d<((now() at time zone 'America/Argentina/Buenos_Aires')::date) or d>((now() at time zone 'America/Argentina/Buenos_Aires')::date+365) then raise exception 'Elegí una fecha de visita válida.';end if;
 when 'adicional' then
  keys:=array['descripcion','monto','incluye','plazo','presupuesto_base_id'];
  perform privado.servicio_texto(datos,'descripcion',5,1000);perform privado.servicio_texto(datos,'incluye',5,1000);perform privado.servicio_texto(datos,'plazo',2,200);
  if jsonb_typeof(datos->'monto') is distinct from 'number' then raise exception 'Revisá el precio adicional.';end if;
  importe:=(datos->>'monto')::numeric;
  if importe<=0 or importe>100000000 or importe<>round(importe,2) then raise exception 'Revisá el precio adicional.';end if;
  if not exists(select 1 from public.mensajes m where m.id=(datos->>'presupuesto_base_id')::bigint and m.match_id=mid and m.tipo='presupuesto' and m.estado_presupuesto='aceptado' and m.trabajo_estado is null and m.pago_estado is null) then raise exception 'El presupuesto original ya no admite adicionales.';end if;
 when 'retiro' then
  keys:=array['equipo','marca','modelo','serie','estado_equipo','accesorios','devolucion_prevista','fotos','nota'];
  perform privado.servicio_texto(datos,'equipo',2,160);perform privado.servicio_texto(datos,'estado_equipo',2,1000);
  perform privado.servicio_texto(datos,'marca',0,100,false);perform privado.servicio_texto(datos,'modelo',0,100,false);perform privado.servicio_texto(datos,'serie',0,100,false);perform privado.servicio_texto(datos,'accesorios',0,500,false);perform privado.servicio_texto(datos,'nota',0,1000,false);
  perform privado.servicio_validar_fotos(mid,coalesce(datos->'fotos','[]'));
  d:=(datos->>'devolucion_prevista')::date;
  if d is null or d<((now() at time zone 'America/Argentina/Buenos_Aires')::date) or d>((now() at time zone 'America/Argentina/Buenos_Aires')::date+365) then raise exception 'Elegí una fecha de devolución válida.';end if;
 else raise exception 'Tipo de acuerdo no válido.';
 end case;
 for k in select jsonb_object_keys(datos) loop if not k=any(keys) then raise exception 'Campo de acuerdo no permitido: %.',k;end if;end loop;
end $$;

create function privado.servicio_proponer_impl(p_match_id bigint,p_tipo text,p_datos jsonb,p_reemplaza_id uuid)
returns public.servicio_acuerdos language plpgsql security definer set search_path='' as $$
declare a public.servicio_acuerdos; anterior public.servicio_acuerdos;rol text;
begin
 rol:=privado.servicio_exigir_parte(p_match_id);
 if rol<>'proveedor' then raise exception 'El proveedor debe proponer el acuerdo.' using errcode='42501';end if;
 if not exists(select 1 from public.mensajes where match_id=p_match_id and tipo='presupuesto' and estado_presupuesto='aceptado' and trabajo_estado is null and pago_estado is null) then raise exception 'Primero debe haber un presupuesto aceptado pendiente de terminar.';end if;
 perform pg_advisory_xact_lock(hashtextextended('servicio-acuerdos:'||auth.uid()::text,0));
 if (select count(*) from public.servicio_acuerdos where propuesto_por=auth.uid() and created_at>now()-interval '1 day')>=30 then raise exception 'Llegaste al límite diario de acuerdos.';end if;
 perform privado.servicio_validar_datos(p_match_id,p_tipo,p_datos);
 if p_reemplaza_id is not null then
  select * into anterior from public.servicio_acuerdos where id=p_reemplaza_id for update;
  if anterior.id is null or anterior.match_id<>p_match_id or anterior.tipo<>p_tipo or anterior.estado in('rechazado','reemplazado','devuelto','visita_confirmada') then raise exception 'Ese acuerdo ya no se puede reemplazar.';end if;
  -- Un adicional aceptado ya es un presupuesto: nunca se cambia ni se reemplaza.
  if p_tipo='adicional' and anterior.estado<>'propuesta' then raise exception 'Un adicional aceptado no se modifica.';end if;
  if p_tipo='retiro' and anterior.estado<>'propuesta' then raise exception 'Un retiro confirmado no se modifica.';end if;
  update public.servicio_acuerdos set estado='reemplazado',version=version+1,updated_at=now() where id=anterior.id;
 end if;
 insert into public.servicio_acuerdos(match_id,tipo,datos,propuesto_por,reemplaza_id) values(p_match_id,p_tipo,p_datos,auth.uid(),p_reemplaza_id) returning * into a;
 return a;
end $$;
create function public.servicio_proponer(p_match_id bigint,p_tipo text,p_datos jsonb,p_reemplaza_id uuid default null)
returns public.servicio_acuerdos language sql security invoker set search_path='' as $$select privado.servicio_proponer_impl(p_match_id,p_tipo,p_datos,p_reemplaza_id);$$;

create function privado.servicio_responder_impl(p_id uuid,p_aceptar boolean,p_version integer)
returns public.servicio_acuerdos language plpgsql security definer set search_path='' as $$
declare a public.servicio_acuerdos;mid bigint;rol text;msg bigint;
begin
 select match_id into mid from public.servicio_acuerdos where id=p_id;
 rol:=privado.servicio_exigir_parte(mid);
 if rol<>'cliente' then raise exception 'Solo el cliente puede aceptar o rechazar.' using errcode='42501';end if;
 select * into a from public.servicio_acuerdos where id=p_id for update;
 if a.estado in('aceptado','rechazado') and a.respondido_por=auth.uid() and ((p_aceptar and a.estado='aceptado') or (not p_aceptar and a.estado='rechazado')) then return a;end if;
 if p_aceptar is null or a.estado<>'propuesta' or a.version is distinct from p_version then raise exception 'El acuerdo cambió. Volvé a cargarlo.' using errcode='40001';end if;
 if p_aceptar then
  -- El flujo anterior de terminar/pagar actualiza mensajes directamente. Bloquear
  -- su fila evita aceptar un acuerdo sobre un presupuesto que termina a la vez.
  perform 1 from public.mensajes where match_id=mid and tipo='presupuesto' and estado_presupuesto='aceptado' and trabajo_estado is null and pago_estado is null order by id limit 1 for update;
  if not found then raise exception 'El trabajo ya no admite nuevos acuerdos.';end if;
  -- Valida de nuevo el presupuesto base, pero las fotos ya fueron comprobadas al proponer.
  if a.tipo='adicional' then
   perform 1 from public.mensajes where id=(a.datos->>'presupuesto_base_id')::bigint and match_id=mid and tipo='presupuesto' and estado_presupuesto='aceptado' and trabajo_estado is null and pago_estado is null for update;
   if not found then raise exception 'El presupuesto original ya no admite adicionales.';end if;
   insert into public.mensajes(match_id,remitente_tipo,tipo,contenido,monto,incluye,plazo,estado_presupuesto)
   values(mid,'proveedor','presupuesto','Adicional aceptado: '||(a.datos->>'descripcion'),(a.datos->>'monto')::numeric,a.datos->>'incluye',a.datos->>'plazo','aceptado') returning id into msg;
  end if;
 end if;
 update public.servicio_acuerdos set estado=case when p_aceptar then 'aceptado' else 'rechazado' end,respondido_por=auth.uid(),respondido_at=now(),updated_at=now(),version=version+1,presupuesto_id=msg where id=p_id returning * into a;
 return a;
end $$;
create function public.servicio_responder(p_id uuid,p_aceptar boolean,p_version integer)
returns public.servicio_acuerdos language sql security invoker set search_path='' as $$select privado.servicio_responder_impl(p_id,p_aceptar,p_version);$$;

create function privado.servicio_cambiar_estado_impl(p_id uuid,p_estado text,p_version integer)
returns public.servicio_acuerdos language plpgsql security definer set search_path='' as $$
declare a public.servicio_acuerdos;mid bigint;rol text;permitido boolean:=false;
begin
 select match_id into mid from public.servicio_acuerdos where id=p_id;
 rol:=privado.servicio_exigir_parte(mid);
 select * into a from public.servicio_acuerdos where id=p_id for update;
 if a.version is distinct from p_version then raise exception 'El acuerdo cambió. Volvé a cargarlo.' using errcode='40001';end if;
 if a.tipo='visita' then permitido:=(rol='proveedor' and ((a.estado='aceptado' and p_estado='en_camino') or (a.estado='en_camino' and p_estado='llego'))) or (rol='cliente' and a.estado='llego' and p_estado='visita_confirmada');
 elsif a.tipo='retiro' then permitido:=(rol='proveedor' and ((a.estado='aceptado' and p_estado='retiro_realizado') or (a.estado='retiro_realizado' and p_estado='devolucion_informada'))) or (rol='cliente' and a.estado in('retiro_realizado','devolucion_informada') and p_estado='devuelto');end if;
 if not permitido then raise exception 'No podés hacer ese cambio de estado.' using errcode='42501';end if;
 update public.servicio_acuerdos set estado=p_estado,version=version+1,updated_at=now() where id=p_id returning * into a;
 return a;
end $$;
create function public.servicio_cambiar_estado(p_id uuid,p_estado text,p_version integer)
returns public.servicio_acuerdos language sql security invoker set search_path='' as $$select privado.servicio_cambiar_estado_impl(p_id,p_estado,p_version);$$;

create function privado.servicio_abrir_reclamo_impl(p_match_id bigint,p_motivo text,p_detalle text,p_fotos jsonb)
returns public.servicio_reclamos language plpgsql security definer set search_path='' as $$
declare r public.servicio_reclamos;
begin
 perform privado.servicio_exigir_parte(p_match_id,false);
 if length(trim(p_motivo)) not between 3 and 120 or length(trim(p_detalle)) not between 10 and 4000 or p_motivo is null or p_detalle is null or p_motivo ~ '[<>]' or p_detalle ~ '[<>]' then raise exception 'Contanos el motivo y qué pasó, sin código HTML.';end if;
 perform privado.servicio_validar_fotos(p_match_id,p_fotos);
 select * into r from public.servicio_reclamos where match_id=p_match_id and reportante=auth.uid() and estado in('recibido','en_revision') order by created_at desc limit 1;
 if r.id is not null then return r;end if;
 perform pg_advisory_xact_lock(hashtextextended('servicio-reclamos:'||auth.uid()::text,0));
 if (select count(*) from public.servicio_reclamos where reportante=auth.uid() and created_at>now()-interval '1 day')>=5 then raise exception 'Llegaste al límite diario de reclamos.';end if;
 insert into public.servicio_reclamos(match_id,reportante,motivo,detalle,fotos) values(p_match_id,auth.uid(),trim(p_motivo),trim(p_detalle),p_fotos) returning * into r;
 return r;
end $$;
create function public.servicio_abrir_reclamo(p_match_id bigint,p_motivo text,p_detalle text,p_fotos jsonb default '[]')
returns public.servicio_reclamos language sql security invoker set search_path='' as $$select privado.servicio_abrir_reclamo_impl(p_match_id,p_motivo,p_detalle,p_fotos);$$;
create function privado.servicio_comentar_reclamo_impl(p_id uuid,p_texto text,p_fotos jsonb)
returns public.servicio_reclamo_eventos language plpgsql security definer set search_path='' as $$
declare r public.servicio_reclamos;e public.servicio_reclamo_eventos;
begin
 select * into r from public.servicio_reclamos where id=p_id;
 perform privado.servicio_exigir_parte(r.match_id,false);
 -- Releer con lock: soporte puede haber cerrado el caso durante la autorización.
 select * into r from public.servicio_reclamos where id=p_id for update;
 if r.estado not in('recibido','en_revision') then raise exception 'El reclamo está cerrado.';end if;
 if p_texto is null or length(trim(p_texto)) not between 1 and 4000 or p_texto ~ '[<>]' then raise exception 'Escribí un comentario de hasta4000 caracteres, sin HTML.';end if;
 perform privado.servicio_validar_fotos(r.match_id,p_fotos);
 perform pg_advisory_xact_lock(hashtextextended('servicio-comentarios:'||auth.uid()::text,0));
 if (select count(*) from public.servicio_reclamo_eventos where autor=auth.uid() and created_at>now()-interval '1 day')>=20 then raise exception 'Llegaste al límite diario de comentarios.';end if;
 insert into public.servicio_reclamo_eventos(reclamo_id,autor,tipo,texto,fotos) values(p_id,auth.uid(),'comentario',trim(p_texto),p_fotos) returning * into e;
 return e;
end $$;
create function public.servicio_comentar_reclamo(p_id uuid,p_texto text,p_fotos jsonb default '[]')
returns public.servicio_reclamo_eventos language sql security invoker set search_path='' as $$select privado.servicio_comentar_reclamo_impl(p_id,p_texto,p_fotos);$$;

-- Operador humano: disponible sólo al servidor, jamás a la cuenta pública.
create function public.servicio_soporte_reclamo(p_id uuid,p_estado text,p_texto text,p_version integer)
returns public.servicio_reclamos language plpgsql security definer set search_path='' as $$
declare r public.servicio_reclamos;
begin
 if session_user not in('postgres','supabase_admin') and coalesce(current_setting('request.jwt.claim.role',true),'')<>'service_role' and coalesce(current_setting('request.jwt.claims',true),'{}')::jsonb->>'role' is distinct from 'service_role' then raise exception 'Solo soporte.' using errcode='42501';end if;
 if p_estado not in('en_revision','resuelto','cerrado') or p_texto is null or length(trim(p_texto)) not between 5 and 4000 or p_texto ~ '[<>]' then raise exception 'Revisá la respuesta de soporte.';end if;
 select * into r from public.servicio_reclamos where id=p_id for update;
 if r.id is null or r.version is distinct from p_version or r.estado in('resuelto','cerrado') then raise exception 'El reclamo cambió o ya está cerrado.' using errcode='40001';end if;
 update public.servicio_reclamos set estado=p_estado,version=version+1,updated_at=now() where id=p_id returning * into r;
 insert into public.servicio_reclamo_eventos(reclamo_id,tipo,texto) values(p_id,'soporte',trim(p_texto));
 return r;
end $$;

-- Una baja no se bloquea por un reclamo: resguarda sólo el expediente mínimo.
create function privado.servicio_resguardar_match()
returns trigger language plpgsql security definer set search_path='' as $$
declare r record;ac jsonb;
begin
 for r in select * from public.servicio_reclamos where match_id=old.id and estado in('recibido','en_revision') loop
  insert into privado.servicio_resguardos(referencia,tipo,expediente)
  values(r.id,'reclamo',jsonb_build_object('caso',r.id,'estado',r.estado,'abierto_at',r.created_at,'motivo',left(r.motivo,120),'detalle',left(r.detalle,4000),'comentarios',coalesce((select jsonb_agg(jsonb_build_object('tipo',e.tipo,'fecha',e.created_at,'texto',left(e.texto,1000))) from (select tipo,created_at,texto from public.servicio_reclamo_eventos where reclamo_id=r.id order by created_at desc limit 20)e),'[]')))
  on conflict(referencia,tipo) do nothing;
 end loop;
 for r in select * from public.servicio_acuerdos where match_id=old.id and tipo='retiro' and estado in('aceptado','retiro_realizado','devolucion_informada') loop
  ac:=jsonb_build_object('recibo',r.id,'estado',r.estado,'fecha',r.created_at,'equipo',r.datos->>'equipo','marca',r.datos->>'marca','modelo',r.datos->>'modelo','serie',r.datos->>'serie','estado_equipo',r.datos->>'estado_equipo','accesorios',r.datos->>'accesorios','devolucion_prevista',r.datos->>'devolucion_prevista');
  insert into privado.servicio_resguardos(referencia,tipo,expediente) values(r.id,'retiro',ac) on conflict(referencia,tipo) do nothing;
 end loop;
 return old;
end $$;
create trigger servicio_resguardar_antes_baja before delete on public.matches for each row execute function privado.servicio_resguardar_match();
create function privado.servicio_encolar_fotos_borradas()
returns trigger language plpgsql security definer set search_path='' as $$
declare refs jsonb;ref text;
begin
 if tg_table_name='servicio_acuerdos' then refs:=coalesce(old.datos->'fotos','[]');if nullif(old.datos->>'foto_ref','') is not null then refs:=refs||jsonb_build_array(old.datos->>'foto_ref');end if;
 else refs:=old.fotos;end if;
 for ref in select jsonb_array_elements_text(refs) loop insert into privado.servicio_archivos_por_borrar(nombre) values(ref) on conflict do nothing;end loop;
 return old;
end $$;
create trigger servicio_fotos_acuerdo_borrado before delete on public.servicio_acuerdos for each row execute function privado.servicio_encolar_fotos_borradas();
create trigger servicio_fotos_reclamo_borrado before delete on public.servicio_reclamos for each row execute function privado.servicio_encolar_fotos_borradas();
create trigger servicio_fotos_evento_borrado before delete on public.servicio_reclamo_eventos for each row execute function privado.servicio_encolar_fotos_borradas();
create function public.servicio_evidencias_pendientes_borrado(p_limit integer default 100)
returns table(nombre text) language plpgsql security definer set search_path='' as $$
declare obj record;n integer:=0;
begin
 for obj in
  -- Incluir la cola aunque Storage ya no tenga el objeto: una eliminación
  -- aceptada con respuesta perdida se puede confirmar y limpiar idempotentemente.
  select q.nombre as name from privado.servicio_archivos_por_borrar q where not privado.servicio_ref_usada(q.nombre)
  union
  select o.name from storage.objects o where o.bucket_id='servicio-evidencias' and not privado.servicio_ref_usada(o.name) and o.created_at<now()-interval '1 day'
  order by name
 loop
  -- Serializa publicación y retiro de archivos con el mismo lock del match.
  perform 1 from public.matches where id=privado.servicio_ref_match(obj.name) for update;
  if privado.servicio_ref_usada(obj.name) then continue;end if;
  insert into privado.servicio_archivos_por_borrar(nombre) values(obj.name) on conflict do nothing;
  nombre:=obj.name;return next;n:=n+1;
  exit when n>=least(greatest(p_limit,1),1000);
 end loop;
end $$;
create function public.servicio_evidencias_borradas(p_names text[])
returns integer language plpgsql security definer set search_path='' as $$
declare n integer;
begin
 delete from privado.servicio_archivos_por_borrar where nombre=any(p_names);get diagnostics n=row_count;return n;
end $$;
create function privado.purgar_resguardos_servicio()
returns integer language plpgsql security definer set search_path='' as $$
declare n integer;
begin
 delete from privado.servicio_resguardos where eliminar_at<=now();get diagnostics n=row_count;
 delete from public.servicio_reclamos where estado in('resuelto','cerrado') and updated_at<=now()-interval '180 days';
 return n;
end $$;

-- RPC invoker exterior y funciones privadas internas: ACL explícita por firma.
revoke all on function privado.servicio_es_parte(bigint),privado.servicio_exigir_parte(bigint,boolean),privado.servicio_ref_match(text),privado.servicio_ref_usada(text),privado.servicio_puede_subir(text),privado.servicio_validar_fotos(bigint,jsonb),privado.servicio_texto(jsonb,text,integer,integer,boolean),privado.servicio_validar_datos(bigint,text,jsonb),privado.servicio_proponer_impl(bigint,text,jsonb,uuid),privado.servicio_responder_impl(uuid,boolean,integer),privado.servicio_cambiar_estado_impl(uuid,text,integer),privado.servicio_abrir_reclamo_impl(bigint,text,text,jsonb),privado.servicio_comentar_reclamo_impl(uuid,text,jsonb),privado.servicio_resguardar_match(),privado.servicio_encolar_fotos_borradas(),privado.purgar_resguardos_servicio() from public,anon,authenticated;
grant usage on schema privado to authenticated;
grant execute on function privado.servicio_es_parte(bigint),privado.servicio_ref_match(text),privado.servicio_ref_usada(text),privado.servicio_puede_subir(text),privado.servicio_proponer_impl(bigint,text,jsonb,uuid),privado.servicio_responder_impl(uuid,boolean,integer),privado.servicio_cambiar_estado_impl(uuid,text,integer),privado.servicio_abrir_reclamo_impl(bigint,text,text,jsonb),privado.servicio_comentar_reclamo_impl(uuid,text,jsonb) to authenticated;
revoke all on function public.servicio_proponer(bigint,text,jsonb,uuid),public.servicio_responder(uuid,boolean,integer),public.servicio_cambiar_estado(uuid,text,integer),public.servicio_abrir_reclamo(bigint,text,text,jsonb),public.servicio_comentar_reclamo(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.servicio_proponer(bigint,text,jsonb,uuid),public.servicio_responder(uuid,boolean,integer),public.servicio_cambiar_estado(uuid,text,integer),public.servicio_abrir_reclamo(bigint,text,text,jsonb),public.servicio_comentar_reclamo(uuid,text,jsonb) to authenticated;
revoke all on function public.servicio_soporte_reclamo(uuid,text,text,integer),public.servicio_evidencias_pendientes_borrado(integer),public.servicio_evidencias_borradas(text[]) from public,anon,authenticated;
grant execute on function public.servicio_soporte_reclamo(uuid,text,text,integer),public.servicio_evidencias_pendientes_borrado(integer),public.servicio_evidencias_borradas(text[]),privado.purgar_resguardos_servicio() to service_role;

-- En producción pg_cron está instalado. No hay envíos, pagos ni llamadas externas.
do $$begin
 if exists(select 1 from pg_namespace where nspname='cron') then
  perform cron.schedule('servicio-resguardos-purga','17 6 * * *','select privado.purgar_resguardos_servicio()');
 end if;
end $$;
notify pgrst,'reload schema';
