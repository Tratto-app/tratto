-- Sello público según el tipo de número (propuesta aprobada el 04/11/2026:
-- "CUIL verificado" para personas, "CUIT verificado" para empresas) y una
-- consulta pública para que el registro sepa si el chequeo con ARCA ya está
-- andando: sin certificado cargado, la app no promete un chequeo que no hace.

alter table public.distintivos drop constraint distintivos_tipo_check;
alter table public.distintivos add constraint distintivos_tipo_check check(tipo in('identidad','cuit','cuil'));

create or replace function public.cuit_marcar_verificado(p_user uuid,p_cuit text,p_tipo text)
returns void language plpgsql security definer set search_path='' as $$
declare sello text := case when p_tipo='empresa' then 'cuit' else 'cuil' end;
begin
 if not privado.es_servidor() then raise exception 'Solo el servidor.' using errcode='42501';end if;
 insert into privado.cuit_estado(user_id,resultado,cuit,tipo,intentos,proximo,updated_at)
 values(p_user,'coincide',p_cuit,p_tipo,0,null,now())
 on conflict(user_id) do update set resultado='coincide',cuit=excluded.cuit,tipo=excluded.tipo,
  intentos=0,proximo=null,updated_at=now();
 delete from public.distintivos where user_id=p_user and tipo in('cuit','cuil') and tipo<>sello;
 insert into public.distintivos(user_id,tipo,desde) values(p_user,sello,current_date)
 on conflict(user_id,tipo) do nothing;
end $$;
revoke all on function public.cuit_marcar_verificado(uuid,text,text) from public,anon,authenticated;
grant execute on function public.cuit_marcar_verificado(uuid,text,text) to service_role;

create function public.cuit_verificacion_activa()
returns boolean language sql stable security definer set search_path='' as $$
 select coalesce((select a.certificado_pem is not null and a.clave_secreto is not null and a.cuit is not null
  from privado.arca a where a.id=1),false);
$$;
revoke all on function public.cuit_verificacion_activa() from public;
grant execute on function public.cuit_verificacion_activa() to anon,authenticated;
