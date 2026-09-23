-- M-02, correccion de fondo: que la base no le entregue email_cliente ni
-- telefono_cliente a ningun usuario (ni siquiera al proveedor del match, ni
-- llamando a la API a mano con select=*). n8n usa service_role y no se ve
-- afectado; la app nunca lee esas dos columnas, solo las escribe al crear.
--
-- *** CORRER SOLO DESPUES DE MERGEAR LA RAMA A MAIN ***
-- La version de index.html que hoy esta en produccion pide select=* y
-- return=representation sobre solicitudes. Con este cambio, esa version deja
-- de poder crear pedidos. La version nueva (esta rama) pide columnas
-- explicitas y return=minimal, y funciona con esto.
--
-- Probado el 23/09/2026 en una transaccion con rollback, como el cliente y el
-- proveedor reales del match 29: el cliente lee y crea sus pedidos; el
-- proveedor ve el pedido del match; leer email/telefono -> permission denied.

revoke select on public.solicitudes from authenticated, anon;
grant select (id, created_at, nombre_cliente, servicio_necesitado, zona, presupuesto,
              urgencia, descripcion, estado, user_id, foto_url, cupo)
  on public.solicitudes to authenticated;
