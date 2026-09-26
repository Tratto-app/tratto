-- Índices faltantes y políticas RLS más baratas. SIN cambiar quién ve qué,
-- salvo un ajuste de seguridad explícito (visitas_perfil, ver abajo).
--
-- Por qué: con datos de prueba a escala (staging: 20k pedidos, 288k mensajes)
-- abrir un chat tardaba ~2 s porque mensajes no tenía índice por match_id y
-- Postgres recorría la tabla entera. Detalle y mediciones en docs/LOAD_TESTING.md.
--
-- 1) Índices para los filtros que usa la app (index.html) y para las FK que
--    el linter de Supabase marca sin índice.
-- 2) auth.uid() pasa a (select auth.uid()): Postgres lo evalúa una vez por
--    consulta en vez de una vez por fila (lint 0003 auth_rls_initplan).
-- 3) Políticas duplicadas que se evaluaban juntas (lint 0006):
--    * cuentas_mp: dos SELECT idénticos -> queda uno.
--    * credenciales / publicaciones: "manejo mis ..." era FOR ALL y se sumaba
--      al SELECT "visibles". Se parte en INSERT/UPDATE/DELETE; el SELECT ya lo
--      cubre "visibles" (que es más amplio), así que nadie ve más ni menos.
--    * interesados: dos SELECT -> uno con OR, mismo resultado.
--    * mensajes: "el cliente responde el presupuesto" (UPDATE) es un caso
--      particular de msg_editar (soy_parte_del_match incluye al cliente), así
--      que se borra. La regla de negocio real (solo el cliente acepta o
--      rechaza) la aplica el trigger proteger_mensajes, que no cambia.
-- 4) Seguridad: "registro visita" permitía insertar una visita con cualquier
--    visitante. Ahora visitante tiene que ser quien visita (o null). La app ya
--    manda su propio id, así que no cambia nada para un usuario normal.

-- ── 1) Índices ────────────────────────────────────────────────────────────
create index if not exists mensajes_match_creado_idx     on public.mensajes (match_id, created_at);
create index if not exists solicitudes_user_creado_idx   on public.solicitudes (user_id, created_at desc);
create index if not exists solicitudes_feed_idx          on public.solicitudes (servicio_necesitado, created_at desc) where estado = 'pendiente';
create index if not exists proveedores_user_idx          on public.proveedores (user_id, rubro);
create index if not exists proveedores_rubro_idx         on public.proveedores (rubro);
create index if not exists matches_proveedor_idx         on public.matches (proveedor_id);
create index if not exists visitas_perfil_perfil_idx     on public.visitas_perfil (perfil_user_id);
create index if not exists visitas_perfil_visitante_idx  on public.visitas_perfil (visitante);
create index if not exists reputacion_proveedor_idx      on public.reputacion (proveedor_user_id, created_at desc);
create index if not exists reputacion_cliente_idx        on public.reputacion (cliente_user_id);
create index if not exists publicaciones_user_idx        on public.publicaciones (user_id, created_at desc);
create index if not exists credenciales_user_idx         on public.credenciales (user_id);
create index if not exists interesados_proveedor_idx     on public.interesados (proveedor_id);
create index if not exists canjes_user_idx               on public.canjes (user_id);
create index if not exists consultas_user_idx           on public.consultas (user_id);
create index if not exists oauth_states_user_idx         on public.oauth_states (user_id);

-- ── 2 y 3) Políticas ──────────────────────────────────────────────────────
-- canjes
drop policy "manejo mis canjes" on public.canjes;
create policy "manejo mis canjes" on public.canjes for all to public
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- credenciales
drop policy "credenciales visibles" on public.credenciales;
drop policy "manejo mis credenciales" on public.credenciales;
create policy "credenciales visibles" on public.credenciales for select to public
  using ((select auth.uid()) is not null);
create policy "creo mis credenciales" on public.credenciales for insert to public
  with check (user_id = (select auth.uid()));
create policy "edito mis credenciales" on public.credenciales for update to public
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "borro mis credenciales" on public.credenciales for delete to public
  using (user_id = (select auth.uid()));

