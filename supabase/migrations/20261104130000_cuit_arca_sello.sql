-- Sello público según el tipo de número (propuesta aprobada el 04/11/2026:
-- "CUIL verificado" para personas, "CUIT verificado" para empresas) y una
-- consulta pública para que el registro sepa si el chequeo con ARCA ya está
-- andando: sin certificado cargado, la app no promete un chequeo que no hace.
--
-- El distintivo sigue siendo uno solo (tipo 'cuit'); si es de persona o de
-- empresa sale de privado.cuit_estado. Así no hace falta tocar la regla de
-- la tabla de distintivos.

create function public.cuit_verificacion_activa()
returns boolean language sql stable security definer set search_path='' as $$
 select coalesce((select a.certificado_pem is not null and a.clave_secreto is not null and a.cuit is not null
  from privado.arca a where a.id=1),false);
$$;
revoke all on function public.cuit_verificacion_activa() from public;
grant execute on function public.cuit_verificacion_activa() to anon,authenticated;

-- Para la ficha pública: 'cuil' (persona) o 'cuit' (empresa) de quienes
-- tienen el sello. Es lo mismo que ya muestra el sello; no expone el número.
create function public.sello_fiscal(p_user uuid)
returns text language sql stable security definer set search_path='' as $$
 select case when e.tipo='empresa' then 'cuit' else 'cuil' end
 from public.distintivos d join privado.cuit_estado e on e.user_id=d.user_id and e.resultado='coincide'
 where d.user_id=p_user and d.tipo='cuit';
$$;
revoke all on function public.sello_fiscal(uuid) from public;
grant execute on function public.sello_fiscal(uuid) to anon,authenticated;
