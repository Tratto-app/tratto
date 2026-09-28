# Cuentas demo

Tres cuentas permanentes en producción para los revisores de Google Play y
App Store y para filmar la app, sin mezclarse con usuarios reales.

| Email | Rol | Nombre |
|---|---|---|
| `trattoapp1+demo-cliente@gmail.com` | cliente | Laura Fernández |
| `trattoapp1+demo-techista@gmail.com` | proveedor | Martín Ríos (techista) |
| `trattoapp1+demo-humedades@gmail.com` | proveedor | Sergio Medina (humedades) |

Todas usan la misma contraseña. **No está en el repo**: la tiene el dueño del
proyecto, y en la base solo se guarda su hash (`privado.config`, clave
`demo_hash`). Los mails llegan a la casilla `trattoapp1@gmail.com` (alias con `+`).

## Qué hay cargado

Rubro "Techos y humedades", zona GBA Oeste:

- **Pedido con dos presupuestos** ($ 68.000 y $ 54.000) y chat con cada
  proveedor: para mostrar la comparación y la conversación.
- **Pedido abierto**: aparece en el Panel de los dos proveedores demo.
- **Trabajo terminado** hace 30 días, con calificación de 5 estrellas en el
  perfil de Martín.

## Cómo se aíslan

Una cuenta es demo si su `app_metadata` tiene `"demo": true` (el usuario no
puede cambiarlo; solo la base o el panel de Supabase).
Migración: `supabase/migrations/20260928120000_cuentas_demo.sql`.

- `solicitudes.demo` y `proveedores.demo` los pone un trigger según la cuenta.
  Si el cliente manda otro valor, se ignora.
- Los triggers de matching (`matching_solicitudes`, `matching_proveedores`)
  tienen `WHEN (NOT new.demo)`: lo demo no llama a n8n.
- En n8n, "Matching automatico + avisos" filtra `demo=eq.false`, tanto al
  releer el registro ("Verificar origen") como al buscar candidatos
  ("Preparar consulta").
- `pedidos_abiertos` muestra a cada proveedor solo los pedidos de su mismo
  tipo, demo o real (`privado.soy_demo()`).
- La base descarta en silencio cualquier fila de `matches` o `interesados`
  que junte una cuenta demo con una real (`privado.no_mezclar_demo`).
- `notificar_evento_push` no avisa a cuentas demo. Las novedades solo van a
  quien aceptó publicidad, y las cuentas demo la tienen en `false`.
- Los pedidos demo no se vencen a los 15 días y no cuentan para los
  reintentos de matching ni para las alertas.

## Reponer los datos

Si un revisor borra la cuenta o cambia datos, o después de filmar:

```sql
select privado.reponer_demo();
```

Esto vuelve a crear las cuentas que falten y deja los datos como nuevos. Lo
creado a mano desde esas cuentas se borra. No toca nada que no sea de ellas.

El pedido abierto se crea con fecha de "hace 3 horas". Como el feed solo
muestra pedidos de los últimos 15 días, después de ese plazo desaparece del
Panel: hay que reponer antes de cada revisión o filmación.

## Cambiar la contraseña

1. Generar el hash bcrypt de la nueva, por ejemplo con
   `python3 -c "import bcrypt;print(bcrypt.hashpw(b'NUEVA', bcrypt.gensalt(10)).decode())"`.
2. `update privado.config set valor = '<hash>' where clave = 'demo_hash';`
3. `select privado.reponer_demo();` (también actualiza la contraseña de las
   cuentas que ya existen).

## Qué se probó (2026-09-28)

En staging:

- La marca demo se aplica aunque el cliente mande `demo:false`.
- El feed muestra solo pedidos del mismo tipo: los proveedores demo ven solo
  el pedido demo, y un proveedor real ve sus 67 pedidos sin ninguno demo.
- Las conexiones mezcladas se descartan (0 filas) y las demo↔demo se crean.
- Un presupuesto a una cuenta demo encola 0 avisos push; uno a una cuenta real
  encola 1 (control).
- `reponer_demo()` se puede correr más de una vez.
- Login real por la API.

En producción:

- Los dos triggers de matching quedaron con `WHEN`.
- Al crear los datos no salió ninguna llamada HTTP.
- Los proveedores demo ven solo el pedido demo; los reales no ven ningún pedido
  demo.
- Las tres cuentas entran por la API.
- La consulta de n8n con `demo=eq.false` responde 200 y excluye lo demo.

El workflow de n8n no se pudo probar en ejecución: la cuota mensual está
agotada hasta el 1/10. Queda para ese día.
