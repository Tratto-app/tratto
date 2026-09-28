# Arquitectura de Tratto

Estado al 25/09/2026. Describe lo que hay en producción, no lo que se planea.

## Piezas

```
 Navegador / app Android (TWA) / app iPhone (Capacitor)
        │  index.html (SPA de un solo archivo, ~314 KB)
        ▼
 Vercel (hosting estático, cabeceras de seguridad en vercel.json)
        │
        ├──► Supabase (sa-east-1, São Paulo)
        │      ├─ Auth (email + contraseña, SMTP propio por Brevo)
        │      ├─ PostgREST: la app lee y escribe tablas directo, con RLS
        │      ├─ Postgres 17: 20 tablas, RLS en todas, triggers, pg_cron, pg_net
        │      ├─ Realtime: chat (tabla mensajes)
        │      ├─ Storage: bucket "publicaciones" (fotos, público de lectura)
        │      └─ Edge Functions: quick-service (push + mail de avisos),
        │                         avisar-equipo (alertas), limpieza-fotos
        │
        └──► n8n Cloud (webhooks): asistente, tasador por foto, comparador,
               reputación, Mercado Pago (OAuth, clave pública, cobro)
                    │
                    └─► OpenAI (gpt-4o-mini), Mercado Pago, Brevo
```

Flujos que arrancan en la base (no en la app):

| Evento | Quién lo dispara | Qué hace |
|---|---|---|
| Pedido o servicio nuevo | trigger `matching_*` (pg_net) | avisa a n8n, que crea las conexiones y manda mails |
| Presupuesto nuevo/aceptado/rechazado, trabajo terminado, pago | trigger `mensajes_notificar_push` | llama a `quick-service` (push + mail) |
| Cada 10 min | pg_cron `reintentar-matching` | re-avisa a n8n los pedidos que quedaron sin proveedores (máx. 3 veces) |
| Cada 15 min | pg_cron `revisar-salud` | junta problemas y manda alerta por mail |
| Todos los días 04:00 AR | pg_cron `vencer-pedidos` | pedidos pendientes de más de 15 días → `vencida` |

## Decisiones y por qué

- **Sin backend propio.** La app habla directo con Supabase y la seguridad
  vive en la base (RLS + triggers). Es simple y barato; la contracara es que
  toda regla de negocio que importe tiene que estar en la base, no en el
  JavaScript (que el usuario puede modificar). Por eso los topes anti-abuso,
  la protección de mensajes y el cupo de interesados son triggers.
- **n8n para integraciones.** Rápido de cambiar sin deploy. Los secretos de
  n8n y su disponibilidad son un riesgo operativo: ver SECURITY.md y
  MONITORING.md.
- **Un solo archivo HTML.** Carga en un pedido (83 KB comprimido). Cambiarlo
  a un framework no está justificado hoy.

## Esquema y migraciones

- `supabase/migrations/`: cambios versionados desde esta auditoría, en orden.
  El esquema anterior a eso se creó a mano desde el panel de Supabase.
- `supabase/tests/`: pruebas de permisos (matriz de visibilidad y escrituras)
  que se corren en staging antes y después de tocar políticas.
- Staging: proyecto Supabase aparte ("Tratto Staging"), mismo esquema, sin los
  triggers que llaman a n8n y a notificaciones, con datos de prueba.

## Límites que impone la arquitectura actual

Ver SCALABILITY.md (números medidos) y LOAD_TESTING.md (cómo se midió).
