-- privado.reponer_demo(): crea (o vuelve a dejar como nuevas) las 3 cuentas demo
-- y sus datos. Se puede correr las veces que haga falta, por ejemplo si un
-- revisor de Apple o Google prueba "Borrar mi cuenta" o después de filmar.
--
--   select privado.reponer_demo();
--
-- Cuentas (todas con la misma contraseña, que NO está en el repo: su hash vive
-- en privado.config, clave 'demo_hash'):
--   trattoapp1+demo-cliente@gmail.com    cliente    Laura Fernández
--   trattoapp1+demo-techista@gmail.com   proveedor  Martín Ríos (techista)
--   trattoapp1+demo-humedades@gmail.com  proveedor  Sergio Medina (humedades)
-- Todas en GBA Oeste, rubro "Techos y humedades". Quedan:
--   * un pedido del cliente con dos presupuestos para comparar y chat;
--   * un pedido abierto que los dos proveedores ven en su Panel;
--   * un trabajo terminado y calificado en el perfil de Martín.

create or replace function privado.reponer_demo()
returns text language plpgsql security definer set search_path = '' as $$
declare
  hash text;
  cli uuid := 'de000000-0000-4000-8000-0000000000c1';
  tec uuid := 'de000000-0000-4000-8000-0000000000a1';
  hum uuid := 'de000000-0000-4000-8000-0000000000a2';
  u record;
  p_tec bigint; p_hum bigint; s_a bigint; s_b bigint; s_c bigint;
  m_a bigint; m_b bigint; m_c bigint;
  t0 timestamptz := now() - interval '2 days';
