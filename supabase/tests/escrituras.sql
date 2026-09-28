-- Pruebas de escritura con RLS (STAGING). Cada caso dice qué se espera; el
-- bloque termina en error a propósito para deshacer todo y devolver el informe.
do $$
declare
  cli uuid := '00000000-0000-4000-8000-000000000001';
  otro uuid := '00000000-0000-4000-8000-000000000002';
  prov uuid := '00000000-0000-4000-8000-000000002001';
  sal text := ''; n int; mid bigint; pid bigint; ajeno bigint; sid bigint;

begin
  -- datos de apoyo (como postgres, antes de cambiar de rol)
  select m.id into mid from public.matches m join public.solicitudes s on s.id = m.solicitud_id
   join public.mensajes x on x.match_id = m.id and x.tipo = 'presupuesto' and x.estado_presupuesto = 'pendiente'
   where s.user_id = cli limit 1;
  select id into pid from public.proveedores where user_id = prov limit 1;
  select id into ajeno from public.proveedores where user_id <> prov limit 1;
  select s.id into sid from public.solicitudes s where s.estado = 'pendiente' and s.user_id <> prov
    and not exists (select 1 from public.interesados i where i.solicitud_id = s.id and i.proveedor_id = pid) limit 1;

  -- ── como cliente ──
  perform set_config('request.jwt.claims', json_build_object('sub', cli, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    update public.mensajes set estado_presupuesto = 'aceptado' where match_id = mid and tipo = 'presupuesto' and estado_presupuesto = 'pendiente';
    get diagnostics n = row_count; sal := sal || '1.cliente acepta presupuesto (espera 1): ' || n || E'\n';
  exception when others then sal := sal || '1.cliente acepta presupuesto (espera 1): ERROR ' || sqlerrm || E'\n'; end;
  begin
    insert into public.visitas_perfil (perfil_user_id, visitante) values (prov, otro);
    sal := sal || '2.visita con visitante ajeno: PERMITIDA' || E'\n';
  exception when others then sal := sal || '2.visita con visitante ajeno: RECHAZADA' || E'\n'; end;
  begin
    insert into public.visitas_perfil (perfil_user_id, visitante) values (prov, cli);
    sal := sal || '3.visita propia (espera permitida): PERMITIDA' || E'\n';
  exception when others then sal := sal || '3.visita propia (espera permitida): RECHAZADA ' || sqlerrm || E'\n'; end;
  begin
    insert into public.solicitudes (user_id, servicio_necesitado, estado) values (otro, 'Plomería', 'pendiente');
    sal := sal || '4.pedido a nombre de otro (espera rechazo): PERMITIDO' || E'\n';
  exception when others then sal := sal || '4.pedido a nombre de otro (espera rechazo): RECHAZADO' || E'\n'; end;
  begin
    update public.publicaciones set titulo = 'x' where user_id = prov;
    get diagnostics n = row_count; sal := sal || '5.editar publicación ajena (espera 0): ' || n || E'\n';
  exception when others then sal := sal || '5.editar publicación ajena: ERROR ' || sqlerrm || E'\n'; end;
  begin
    insert into public.credenciales (user_id, titulo) values (cli, 'mia');
    sal := sal || '6.credencial propia (espera permitida): PERMITIDA' || E'\n';
  exception when others then sal := sal || '6.credencial propia (espera permitida): RECHAZADA ' || sqlerrm || E'\n'; end;
  begin
    insert into public.credenciales (user_id, titulo) values (otro, 'ajena');
    sal := sal || '7.credencial ajena (espera rechazo): PERMITIDA' || E'\n';
  exception when others then sal := sal || '7.credencial ajena (espera rechazo): RECHAZADA' || E'\n'; end;
  begin
    delete from public.credenciales where user_id = prov;
    get diagnostics n = row_count; sal := sal || '8.borrar credenciales ajenas (espera 0): ' || n || E'\n';
  exception when others then sal := sal || '8.borrar credenciales ajenas: ERROR ' || sqlerrm || E'\n'; end;
  begin
    update public.mensajes set contenido = 'cambiado' where match_id = mid;
    get diagnostics n = row_count; sal := sal || '9.editar texto de mensaje (espera rechazo): ' || n || E'\n';
  exception when others then sal := sal || '9.editar texto de mensaje (espera rechazo): RECHAZADO' || E'\n'; end;
  reset role;

  -- ── como proveedor ──
  perform set_config('request.jwt.claims', json_build_object('sub', prov, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    update public.mensajes set estado_presupuesto = 'rechazado'
     where tipo = 'presupuesto' and estado_presupuesto = 'pendiente'
       and match_id in (select id from public.matches where proveedor_id = pid);
    get diagnostics n = row_count; sal := sal || '10.proveedor responde su propio presupuesto (espera rechazo): ' || n || E'\n';
  exception when others then sal := sal || '10.proveedor responde su propio presupuesto (espera rechazo): RECHAZADO' || E'\n'; end;
  begin
    insert into public.interesados (solicitud_id, proveedor_id, user_id) values (sid, pid, prov);
    sal := sal || '11.anotarse con su servicio (espera permitido): PERMITIDO' || E'\n';
  exception when others then sal := sal || '11.anotarse con su servicio (espera permitido): RECHAZADO ' || sqlerrm || E'\n'; end;
  begin
    insert into public.interesados (solicitud_id, proveedor_id, user_id) values (sid, ajeno, prov);
    sal := sal || '12.anotarse con servicio ajeno (espera rechazo): PERMITIDO' || E'\n';
  exception when others then sal := sal || '12.anotarse con servicio ajeno (espera rechazo): RECHAZADO' || E'\n'; end;
  begin
    select count(*) into n from public.cuentas_mp;
    sal := sal || '13.ve cuentas_mp (espera 0, no tiene): ' || n || E'\n';
  exception when others then sal := sal || '13.ve cuentas_mp: ERROR ' || sqlerrm || E'\n'; end;
  reset role;
  raise exception E'INFORME\n%', sal;
end $$;
