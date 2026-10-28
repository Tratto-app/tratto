-- Trabajo protegido (fundador, 28/10/2026).
--
-- El cliente puede proteger un presupuesto aceptado pagándole a Tratto una
-- cuota del 5 % del presupuesto (mínimo $1.500). Si quien hace el trabajo no
-- lo termina, el cliente elige:
--   * seguir: Tratto le consigue, en 48 h hábiles desde el reclamo, otra
--     persona con identidad comprobada de su zona que le pase presupuesto para
--     terminarlo. Si no la consigue, le devuelve la cuota;
--   * no seguir: Tratto le devuelve la cuota.
-- Tratto no paga la diferencia ni ninguna parte del trabajo. No es un seguro
-- (Ley 20.091: solo las aseguradoras autorizadas venden seguros); es un
-- compromiso comercial de Tratto y así se lo nombra en la app y los términos.
--
-- Solo se ofrece cuando quien hace el trabajo tiene la identidad comprobada y
-- Mercado Pago conectado. La identidad la revisa una persona del equipo
-- (DNI de frente y de dorso y una selfie con el DNI); las fotos se borran
-- apenas se decide. No se piden antecedentes penales (Ley 25.326, art. 7.4).
--
-- También queda la lista de rubros que admiten adelanto (seña) por la app,
-- para la segunda etapa. El cobro de la cuota y las devoluciones los hace la
-- función trabajo-protegido con la cuenta de Mercado Pago de Tratto.

-- ── Quién es soporte: los miembros owner o admin del CRM ───────────────────
create or replace function privado.es_soporte()
returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(
  select 1 from public.growth_members m where m.user_id=auth.uid() and m.role in('owner','admin'));
$$;
create or replace function privado.es_servidor()
returns boolean language sql stable set search_path='' as $$
 select session_user in('postgres','supabase_admin')
  or coalesce(current_setting('request.jwt.claim.role',true),'')='service_role'
  or coalesce(current_setting('request.jwt.claims',true),'{}')::jsonb->>'role'='service_role';
$$;

-- Dos días hábiles (lunes a viernes, hora de Buenos Aires). Los feriados no
-- se descuentan: el plazo que se promete es el más corto de los dos.
create or replace function privado.sumar_dias_habiles(desde timestamptz, dias integer)
returns timestamptz language plpgsql stable set search_path='' as $$
declare t timestamptz:=desde; n integer:=0;
begin
 while n<dias loop
  t:=t+interval '1 day';
  if extract(isodow from t at time zone 'America/Argentina/Buenos_Aires')<6 then n:=n+1;end if;
 end loop;
 return t;
end $$;

-- ── Rubros que admiten adelanto por la app (segunda etapa) ─────────────────
-- Solo los que tienen que comprar algo para ese trabajo antes de empezar o
-- reservar una fecha que los hace rechazar otros trabajos. El resto cobra al
-- terminar, como hoy: un adelanto donde no hace falta solo suma riesgo.
create table public.rubros_adelanto (
 rubro text primary key,
 tope_porc smallint not null check(tope_porc between 1 and 50),
 para text not null check(para in('materiales','repuestos','tasas','insumos','reservar_fecha'))
);
alter table public.rubros_adelanto enable row level security;
revoke all on public.rubros_adelanto from public,anon,authenticated;
grant select on public.rubros_adelanto to anon,authenticated;
grant all on public.rubros_adelanto to service_role;
create policy rubros_adelanto_lectura on public.rubros_adelanto for select using(true);
insert into public.rubros_adelanto(rubro,tope_porc,para) values
 ('Plomería y destapaciones',40,'materiales'),
 ('Albañilería y refacciones',40,'materiales'),
 ('Pintura',40,'materiales'),
 ('Carpintería y muebles',40,'materiales'),
 ('Herrería y soldadura',40,'materiales'),
 ('Techos e impermeabilización',40,'materiales'),
 ('Durlock y yeso',40,'materiales'),
 ('Pisos y revestimientos',40,'materiales'),
 ('Vidrios y aberturas',40,'materiales'),
 ('Aire acondicionado',40,'materiales'),
 ('Jardinería y piletas',40,'materiales'),
 ('Tapicería y restauración',40,'materiales'),
 ('Decoración e interiores',40,'materiales'),
 ('Service de electrodomésticos',40,'repuestos'),
 ('Mecánica del automotor',40,'repuestos'),
 ('Chapa y pintura',40,'repuestos'),
 ('Reparación y soporte técnico',40,'repuestos'),
 ('Gestoría y trámites',40,'tasas'),
 ('Catering y pastelería',40,'insumos'),
 ('Fletes y mudanzas',30,'reservar_fecha'),
 ('Fotografía y video',30,'reservar_fecha'),
 ('Música y sonido (DJ)',30,'reservar_fecha'),
 ('Animación y organización de eventos',30,'reservar_fecha');

