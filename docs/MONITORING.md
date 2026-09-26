# Monitoreo y alertas

## Qué avisa solo (mail a trattoapp1@gmail.com)

| Alerta | De dónde sale | Cuándo | Frecuencia máxima |
|---|---|---|---|
| "Falló <workflow>" | n8n, workflow *ALERTA - Aviso por mail cuando falla un workflow* (está configurado como *error workflow* de todos los activos) | cualquier ejecución con error | 1 por workflow cada 30 min |
| "N llamadas salientes fallaron" | base, tarea `revisar-salud` | avisos a n8n / notificaciones / mails que devolvieron error | 1 cada 6 h |
| "N pedidos sin proveedores" | base | pedidos que siguen sin conexión después de 3 reintentos | 1 cada 6 h |
| "Falló una tarea programada" | base | alguna tarea de pg_cron falló | 1 cada 6 h |
| "La base está al X %" / "Las fotos ocupan el X %" | base | más del 80 % del plan | 1 cada 6 h |

Las alertas de la base salen por la función `avisar-equipo` (SMTP de Brevo).
Los topes del plan están en `privado.config` (`tope_base_mb`,
`tope_fotos_mb`): si se pasa a Supabase Pro, actualizarlos.

## Qué NO está cubierto todavía (hacer a mano o configurar)

- **Que la web esté arriba.** Recomendado: UptimeRobot (gratis) contra
  `https://www.trattoapp.com.ar` y contra
  `https://qglsonbcsncgekzbfafk.supabase.co/auth/v1/health` cada 5 min.
- **Gasto de OpenAI.** Poner un tope mensual en platform.openai.com → Limits.
  El asistente ya tiene tope por usuario/IP (ver SECURITY.md).
- **Cuota de n8n y de Brevo.** Revisar una vez por semana en sus paneles.

## Dónde mirar cuando algo falla

| Síntoma | Mirar |
|---|---|
| Un pedido no recibe proveedores | `select * from privado.reintentos_matching order by ultimo_en desc limit 20;` y ejecuciones de "Matching automatico + avisos" en n8n |
| No llegan push/mails de avisos | `select status_code, error_msg, created from net._http_response order by created desc limit 20;` y logs de `quick-service` |
| Tareas programadas | `select jobname, status, return_message, start_time from cron.job_run_details d join cron.job j using (jobid) order by start_time desc limit 20;` |
| Consultas lentas | Supabase → Database → Query performance, o `extensions.pg_stat_statements` |
| Advertencias de seguridad/rendimiento | Supabase → Advisors (correrlos después de cada migración) |
| Errores de la app | consola del navegador; logs de API en Supabase → Logs |
