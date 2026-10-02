-- Prueba de aislamiento entre workspaces (RLS).
-- Corre como el rol "authenticated" con dos identidades: el dueño del
-- workspace demo y un usuario cualquiera que no es miembro. Al final lanza
-- una excepción con el resultado: así TODO se deshace y no queda nada escrito.
-- Resultado esperado: el mensaje empieza con "RESULTADO OK".
do $t$
declare
  owner uuid := (select id from auth.users where email = 'demo.growth@example.com');
  ws uuid := (select id from public.growth_workspaces where slug = 'demo');
  extraño uuid := gen_random_uuid();
  n_owner int; n_extraño int; n_users int; n_msgs int; n_anon int;
  ins_ok boolean := false; upd_n int; key_ok boolean := false; demo_ok boolean := false;
  fallas text := '';
begin
  -- Dueño: ve sus datos
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', owner, 'role', 'authenticated')::text, true);
  select count(*) into n_owner from public.growth_prospects where workspace_id = ws;
  if n_owner < 500 then fallas := fallas || ' dueño_no_ve(' || n_owner || ')'; end if;

  -- Extraño: no ve nada de ningún tipo
  perform set_config('request.jwt.claims', json_build_object('sub', extraño, 'role', 'authenticated')::text, true);
  select count(*) into n_extraño from public.growth_prospects;
  select count(*) into n_users from public.growth_app_users;
  select count(*) into n_msgs from public.growth_messages;
  if n_extraño + n_users + n_msgs > 0 then fallas := fallas || ' extraño_ve(' || n_extraño || ',' || n_users || ',' || n_msgs || ')'; end if;

  -- Extraño: no puede insertar en el workspace ajeno
  begin
    insert into public.growth_prospects (workspace_id, first_name) values (ws, 'Intruso');
    ins_ok := true;
  exception when others then null;
  end;
  if ins_ok then fallas := fallas || ' extraño_inserta'; end if;

  -- Extraño: un update no toca filas ajenas
  update public.growth_prospects set notes = 'x' where workspace_id = ws;
  get diagnostics upd_n = row_count;
  if upd_n > 0 then fallas := fallas || ' extraño_actualiza(' || upd_n || ')'; end if;

  -- Extraño: no puede generar la clave de ingesta ni simular eventos
  begin
    perform public.growth_rotate_ingest_key(ws);
    key_ok := true;
  exception when others then null;
  end;
  if key_ok then fallas := fallas || ' extraño_genera_clave'; end if;
  begin
    perform public.growth_simulate_event(ws, '{"event":"install"}');
    demo_ok := true;
  exception when others then null;
  end;
  if demo_ok then fallas := fallas || ' extraño_simula'; end if;

  -- Extraño: las funciones de métricas rechazan el workspace ajeno
  begin
    perform public.growth_kpis(ws, now() - interval '30 days', now());
    fallas := fallas || ' extraño_lee_kpis';
  exception when others then null;
  end;

  -- Anónimo: sin acceso
  perform set_config('role', 'anon', true);
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  begin
    select count(*) into n_anon from public.growth_prospects;
    if n_anon > 0 then fallas := fallas || ' anon_ve(' || n_anon || ')'; end if;
  exception when insufficient_privilege then null;
  end;

  raise exception 'RESULTADO %', case when fallas = '' then 'OK (dueño ve ' || n_owner || ' prospectos; extraño y anónimo, 0)' else 'FALLAS:' || fallas end;
end $t$;
