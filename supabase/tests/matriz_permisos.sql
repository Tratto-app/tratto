-- Matriz de visibilidad: cuántas filas ve cada usuario en cada tabla.
-- Se corre antes y después de tocar políticas RLS; el resultado tiene que ser
-- idéntico. Solo lectura; todo pasa dentro de un bloque que termina en error
-- a propósito para devolver el resultado sin dejar rastros.
-- Pensado para STAGING (usa los usuarios de prueba carga*@staging...).
do $$
declare
  u text; t text; n bigint; salida text := '';
  -- Un usuario por corrida (contar mensajes con RLS fila por fila es lento):
  -- reemplazar USUARIO por anon o por un id de usuario de prueba.
  usuarios text[] := array['USUARIO'];
  tablas text[] := array['bajas','canjes','config_app','consultas','credenciales','cuentas_mp',
    'interesados','matches','mensajes','novedades','novedades_envios','oauth_states',
    'perfil_proveedor','proveedores','publicaciones','push_subscripciones','reputacion',
    'solicitudes','video_jobs','visitas_perfil','pedidos_abiertos'];
begin
  foreach u in array usuarios loop
    if u = 'anon' then
      perform set_config('request.jwt.claims', '{"role":"anon"}', true);
      set local role anon;
    else
      perform set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
      set local role authenticated;
    end if;
    foreach t in array tablas loop
      begin
        -- mensajes: se cuenta un rango de ids (~30k filas); contar las 288k con
        -- RLS fila por fila tarda más de lo que deja la herramienta.
        execute format('select count(*) from public.%I', t)
             || case when t = 'mensajes' then ' where id between 1 and 30000' else '' end into n;
        salida := salida || right(u, 4) || ':' || t || '=' || n || ' ';
      exception when others then
        salida := salida || right(u, 4) || ':' || t || '=ERR(' || sqlstate || ') ';
      end;
    end loop;
    reset role;
  end loop;
  raise exception 'MATRIZ %', salida;
end $$;
