-- Arregla "Borrar mi cuenta".
--
-- Problema: mis_prov, mis_sol y mis_match estaban declaradas uuid[], pero los
-- ids de proveedores, solicitudes y matches son bigint. Con cualquier pedido o
-- servicio cargado la función fallaba ("invalid input syntax for type uuid")
-- y la cuenta NO se borraba. Solo funcionaba para cuentas vacías.
-- Verificado en staging con datos de prueba antes y después del cambio.
--
-- De paso completa lo que la Política de privacidad promete borrar:
--   * push_subscripciones: los dispositivos del usuario (no tienen FK a
--     auth.users, así que quedaban huérfanos).
--   * novedades_envios: se borra explícito (hoy lo cubriría el borrado del
--     usuario solo si tuviera FK; no la tiene).
--   * visitas_perfil.visitante: es el id de quien visitó. Se anonimiza (null)
--     en vez de borrar la fila, para no alterarle las estadísticas al
--     proveedor visitado.
--   * El motivo de baja se corta a 1000 caracteres (antes no tenía tope).
-- El resto de la lógica queda igual.

CREATE OR REPLACE FUNCTION public.borrar_mi_cuenta(motivo_baja text DEFAULT NULL::text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
declare
  yo        uuid := auth.uid();
  mi_rol    text;
  mis_prov  bigint[];
  mis_sol   bigint[];
  mis_match bigint[];
  borradas  int := 0;
begin
  -- Nunca confiar en un id que venga de afuera: se usa el del token.
  if yo is null then
    raise exception 'sin sesión';
  end if;

  select coalesce(raw_user_meta_data->>'rol', 'cliente')
    into mi_rol from auth.users where id = yo;

  -- Qué es mío, resuelto una sola vez
  select coalesce(array_agg(id), '{}') into mis_prov
    from public.proveedores where user_id = yo;

  select coalesce(array_agg(id), '{}') into mis_sol
    from public.solicitudes where user_id = yo;

  select coalesce(array_agg(id), '{}') into mis_match
    from public.matches
    where solicitud_id = any(mis_sol) or proveedor_id = any(mis_prov);

  -- ── Calificaciones ────────────────────────────────────────────────────
  -- Las que YO dejé sobre un Proveedor: sobreviven, pero dejan de decir
  -- quién las dejó. Es la reputación de otra persona, no mía.
  update public.reputacion
     set cliente_user_id = null,
         match_id        = null
   where cliente_user_id = yo;

  -- Las que son SOBRE MÍ como Proveedor: se van con el perfil.
  delete from public.reputacion where proveedor_user_id = yo;

  -- ── Conversaciones ────────────────────────────────────────────────────
  delete from public.mensajes    where match_id = any(mis_match);
  delete from public.matches     where id       = any(mis_match);
  delete from public.interesados where user_id  = yo or solicitud_id = any(mis_sol);

  -- ── Pedidos y perfiles ────────────────────────────────────────────────
  delete from public.solicitudes      where user_id = yo;
  delete from public.publicaciones    where user_id = yo;
  delete from public.credenciales     where user_id = yo;
  delete from public.perfil_proveedor where user_id = yo;
  delete from public.proveedores      where user_id = yo;

  -- ── Rastros de uso ────────────────────────────────────────────────────
  delete from public.consultas         where user_id        = yo;
  delete from public.canjes            where user_id        = yo;
  delete from public.visitas_perfil    where perfil_user_id = yo;
  update public.visitas_perfil set visitante = null where visitante = yo;
  delete from public.push_subscripciones where user_id      = yo;
  delete from public.novedades_envios    where user_id      = yo;

  -- ── Mercado Pago ──────────────────────────────────────────────────────
  -- Acá viven access_token y refresh_token. Borrar la fila no revoca el
  -- permiso del lado de Mercado Pago; eso se hace con su API.
  delete from public.cuentas_mp where user_id = yo;

  -- ── Lo que sobrevive ──────────────────────────────────────────────────
  -- Punto 6.1 de la Política: hoy no existe tabla de operaciones cobradas
  -- ni comprobantes, así que no hay registro contable que conservar.

  -- ── Motivo, sin dueño ─────────────────────────────────────────────────
  if motivo_baja is not null and length(trim(motivo_baja)) > 0 then
    insert into public.bajas (motivo, era_de) values (left(trim(motivo_baja), 1000), mi_rol);
  end if;

  -- ── La cuenta ─────────────────────────────────────────────────────────
  delete from auth.users where id = yo;
  get diagnostics borradas = row_count;

  return json_build_object('ok', true, 'cuenta_borrada', borradas = 1);
end;
$function$;
