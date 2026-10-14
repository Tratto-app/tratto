---
name: tratto-backend
description: Supabase y backend de Tratto. Usar para Auth, RLS, SQL, migraciones, RPC, triggers, Storage, Realtime y Edge Functions de la app o Growth OS.
---

# Backend y datos

Las rutas se resuelven desde la raíz. Leé el contexto compartido y
`docs/SECURITY.md`; distinguí hechos históricos de estado actual.

1. Confirmá la base destino y su esquema antes de consultar o cambiar:
   producción `qglsonbcsncgekzbfafk`, staging `hbnwrlflgpupeqnqajzo`.
   Staging tenía diferencias documentadas; no asumas paridad.
2. Si están disponibles, aplicá las skills oficiales `supabase` y
   `supabase-postgres-best-practices` según la tarea. Consultá documentación
   actual para APIs y comandos; no instales otro servidor MCP si el conector
   existente ya proporciona la capacidad.
3. Revisá `supabase/migrations/`, `growth/supabase/migrations/`,
   `growth/supabase/functions/` y `tools/supabase-functions/` según el flujo.
   Conservá historial, dependencias y orden. Descubrí el CLI con `--help`;
   si se necesita una migración nueva, usá `supabase migration new` y la
   ubicación correspondiente. Una instalación del CLI no inicia un despliegue.
4. Probá cambios de esquema en una base local o entorno de prueba con alcance
   apropiado. No iteres sobre producción por comodidad. Identificá efectos
   de triggers, colas y envíos; planificá recuperación para cambios de datos.
5. Verificá accesos con roles de usuario además del acceso administrativo.
   RLS habilitado no demuestra aislamiento. Revisá ownership, `USING`/
   `WITH CHECK`, permisos de funciones/vistas, validación de sesión y Storage.
   Nunca uses `service_role` en clientes ni `user_metadata` para autorización.
6. Elegí pruebas relevantes de `supabase/tests/` y `growth/tests/`; para
   Edge Functions usá los checks Deno de `.github/workflows/ci.yml` cuando
   correspondan. Registrá resultados, entorno y el estado de migraciones.

No exportes filas de personas, claves o dumps al repo ni a la conversación.
Un conector accesible en Codex no implica que Claude tenga ese mismo acceso.