-- cuentas_mp
drop policy "cada proveedor ve su cuenta" on public.cuentas_mp;
drop policy "veo mi cuenta de mp" on public.cuentas_mp;
create policy "veo mi cuenta de mp" on public.cuentas_mp for select to public
  using (user_id = (select auth.uid()));

-- interesados
drop policy "el cliente ve quien tomo su pedido" on public.interesados;
drop policy "el proveedor ve sus propios intereses" on public.interesados;
drop policy "el proveedor anota su propio interes" on public.interesados;
create policy "veo los interesados que me tocan" on public.interesados for select to authenticated
  using (user_id = (select auth.uid())
         or exists (select 1 from public.solicitudes s
                    where s.id = interesados.solicitud_id and s.user_id = (select auth.uid())));
create policy "el proveedor anota su propio interes" on public.interesados for insert to authenticated
  with check (user_id = (select auth.uid())
              and exists (select 1 from public.proveedores p
                          where p.id = interesados.proveedor_id and p.user_id = (select auth.uid())));

-- mensajes
drop policy "el cliente responde el presupuesto" on public.mensajes;

-- perfil_proveedor
drop policy "creo mi perfil" on public.perfil_proveedor;
drop policy "edito mi perfil" on public.perfil_proveedor;
drop policy "perfil visible" on public.perfil_proveedor;
create policy "creo mi perfil" on public.perfil_proveedor for insert to public
  with check (user_id = (select auth.uid()));
create policy "edito mi perfil" on public.perfil_proveedor for update to public
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "perfil visible" on public.perfil_proveedor for select to public
  using ((select auth.uid()) is not null);

-- proveedores
drop policy prov_borrar on public.proveedores;
drop policy prov_crear on public.proveedores;
drop policy prov_editar on public.proveedores;
drop policy prov_leer on public.proveedores;
create policy prov_borrar on public.proveedores for delete to authenticated
  using (user_id = (select auth.uid()));
create policy prov_crear on public.proveedores for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy prov_editar on public.proveedores for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy prov_leer on public.proveedores for select to authenticated
  using (user_id = (select auth.uid()) or public.proveedor_visible(id));

-- publicaciones
drop policy "manejo mis publicaciones" on public.publicaciones;
drop policy "publicaciones visibles" on public.publicaciones;
create policy "publicaciones visibles" on public.publicaciones for select to public
  using ((select auth.uid()) is not null);
create policy "creo mis publicaciones" on public.publicaciones for insert to public
  with check (user_id = (select auth.uid()));
create policy "edito mis publicaciones" on public.publicaciones for update to public
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "borro mis publicaciones" on public.publicaciones for delete to public
  using (user_id = (select auth.uid()));

-- push_subscripciones
drop policy "cada uno borra sus propios dispositivos" on public.push_subscripciones;
drop policy "cada uno ve sus propios dispositivos" on public.push_subscripciones;
create policy "cada uno borra sus propios dispositivos" on public.push_subscripciones for delete to authenticated
  using (user_id = (select auth.uid()));
create policy "cada uno ve sus propios dispositivos" on public.push_subscripciones for select to authenticated
  using (user_id = (select auth.uid()));

-- reputacion
drop policy "reputacion visible" on public.reputacion;
create policy "reputacion visible" on public.reputacion for select to public
  using ((select auth.uid()) is not null);

-- solicitudes
drop policy sol_borrar on public.solicitudes;
drop policy sol_crear on public.solicitudes;
drop policy sol_editar on public.solicitudes;
drop policy sol_leer on public.solicitudes;
create policy sol_borrar on public.solicitudes for delete to authenticated
  using (user_id = (select auth.uid()));
create policy sol_crear on public.solicitudes for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy sol_editar on public.solicitudes for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy sol_leer on public.solicitudes for select to authenticated
  using (user_id = (select auth.uid()) or public.solicitud_visible(id));

-- visitas_perfil (4: visitante tiene que ser uno mismo)
drop policy "registro visita" on public.visitas_perfil;
drop policy "veo mis visitas" on public.visitas_perfil;
create policy "registro visita" on public.visitas_perfil for insert to public
  with check ((select auth.uid()) is not null
              and (visitante is null or visitante = (select auth.uid())));
create policy "veo mis visitas" on public.visitas_perfil for select to public
  using (perfil_user_id = (select auth.uid()));
