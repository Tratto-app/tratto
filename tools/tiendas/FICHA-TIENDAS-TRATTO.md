# Tratto en Play Store y App Store: todo para copiar y pegar

Links que piden las dos tiendas:
- Sitio web y soporte: `https://www.trattoapp.com.ar`
- Política de privacidad: `https://www.trattoapp.com.ar/privacidad.html`
- Email de contacto: `trattoapp1@gmail.com`

---

## 1. Google Play

### Ficha principal
**Nombre de la app** (máx. 30):
```
Tratto: servicios cerca tuyo
```
**Descripción breve** (máx. 80):
```
Pedí lo que necesitás y recibí presupuestos de profesionales de tu zona.
```
**Descripción completa:**
```
¿Necesitás a alguien para un trabajo y no sabés a quién llamar ni cuánto debería costar? En Tratto contás qué necesitás, te conectamos con gente de tu zona que hace ese trabajo y elegís el presupuesto que más te conviene. Sin llamar a diez personas.

CÓMO FUNCIONA
1. Pedís: contás qué necesitás o le sacás una foto. Te damos un precio de referencia al toque.
2. Te cotizan: proveedores de tu zona y de ese rubro te mandan su presupuesto por el chat.
3. Elegís vos: comparás qué incluye cada uno, cuánto sale y cuándo puede.

MÁS DE 40 RUBROS
• Hogar: plomería, pintura, albañilería, techos, cerrajería, aire acondicionado, jardinería y más
• Limpieza de casas, oficinas y consorcios
• Autos y traslados: mecánica, gomería, lavado, fletes y mudanzas
• Clases: apoyo escolar, idiomas, música, computación, manejo
• Eventos: catering, DJ, animación y organización
• Digital: diseño, programación, redes sociales, fotografía y video, soporte técnico
• Trámites, contabilidad, belleza, entrenamiento, mascotas y mucho más

PENSADO PARA QUE ELIJAS TRANQUILO
• Precio de referencia a partir de una foto o de lo que escribís, para saber si un presupuesto tiene sentido.
• Comparador de presupuestos con inteligencia artificial: te muestra qué incluye y qué no incluye cada uno.
• Chat privado dentro de la app: tus datos no quedan expuestos.
• Calificaciones de otros clientes en el perfil de cada proveedor.

PARA EL QUE PIDE ES GRATIS
Pedir un servicio, chatear y recibir presupuestos no cuesta nada.

¿OFRECÉS UN SERVICIO?
Registrate gratis y recibí pedidos de gente de tu zona y de tu rubro. Sin abono mensual.

Tratto no admite rubros que requieran matrícula (gas, electricidad, salud).
```

### Datos de la app
- **Categoría:** Casa y hogar
- **Etiquetas:** Servicios para el hogar · Reparaciones
- **Anuncios:** No, la app no tiene anuncios.
- **Público objetivo:** 18 años o más (los términos exigen ser mayor de edad).
- **App de noticias:** No. **App de salud:** No. **Préstamos o finanzas:** No.

### Acceso a la app (para los revisores)
Elegí "Toda la funcionalidad o parte de ella está restringida" → Agregar instrucciones:
- Nombre: Cuenta de prueba (cliente)
- Usuario: `trattoapp1+demo-cliente@gmail.com`
- Contraseña: la de las cuentas demo (la tiene el dueño; no va en el repo)
- Instrucciones: "Tocá Iniciar sesión e ingresá con este email y contraseña.
  La cuenta ya tiene un pedido con dos presupuestos, chats y un trabajo
  calificado. Para ver la app como proveedor:
  trattoapp1+demo-techista@gmail.com con la misma contraseña."

Detalle de las cuentas en `docs/DEMO_ACCOUNTS.md`. Antes de mandar a revisión,
reponer los datos con `select privado.reponer_demo();`.

### Clasificación de contenido (cuestionario IARC)
- Categoría: **Todas las demás apps**
- Violencia, sexo, lenguaje, drogas, juegos de azar: **No** a todo.
- ¿Los usuarios pueden comunicarse entre sí? **Sí** (chat privado entre cliente y proveedor).
- ¿Comparte la ubicación del usuario con otros? **No** (solo la zona que la persona elige, por ejemplo "GBA Oeste").
- ¿Compras digitales? **No** (los trabajos se pagan por Mercado Pago y son servicios físicos).
- Resultado esperado: apta para todo público, con el aviso "Los usuarios interactúan".

### Seguridad de los datos
**¿Recopila o comparte datos?** Sí recopila. No comparte con terceros para sus
propios fines: los proveedores técnicos (Supabase, Vercel, Brevo, OpenAI,
Mercado Pago) procesan en nombre de Tratto, y Google no considera eso "compartir".
- **¿Cifrado en tránsito?** Sí.
- **¿Se pueden pedir que se borren?** Sí, desde la app (Cuenta → Borrar mi cuenta) o por mail.
- **Link para pedir que se borre la cuenta** (Google lo pide aparte, en "Eliminación de datos"): `https://www.trattoapp.com.ar/privacidad.html#derechos`

