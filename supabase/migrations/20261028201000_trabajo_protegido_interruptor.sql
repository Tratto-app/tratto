-- Interruptor de lanzamiento de Trabajo protegido. Mientras privado.config no
-- diga trabajo_protegido_activo = 'si', la app no ofrece proteger ningún
-- trabajo: se prende cuando la función tenga la cuenta de Mercado Pago de
-- Tratto cargada y el fundador dé el visto bueno a los términos.
--   update privado.config set valor='si' where clave='trabajo_protegido_activo';
insert into privado.config(clave,valor) values('trabajo_protegido_activo','no')
on conflict(clave) do nothing;

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
revoke all on function privado.proteccion_chequear(bigint,uuid) from public,anon,authenticated;
