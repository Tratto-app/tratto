# Avisos por evento: CRM → Codex

El fundador eligió el15/10/2026 una sesión de **Codex conectada al CRM en un
servidor permanente**. No se intenta despertar la conversación de ChatGPT
ni se reemplaza el sondeo anterior por otro cron.

## Qué hace

1. Un INSERT real de Claude para Codex crea una fila privada en
   `growth_agent_private.codex_outbox`. Se ignoran pruebas, otros remitentes,
   otros destinatarios y mensajes ya leídos.
2. Con receptor configurado y pizarra programada, `pg_net` manda sólo IDs
   por HTTPS, con un secreto del Vault. No transmite teléfonos ni contenido
   de conversaciones en el aviso.
3. `receiver.py` autentica el evento y reserva su ID en SQLite durable.
   Usa **el daemon existente** de Codex y `thread/queue/add`, con el ID del
   mensaje como `clientUserMessageId`. No abre otro app-server para el mismo
   hilo y no llama a `turn/steer` ni a `turn/interrupt`.
4. Si Codex está ocupado, queda en cola. Al llegar un evento de estado libre,
   se inicia exclusivamente una entrada de este receptor mediante
   `thread/queue/start`. No escanea la base cada cierto tiempo.
5. Codex usa su Supabase MCP autenticado para leer la pizarra y el mensaje,
   tomar su lease y responder sólo cuando corresponde. Revalida pausa en
   cada escritura. La lectura real se registra en CRM; HTTP202 sólo prueba
   que el aviso quedó en la cola.

Ni el receptor ni esta migración envían Gmail/WhatsApp, publican contenidos,
activan los workflows comerciales o ejecutan pedidos de Claude que excedan
el alcance autorizado. Las instrucciones están en `instructions.md`.

## Estado de la entrega

Código y pruebas preparados. **No es una conexión operativa hasta que haya
un host permanente, su sesión Codex/MCP autenticada, URL HTTPS y una prueba
real de lectura en CRM.** La máquina temporal de esta conversación no es
ese host. No se copiaron sus credenciales a otro equipo. El receptor sale
sin iniciarse mientras `TRATTO_NOTIFY_ENABLED` no sea `true`.

La migración arranca sin filas de configuración: no existe un destino
externo por defecto y no se activa ninguna rutina de marketing. La tabla
privada puede conservar avisos pendientes mientras se prepara el receptor.

## Preparación del host (una vez)

Se necesita Linux, Python3.10+, HTTPS y disco persistente. El proceso
pertenece a un usuario dedicado, `tratto-codex`; SQLite y el daemon deben
conservar su estado entre reinicios. El hosting estático de la web no
equivale a tener este proceso. El costo del host depende del equipo elegido;
el modelo usa la autenticación y límites de la cuenta Codex del titular.
No contratar un servidor ni otro plan sin revisar su costo con el fundador.

1. Instalar el CLI oficial Codex que soporte la cola del app-server
   (protocolo comprobado con `codex-cli0.159.2`). Revisar `codex --help` y
   `codex app-server daemon --help` en ese equipo.
2. Autenticar **en el host**, como el usuario del servicio, con `codex login`.
   No exportar ni pegar archivos de autenticación en chats o en GitHub.
3. Agregar el Supabase MCP restringido al proyecto de producción, si aún
   no existe en ese host, y completar su OAuth como titular:

   ```sh
   codex mcp add supabase --url 'https://mcp.supabase.com/mcp?project_ref=PROJECT_REF'
   codex mcp login supabase
   codex mcp list
   codex app-server daemon bootstrap
   codex app-server daemon version
   ```

   El MCP conectado de ChatGPT no se transfiere automáticamente al CLI.
   Verificar primero una lectura inocua en el workspace real.
4. Crear un hilo separado sin iniciar un turno de modelo:

   ```sh
   python3 /srv/tratto/tools/agent-notifier/setup_thread.py /srv/tratto
   ```

   Guardar su UUID en `TRATTO_CODEX_THREAD_ID`; no usar el ID de esta
   conversación ni una sesión de marketing o desarrollo con tareas pendientes.
5. Preparar el secreto nuevo de este webhook como archivo de permisos0600
   en el host y con el mismo valor en Supabase Vault, nombre
   `codex_chat_webhook`. Generarlo directamente en el equipo y cargarlo
   mediante los canales de configuración del titular; nunca por el chat.
   No reutilizar el token de las rutinas de Claude, Meta ni otra integración.
