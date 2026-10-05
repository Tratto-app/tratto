# Seeds del Growth OS

## demo.sql — datos ficticios

Crea el workspace `demo` (`is_demo = true`): 520 prospectos, conversaciones, 6 campañas con gasto, 7 links, 3 automatizaciones y 100 usuarios de la app con sus eventos (los eventos pasan por `growth_ingest_event`, la misma función que usa la app real). Nombres inventados, emails `@example.com`, teléfonos `+54 9 11 0000-xxxx`, cuentas `@demo_…`. Nada se envía.

Requiere un usuario `demo.growth@example.com` en Supabase Auth (crealo desde el panel de Supabase → Authentication → Add user, con email confirmado). Si el workspace ya existe, no hace nada.

Solo en un workspace demo se pueden **simular** clicks y eventos desde el panel (`growth_simulate_click`, `growth_simulate_event`).

## tratto.sql — workspace real

App Settings, base de conocimiento, objeciones y dos links con información real de Tratto. No crea prospectos ni usuarios. En staging se cargó por la API con la sesión del dueño (mismo contenido), porque la herramienta usada para SQL pedía una confirmación manual para el `update`.

El dueño inicial es el usuario demo: agregá tu propia cuenta como owner desde Settings → Workspace.
