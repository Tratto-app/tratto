# Limpieza de fotos y evidencias privadas

La función desplegada sigue siendo `limpieza-fotos`. Conserva la autenticación por encabezado
`x-tratto-firma`, validado contra `PUSH_TRIGGER_SECRET` dentro del servidor.
El despliegue debe conservar `verify_jwt=false`: esa configuración no sustituye
la comprobación propia del encabezado. No se muestran ni se cambian secretos.

El paquete tiene dos archivos de despliegue: `index.ts` y `handler.mjs`.
El SDK se fija en `npm:@supabase/supabase-js@2.117.0`.

La revisión del 28/10 comprobó que la tarea histórica `limpiar-fotos` no estaba
programada. Su migración original dejó la activación pendiente de aprobación
por tratarse de borrados irreversibles. Este cambio **no activa esa tarea ni
limpia publicaciones históricas**.

La migración `20261028113131_servicio_evidencias_programar_limpieza.sql` crea
la tarea nueva `servicio-evidencias-limpieza` a las 06:30 UTC. Llama por `POST`
a `limpieza-fotos?solo=evidencias` y sólo procesa el bucket privado nuevo.
Se debe desplegar primero el handler con ese modo y aplicar después esta
migración: una versión anterior que ignorase la query no sirve para esta tarea.
El modo normal, sin query, conserva los dos trabajos previos para sus llamadas
administrativas existentes. Un modo desconocido, duplicado o parámetros de
bucket/ruta se rechazan sin operaciones.

El cron sólo guarda una llamada a una función privada, sin secreto literal.
La función valida el destino Supabase configurado y resuelve la firma en Vault
al ejecutar dentro del servidor; no devuelve ni registra el secreto. Sus permisos
excluyen `PUBLIC`, `anon`, `authenticated` y `service_role`: la ejecuta el dueño
administrativo de la tarea. Si faltan dependencias o configuración, la migración
falla en lugar de afirmar que hay una tarea funcional.

El modo normal ejecuta dos trabajos independientes, con nombres y límites definidos por el
servidor; el solicitante no puede elegir un bucket ni pasar rutas:

1. `fotos_para_borrar({limite:200})` → bucket `publicaciones` →
   `fotos_borradas({nombres})`.
2. `servicio_evidencias_pendientes_borrado({p_limit:100})` → bucket privado
   `servicio-evidencias` → `servicio_evidencias_borradas({p_names})`.

Las RPC de evidencias requieren la migración de acuerdos de servicio y son
exclusivas de `service_role`. Seleccionan elementos en cola por eliminación y
subidas huérfanas elegibles; esta función no determina la retención de un caso.

La eliminación se hace por la API de Storage. Solo se confirma el trabajo en
la base cuando `Storage.remove` terminó sin error. Si el objeto ya no existe,
una eliminación idempotente exitosa también permite retirar la referencia.
Si el borrado falla o es incierto no se confirma: queda para la siguiente
ejecución. Si falla la confirmación, se responde error para que no se presente
como una limpieza completa. No se usa `DELETE storage.objects`.

En modo normal ambos trabajos se intentan aunque uno esté vacío o falle. La respuesta
mantiene `borradas` y `pedidos` y agrega `evidencias_borradas`,
`evidencias_referencias` y errores por etapa sin rutas ni cuerpos sensibles.

Verificación aislada, sin secretos, Storage real ni escrituras a producción:

```sh
node --test tools/supabase-functions/limpieza-fotos/handler.test.mjs
```

Los tests verifican rechazo sin firma, método, orden borrar→confirmar,
fallos de listado/borrado/confirmación, duplicados, reintentos idempotentes y
separación de buckets. No prueban por sí solos el cron ni la eliminación real
en producción; eso debe comprobarse al desplegar el paquete y las RPC.
