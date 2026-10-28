-- Sugerencias para un pedido (fundador, 28/10/2026): "que te machee si está la
-- publicación y, si no, que te traiga el perfil de ese carpintero para que le
-- puedas mandar un mensaje y preguntarle si hace ese trabajo".
--
-- El matching automático (n8n) conecta solo con quien publicó el mismo rubro,
-- en la zona y dentro del presupuesto (20 % de tolerancia), y como mucho 3.
-- Esto suma, para que el cliente elija a quién escribirle:
--   1. el mismo rubro aunque no entre en el presupuesto o pase el tope de 3;
--   2. rubros afines (public.rubros_afines): quien hace algo parecido y quizás
--      también hace esto aunque no lo tenga publicado.
-- Solo de la misma zona, la región (AMBA) o que trabajan a distancia. Nunca
-- se conecta sola: el cliente toca "Escribirle" y recién ahí se crea el chat.

create table public.rubros_afines (
 rubro text not null,
 afin text not null,
 primary key(rubro,afin),
 check(rubro<>afin)
);
alter table public.rubros_afines enable row level security;
revoke all on public.rubros_afines from public,anon,authenticated;
grant select on public.rubros_afines to anon,authenticated;
grant all on public.rubros_afines to service_role;
create policy rubros_afines_lectura on public.rubros_afines for select using(true);

-- Se cargan de a pares y en las dos direcciones.
with pares(a,b) as (values
 ('Arreglos generales','Plomería y destapaciones'),('Arreglos generales','Albañilería y refacciones'),
 ('Arreglos generales','Pintura'),('Arreglos generales','Carpintería y muebles'),
 ('Arreglos generales','Herrería y soldadura'),('Arreglos generales','Durlock y yeso'),
 ('Arreglos generales','Cerrajería'),('Arreglos generales','Pisos y revestimientos'),
 ('Arreglos generales','Vidrios y aberturas'),('Arreglos generales','Jardinería y piletas'),
 ('Arreglos generales','Techos e impermeabilización'),
 ('Carpintería y muebles','Tapicería y restauración'),('Carpintería y muebles','Decoración e interiores'),
 ('Carpintería y muebles','Vidrios y aberturas'),('Carpintería y muebles','Pisos y revestimientos'),
 ('Pintura','Albañilería y refacciones'),('Pintura','Durlock y yeso'),('Pintura','Techos e impermeabilización'),
 ('Pintura','Decoración e interiores'),
 ('Albañilería y refacciones','Durlock y yeso'),('Albañilería y refacciones','Pisos y revestimientos'),
 ('Albañilería y refacciones','Techos e impermeabilización'),('Albañilería y refacciones','Plomería y destapaciones'),
 ('Plomería y destapaciones','Jardinería y piletas'),
 ('Herrería y soldadura','Vidrios y aberturas'),('Herrería y soldadura','Cerrajería'),
 ('Vidrios y aberturas','Cerrajería'),
 ('Aire acondicionado','Service de electrodomésticos'),
 ('Service de electrodomésticos','Reparación y soporte técnico'),
 ('Mecánica del automotor','Chapa y pintura'),('Mecánica del automotor','Gomería y auxilio'),
 ('Chapa y pintura','Lavado de autos'),
 ('Fletes y mudanzas','Mandados y mensajería'),
 ('Contabilidad e impuestos','Gestoría y trámites'),('Contabilidad e impuestos','Asistente administrativo'),
 ('Gestoría y trámites','Asistente administrativo'),
 ('Diseño gráfico','Marketing y redes sociales'),('Diseño gráfico','Fotografía y video'),
 ('Diseño gráfico','Programación y desarrollo'),
 ('Marketing y redes sociales','Fotografía y video'),('Marketing y redes sociales','Programación y desarrollo'),
 ('Programación y desarrollo','Reparación y soporte técnico'),('Programación y desarrollo','Computación y capacitación'),
 ('Reparación y soporte técnico','Computación y capacitación'),
 ('Fotografía y video','Animación y organización de eventos'),
 ('Estética, maquillaje y peinados','Masajes'),
 ('Personal trainer, yoga y pilates','Masajes'),
 ('Cuidado de adultos mayores','Mandados y mensajería'),('Cuidado de adultos mayores','Servicios de limpieza'),
 ('Catering y pastelería','Animación y organización de eventos'),
 ('Música y sonido (DJ)','Animación y organización de eventos'),('Música y sonido (DJ)','Clases de música'),
 ('Animación y organización de eventos','Decoración e interiores'),
 ('Apoyo escolar y universitario','Idiomas'),('Apoyo escolar y universitario','Computación y capacitación'),
 ('Paseo y cuidado de mascotas','Peluquería y adiestramiento canino'),
 ('Costura y arreglos de ropa','Tapicería y restauración'),
 ('Tapicería y restauración','Decoración e interiores')
)
insert into public.rubros_afines(rubro,afin)
select a,b from pares union select b,a from pares
on conflict do nothing;