begin
  select valor into hash from privado.config where clave = 'demo_hash';
  if hash is null then raise exception 'Falta el hash de la contraseña demo (privado.config, demo_hash)'; end if;

  -- ── Cuentas ──
  for u in select * from (values
      (cli, 'trattoapp1+demo-cliente@gmail.com',   'cliente',   'Laura Fernández', null::text),
      (tec, 'trattoapp1+demo-techista@gmail.com',  'proveedor', 'Martín Ríos',     'Techos y humedades'),
      (hum, 'trattoapp1+demo-humedades@gmail.com', 'proveedor', 'Sergio Medina',   'Techos y humedades')
    ) v(id, email, rol, nombre, rubro)
  loop
    if not exists (select 1 from auth.users where id = u.id) then
      insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
        confirmation_token, recovery_token, email_change_token_new, email_change,
        email_change_token_current, phone_change, phone_change_token, reauthentication_token)
      values ('00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email, hash, now(),
        '{"provider":"email","providers":["email"],"demo":true}'::jsonb,
        jsonb_build_object('rol', u.rol, 'nombre', u.nombre, 'telefono', '1100000000', 'rubro', u.rubro,
          'condicion_fiscal', case when u.rol = 'proveedor' then 'Monotributo' end,
          'legales_version', '2026-09-25', 'legales_rol', u.rol,
          'transfer_permiso', true, 'transfer_permiso_fecha', now(), 'publicidad_permiso', false),
        now() - interval '45 days', now(), '', '', '', '', '', '', '', '');
      insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
      values (u.id::text, u.id, jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
              'email', now(), now(), now());
    else
      update auth.users
         set raw_app_meta_data = raw_app_meta_data || '{"demo":true}'::jsonb,
             encrypted_password = hash, email_confirmed_at = coalesce(email_confirmed_at, now())
       where id = u.id;
    end if;
  end loop;

  -- ── Limpiar lo que haya de antes ──
  delete from public.mensajes where match_id in (
    select m.id from public.matches m
      join public.solicitudes s on s.id = m.solicitud_id where s.user_id in (cli, tec, hum)
    union select m.id from public.matches m
      join public.proveedores p on p.id = m.proveedor_id where p.user_id in (cli, tec, hum));
  delete from public.reputacion  where proveedor_user_id in (tec, hum) or cliente_user_id = cli;
  delete from public.matches     where solicitud_id in (select id from public.solicitudes where user_id in (cli, tec, hum))
                                    or proveedor_id in (select id from public.proveedores where user_id in (cli, tec, hum));
  delete from public.interesados where user_id in (cli, tec, hum)
                                    or solicitud_id in (select id from public.solicitudes where user_id in (cli, tec, hum));
  delete from public.solicitudes      where user_id in (cli, tec, hum);
  delete from public.proveedores      where user_id in (cli, tec, hum);
  delete from public.publicaciones    where user_id in (cli, tec, hum);
  delete from public.credenciales     where user_id in (cli, tec, hum);
  delete from public.perfil_proveedor where user_id in (cli, tec, hum);
  delete from public.visitas_perfil   where perfil_user_id in (cli, tec, hum);

  -- ── Proveedores ──
  insert into public.proveedores (created_at, nombre, email, telefono, rubro, zona, precio_desde, precio_hasta,
                                  disponibilidad, descripcion, user_id)
  values (now() - interval '44 days', 'Martín Ríos', 'trattoapp1+demo-techista@gmail.com', '1100000001',
          'Techos y humedades', 'GBA Oeste', 35000, 120000, 'Lunes a sábado',
          'Techista con 15 años de oficio. Impermeabilizaciones, membranas, filtraciones y reparación de cielorrasos en zona oeste.', tec)
  returning id into p_tec;
  insert into public.proveedores (created_at, nombre, email, telefono, rubro, zona, precio_desde, precio_hasta,
                                  disponibilidad, descripcion, user_id)
  values (now() - interval '40 days', 'Sergio Medina', 'trattoapp1+demo-humedades@gmail.com', '1100000002',
          'Techos y humedades', 'GBA Oeste', 30000, 90000, 'Lunes a viernes',
          'Humedades y filtraciones. Detección del origen, membrana líquida y pintura antihongos.', hum)
  returning id into p_hum;

  insert into public.perfil_proveedor (user_id, nombre, titular, bio, anios_exp, trabajos_hechos) values
    (tec, 'Martín Ríos', 'Techista · 15 años en zona oeste',
     'Trabajo en techos planos y de chapa. Antes de presupuestar subo a ver el origen del problema, así no se paga dos veces.', 15, 1),
    (hum, 'Sergio Medina', 'Humedades y filtraciones',
     'Detecto de dónde viene la humedad y la corto de raíz. Trabajo prolijo y limpio.', 8, 0);
  insert into public.credenciales (user_id, tipo, titulo, donde, desde, hasta, detalle) values
    (tec, 'curso', 'Aplicación de membranas líquidas', 'Centro de Formación Profesional N.º 401', '2016', '2016', 'Curso de 40 horas');
  insert into public.publicaciones (user_id, tipo, titulo, cuerpo, estado) values
    (tec, 'trabajo', 'Terraza impermeabilizada en Caseros',
     'Membrana líquida en 40 m², con refuerzo en las uniones y babetas nuevas.', 'publicado');

  -- ── Pedido A: el del cliente, con dos presupuestos ──
  insert into public.solicitudes (created_at, nombre_cliente, email_cliente, telefono_cliente, servicio_necesitado, zona,
                                  presupuesto, urgencia, descripcion, estado, user_id)
  values (t0, 'Laura Fernández', 'trattoapp1+demo-cliente@gmail.com', '1100000000', 'Techos y humedades', 'GBA Oeste',
          70000, 'Esta semana',
          'Tengo una mancha de humedad en el techo del living que crece cada vez que llueve. Necesito que vean de dónde viene y lo arreglen.',
          'con_match', cli)
  returning id into s_a;
  insert into public.matches (created_at, solicitud_id, proveedor_id, estado) values (t0 + interval '5 minutes', s_a, p_tec, 'sugerido') returning id into m_a;
  insert into public.matches (created_at, solicitud_id, proveedor_id, estado) values (t0 + interval '6 minutes', s_a, p_hum, 'sugerido') returning id into m_b;

  insert into public.mensajes (created_at, match_id, remitente_tipo, contenido, leido, tipo, monto, incluye, plazo, estado_presupuesto) values
    (t0 + interval '20 minutes', m_a, 'cliente',   'Hola Martín, ¿podrías venir a verlo esta semana? La mancha está en el living, cerca de la ventana.', true, 'texto', null, null, null, null),
    (t0 + interval '35 minutes', m_a, 'proveedor', '¡Hola Laura! Sí, puedo pasar el jueves a la tarde. ¿Tenés acceso a la terraza?', true, 'texto', null, null, null, null),
    (t0 + interval '40 minutes', m_a, 'cliente',   'Sí, se sube por una escalera del patio.', true, 'texto', null, null, null, null),
    (t0 + interval '55 minutes', m_a, 'proveedor', 'Perfecto. Por la foto parece una fisura en la membrana. Te paso el presupuesto.', true, 'texto', null, null, null, null),
    (t0 + interval '56 minutes', m_a, 'proveedor', 'Presupuesto: $ 68.000', false, 'presupuesto', 68000,
       'Revisión de la terraza, sellado de fisuras con membrana líquida (6 m²) y reparación del cielorraso del living', '2 días', 'pendiente'),
    (t0 + interval '70 minutes', m_b, 'cliente',   'Hola Sergio, ¿cuándo podrías pasar a ver la humedad?', true, 'texto', null, null, null, null),
    (t0 + interval '90 minutes', m_b, 'proveedor', 'Buenas Laura, el viernes a la mañana. Te dejo el presupuesto para que lo tengas.', true, 'texto', null, null, null, null),
    (t0 + interval '91 minutes', m_b, 'proveedor', 'Presupuesto: $ 54.000', false, 'presupuesto', 54000,
       'Impermeabilización de la zona afectada con membrana, sin reparación ni pintura del cielorraso', '1 día', 'pendiente');

  -- ── Pedido B: abierto, para el Panel de los proveedores ──
  insert into public.solicitudes (created_at, nombre_cliente, email_cliente, telefono_cliente, servicio_necesitado, zona,
                                  presupuesto, urgencia, descripcion, estado, user_id)
  values (now() - interval '3 hours', 'Laura Fernández', 'trattoapp1+demo-cliente@gmail.com', '1100000000',
          'Techos y humedades', 'GBA Oeste', 45000, 'Sin apuro',
          'Se descascara la pintura del baño por la humedad. Quiero saber si es condensación o una filtración.',
          'pendiente', cli)
  returning id into s_b;

  -- ── Pedido C: trabajo terminado y calificado (reputación de Martín) ──
  insert into public.solicitudes (created_at, nombre_cliente, email_cliente, telefono_cliente, servicio_necesitado, zona,
                                  presupuesto, urgencia, descripcion, estado, user_id)
  values (now() - interval '30 days', 'Laura Fernández', 'trattoapp1+demo-cliente@gmail.com', '1100000000',
          'Techos y humedades', 'GBA Oeste', 50000, 'Esta semana', 'Gotea el techo de chapa del lavadero cuando llueve fuerte.',
          'con_match', cli)
  returning id into s_c;
  insert into public.matches (created_at, solicitud_id, proveedor_id, estado) values (now() - interval '30 days', s_c, p_tec, 'aceptado') returning id into m_c;
  insert into public.mensajes (created_at, match_id, remitente_tipo, contenido, leido, tipo, monto, incluye, plazo, estado_presupuesto, trabajo_estado) values
    (now() - interval '30 days' + interval '1 hour', m_c, 'proveedor', 'Presupuesto: $ 48.000', true, 'presupuesto', 48000,
     'Cambio de 3 chapas, sellado de tornillos y canaleta nueva', '1 día', 'aceptado', 'terminado');
  insert into public.reputacion (created_at, match_id, proveedor_user_id, cliente_user_id, puntaje, atributos, resumen, comentario)
  values (now() - interval '27 days', m_c, tec, cli, 5, '["Puntual","Presupuesto claro","Dejó todo limpio"]'::jsonb,
          'Llegó a horario, explicó qué iba a cambiar antes de empezar y dejó el lavadero limpio.',
          'Muy recomendable, resolvió la gotera en un día.');

  return format('Demo lista: cliente %s, proveedores %s y %s; pedidos %s (2 presupuestos), %s (abierto), %s (terminado)',
                cli, p_tec, p_hum, s_a, s_b, s_c);
end $$;

revoke all on function privado.reponer_demo() from public, anon, authenticated;
