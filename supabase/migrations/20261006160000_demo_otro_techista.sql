-- Cuentas demo: otro techista, en CABA (los otros dos son de GBA Oeste).
--   Diego Ferreyra · Techos e impermeabilización · CABA   trattoapp1+demo-techos@gmail.com
-- Se suma a privado.reponer_demo_extra() (solo agrega lo que falte).
-- Aplicada el 2026-10-06.

create or replace function privado.reponer_demo_extra()
returns text language plpgsql security definer set search_path = '' as $$
declare
  hash text;
  u record;
begin
  select valor into hash from privado.config where clave = 'demo_hash';
  if hash is null then raise exception 'Falta el hash de la contraseña demo (privado.config, demo_hash)'; end if;
  for u in select * from (values
      ('de000000-0000-4000-8000-0000000000a3'::uuid, 'trattoapp1+demo-pintura@gmail.com',  'Lucía Benítez', 'Pintura',  'CABA', 90000, 600000, 'Lunes a sábado',
       'Pintura de interiores y exteriores. Preparo las paredes antes de pintar: enduido, lijado y fijador. Presupuesto con materiales detallados.',
       'Pintora · interiores y exteriores',
       'Antes de pintar reparo lo que haga falta, así la pintura dura. Trabajo prolijo, cubro muebles y pisos y dejo todo limpio.', 10, '1100000003'),
      ('de000000-0000-4000-8000-0000000000a4'::uuid, 'trattoapp1+demo-limpieza@gmail.com', 'Rosa Giménez',  'Limpieza', 'CABA', 30000, 180000, 'Lunes a viernes',
       'Limpieza de casas y departamentos, por hora o jornada. Limpieza a fondo de mudanza y de fin de obra.',
       'Limpieza de hogar y fin de obra',
       'Limpiezas por hora, jornada o a fondo. Llevo mis productos si hace falta. Referencias de clientes del barrio.', 12, '1100000004'),
      ('de000000-0000-4000-8000-0000000000a5'::uuid, 'trattoapp1+demo-techos@gmail.com', 'Diego Ferreyra', 'Techos e impermeabilización', 'CABA', 40000, 450000, 'Lunes a sábado',
       'Techos de chapa y losa, membranas, canaletas y filtraciones en terrazas y balcones. Reviso el techo antes de presupuestar.',
       'Techista · terrazas y balcones en CABA',
       'Arreglo filtraciones de raíz: busco de dónde viene el agua antes de tocar nada. Garantía escrita en membranas.', 18, '1100000005')
    ) v(id, email, nombre, rubro, zona, desde, hasta, dispo, descr, titular, bio, anios, tel)
  loop
    if not exists (select 1 from auth.users where id = u.id) then
      insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
        confirmation_token, recovery_token, email_change_token_new, email_change,
        email_change_token_current, phone_change, phone_change_token, reauthentication_token)
      values ('00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email, hash, now(),
        '{"provider":"email","providers":["email"],"demo":true}'::jsonb,
        jsonb_build_object('rol', 'proveedor', 'nombre', u.nombre, 'telefono', '1100000000', 'rubro', u.rubro,
          'condicion_fiscal', 'Monotributo', 'legales_version', '2026-09-25', 'legales_rol', 'proveedor',
          'transfer_permiso', true, 'transfer_permiso_fecha', now(), 'publicidad_permiso', false),
        now() - interval '38 days', now(), '', '', '', '', '', '', '', '');
      insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
      values (u.id::text, u.id, jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
              'email', now(), now(), now());
    else
      update auth.users
         set raw_app_meta_data = raw_app_meta_data || '{"demo":true}'::jsonb,
             encrypted_password = hash, email_confirmed_at = coalesce(email_confirmed_at, now())
       where id = u.id;
    end if;
    if not exists (select 1 from public.proveedores where user_id = u.id) then
      insert into public.proveedores (created_at, nombre, email, telefono, rubro, zona, precio_desde, precio_hasta,
                                      disponibilidad, descripcion, user_id)
      values (now() - interval '37 days', u.nombre, u.email, u.tel, u.rubro, u.zona, u.desde, u.hasta, u.dispo, u.descr, u.id);
    end if;
    if not exists (select 1 from public.perfil_proveedor where user_id = u.id) then
      insert into public.perfil_proveedor (user_id, nombre, titular, bio, anios_exp, trabajos_hechos)
      values (u.id, u.nombre, u.titular, u.bio, u.anios, 0);
    end if;
  end loop;
  perform privado.matching_demo_pendientes();
  return 'ok: proveedores demo extra listos (Pintura, Limpieza, Techos CABA)';
end $$;
revoke all on function privado.reponer_demo_extra() from public, anon, authenticated;

select privado.reponer_demo_extra();
