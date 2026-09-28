-- Las funciones auxiliares de las políticas RLS (es_mi_*, *_visible,
-- soy_parte_del_match) son security definer y se podían llamar sin sesión por
-- /rest/v1/rpc/... (advisor 0028). Ninguna política para anon las usa (todas
-- las que las llaman son "to authenticated"), así que se les quita EXECUTE a
-- anon y a PUBLIC. Para un usuario con sesión no cambia nada.
revoke execute on function public.es_mi_proveedor(bigint), public.es_mi_solicitud(bigint),
  public.proveedor_visible(bigint), public.solicitud_visible(bigint), public.soy_parte_del_match(bigint)
  from public, anon;
grant execute on function public.es_mi_proveedor(bigint), public.es_mi_solicitud(bigint),
  public.proveedor_visible(bigint), public.solicitud_visible(bigint), public.soy_parte_del_match(bigint)
  to authenticated, service_role;
