# Limpieza de fotos y evidencias privadas

La función desplegada sigue siendo `limpieza-fotos`, invocada por la tarea
diaria existente con `POST`. Conserva la autenticación por encabezado
`x-tratto-firma`, validado contra `PUSH_TRIGGER_SECRET` dentro del servidor.
El despliegue debe conservar `verify_jwt=false`: esa configuración no sustituye
la comprobación propia del encabezado. No se muestran ni se cambian secretos.

El paquete tiene dos archivos de despliegue: `index.ts` y `handler.mjs`.
El SDK se fija en `npm:@supabase/supabase-js@2.117.0`.

Ejecuta dos trabajos independientes, con nombres y límites definidos por el
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

Los dos trabajos se intentan aunque uno esté vacío o falle. La respuesta
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
