# Arquitectura del Growth OS

## Piezas

| Pieza | Dónde | Qué hace |
|---|---|---|
| Panel | `growth/web` (React + Vite + TS, sin backend propio) | Lee y escribe con la clave pública de Supabase; los permisos los decide RLS |
| Base | Tablas `public.growth_*` en Supabase (Postgres) | Datos, reglas, métricas (funciones SQL `growth_*`), triggers |
| Edge Functions | `growth/supabase/functions` (Deno) | Lo que necesita secretos o llamadas externas |
| Tareas programadas | `pg_cron` + `pg_net` | Cada 5 min avanza automatizaciones; 9:40 marca inactivos |

Se eligió esto porque es el mismo stack que ya usa Tratto (Supabase + Vercel + Deno + gpt-4o-mini): no suma proveedores ni servidores.

## Modelo de datos (resumen)

- **Multi-workspace**: `growth_workspaces` + `growth_members` (owner/admin/member). Cada tabla tiene `workspace_id` y política RLS "miembros del workspace" (`growth_is_member`). Probado con `tests/sql/rls_aislamiento.sql`: un usuario ajeno y el rol anónimo ven 0 filas y no pueden escribir.
- **Prospecto ≠ usuario de la app**: `growth_prospects` (personas que todavía no usan la app) y `growth_app_users` (identidad dentro de la app, `external_user_id`). Se vinculan cuando un evento trae `click_token`, `prospect_id` o el mismo email.
- **Funnel por cohorte**: cada prospecto guarda la fecha en que llegó a cada etapa (`contacted_at` … `activated_at`). `growth_funnel` cuenta, de los prospectos que entraron en el período, cuántos llegaron a cada etapa o más lejos, y lo compara con el período anterior de igual duración. "Usuario activo" = activado y con uso dentro de la ventana configurada.
- **Estados** solo avanzan (`growth_advance`): un evento viejo no hace retroceder a nadie; las etapas "duras" (click en adelante) pisan "no interesado" o "sin respuesta".
- **Scoring**: reglas editables (`growth_score_rules`) evaluadas por `growth_score_for` en un trigger; el score de la IA se guarda aparte (`ai_score`). Un score manual (`score_manual`) no se recalcula.
- **Reglas**: un mismo lenguaje JSON (`all`/`any` + `eq, neq, in, nin, gt, gte, lt, lte, contains, has_tag, is_set, is_null, within_days, older_than_days`) evaluado en SQL (`growth_match`) y en TypeScript (`matchCond`). Lo usan segmentos, filtros de automatizaciones y condiciones.

## Flujos

**Click**: `growth-go/<slug>?r=<ref>` → `growth_record_click` registra dispositivo y destino (sin guardar IP) → 302 a Play (con `referrer` = UTM + `gid`), App Store (con `ct`) o la web. Los previsualizadores de chats no cuentan como click.

**Eventos de la app**: `POST growth-event` con `x-growth-key` (se guarda solo su sha256) → `growth_ingest_event`: crea/actualiza el usuario, lo vincula al prospecto, registra instalación/registro/activación/sesión/pago, avanza el estado del prospecto y notifica. Idempotente por `idempotency_key`. El evento de activación se configura en App Overview.

**Automatizaciones**: un trigger crea la ejecución (`growth_workflow_runs`, una activa por prospecto y automatización); `growth-automations` la avanza paso a paso (enviar mensaje o link, esperar, esperar respuesta con rama sí/no, condición, IA, score, estado, etiqueta, tarea, notificación, webhook https). Una respuesta entrante despierta las ejecuciones que la esperaban. Se cortan si el prospecto pide no ser contactado.

**IA**: `growth-ai` arma el contexto con App Settings + base de conocimiento + objeciones, llama a OpenAI (JSON) y sanea la salida; sin clave usa reglas deterministas marcadas como `mock`. Todo queda en `growth_ai_runs`.

## Despliegue actual (staging)

- Migraciones aplicadas en `hbnwrlflgpupeqnqajzo` (sin las líneas `drop … if exists`, que la herramienta usada no permite ejecutar sin confirmación; en un proyecto nuevo no hacen nada).
- Las 5 funciones desplegadas. Las copias desplegadas por la herramienta MCP llevan solo la parte de `_shared/` que usa cada función; para un despliegue canónico usar `supabase functions deploy` desde este repo.
- Fix posteriores aplicados también en staging: `growth_store_stats` (columna ambigua) y `growth_funnel` (definición de "activo").
