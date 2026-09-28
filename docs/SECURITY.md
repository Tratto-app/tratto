# Seguridad

Este repositorio es **público**. Acá se describen los controles y los
procedimientos; los hallazgos de auditoría pendientes se manejan en privado
(no se versionan: ver `.gitignore`).

## Modelo

- La app habla directo con Supabase. **La seguridad vive en la base**: RLS en
  las 20 tablas, triggers que protegen reglas de negocio y funciones
  `security definer` con `search_path` fijo. Nada que dependa del JavaScript
  del cliente cuenta como control.
- La clave anónima de Supabase es pública por diseño. La clave de servicio
  (service_role) **nunca** va al cliente ni al repo.
- Todo lo sensible que no puede resolver la base (IA, Mercado Pago) pasa por
  n8n o por Edge Functions, que validan la sesión del usuario.

## Controles en la base

| Control | Dónde |
|---|---|
| RLS en todas las tablas; tablas internas solo para service_role | políticas en cada tabla; `supabase/tests/` las verifica |
| Un mensaje enviado no se edita; solo el cliente acepta/rechaza; solo el proveedor marca terminado | trigger `proteger_mensajes` |
| El contador de trabajos no se puede tocar desde la app | trigger `proteger_perfil_proveedor` |
| Cupo de interesados por pedido, sin carreras | trigger `chequear_cupo` (`for update`) |
| Topes por usuario: 5 pedidos/día, 5 servicios/día, 10 publicaciones/día, 20 antecedentes/día, 30 postulaciones/día, 20 mensajes/min por conversación | `privado.limitar_*` (migración `limites_anti_abuso`) |
| Una visita de perfil solo a nombre propio; repetidas en 1 h no cuentan | política `registro visita` + trigger `limite_visitas` |
| Fotos: solo en la carpeta propia, 2 MB por archivo, 20 por día y 150 por usuario | política `subo mis fotos` + `privado.fotos_permitidas` |
| Asistente con IA: 40 preguntas/día con sesión, 15/día por IP sin sesión, 500/día entre todos los anónimos | `public.asistente_permitido` (la IP se guarda con hash y sal) |
| Borrar la cuenta borra o anonimiza todos los datos personales | `borrar_mi_cuenta()`; las fotos las borra `limpieza-fotos` |
| Esquema `privado` no expuesto por la API | funciones internas y tablas de control |

## Controles fuera de la base

- **Cabeceras HTTP** (CSP, HSTS, X-Frame-Options, etc.): `vercel.json`.
- **Webhooks de n8n**: el de matching exige un encabezado secreto; los que
  llama la app validan el token de sesión contra Supabase y aceptan solo el
  origen del sitio (CORS).
- **Edge Functions internas** (`quick-service`, `avisar-equipo`,
  `limpieza-fotos`) exigen el encabezado `x-tratto-firma`.
- **Mercado Pago**: OAuth con `state` de un solo uso (`oauth_states`).
- **CI**: `tools/ci/revisar.py` falla si aparece una credencial en un archivo
  versionado.

## Reglas para secretos

1. Nunca en el repo, ni en issues, ni en capturas de pantalla.
2. En n8n, preferir **Credentials** (cifradas) a valores escritos en nodos.
3. En Supabase: Vault para lo que usa la base; *Edge Function secrets* para
   las funciones.
4. Rotar cada 6 meses y siempre que alguien que los vio deja el proyecto.

## Si se filtra una credencial

| Credencial | Dónde se rota | Dónde hay que actualizarla después |
|---|---|---|
| Supabase secret / service_role | Supabase → Settings → API Keys | n8n (nodos "Configuracion"), GitHub secrets si aplica |
| Contraseña de la base | Supabase → Settings → Database | GitHub secret `SUPABASE_DB_URL` |
| Brevo (API o SMTP) | Brevo → SMTP & API | `config_app` (base), credenciales de n8n, secrets de Edge Functions |
| Mercado Pago (client secret) | Mercado Pago Developers → la aplicación | n8n (workflows de MP) |
| OpenAI | platform.openai.com → API keys | n8n (asistente, tasador, comparador, reputación) |
| n8n API key | n8n → Settings → API | nada (solo se usa para administración) |
| Secreto del webhook de matching / firma de funciones | generar uno nuevo | trigger `matching_*` + n8n; Vault `push_firma_quick_service` + secret `PUSH_TRIGGER_SECRET` |

Después de rotar: probar el flujo afectado de punta a punta.

## Reportar un problema de seguridad

Escribir a trattoapp1@gmail.com con el asunto "Seguridad". No abrir un issue
público.