| Tipo de dato | ¿Se recopila? | Obligatorio | Para qué |
|---|---|---|---|
| Nombre | Sí | Sí | Funcionalidad de la app, administración de la cuenta |
| Email | Sí | Sí | Administración de la cuenta, comunicaciones |
| ID de usuario (el identificador de la cuenta) | Sí | Sí | Funcionalidad de la app, administración de la cuenta |
| Teléfono | Sí | Sí | Funcionalidad de la app (contacto entre cliente y proveedor) |
| Otra información personal: CUIT/CUIL y condición frente al IVA (solo proveedores) | Sí | No (los clientes no lo cargan) | Funcionalidad de la app (facturar la comisión) |
| Fotos | Sí | No | Funcionalidad de la app (foto del pedido) |
| Otros contenidos del usuario (mensajes del chat, pedidos, calificaciones) | Sí | Sí | Funcionalidad de la app |
| Información de pago (la tarjeta se carga en el formulario de Mercado Pago dentro de la app) | Sí | No | Funcionalidad de la app; seguridad, cumplimiento y prevención de fraudes |
| Información financiera: historial de compras (trabajos cobrados por la app) | Sí | No | Funcionalidad de la app |
| ID de dispositivo (para notificaciones) | Sí | No | Funcionalidad de la app |
| Interacciones con la app (estadísticas de uso y visitas a perfiles) | Sí | No | Funcionalidad de la app, estadísticas |
| Ubicación precisa o aproximada del dispositivo | **No** | | |
| ID de publicidad | **No** (la app no pide el permiso AD_ID) | | |

### Gráficos
- Ícono: `play-icono-512.png`
- Gráfico destacado: `play-grafico-destacado-1024x500.png`
- Capturas del teléfono, en este orden: `play-1.png` … `play-5.png`

---

## 2. App Store

**Nombre** (máx. 30):
```
Tratto: servicios cerca tuyo
```
**Subtítulo** (máx. 30):
```
Presupuestos de tu zona
```
**Texto promocional** (máx. 170, se puede cambiar sin revisión):
```
Sacale una foto a lo que se rompió o contá lo que necesitás, recibí presupuestos de proveedores de tu zona y compará qué incluye cada uno. Gratis para el que pide.
```
**Descripción:** la misma que en Google Play.

**Palabras clave** (máx. 100 caracteres, separadas por comas, sin espacios):
```
plomero,pintor,cerrajero,albañil,flete,limpieza,mecanico,profesor,clases,presupuesto,oficios
```
- **Categoría principal:** Estilo de vida. **Secundaria:** Productividad.
- **Precio:** Gratis. **Disponibilidad:** Argentina.
- **URL de soporte:** `https://www.trattoapp.com.ar` · **URL de privacidad:** `https://www.trattoapp.com.ar/privacidad.html`
- **Derechos de autor:** `2026 Tratto`

### Clasificación por edad
Todo en "Ninguno", salvo **Contenido generado por usuarios / comunicación
entre usuarios: Sí**. Resultado esperado: 12+ (Apple sube la edad cuando hay chat).

### Privacidad de la app ("etiqueta nutricional")
- **Datos vinculados a vos:** Información de contacto (nombre, email, teléfono) ·
  Contenido del usuario (fotos, mensajes, otros) · Compras · Identificadores
  (ID de usuario, token del dispositivo para notificaciones).
- **Datos no vinculados a vos:** Datos de uso (estadísticas de visitas anónimas).
- **Rastreo (tracking entre apps):** **No**.

### Notas para el revisor (App Review Information)
```
Tratto conecta a personas que necesitan un arreglo en su casa con proveedores de su zona en Argentina. Los trabajos son servicios físicos que se pagan fuera de la app o por Mercado Pago (guideline 3.1.3(e)), por eso no se usa In-App Purchase.

Cuenta de prueba (cliente con un pedido y dos presupuestos): [la completamos antes de enviar]

Funciones nativas: notificaciones push (APNs) cuando llega un presupuesto, lo aceptan o se termina un trabajo; cámara y fotos para cargar la foto del pedido.
Moderación: filtro de palabras en el chat, botón "Reportar" en cada perfil, publicación y conversación (en el chat: "Ver ficha" → Reportar), bloqueo de usuarios desde el chat ("Ver ficha" → Bloquear), avisos al equipo por mail en cada reporte y borrado de cuenta desde Cuenta → Borrar mi cuenta.
```

### Capturas
iPhone 6,9": `ios-1.png` … `ios-5.png` (1290×2796). Si App Store Connect
muestra el casillero de 6,5" (pide 1242×2688 o 1284×2778), usar `ios65-1.png` … `ios65-5.png`. Con eso alcanza para
todos los tamaños de iPhone. La app es solo para iPhone, así que no hacen falta
capturas de iPad.
