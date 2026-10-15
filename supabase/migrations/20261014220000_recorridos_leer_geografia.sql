-- La pantalla Recorridos del CRM (Mail y WhatsApp) lee la regla de zonas
-- (prospeccion_geografia) para mostrar en qué etapa va la prospección. La
-- tabla growth_mkt_ajustes estaba cerrada para los usuarios del CRM, así que
-- esa lectura daba "permiso denegado" y la pantalla no cargaba.
-- Se abre solo la lectura de esa clave y solo para miembros del workspace.
-- El resto de los ajustes sigue cerrado y nadie puede cambiarlos desde el CRM.

grant select on public.growth_mkt_ajustes to authenticated;

drop policy if exists "miembros leen la geografia" on public.growth_mkt_ajustes;
create policy "miembros leen la geografia" on public.growth_mkt_ajustes
  for select to authenticated
  using (clave = 'prospeccion_geografia' and (select public.growth_is_member(workspace_id)));
