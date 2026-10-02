# Growth OS

Panel interno para **conseguir usuarios para la app**: prospectos → contacto → interés → link a la tienda → instalación → registro → activación → retención. Todo lo que muestra se calcula desde la base; nada se escribe a mano.

Está separado de la app de Tratto: vive en `growth/`, no se sirve desde `trattoapp.com.ar` (está en `.vercelignore`) y usa sus propias tablas `growth_*`. **Hoy está instalado solo en staging** (`hbnwrlflgpupeqnqajzo`). Producción no se tocó.

```
growth/
├─ web/                     Panel (React 19 + Vite + TypeScript)
├─ supabase/migrations/     Tablas growth_*, RLS, lógica y métricas (SQL)
├─ supabase/functions/      Edge Functions (Deno): growth-go, growth-event, growth-ai, growth-send, growth-automations
├─ supabase/seed/           demo.sql (datos ficticios) y tratto.sql (workspace real)
├─ tests/                   e2e/flujo_completo.py (API) y sql/rls_aislamiento.sql
└─ docs/                    Arquitectura, integraciones y cumplimiento
```

## Correrlo

```bash
cd growth/web
cp .env.example .env.local      # completar VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY (clave pública)
npm ci
npm run dev                     # http://localhost:5180
```

Usuario de la demo en staging: `demo.growth@example.com` (la contraseña no está en el repo; pedila o reseteala desde Supabase Auth). Ve dos workspaces: **Demo** (datos ficticios) y **Tratto** (configuración real, sin prospectos todavía).

Comandos:

| | |
|---|---|
| `npm run typecheck` | TypeScript estricto |
| `npm test` | Tests unitarios (Vitest): motor de reglas, redirecciones, lectura de respuestas, períodos, CSV |
| `npm run build` | Build de producción en `dist/` |
| `npm run e2e` | Smoke test en navegador (Playwright) contra un proyecto real; necesita `GROWTH_DEMO_EMAIL`, `GROWTH_DEMO_PASSWORD` y el build hecho con las variables `VITE_*` |
| `python3 growth/tests/e2e/flujo_completo.py` | Prueba de punta a punta de la API (prospecto → activación); ver variables en el archivo |

## Instalar en otro proyecto Supabase

1. Aplicar las 4 migraciones de `supabase/migrations/` en orden.
2. Guardar la URL de las funciones: `insert into growth_system (key, value) values ('functions_url', 'https://<ref>.supabase.co/functions/v1');` (lo explica la migración 4).
3. Desplegar las funciones: `supabase functions deploy growth-go growth-event --no-verify-jwt` y `supabase functions deploy growth-ai growth-send` y `supabase functions deploy growth-automations --no-verify-jwt` (esta última valida su propio secreto o la sesión).
4. Cargar los secrets que quieras usar (`supabase/functions/.env.example`).
5. Opcional: `seed/demo.sql` (requiere el usuario `demo.growth@example.com`) y `seed/tratto.sql`.

## Probar el recorrido Prospecto → Instalación → Registro → Activación

**Desde el panel (workspace Demo):**
1. Prospects → **+ Prospecto** (nombre y un @). Se crea con score calculado y arranca la automatización "Bienvenida".
2. Automations → **Procesar ahora**: la IA lo analiza, le escribe (queda "Simulado") y espera respuesta.
3. Inbox → elegilo → **Cargar respuesta recibida**: "Me interesa, pasame el link". Pasa a *Interesado*.
4. Automations → **Procesar ahora**: la automatización "Interesados" le manda su link personal (*Link enviado*).
5. En su perfil → Links personales → **Simular click Android**: queda *Hizo click* (en la demo; en la vida real es el link abierto en el teléfono).
6. En su perfil → Simular la app → `install`, `register`, `first_action`: pasa a *Instaló*, *Se registró* y *Activado*, aparece en App Users vinculado al prospecto y en el Dashboard/Funnel.

**Desde la API (lo que haría la app real):** `tests/e2e/flujo_completo.py` hace exactamente eso con las Edge Functions reales, incluido el click con un User-Agent de Android, la lectura del `gid` del referrer de Google Play y los eventos con la clave de ingesta. Última corrida: 23/23 OK.

## Qué es real y qué es simulado

Ver `docs/INTEGRACIONES.md`. En corto: base, métricas, RLS, links trackeados, ingesta de eventos, automatizaciones, cron y panel funcionan de verdad (probados en staging). Los envíos por email/WhatsApp/SMS/Instagram están implementados contra las APIs oficiales pero **sin probar en vivo** (no hay credenciales cargadas), así que hoy todo envío queda como *Simulado*. La IA, sin `OPENAI_API_KEY`, responde por reglas y lo dice. Las métricas de las consolas de Google Play y App Store no están conectadas y no se inventan.