-- ── Distintivos públicos ───────────────────────────────────────────────────
-- Uno por aspecto revisado, con la fecha del control. Nada de un "verificado"
-- general que parezca certificar todo: "identidad" solo dice que una persona
-- del equipo comparó el DNI con la selfie y con el nombre del perfil.
create table public.distintivos (
 user_id uuid not null references auth.users(id) on delete cascade,
 tipo text not null check(tipo in('identidad')),
 desde date not null default current_date,
 primary key(user_id,tipo)
);
alter table public.distintivos enable row level security;
revoke all on public.distintivos from public,anon,authenticated;
grant select on public.distintivos to anon,authenticated;
grant all on public.distintivos to service_role;
create policy distintivos_lectura on public.distintivos for select using(true);

-- ── Pedidos de comprobación de identidad ───────────────────────────────────
create table privado.identidad_solicitudes (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 nombre text not null check(length(nombre) between 3 and 120),
 archivos text[] not null check(array_length(archivos,1)=3),   -- frente, dorso, selfie
 estado text not null default 'pendiente' check(estado in('pendiente','aprobada','rechazada')),
 motivo text check(motivo is null or length(motivo)<=300),
 created_at timestamptz not null default now(),
 decidida_at timestamptz, decidida_por uuid
);
create unique index identidad_una_pendiente on privado.identidad_solicitudes(user_id) where estado='pendiente';
create index identidad_por_usuario on privado.identidad_solicitudes(user_id,created_at desc);
alter table privado.identidad_solicitudes enable row level security;
revoke all on privado.identidad_solicitudes from public,anon,authenticated;
grant all on privado.identidad_solicitudes to service_role;

