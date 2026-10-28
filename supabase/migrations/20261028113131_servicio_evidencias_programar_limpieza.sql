-- Programa sólo la cola privada nueva. No activa limpiar-fotos/publicaciones,
-- cuya aprobación histórica permanece separada. El secreto no se imprime ni
-- se incorpora al SQL de cron: sólo se resuelve dentro del servidor al ejecutar.
do $$begin
 if not exists(select 1 from pg_namespace where nspname='cron')
 or not exists(select 1 from pg_namespace where nspname='net')
 or not exists(select 1 from pg_namespace where nspname='vault') then
  raise exception 'Faltan cron, net o vault para programar limpieza de evidencias.';
 end if;
 if to_regprocedure('net.http_post(text,jsonb,jsonb,jsonb,integer)') is null
 or to_regprocedure('cron.schedule(text,text,text)') is null
 or to_regclass('vault.decrypted_secrets') is null then
  raise exception 'Faltan funciones de cron/net o la vista de Vault para limpieza de evidencias.';
 end if;
 if not exists(select 1 from privado.config where clave='url_funciones'
  and valor ~ '^https://[a-z0-9]+\.supabase\.co/functions/v1/?$') then
  raise exception 'Falta una URL válida de funciones Supabase para limpieza de evidencias.';
 end if;
 if not exists(select 1 from vault.secrets where name='push_firma_quick_service') then
  raise exception 'Falta la firma de servidor para limpieza de evidencias.';
 end if;
end $$;

create function privado.servicio_programar_limpieza_evidencias()
returns bigint language plpgsql security definer set search_path='' as $$
declare destino text; firma text; solicitud bigint;
begin
 select valor into destino from privado.config where clave='url_funciones';
 if destino is null or destino !~ '^https://[a-z0-9]+\.supabase\.co/functions/v1/?$' then
  raise exception 'Configuración de limpieza de evidencias incompleta.';
 end if;
 select decrypted_secret into firma from vault.decrypted_secrets where name='push_firma_quick_service';
 if nullif(firma,'') is null then raise exception 'Firma de limpieza de evidencias no disponible.';end if;
 select net.http_post(
  url:=rtrim(destino,'/')||'/limpieza-fotos?solo=evidencias',
  headers:=jsonb_build_object('Content-Type','application/json','x-tratto-firma',firma),
  body:='{}'::jsonb,timeout_milliseconds:=60000
 ) into solicitud;
 return solicitud;
end $$;
revoke all on function privado.servicio_programar_limpieza_evidencias() from public,anon,authenticated,service_role;

select cron.schedule('servicio-evidencias-limpieza','30 6 * * *',
 'select privado.servicio_programar_limpieza_evidencias()');
