# Correcciones de seguridad — estado y lo que falta

Continuación de `SECURITY-AUDIT.md` (que no está en el repo porque es público).

## Ya aplicado en Supabase (23/09/2026, en producción)

Cada cambio se probó primero dentro de una transacción con rollback, actuando
como el cliente y el proveedor reales del match 29, antes de aplicarlo.

| Migración | Qué corrige |
|---|---|
| `proteger_columnas_mensajes_y_perfil` (= `02-...sql`) | **P-01 (CRITICAL)**: nadie puede cambiar `monto`, `pago_estado` ni nada de un mensaje ya enviado; solo el cliente responde un presupuesto, solo desde `pendiente`; solo el proveedor marca "terminado"; un presupuesto insertado siempre entra `pendiente` y sin pago. **P-02 (HIGH)**: `trabajos_hechos` ya no se puede escribir a mano, y como el proveedor ya no puede aceptarse a sí mismo, tampoco inflarlo con el trigger. |
| `cerrar_listado_bucket_publicaciones` (= `03-...sql`) | **H-02**: el bucket de fotos ya no se puede listar (antes: 7 fotos de 6 usuarios visibles sin sesión). Las URLs públicas siguen andando. Además, solo acepta imágenes de hasta 5 MB. |
| `oauth_states_mercadopago` (= `04-...sql`) | Tabla de nonces para **H-01**. |
| `pedidos_abiertos_solo_lectura` | **Hallazgo nuevo**: a través de esa vista un proveedor podía modificar y **borrar pedidos de otros clientes** (la vista saltea RLS). Ahora es solo lectura. |
| `revocar_ejecucion_publica_funciones_internas` | `marcar_publicacion` se podía ejecutar sin sesión; funciones internas sin `search_path` fijo. |

Si algún pago o flujo de n8n empieza a fallar con *"No se puede modificar un
mensaje ya enviado"*, es que ese workflow escribe `pago_estado` con el token
del usuario en vez de la `service_role`. Tiene que usar la `service_role`
(ya la necesita para leer `cuentas_mp`).

---

## Hecho el 23/09/2026 después del merge (PR #5)

- `mp-iniciar` importado y activo: rechaza tokens inválidos sin crear nonces.
- Rama mergeada a `main`. Verificado en producción: cabeceras de seguridad
  activas, CSP sin bloqueos en la app real, supabase-js con hash de
  integridad, `/lapeluquerie/`, `/.claude/` y `/tools/` dan 404.
- `05-contacto-cliente-privado.sql` aplicado (migración `contacto_cliente_privado`):
  ningún usuario puede leer `email_cliente` ni `telefono_cliente`; n8n sí.

**Si algo de n8n deja de andar después de esto** (comparar presupuestos,
calificar, cobrar) con un error de *permission denied for table solicitudes*,
es que ese workflow lee `solicitudes` con el token del usuario. Arreglo: que
use la `service_role`. Reversión de emergencia (vuelve a exponer el contacto):
`grant select on public.solicitudes to authenticated;`

---

## Lo que falta, en este orden

### 1. Probar en la app con una cuenta de prueba

Crear un pedido, que un proveedor mande un presupuesto, aceptarlo, "Comparar
presupuestos" y calificar. Es la única forma de confirmar que los workflows de
n8n no dependían de leer `solicitudes` con el token del usuario.

### 2. Terminar H-01 en el workflow `mp-conectar` existente

Primer paso después del Webhook:
- `GET {SUPABASE_URL}/rest/v1/oauth_states?nonce=eq.{{ $json.query.state }}&select=user_id`
  con la `service_role`.
- Si no devuelve exactamente una fila → responder error y cortar.
- Usar ese `user_id` donde antes se usaba el `state` directo.
- Al final, borrar el nonce: `DELETE .../oauth_states?nonce=eq....`

Hasta que esto esté, la conexión de Mercado Pago **no funciona**: la app ya
manda el nonce, y `mp-conectar` todavía lo interpreta como un user_id.

No te doy el JSON completo porque nunca vi ese workflow; está solo en tu n8n.

### 3. H-03 en los workflows `tasar` y `asistente`

- Primer nodo: validar `{{ $json.body.token }}` con `GET {SUPABASE_URL}/auth/v1/user`
  (copiá el nodo "Validar token de sesion" de `n8n-mp-iniciar.json`).
- `tasar`: sin token válido → 401. Validar que `foto` empiece con
  `https://qglsonbcsncgekzbfafk.supabase.co/storage/v1/object/public/publicaciones/`.
- `asistente`: sin token válido → responder igual, pero como anónimo; nunca
  usar un `userId` que venga en el cuerpo.
- En los dos (y en los demás webhooks): Settings → **Allowed Origins (CORS)**
  → `https://www.trattoapp.com.ar`.

### 4. Credenciales (M-05)

Pasar `service_role` y las API keys de los nodos "Configuracion" de los
workflows de video a **Credentials** de n8n, y después regenerar la
`service_role` en Supabase (Settings → API).

### 5. En el panel de Supabase

Authentication → Policies → activar **Leaked password protection** (bloquea
contraseñas filtradas conocidas).

### 6. Claves compartidas por chat

Revocar y regenerar la de ElevenLabs y cualquier otra que hayas pegado en el
chat o en capturas.