-- Bucket privado: nadie lo lee salvo soporte (para revisarlo) y el servidor
-- (para borrarlo). Quien sube no puede volver a bajar ni reemplazar archivos.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('identidad','identidad',false,6291456,array['image/jpeg','image/png','image/webp'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

create or replace function privado.identidad_puede_subir(ref text)
returns boolean language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or ref is null
  or ref !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|jpeg|png|webp)$'
  or split_part(ref,'/',1)<>auth.uid()::text
  or not exists(select 1 from public.proveedores p where p.user_id=auth.uid() and coalesce(p.demo,false)=false)
 then return false;end if;
 perform pg_advisory_xact_lock(hashtextextended('identidad-fotos:'||auth.uid()::text,0));
 return (select count(*) from storage.objects where bucket_id='identidad'
         and split_part(name,'/',1)=auth.uid()::text and created_at>now()-interval '1 day')<9;
end $$;
create policy identidad_subir on storage.objects for insert to authenticated
 with check(bucket_id='identidad' and privado.identidad_puede_subir(name));
create policy identidad_leer_soporte on storage.objects for select to authenticated
 using(bucket_id='identidad' and privado.es_soporte());

create or replace function public.identidad_pedir(p_nombre text,p_frente text,p_dorso text,p_selfie text)
returns text language plpgsql security definer set search_path='' as $$
declare arch text[]:=array[p_frente,p_dorso,p_selfie]; f text; sid uuid;
begin
 if auth.uid() is null then raise exception 'Iniciá sesión.' using errcode='42501';end if;
 if not exists(select 1 from public.proveedores p where p.user_id=auth.uid() and coalesce(p.demo,false)=false) then
  raise exception 'Primero publicá un servicio.';end if;
 if exists(select 1 from public.distintivos d where d.user_id=auth.uid() and d.tipo='identidad') then
  raise exception 'Tu identidad ya está comprobada.';end if;
 if exists(select 1 from privado.identidad_solicitudes s where s.user_id=auth.uid() and s.estado='pendiente') then
  raise exception 'Ya la mandaste. Te avisamos cuando la revisemos.';end if;
 if p_nombre is null or length(trim(p_nombre)) not between 3 and 120 or p_nombre ~ '[<>]' then
  raise exception 'Escribí tu nombre y apellido como figuran en el DNI.';end if;
 if (select count(distinct x) from unnest(arch) x)<>3 then raise exception 'Faltan fotos.';end if;
 foreach f in array arch loop
  if f is null or split_part(f,'/',1)<>auth.uid()::text
   or not exists(select 1 from storage.objects o where o.bucket_id='identidad' and o.name=f) then
   raise exception 'Volvé a subir las fotos.';end if;
 end loop;
 if (select count(*) from privado.identidad_solicitudes s where s.user_id=auth.uid() and s.created_at>now()-interval '30 days')>=3 then
  raise exception 'Llegaste al límite de envíos del mes. Escribinos a soporte.';end if;
 insert into privado.identidad_solicitudes(user_id,nombre,archivos) values(auth.uid(),trim(p_nombre),arch) returning id into sid;
 perform privado.avisar('identidad_'||sid::text,'Identidad para revisar',
  'Alguien que ofrece servicios mandó su DNI y su selfie para comprobar su identidad. '
  ||'Revisalo en el CRM, sección Confianza. Las fotos se borran apenas decidís.');
 return 'pendiente';
end $$;

create or replace function public.identidad_mi_estado()
returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object(
  'desde',(select d.desde from public.distintivos d where d.user_id=auth.uid() and d.tipo='identidad'),
  'estado',s.estado,'motivo',s.motivo,'fecha',s.created_at)
 from (select 1) uno
 left join lateral (select * from privado.identidad_solicitudes x where x.user_id=auth.uid()
                    order by x.created_at desc limit 1) s on true
 where auth.uid() is not null;
$$;

create or replace function public.identidad_pendientes()
returns table(id uuid,user_id uuid,nombre_dni text,nombre_perfil text,email text,archivos text[],
              mp_conectada boolean,created_at timestamptz)
language plpgsql stable security definer set search_path='' as $$
begin
 if not privado.es_soporte() then raise exception 'Solo soporte.' using errcode='42501';end if;
 return query
 select s.id,s.user_id,s.nombre,
  coalesce((select pp.nombre from public.perfil_proveedor pp where pp.user_id=s.user_id),
           (select p.nombre from public.proveedores p where p.user_id=s.user_id order by p.created_at limit 1)),
  (select u.email::text from auth.users u where u.id=s.user_id),
  s.archivos,
  exists(select 1 from public.cuentas_mp c where c.user_id=s.user_id),
  s.created_at
 from privado.identidad_solicitudes s where s.estado='pendiente' order by s.created_at;
end $$;

create or replace function public.identidad_decidir(p_id uuid,p_aprobar boolean,p_motivo text default null)
returns text language plpgsql security definer set search_path='' as $$
declare s privado.identidad_solicitudes;
begin
 if not privado.es_soporte() then raise exception 'Solo soporte.' using errcode='42501';end if;
 if p_aprobar is null then raise exception 'Elegí aprobar o rechazar.';end if;
 if not p_aprobar and (p_motivo is null or length(trim(p_motivo)) not between 5 and 300 or p_motivo ~ '[<>]') then
  raise exception 'Contale por qué no se aprobó (para que lo pueda corregir).';end if;
 select * into s from privado.identidad_solicitudes where id=p_id for update;
 if s.id is null or s.estado<>'pendiente' then raise exception 'Ese pedido ya se decidió.';end if;
 update privado.identidad_solicitudes set estado=case when p_aprobar then 'aprobada' else 'rechazada' end,
  motivo=case when p_aprobar then null else trim(p_motivo) end,decidida_at=now(),decidida_por=auth.uid()
 where id=p_id;
 if p_aprobar then
  insert into public.distintivos(user_id,tipo,desde) values(s.user_id,'identidad',current_date)
  on conflict(user_id,tipo) do update set desde=excluded.desde;
 end if;
 -- Las fotos dejan de servir apenas se decide: se borran ya (y si falla,
 -- en la limpieza de cada noche).
 perform privado.trabajo_protegido_llamar('limpiar');
 return case when p_aprobar then 'aprobada' else 'rechazada' end;
end $$;

-- Archivos del bucket que ya no hacen falta: todo lo que no es parte de un
-- pedido pendiente (decididos, cuentas borradas, subidas sin enviar) y tiene
-- más de una hora (para no borrar lo que alguien está subiendo ahora).
create or replace function public.identidad_archivos_por_borrar(p_limite integer default 200)
returns setof text language plpgsql stable security definer set search_path='' as $$
begin
 if not privado.es_servidor() then raise exception 'Solo el servidor.' using errcode='42501';end if;
 return query
 select o.name from storage.objects o
 where o.bucket_id='identidad'
   and not exists(select 1 from privado.identidad_solicitudes s where s.estado='pendiente' and o.name=any(s.archivos))
   and (o.created_at<now()-interval '1 hour'
        or exists(select 1 from privado.identidad_solicitudes s where s.estado<>'pendiente' and o.name=any(s.archivos)))
 order by o.created_at limit greatest(1,least(coalesce(p_limite,200),500));
end $$;

-- ── Trabajos protegidos ────────────────────────────────────────────────────
create table public.trabajos_protegidos (
 id uuid primary key default gen_random_uuid(),
 presupuesto_id bigint unique references public.mensajes(id) on delete set null,
 match_id bigint references public.matches(id) on delete set null,
 cliente uuid references auth.users(id) on delete set null,
 proveedor uuid references auth.users(id) on delete set null,
 monto numeric(14,2) not null check(monto>0),
 cuota numeric(14,2) not null check(cuota>0),
 pago_id text not null unique,
 estado text not null default 'activa' check(estado in(
  'activa','cumplida','reclamada','reemplazo_conseguido','devolucion_pendiente','devuelta')),
 quiere_seguir boolean,
 plazo_reemplazo timestamptz,
 reclamo_id uuid references public.servicio_reclamos(id) on delete set null,
 devolucion_id text,
 version integer not null default 1,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 reclamada_at timestamptz,
 resuelta_at timestamptz
);
create index trabajos_protegidos_match on public.trabajos_protegidos(match_id);
create index trabajos_protegidos_estado on public.trabajos_protegidos(estado,plazo_reemplazo);
alter table public.trabajos_protegidos enable row level security;
revoke all on public.trabajos_protegidos from public,anon,authenticated;
grant select on public.trabajos_protegidos to authenticated;
grant all on public.trabajos_protegidos to service_role;
-- Lo ven las dos partes (quien hace el trabajo también: saber que está
-- protegido es parte de lo que desalienta abandonarlo) y soporte.
create policy trabajos_protegidos_lectura on public.trabajos_protegidos for select to authenticated
 using(auth.uid() in(cliente,proveedor) or privado.es_soporte());

-- Lo que paga el cliente: 5 % del presupuesto, mínimo $1.500, en pesos enteros.
create or replace function privado.cuota_proteccion(monto numeric)
returns numeric language sql immutable set search_path='' as $$
 select greatest(1500,round(monto*0.05));
$$;

-- Puede proteger este presupuesto quien lo aceptó como cliente, mientras el
-- trabajo no esté terminado ni pagado, si quien lo hace tiene la identidad
-- comprobada y Mercado Pago conectado, y no hay un reclamo abierto.
create or replace function privado.proteccion_chequear(p_presupuesto_id bigint,p_cliente uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare m public.mensajes; cli uuid; prov uuid; motivo text;
begin
 select * into m from public.mensajes where id=p_presupuesto_id;
 if m.id is null or m.tipo<>'presupuesto' then return jsonb_build_object('puede',false,'motivo','No encontramos ese presupuesto.');end if;
 select s.user_id,p.user_id into cli,prov from public.matches x
  join public.solicitudes s on s.id=x.solicitud_id join public.proveedores p on p.id=x.proveedor_id where x.id=m.match_id;
 if p_cliente is null or cli is distinct from p_cliente then return jsonb_build_object('puede',false,'motivo','Solo quien pidió el trabajo puede protegerlo.');end if;
 if exists(select 1 from public.trabajos_protegidos t where t.presupuesto_id=m.id) then motivo:='Este trabajo ya está protegido.';
 elsif m.estado_presupuesto is distinct from 'aceptado' then motivo:='Primero aceptá el presupuesto.';
 elsif m.trabajo_estado is not null or m.pago_estado is not null then motivo:='El trabajo ya está terminado.';
 elsif coalesce(m.monto,0)<=0 then motivo:='El presupuesto no tiene monto.';
 elsif not exists(select 1 from public.distintivos d where d.user_id=prov and d.tipo='identidad') then
  motivo:='Quien hace el trabajo todavía no comprobó su identidad.';
 elsif not exists(select 1 from public.cuentas_mp c where c.user_id=prov) then
  motivo:='Quien hace el trabajo todavía no conectó Mercado Pago.';
 elsif exists(select 1 from public.servicio_reclamos r where r.match_id=m.match_id and r.estado in('recibido','en_revision')) then
  motivo:='Hay un reclamo abierto en este trabajo.';
 elsif privado.hay_bloqueo(cli,prov) then motivo:='Esta conversación está cerrada.';
 end if;
 return jsonb_build_object('puede',motivo is null,'motivo',motivo,'monto',m.monto,
  'cuota',privado.cuota_proteccion(m.monto),'match_id',m.match_id,'proveedor',prov);
end $$;

-- Para la app: si se puede proteger y cuánto sale.
create or replace function public.proteccion_cotizar(p_presupuesto_id bigint)
returns jsonb language sql stable security definer set search_path='' as $$
 select privado.proteccion_chequear(p_presupuesto_id,auth.uid()) - 'proveedor' - 'match_id';
$$;

-- Para la función trabajo-protegido, antes de cobrar (la identidad del
-- cliente la saca la función del token de sesión, no del pedido).
create or replace function public.proteccion_preparar(p_presupuesto_id bigint,p_cliente uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not privado.es_servidor() then raise exception 'Solo el servidor.' using errcode='42501';end if;
 return privado.proteccion_chequear(p_presupuesto_id,p_cliente);
end $$;

-- Después de que Mercado Pago aprobó el cobro. Devuelve 'activa' o
-- 'duplicado' (otro cobro ganó la carrera: la función devuelve este).
create or replace function public.proteccion_activar(p_presupuesto_id bigint,p_cliente uuid,p_pago_id text,p_cuota numeric)
returns text language plpgsql security definer set search_path='' as $$
declare c jsonb;
begin
 if not privado.es_servidor() then raise exception 'Solo el servidor.' using errcode='42501';end if;
 if exists(select 1 from public.trabajos_protegidos where pago_id=p_pago_id) then return 'activa';end if;
 perform pg_advisory_xact_lock(hashtextextended('proteccion:'||p_presupuesto_id::text,0));
 if exists(select 1 from public.trabajos_protegidos where presupuesto_id=p_presupuesto_id) then return 'duplicado';end if;
 c:=privado.proteccion_chequear(p_presupuesto_id,p_cliente);
 if (c->>'cuota')::numeric is distinct from p_cuota then return 'duplicado';end if;
 -- Si entre la cotización y el cobro se terminó el trabajo o se abrió un
 -- reclamo, igual se registra: el cliente ya pagó y soporte decide.
 insert into public.trabajos_protegidos(presupuesto_id,match_id,cliente,proveedor,monto,cuota,pago_id)
 values(p_presupuesto_id,(c->>'match_id')::bigint,p_cliente,(c->>'proveedor')::uuid,(c->>'monto')::numeric,p_cuota,p_pago_id);
 return 'activa';
end $$;

-- El cliente reclama que no se lo terminaron y elige si quiere seguir.
create or replace function public.proteccion_reclamar(p_presupuesto_id bigint,p_seguir boolean,p_detalle text)
returns public.trabajos_protegidos language plpgsql security definer set search_path='' as $$
declare t public.trabajos_protegidos; m public.mensajes; r public.servicio_reclamos;
begin
 if auth.uid() is null then raise exception 'Iniciá sesión.' using errcode='42501';end if;
 select * into t from public.trabajos_protegidos where presupuesto_id=p_presupuesto_id for update;
 if t.id is null or t.cliente is distinct from auth.uid() then raise exception 'Este trabajo no está protegido a tu nombre.' using errcode='42501';end if;
 if t.estado<>'activa' then raise exception 'Ya hay un reclamo en marcha por este trabajo.';end if;
 select * into m from public.mensajes where id=p_presupuesto_id;
 if m.pago_estado is not null then raise exception 'Este trabajo ya lo pagaste como terminado.';end if;
 if p_seguir is null then raise exception 'Elegí si querés que lo termine otra persona.';end if;
 if p_detalle is null or length(trim(p_detalle)) not between 10 and 4000 or p_detalle ~ '[<>]' then
  raise exception 'Contanos en unas líneas qué pasó (sin código HTML).';end if;
 select * into r from public.servicio_reclamos where match_id=t.match_id and reportante=auth.uid()
  and estado in('recibido','en_revision') order by created_at desc limit 1;
 if r.id is null then
  insert into public.servicio_reclamos(match_id,reportante,motivo,detalle)
  values(t.match_id,auth.uid(),'No terminó el trabajo (Trabajo protegido)',trim(p_detalle)) returning * into r;
 else
  insert into public.servicio_reclamo_eventos(reclamo_id,autor,tipo,texto)
  values(r.id,auth.uid(),'comentario','Trabajo protegido: el trabajo no está terminado. '||trim(p_detalle));
 end if;
 insert into public.servicio_reclamo_eventos(reclamo_id,tipo,texto) values(r.id,'soporte',
  case when p_seguir
   then 'Recibimos tu reclamo de Trabajo protegido. En 48 horas hábiles te conseguimos otra persona con identidad comprobada de tu zona para que te pase presupuesto y lo termine. Si no la conseguimos, te devolvemos la cuota.'
   else 'Recibimos tu reclamo de Trabajo protegido. Como no querés seguir, te devolvemos la cuota por Mercado Pago, a la misma tarjeta. Te avisamos acá cuando salga.' end);
 update public.trabajos_protegidos set estado='reclamada',quiere_seguir=p_seguir,reclamo_id=r.id,
  plazo_reemplazo=case when p_seguir then privado.sumar_dias_habiles(now(),2) end,
  reclamada_at=now(),updated_at=now(),version=version+1
 where id=t.id returning * into t;
 -- Aviso en el chat: le llega a quien hace el trabajo como cualquier mensaje.
 insert into public.mensajes(match_id,remitente_tipo,tipo,contenido,leido)
 values(t.match_id,'cliente','texto','Abrí un reclamo de Trabajo protegido porque el trabajo no está terminado. Podés responder en "Problemas y reclamos", acá en el chat.',false);
 perform privado.avisar('protegido_'||t.id::text,'Reclamo de Trabajo protegido',
  case when p_seguir
   then 'Un cliente reclamó que no le terminaron un trabajo protegido y quiere seguir. Hay que conseguirle otra persona con identidad comprobada de su zona antes del '
        ||to_char(t.plazo_reemplazo at time zone 'America/Argentina/Buenos_Aires','DD/MM HH24:MI')
        ||'. Si no se consigue, se le devuelve la cuota. Está en el CRM, sección Confianza.'
   else 'Un cliente reclamó que no le terminaron un trabajo protegido y no quiere seguir: hay que devolverle la cuota. Está en el CRM, sección Confianza.' end);
 return t;
end $$;

-- Soporte: qué hay en marcha.
create or replace function public.soporte_trabajos_protegidos()
returns table(id uuid,estado text,quiere_seguir boolean,plazo_reemplazo timestamptz,monto numeric,cuota numeric,
              rubro text,zona text,cliente_nombre text,proveedor_nombre text,reclamo_detalle text,
              presupuesto_id bigint,created_at timestamptz,reclamada_at timestamptz,version integer)
language plpgsql stable security definer set search_path='' as $$
begin
 if not privado.es_soporte() then raise exception 'Solo soporte.' using errcode='42501';end if;
 return query
 select t.id,t.estado,t.quiere_seguir,t.plazo_reemplazo,t.monto,t.cuota,
  s.servicio_necesitado,s.zona,s.nombre_cliente,p.nombre,r.detalle,t.presupuesto_id,t.created_at,t.reclamada_at,t.version
 from public.trabajos_protegidos t
 left join public.matches x on x.id=t.match_id
 left join public.solicitudes s on s.id=x.solicitud_id
 left join public.proveedores p on p.id=x.proveedor_id
 left join public.servicio_reclamos r on r.id=t.reclamo_id
 order by (t.estado in('reclamada','devolucion_pendiente')) desc,t.plazo_reemplazo nulls last,t.created_at desc
 limit 300;
end $$;

-- Soporte decide. Cada decisión queda en el reclamo, a la vista del cliente.
--   reemplazo_conseguido: otra persona con identidad comprobada le pasó presupuesto;
--   devolver_cuota: no quiso seguir, no se consiguió a nadie a tiempo o corresponde;
--   sigue_el_mismo: quien lo hacía volvió y el cliente está de acuerdo.
-- Las tres le sacan el distintivo a quien abandonó salvo sigue_el_mismo.
create or replace function public.soporte_trabajo_protegido(p_id uuid,p_accion text,p_texto text,p_version integer)
returns public.trabajos_protegidos language plpgsql security definer set search_path='' as $$
declare t public.trabajos_protegidos;
begin
 if not privado.es_soporte() and not privado.es_servidor() then raise exception 'Solo soporte.' using errcode='42501';end if;
 if p_texto is null or length(trim(p_texto)) not between 5 and 2000 or p_texto ~ '[<>]' then
  raise exception 'Escribí qué le decimos al cliente (sin HTML).';end if;
 select * into t from public.trabajos_protegidos where id=p_id for update;
 if t.id is null or t.version is distinct from p_version then raise exception 'Cambió mientras lo mirabas. Volvé a cargar.' using errcode='40001';end if;
 if p_accion='reemplazo_conseguido' and t.estado='reclamada' and t.quiere_seguir then
  update public.trabajos_protegidos set estado='reemplazo_conseguido',resuelta_at=now() where id=p_id;
 elsif p_accion='devolver_cuota' and t.estado in('reclamada','activa') then
  update public.trabajos_protegidos set estado='devolucion_pendiente' where id=p_id;
 elsif p_accion='sigue_el_mismo' and t.estado='reclamada' then
  update public.trabajos_protegidos set estado='activa',quiere_seguir=null,plazo_reemplazo=null where id=p_id;
 else raise exception 'Esa acción no corresponde al estado actual.';end if;
 if p_accion<>'sigue_el_mismo' and t.proveedor is not null and t.estado='reclamada' then
  delete from public.distintivos where user_id=t.proveedor and tipo='identidad';
 end if;
 update public.trabajos_protegidos set updated_at=now(),version=version+1 where id=p_id returning * into t;
 if t.reclamo_id is not null then
  insert into public.servicio_reclamo_eventos(reclamo_id,tipo,texto) values(t.reclamo_id,'soporte',trim(p_texto));
 end if;
 if t.estado='devolucion_pendiente' then perform privado.trabajo_protegido_llamar('devolver');end if;
 return t;
end $$;

-- Para la función: las devoluciones a hacer y la marca de hecha.
create or replace function public.proteccion_devoluciones_pendientes()
returns table(id uuid,pago_id text,cuota numeric) language plpgsql stable security definer set search_path='' as $$
begin
 if not privado.es_servidor() then raise exception 'Solo el servidor.' using errcode='42501';end if;
 return query select t.id,t.pago_id,t.cuota from public.trabajos_protegidos t where t.estado='devolucion_pendiente' order by t.updated_at limit 50;
end $$;
create or replace function public.proteccion_devuelta(p_id uuid,p_devolucion_id text)
returns void language plpgsql security definer set search_path='' as $$
declare t public.trabajos_protegidos;
begin
 if not privado.es_servidor() then raise exception 'Solo el servidor.' using errcode='42501';end if;
 update public.trabajos_protegidos set estado='devuelta',devolucion_id=p_devolucion_id,resuelta_at=now(),updated_at=now(),version=version+1
 where id=p_id and estado='devolucion_pendiente' returning * into t;
 if t.reclamo_id is not null then
  insert into public.servicio_reclamo_eventos(reclamo_id,tipo,texto) values(t.reclamo_id,'soporte',
   'Te devolvimos la cuota de Trabajo protegido por Mercado Pago, a la misma tarjeta. Según tu banco, puede tardar unos días en verse en el resumen.');
 end if;
end $$;

-- Si el cliente pagó el trabajo como terminado, la protección se cumplió.
create or replace function privado.proteccion_cumplida()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.tipo='presupuesto' and new.pago_estado is not null and old.pago_estado is null then
  update public.trabajos_protegidos set estado='cumplida',resuelta_at=now(),updated_at=now(),version=version+1
  where presupuesto_id=new.id and estado='activa';
 end if;
 return new;
end $$;
create trigger trabajo_protegido_cumplido after update of pago_estado on public.mensajes
 for each row execute function privado.proteccion_cumplida();

-- Llamada a la función trabajo-protegido desde la base (devolver o limpiar),
-- con la misma firma que ya usan avisar-equipo y limpieza-fotos (Vault).
create or replace function privado.trabajo_protegido_llamar(accion text)
returns void language plpgsql security definer set search_path='' as $$
declare firma text; url text;
begin
 if accion not in('devolver','limpiar') then return;end if;
 select decrypted_secret into firma from vault.decrypted_secrets where name='push_firma_quick_service';
 select valor into url from privado.config where clave='url_funciones';
 if firma is null or url is null then return;end if;
 perform net.http_post(url:=url||'/trabajo-protegido',
  headers:=jsonb_build_object('Content-Type','application/json','x-tratto-firma',firma),
  body:=jsonb_build_object('accion',accion),timeout_milliseconds:=20000);
end $$;

-- Cada noche: devoluciones que hayan quedado sin salir y fotos de identidad
-- que ya no hacen falta.
select cron.schedule('trabajo-protegido-noche','40 6 * * *',
 $$select privado.trabajo_protegido_llamar('devolver'); select privado.trabajo_protegido_llamar('limpiar');$$);

-- ── Permisos ───────────────────────────────────────────────────────────────
revoke all on function privado.es_soporte(),privado.es_servidor(),privado.sumar_dias_habiles(timestamptz,integer),
 privado.identidad_puede_subir(text),privado.cuota_proteccion(numeric),privado.proteccion_chequear(bigint,uuid),
 privado.proteccion_cumplida(),privado.trabajo_protegido_llamar(text) from public,anon,authenticated;
grant execute on function privado.es_soporte(),privado.identidad_puede_subir(text) to authenticated;
revoke all on function public.identidad_pedir(text,text,text,text),public.identidad_mi_estado(),
 public.identidad_pendientes(),public.identidad_decidir(uuid,boolean,text),public.identidad_archivos_por_borrar(integer),
 public.proteccion_cotizar(bigint),public.proteccion_preparar(bigint,uuid),public.proteccion_activar(bigint,uuid,text,numeric),
 public.proteccion_reclamar(bigint,boolean,text),public.soporte_trabajos_protegidos(),
 public.soporte_trabajo_protegido(uuid,text,text,integer),public.proteccion_devoluciones_pendientes(),
 public.proteccion_devuelta(uuid,text) from public,anon;
grant execute on function public.identidad_pedir(text,text,text,text),public.identidad_mi_estado(),
 public.identidad_pendientes(),public.identidad_decidir(uuid,boolean,text),
 public.proteccion_cotizar(bigint),public.proteccion_reclamar(bigint,boolean,text),
 public.soporte_trabajos_protegidos(),public.soporte_trabajo_protegido(uuid,text,text,integer) to authenticated;
revoke execute on function public.identidad_archivos_por_borrar(integer),public.proteccion_preparar(bigint,uuid),
 public.proteccion_activar(bigint,uuid,text,numeric),public.proteccion_devoluciones_pendientes(),
 public.proteccion_devuelta(uuid,text) from authenticated;
grant execute on function public.identidad_archivos_por_borrar(integer),public.proteccion_preparar(bigint,uuid),
 public.proteccion_activar(bigint,uuid,text,numeric),public.proteccion_devoluciones_pendientes(),
 public.proteccion_devuelta(uuid,text),public.soporte_trabajo_protegido(uuid,text,text,integer) to service_role;