6. Completar `receiver.env.example` fuera del repositorio. El ejemplo
   `tratto-codex-notifier.service` requiere adaptar rutas/PATH al host;
   el daemon Codex se gestiona como el mismo usuario por separado.
   El receptor sólo necesita escribir en `/var/lib/tratto-codex`.
   Publicar por un reverse proxy HTTPS únicamente
   `/events/claude` → `127.0.0.1:8765/events/claude`.
   No exponer el socket/control del app-server ni su WebSocket a Internet.
7. Comprobar `/healthz` local, que el daemon conserva el hilo y que el MCP
   puede consultar el workspace. Después habilitar explícitamente el
   receptor y la configuración de base.

## Base y activación

Aplicar `supabase/migrations/20261015233946_codex_chat_eventos.sql` después
de probarla. Los objetos son privados, RLS habilitado, sin permisos de
cliente ni RPC pública de `SECURITY DEFINER`. Sus funciones internas se
usan por el trigger y por el operador autorizado.

Configurar con los IDs reales, URL y Vault ya preparados (ejemplo sin datos
privados ni credenciales):

```sql
insert into growth_agent_private.codex_config
  (workspace_id,board_id,enabled,receiver_url,vault_secret_name)
values ('WORKSPACE_UUID','BOARD_UUID',true,
  'https://HOST/events/claude','codex_chat_webhook');
select growth_agent_private.codex_dispatch_pending('WORKSPACE_UUID',100);
```

Para preparar sólo captura durable y **sin ninguna conexión externa**:

```sql
insert into growth_agent_private.codex_config(workspace_id,board_id)
values ('WORKSPACE_UUID','BOARD_UUID'); -- enabled=false, URL null
```

Una pausa conserva el evento como `held_by_pause`. Reanudar explícitamente
la pizarra drena esas entradas. No se genera aviso por un latido o por marcar
leído. Si el aviso ya llegó antes de una pausa, Codex vuelve a comprobarla
al leer/escribir y no debe responder mientras esté pausada.

## Verificación para declarar operativo

Con coordinación habilitada, usar un mensaje real que Claude haya enviado,
sin suplantar su autoría. Verificar en orden:

- Un único outbox para su ID y un `request_id` real.
- HTTP202/200 en `net._http_response` (no basta por sí solo).
- Una única entrada del receptor en la cola Codex, sin interrupción del
  turno que ya estaba activo.
- Lectura real de título/cuerpo/datos.texto/contexto, luego `datos.leido`,
  `leido_por=codex`, `leido_at` y lease correctos en CRM.
- Respuesta privada única sólo si había pregunta/pedido, con `respuesta_a`
  y evento idempotente. Ninguna respuesta a un aviso meramente informativo.
- Prueba de pausa sin respuesta y sin tocar estado/configuración de Claude.

Sólo entonces actualizar la pizarra como conexión verificada. No confundir
cola/HTTP/daemon activo con lectura real, ni prueba simulada con un mensaje
de Claude.

## Fallos y recuperación

Un fallo o timeout deja el aviso `uncertain`; no se resetea ni se reenvía
ciegamente. Consultar la cola/historial del hilo y la lectura/respuesta CRM
por el ID antes de reconciliar. El diario SQLite sigue siendo necesario
aunque cambie el proceso. Reiniciar el receptor no hace otra llamada para
las reservas inciertas. La cola del app-server es otro nivel de deduplicación.

Si el daemon cae, el receptor deja de anunciarse listo. Reiniciar su servicio
después de restablecer el daemon: no se introduce un cron de lectura como
recuperación. La base conserva el mensaje original aunque falle el aviso.
`dispatch_error` indica que ni siquiera se pudo crear la solicitud de pg_net;
puede diagnosticarse y despacharse explícitamente. `dispatch_requested`
no se vuelve a enviar sin comprobar el resultado original.

Para detener sólo los avisos, poner `codex_config.enabled=false` y apagar
el receptor. No pausar la pizarra ni las rutinas Gmail/WhatsApp para ese fin.

## Pruebas

```sh
cd tools/agent-notifier
npm ci --ignore-scripts --no-audit --no-fund
npm test
```

PGlite usa fixtures aisladas con HTTP y Vault simulados. Python prueba el
HTTP real en loopback, deduplicación durable, incertidumbre y selección de
cola con un app-server simulado. Ninguna prueba llama al modelo, a producción
ni a proveedores. Fuentes del protocolo: CLI `generate-json-schema` y
`https://github.com/openai/codex/blob/main/codex-rs/tui/src/session_queue_commands.rs`.
Webhooks asíncronos: `https://supabase.com/docs/guides/database/webhooks`.
