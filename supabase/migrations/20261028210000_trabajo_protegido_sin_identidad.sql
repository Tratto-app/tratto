-- Trabajo protegido sin verificación de identidad (fundador, 28/10/2026:
-- "fusioná todo menos lo de la validación de identidad").
-- Ahora alcanza con que quien hace el trabajo tenga Mercado Pago conectado.
-- La comprobación de identidad queda guardada pero apagada: sus funciones ya
-- no se pueden llamar desde la app y sus tablas no se borran (se puede volver
-- a usar). Quien abandona un trabajo protegido ya no pierde un distintivo:
-- el reclamo queda registrado.

create or replace function privado.proteccion_chequear(p_presupuesto_id bigint,p_cliente uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare m public.mensajes; cli uuid; prov uuid; motivo text;
begin
 select * into m from public.mensajes where id=p_presupuesto_id;
 if m.id is null or m.tipo<>'presupuesto' then return jsonb_build_object('puede',false,'motivo','No encontramos ese presupuesto.');end if;
 select s.user_id,p.user_id into cli,prov from public.matches x
  join public.solicitudes s on s.id=x.solicitud_id join public.proveedores p on p.id=x.proveedor_id where x.id=m.match_id;
 if p_cliente is null or cli is distinct from p_cliente then return jsonb_build_object('puede',false,'motivo','Solo quien pidió el trabajo puede protegerlo.');end if;
 if coalesce((select c.valor from privado.config c where c.clave='trabajo_protegido_activo'),'no')<>'si' then
  motivo:='Trabajo protegido todavía no está disponible.';
 elsif exists(select 1 from public.trabajos_protegidos t where t.presupuesto_id=m.id) then motivo:='Este trabajo ya está protegido.';
 elsif m.estado_presupuesto is distinct from 'aceptado' then motivo:='Primero aceptá el presupuesto.';
 elsif m.trabajo_estado is not null or m.pago_estado is not null then motivo:='El trabajo ya está terminado.';
 elsif coalesce(m.monto,0)<=0 then motivo:='El presupuesto no tiene monto.';
 elsif not exists(select 1 from public.cuentas_mp c where c.user_id=prov) then
  motivo:='Quien hace el trabajo todavía no conectó Mercado Pago.';
 elsif exists(select 1 from public.servicio_reclamos r where r.match_id=m.match_id and r.estado in('recibido','en_revision')) then
  motivo:='Hay un reclamo abierto en este trabajo.';
 elsif privado.hay_bloqueo(cli,prov) then motivo:='Esta conversación está cerrada.';
 end if;
 return jsonb_build_object('puede',motivo is null,'motivo',motivo,'monto',m.monto,
  'cuota',privado.cuota_proteccion(m.monto),'match_id',m.match_id,'proveedor',prov);
end $$;
revoke all on function privado.proteccion_chequear(bigint,uuid) from public,anon,authenticated;

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
   then 'Recibimos tu reclamo de Trabajo protegido. En 48 horas hábiles te conseguimos otra persona de tu zona para que te pase presupuesto y lo termine. Si no la conseguimos, te devolvemos la cuota.'
   else 'Recibimos tu reclamo de Trabajo protegido. Como no querés seguir, te devolvemos la cuota por Mercado Pago, a la misma tarjeta. Te avisamos acá cuando salga.' end);
 update public.trabajos_protegidos set estado='reclamada',quiere_seguir=p_seguir,reclamo_id=r.id,
  plazo_reemplazo=case when p_seguir then privado.sumar_dias_habiles(now(),2) end,
  reclamada_at=now(),updated_at=now(),version=version+1
 where id=t.id returning * into t;
 insert into public.mensajes(match_id,remitente_tipo,tipo,contenido,leido)
 values(t.match_id,'cliente','texto','Abrí un reclamo de Trabajo protegido porque el trabajo no está terminado. Podés responder en "Problemas y reclamos", acá en el chat.',false);
 perform privado.avisar('protegido_'||t.id::text,'Reclamo de Trabajo protegido',
  case when p_seguir
   then 'Un cliente reclamó que no le terminaron un trabajo protegido y quiere seguir. Hay que conseguirle otra persona de su zona antes del '
        ||to_char(t.plazo_reemplazo at time zone 'America/Argentina/Buenos_Aires','DD/MM HH24:MI')
        ||'. Si no se consigue, se le devuelve la cuota. Está en el CRM, sección Trabajo protegido.'
   else 'Un cliente reclamó que no le terminaron un trabajo protegido y no quiere seguir: hay que devolverle la cuota. Está en el CRM, sección Trabajo protegido.' end);
 return t;
end $$;

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
 update public.trabajos_protegidos set updated_at=now(),version=version+1 where id=p_id returning * into t;
 if t.reclamo_id is not null then
  insert into public.servicio_reclamo_eventos(reclamo_id,tipo,texto) values(t.reclamo_id,'soporte',trim(p_texto));
 end if;
 if t.estado='devolucion_pendiente' then perform privado.trabajo_protegido_llamar('devolver');end if;
 return t;
end $$;

-- 'revisar': la función contesta si encuentra la cuenta de Mercado Pago de
-- Tratto (sí o no, nunca las claves).
create or replace function privado.trabajo_protegido_llamar(accion text)
returns void language plpgsql security definer set search_path='' as $$
declare firma text; url text;
begin
 if accion not in('devolver','limpiar','revisar') then return;end if;
 select decrypted_secret into firma from vault.decrypted_secrets where name='push_firma_quick_service';
 select valor into url from privado.config where clave='url_funciones';
 if firma is null or url is null then return;end if;
 perform net.http_post(url:=url||'/trabajo-protegido',
  headers:=jsonb_build_object('Content-Type','application/json','x-tratto-firma',firma),
  body:=jsonb_build_object('accion',accion),timeout_milliseconds:=20000);
end $$;
revoke all on function privado.trabajo_protegido_llamar(text) from public,anon,authenticated;

-- Identidad apagada: la app ya no la usa y nadie más puede llamarla.
revoke execute on function public.identidad_pedir(text,text,text,text),public.identidad_mi_estado(),
 public.identidad_pendientes(),public.identidad_decidir(uuid,boolean,text) from authenticated;
