# Tratto — Hechos verificados en el código

**Fuente:** `index.html` (3.575 líneas, 194 KB) · **Fecha de auditoría:** 2026-09-05
**Método:** lectura directa del código de la aplicación. Cada afirmación cita línea.

Este documento reemplaza al dossier narrativo como **base fáctica** para el trabajo legal.
Donde el dossier y el código difieren, **manda el código**.

Tres niveles de certeza:
- **[VERIFICADO]** — leído en el código.
- **[AUSENTE]** — buscado y no encontrado. Es un hecho negativo verificado.
- **[NO AUDITABLE]** — vive fuera de este archivo (Supabase, n8n) y no se puede confirmar desde acá.

---

## 1. Divergencias con el dossier

Estas son las siete diferencias entre lo que el dossier declara y lo que el código hace.
Cada una cambia el análisis legal.

| # | El dossier dice | El código dice | Consecuencia legal |
|---|---|---|---|
| 1 | Cobro con tarjeta, comisión 3% vía `application_fee` de Mercado Pago | **[AUSENTE]** Cero referencias a Mercado Pago, pagos, cobro, tarjeta o comisión en las 3.575 líneas | Todo el modelo económico es plan, no producto. Los documentos legales que regulen pagos van a describir algo que no existe |
| 2 | Terceros: Supabase, OpenAI, Mercado Pago, Brevo | **[VERIFICADO]** Las 4 funciones de IA pasan por **n8n Cloud** (`marketplace-servicios.app.n8n.cloud`), líneas 3167, 3238, 3337, 3401 | Quinto encargado de tratamiento no declarado, y una transferencia internacional adicional no analizada |
| 3 | Calificaciones "planeadas, no construidas" (Fase G2a), a ciegas | **[VERIFICADO]** Sistema completo y en vivo: estrellas, comentario, webhook `/calificar`, tabla `reputacion`, y la respuesta dice *"Tu calificación ya está en el perfil"* (líneas 3238-3300) | Existe y **no es a ciegas**: publica de inmediato. Régimen de reseñas activo sin documento que lo regule |
| 4 | Verificación "mínima, solo email" | **[VERIFICADO]** Los proveedores cargan matrículas y certificaciones autodeclaradas (tabla `credenciales`, línea 1368) que se **exhiben en el perfil como señal de confianza**: *"Es lo que más confianza genera"* (línea 2861) | Mucho peor que no verificar: la plataforma **exhibe activamente** títulos no verificados como argumento de confianza |
| 5 | "RLS activo en las cuatro tablas principales" | **[VERIFICADO]** El cliente accede a **10 tablas**: `solicitudes`, `proveedores`, `perfil_proveedor`, `mensajes`, `credenciales`, `publicaciones`, `visitas_perfil`, `reputacion`, `matches`, `canjes` | Seis tablas fuera del perímetro declarado. El estado real de RLS en ellas es **[NO AUDITABLE]** desde acá |
| 6 | Riesgo concentrado en gas y electricidad | **[VERIFICADO]** Rubros activos incluyen `Gas matriculado`, `Electricidad`, `Asesoría legal`, `Escribanía`, `Arquitectura`, `Ingeniería`, `Agrimensura`, `Maestro mayor de obras` (líneas 1526-1539) | La exposición a profesiones reguladas con colegio y matrícula obligatoria es mucho más amplia que dos rubros |
| 7 | No mencionado | **[VERIFICADO]** Programa de puntos XP con canje por beneficios porcentuales (tabla `canjes`, líneas 3047-3055) | Programa de fidelidad con promesa de valor económico. Genera obligaciones propias y sin documento que lo regule |

---

## 2. Hallazgos críticos

### 2.1 La aplicación no menciona sus propios documentos legales — [AUSENTE]

Búsqueda sobre las 3.575 líneas de `términos`, `condiciones`, `privacidad`, `consentimiento`,
`cookies`, `acepto`: **cero resultados**.

No hay link a los T&C. No hay link a la política de privacidad. No hay casilla de aceptación
al registrarse. No hay captura de consentimiento para el tratamiento de datos. No hay pie de
página legal.

Los ~10 documentos legales redactados **no están conectados al producto**. Jurídicamente,
hoy no son oponibles a ningún usuario: nadie los aceptó ni tuvo oportunidad de leerlos.

### 2.2 Las fotos del tasador quedan públicas y permanentes — [VERIFICADO]

Línea 2698-2704: la foto que el cliente sube para la estimación de costo va al bucket
`publicaciones` y la función devuelve una URL de la forma
`/storage/v1/object/**public**/publicaciones/<nombre>`.

Esa URL se envía después a n8n para que la IA la lea (línea 3355).

Consecuencia: **toda foto subida al tasador queda accesible por URL para cualquiera, sin
autenticación y de forma permanente.** El caso de uso del tasador es fotografiar el problema
a resolver: interiores de viviendas, instalaciones, documentación, y potencialmente personas.
No se encontró rutina de borrado.

### 2.3 n8n Cloud recibe tokens de sesión de los usuarios — [VERIFICADO]

Los webhooks `/comparar` (línea 3196) y `/calificar` (línea 3285) envían
`token: sesion.access_token` — el JWT vivo del usuario.

Un tercero de automatización recibe credenciales capaces de actuar en nombre del usuario
contra Supabase. Además, la sesión completa se guarda en `localStorage` (líneas 1645-1649),
lo que la expone a XSS.

### 2.4 La declaración de independencia existe, es buena, y no se guarda — [VERIFICADO]