-- 'misma' | 'cerca' | 'remoto' | 'lejos', igual que relacionZona() de la app.
create or replace function privado.relacion_zona(cliente text, prov text)
returns text language sql immutable set search_path='' as $$
 select case
  when prov='Todo el país (remoto)' then 'remoto'
  when prov=cliente then 'misma'
  when prov in('CABA','GBA Norte','GBA Oeste','GBA Sur') and cliente in('CABA','GBA Norte','GBA Oeste','GBA Sur') then 'cerca'
  else 'lejos' end;
$$;

create or replace function public.pedido_sugeridos(p_solicitud_id bigint)
returns table(proveedor_id bigint,user_id uuid,nombre text,rubro text,zona text,descripcion text,
              precio_desde numeric,precio_hasta numeric,trabajos integer,motivo text,relacion text)
language plpgsql stable security definer set search_path='' as $$
declare s public.solicitudes;
begin
 select * into s from public.solicitudes x where x.id=p_solicitud_id;
 if s.id is null or s.user_id is distinct from auth.uid() then raise exception 'Ese pedido no es tuyo.' using errcode='42501';end if;
 return query
 with candidatos as (
  select p.*, case when p.rubro=s.servicio_necesitado then 1 else 2 end as nivel,
         privado.relacion_zona(s.zona,p.zona) as rel
  from public.proveedores p
  where p.user_id is not null and p.user_id<>s.user_id
    and coalesce(p.demo,false)=coalesce(s.demo,false)
    and (p.rubro=s.servicio_necesitado
         or exists(select 1 from public.rubros_afines a where a.rubro=s.servicio_necesitado and a.afin=p.rubro))
    and privado.relacion_zona(s.zona,p.zona)<>'lejos'
    and not exists(select 1 from public.matches m join public.proveedores q on q.id=m.proveedor_id
                   where m.solicitud_id=s.id and q.user_id=p.user_id)
    and not privado.hay_bloqueo(s.user_id,p.user_id)
 ), uno_por_persona as (
  select distinct on (c.user_id) c.* from candidatos c
  order by c.user_id, c.nivel, (c.rel='misma') desc, c.created_at
 )
 select u.id,u.user_id,
  coalesce((select pp.nombre from public.perfil_proveedor pp where pp.user_id=u.user_id),u.nombre),
  coalesce(nullif(u.rubro_personalizado,''),u.rubro),u.zona,u.descripcion,u.precio_desde,u.precio_hasta,
  coalesce((select pp.trabajos_hechos from public.perfil_proveedor pp where pp.user_id=u.user_id),0)::integer,
  case when u.nivel=1 then 'Ofrece '||u.rubro
       else 'Ofrece '||u.rubro||': no publicó exactamente esto, pero puede que lo haga' end,
  u.rel
 from uno_por_persona u
 order by u.nivel, case u.rel when 'misma' then 0 when 'cerca' then 1 else 2 end,
          coalesce((select pp.trabajos_hechos from public.perfil_proveedor pp where pp.user_id=u.user_id),0) desc,
          u.created_at
 limit 8;
end $$;

-- El cliente elige a quién escribirle: se crea la conexión (como las del
-- matching) y quien ofrece el servicio recibe el aviso de siempre.
create or replace function public.pedido_conectar(p_solicitud_id bigint,p_proveedor_id bigint)
returns bigint language plpgsql security definer set search_path='' as $$
declare s public.solicitudes; mid bigint;
begin
 select * into s from public.solicitudes x where x.id=p_solicitud_id;
 if s.id is null or s.user_id is distinct from auth.uid() then raise exception 'Ese pedido no es tuyo.' using errcode='42501';end if;
 if s.estado='vencida' then raise exception 'Ese pedido ya venció. Publicalo de nuevo.';end if;
 if not exists(select 1 from public.pedido_sugeridos(p_solicitud_id) g where g.proveedor_id=p_proveedor_id) then
  select m.id into mid from public.matches m where m.solicitud_id=p_solicitud_id and m.proveedor_id=p_proveedor_id;
  if mid is not null then return mid;end if;
  raise exception 'No podemos conectarte con esa persona para este pedido.';
 end if;
 perform pg_advisory_xact_lock(hashtextextended('conectar:'||auth.uid()::text,0));
 if (select count(*) from public.matches m where m.solicitud_id=p_solicitud_id and m.created_at>now()-interval '1 day')>=15 then
  raise exception 'Ya le escribiste a muchas personas por este pedido hoy.';end if;
 insert into public.matches(solicitud_id,proveedor_id) values(p_solicitud_id,p_proveedor_id)
 on conflict(solicitud_id,proveedor_id) do nothing returning id into mid;
 if mid is null then select m.id into mid from public.matches m where m.solicitud_id=p_solicitud_id and m.proveedor_id=p_proveedor_id;end if;
 update public.solicitudes set estado='con_match' where id=p_solicitud_id and estado='pendiente';
 return mid;
end $$;

revoke all on function privado.relacion_zona(text,text) from public,anon,authenticated;
revoke all on function public.pedido_sugeridos(bigint),public.pedido_conectar(bigint,bigint) from public,anon;
grant execute on function public.pedido_sugeridos(bigint),public.pedido_conectar(bigint,bigint) to authenticated;