Líneas 1107-1123. Antes de publicar su perfil, el proveedor debe tildar una casilla obligatoria
sobre siete puntos: trabaja por su cuenta, Tratto no es su empleador ni su cliente, pone su
precio, puede rechazar pedidos sin explicación, puede trabajar fuera de Tratto, pone sus
herramientas, tiene a cargo sus impuestos y matrículas, es responsable de su trabajo.

Es el mejor activo legal del producto contra el riesgo de recalificación laboral, y no estaba
en el dossier.

**Pero:** el campo `p-declara` **no se incluye en el payload** que se envía a la tabla
`proveedores` (líneas 1904-1917) y se resetea después de publicar (línea 1929). La aceptación
no queda registrada: no hay fecha, ni versión del texto, ni evidencia. En un reclamo laboral
no se puede probar que el proveedor la aceptó.

---

## 3. Datos personales — inventario verificado

### 3.1 Qué se recolecta

**Cliente, al pedir un servicio** (líneas 1849-1856):
`nombre_cliente`, `email_cliente`, `telefono_cliente`, `servicio_necesitado`, `zona`,
`presupuesto`, `urgencia`, `descripcion`, `user_id`

**Proveedor, al publicar perfil** (líneas 1904-1917):
`nombre`, `email`, `telefono`, `rubro`, `rubro_personalizado`, `zona`, `precio_desde`,
`precio_hasta`, `disponibilidad`, `descripcion`, `user_id`

**Además:** credenciales autodeclaradas, publicaciones con fotos, mensajes de chat,
calificaciones con comentario libre, y puntos/canjes.

### 3.2 Tracking no declarado — [VERIFICADO]

Línea 2808: cada visita a un perfil escribe en `visitas_perfil` el par
`{perfil_user_id, visitante}`. Es registro de comportamiento **nominado** — quién miró a
quién — conservado sin plazo declarado.

### 3.3 Qué sale hacia terceros

| Destino | Qué se envía | Línea |
|---|---|---|
| n8n → IA (tasador) | URL pública de la foto + zona | 3355 |
| n8n → IA (asistente) | Pregunta, últimos 8 mensajes de la charla, `userId`, modo | 3444 |
| n8n → IA (comparar) | `access_token` del usuario + `solicitudId` | 3196 |
| n8n → IA (calificar) | `access_token`, `matchId`, puntaje, comentario libre | 3285 |
| Supabase (São Paulo) | Todo lo demás | — |

**[NO AUDITABLE]:** qué hace n8n con esos datos, dónde está alojado, qué modelo de IA usa
realmente, qué retiene y por cuánto tiempo. Los flujos de n8n no están en este repositorio.

### 3.4 Almacenamiento en el navegador — [VERIFICADO]

`localStorage` guarda la sesión, incluido el `access_token` (líneas 1645-1649).
**[AUSENTE]:** no se encontró `document.cookie` ni cookies de terceros, analytics ni píxeles
de seguimiento. Una política de cookies que declare cookies de análisis o publicidad estaría
describiendo algo que no existe.

### 3.5 Derecho de supresión — [VERIFICADO]

Existe `rpc/borrar_mi_cuenta` con motivo opcional (líneas 3147-3155). Es un activo real frente
al art. 16 de la Ley 25.326. **[NO AUDITABLE]:** qué borra efectivamente esa función del lado
del servidor, y si alcanza a mensajes, reputación y visitas.

---

## 4. Lo que no se puede auditar desde acá

Estos puntos requieren acceso a Supabase y a n8n. Van a la entrevista, no se pueden dar por sabidos:

1. **La lógica de matching.** Las tres reglas (rubro exacto, zona, precio ≤ presupuesto × 1,20,
   tope de 3 proveedores) **no están en el cliente**. Viven en una función de base o en n8n.
   No se puede verificar que el producto haga lo que los T&C van a decir que hace.
2. **El estado real de RLS** en las 10 tablas.
3. **Qué borra `borrar_mi_cuenta`** realmente.
4. **Los flujos de n8n**: modelo de IA, retención, subprocesadores, región de alojamiento.
5. **Contratos firmados** con Supabase, OpenAI, n8n y Brevo (encargado de tratamiento,
   cláusulas de transferencia internacional).
6. **Política de retención** de fotos, mensajes y visitas de perfil.

---

## 5. Consecuencias para la arquitectura legal

1. **Los documentos sobre pagos y comisiones describen un producto inexistente.** Escribirlos
   ahora es escribir sobre un diseño no implementado: hay que marcarlos como condicionales al
   desarrollo, o el primer reclamo va a comparar el texto con la app.
2. **El riesgo número uno no es la falta de verificación de matrícula: es exhibir matrículas
   no verificadas como señal de confianza.** No verificar es una omisión. Exhibir un título
   falso como argumento para contratar es una conducta activa de la plataforma.
3. **Cero puntos de aceptación en el producto** convierte a los ~10 documentos en papel no
   oponible. Es el arreglo más barato y de mayor impacto de toda la lista.
4. **n8n cambia el mapa de privacidad**: hay un encargado más, una transferencia más, y
   circulación de tokens de sesión hacia un tercero.
5. **Las fotos públicas permanentes** son el incumplimiento más concreto y demostrable hoy
   frente a la Ley 25.326.
6. **La declaración de independencia hay que persistirla**, con fecha y versión. Es convertir
   un activo existente en prueba, y cuesta un campo en una tabla.

