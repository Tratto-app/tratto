# Pelo's Design — sitio web

Peluquería de diseño en Yerbal 880, Caballito, CABA.

Sitio estático: HTML, CSS y JavaScript, sin frameworks y sin proceso de compilado.
Se abre haciendo doble click en `index.html` y funciona igual publicado.

---

## Para el salón: cómo cambiar las cosas

**Todo lo que se cambia está en un solo archivo: `js/datos.js`.**

Se abre con cualquier editor de texto (Bloc de notas en Windows, TextEdit en Mac,
o VS Code si lo tenés). No hace falta saber programar.

Tres reglas:

1. Cambiá solo lo que está entre comillas `"así"` o los números.
2. No borres las comas del final de cada línea.
3. Guardá el archivo y recargá el navegador con **Ctrl+F5** (Cmd+Shift+R en Mac).

Si algo se rompe, deshacé el último cambio con Ctrl+Z y volvé a guardar.

### Cambiar los precios

Abrí `js/datos.js` y buscá el bloque **4) SERVICIOS Y PRECIOS**.

Cada servicio tiene cuatro precios, uno por largo de pelo, en este orden:
corto, mediano, largo, extra largo.

```
{ nombre: "Corte",  detalle: "Incluye lavado y secado",  precios: [18000, 22000, 26000, 30000] },
```

- Se escriben **sin signo peso y sin puntos**: `18000`, no `$ 18.000`.
- Si el servicio vale lo mismo para todos los largos, usá `fijo: 15000`.
- Si todavía no sabés un precio, dejá `null` y la lista muestra "a consultar".
- Si un servicio no lo ofrecen más, borrá esa línea entera.

Mientras falte cargar algún precio, la página muestra un **cartel amarillo** que
te dice cuántos faltan. Ese cartel lo ves vos y también lo ve quien entre, así que
conviene completarlos. Cuando estén todos, desaparece solo.

Para cambiar hasta cuándo valen esos precios, buscá `vigencia` en el bloque
**1) NEGOCIO**.

### Cargar las reseñas de Google

Buscá el bloque **3) RESEÑAS DE GOOGLE**.

1. Entrá a la ficha del salón: https://maps.app.goo.gl/bU6EvPzkiTfMdYFy8
2. Tocá donde dice "176 reseñas".
3. Elegí cuatro a seis que cuenten bien cómo trabajan.
4. **Copiá el texto y el nombre tal cual están.** No los reescribas ni los mejores.
5. Pegalos reemplazando cada `texto: null` y `autor: null`.

```
{ autor: "Nombre Apellido", texto: "Lo que escribió, textual.", estrellas: 5, tema: "Color", recortada: false },
```

Si tuviste que recortar una reseña larga, poné `recortada: true` y el sitio lo
aclara con puntos suspensivos. Nunca la recortes de forma que cambie lo que la
persona quiso decir.

Mientras no haya ninguna cargada, quien visita el sitio **no ve recuadros vacíos**:
ve un panel que lo manda a leerlas a Google. El cartel amarillo lo ves solo vos.

Cuando cambie la cantidad de reseñas o el puntaje, actualizá `puntaje` y
`cantidadReseñas` en el bloque **1) NEGOCIO**.

### Cambiar los horarios

Buscá el bloque **2) HORARIOS**. Las horas van en formato 24 horas, `"10:00"` y
`"17:30"`. Si un día está cerrado, dejá `abre: null, cierra: null`.

El sitio calcula solo si está abierto en este momento y, si está cerrado, cuándo
vuelve a abrir. Usa siempre la hora de Buenos Aires, aunque quien mire el sitio
esté en otro país.

### Cambiar el teléfono

Buscá `whatsapp` y `whatsappVisible` en el bloque **1) NEGOCIO**.

- `whatsapp` es el número para el link, **solo números**, con `54 9` adelante y
  sin espacios ni guiones: `5491167941212`.
- `whatsappVisible` es cómo se lee en pantalla: `11 6794-1212`.

Importante: el teléfono tiene que estar escrito **igual** acá, en Google y en
Instagram. Una diferencia de formato le cuesta posiciones al negocio en las
búsquedas.

### Cambiar las fotos de la galería

1. Guardá las fotos dentro de la carpeta `img/`.
2. Poneles un nombre sin espacios ni acentos, por ejemplo `balayage-cobre.webp`.
3. Anotá ese nombre en el bloque **6) GALERÍA** de `js/datos.js`.

```
{ archivo: "balayage-cobre.webp", alt: "Balayage cobrizo en pelo largo ondulado", etiqueta: "Balayage" },
```

El `alt` es la descripción de la foto: la lee quien no puede ver la imagen y
también la lee Google. Describí lo que se ve de verdad, en una frase.

Conviene guardarlas en formato **WebP** y de unos 800×1000 píxeles. Cualquier
conversor online sirve. Poné solo trabajos hechos en el salón y con permiso de la
persona.

### Cambiar las preguntas frecuentes

Bloque **7) PREGUNTAS FRECUENTES**. Si una respuesta está en `null`, esa pregunta
directamente no aparece en el sitio.

---

## Publicar el sitio en Vercel, paso a paso

Vercel es gratis para un sitio como este.

> **Antes de empezar, ojo con esto.** Este repositorio ya tiene un proyecto de
> Vercel conectado, y es el del marketplace, no el de la peluquería. El sitio del
> salón necesita un proyecto **aparte**. No le cambies el *Root Directory* al que
> ya existe: si lo hacés, el marketplace deja de publicarse.

1. Entrá a **vercel.com** y creá una cuenta con el usuario de GitHub.
2. En el panel, tocá **Add New → Project**.
3. Elegí el repositorio donde está este proyecto y tocá **Import**.
4. En **Root Directory**, tocá *Edit* y elegí la carpeta **`pelosdesign`**.
   Este paso es importante: el repositorio tiene otras cosas adentro.
5. En **Framework Preset** dejá **Other**. No toques Build Command ni Output
   Directory: no hay nada que compilar.
6. Tocá **Deploy** y esperá menos de un minuto.
7. Ponele un nombre al proyecto que no se confunda con el otro, por ejemplo
   `pelosdesign`.
8. Vercel te da una dirección tipo `pelosdesign.vercel.app`. Abrila y revisá que
   se vea bien.

### Mientras tanto: ya se puede ver

El proyecto de Vercel que ya existe publica el repositorio entero, así que el
sitio del salón **ya se ve** agregándole `/pelosdesign/` al final de la dirección.
Sirve para revisar y para mostrarlo, aunque la dirección definitiva es la del
proyecto nuevo.

Por eso hay **dos** archivos `vercel.json` y no uno:

- El de la raíz del repositorio le pone caché a las tipografías y a las imágenes
  del salón cuando se publica desde el proyecto que ya existe. No toca nada del
  marketplace: todas sus reglas empiezan con `/pelosdesign/`.
- El de `pelosdesign/vercel.json` es el que se usa cuando creás el proyecto
  aparte con *Root Directory* en `pelosdesign`. Hasta ese momento no hace nada.

No borres ninguno de los dos.

### Conectar el dominio propio, si lo compran

En el proyecto de Vercel: **Settings → Domains → Add**, escribí el dominio y
seguí las instrucciones que te da para cambiar los DNS donde lo compraron.

**Después de conectar el dominio hay que cambiar tres cosas** para que Google no
se confunda:

1. En `js/datos.js`, el campo `sitio` del bloque **1) NEGOCIO**.
2. En `index.html` y `precios.html`, las líneas que dicen `canonical` y `og:`.
3. En `sitemap.xml` y `robots.txt`, las direcciones que aparecen ahí.

Buscá y reemplazá `https://pelosdesign.vercel.app` por el dominio nuevo en todos
los archivos.

### Cada cambio que hagas

Cuando guardes un cambio y lo subas al repositorio, Vercel vuelve a publicar el
sitio solo, en menos de un minuto. No hay que hacer nada más.

---

## Después de publicar, en Google

Esto se hace una sola vez y es lo que más mueve la aguja en las búsquedas:

- [ ] Entrar al **perfil de Google Business** del salón y poner la dirección
      nueva del sitio en el campo "Sitio web".
- [ ] Revisar que el nombre, la dirección y el teléfono estén escritos
      **idénticos** en el sitio, en Google y en Instagram. Carácter por carácter.
- [ ] Poner el link del sitio en la bio de Instagram.
- [ ] Dar de alta el sitio en **Google Search Console** y subir el `sitemap.xml`.

---

## Para quien toque el código

```
pelosdesign/
├── index.html          una sola página con navegación por anclas
├── precios.html        la lista de precios
├── css/estilo.css      todo el sistema de diseño, las dos páginas
├── js/
│   ├── datos.js        ← LO ÚNICO QUE EDITA EL SALÓN
│   ├── comun.js        helpers compartidos (WhatsApp, horarios, escapado)
│   ├── sitio.js        arma index.html
│   └── precios.js      arma precios.html
├── fonts/              Archivo y Newsreader, servidas desde acá
├── img/                og.png, favicon, apple-touch-icon y las fotos
├── robots.txt · sitemap.xml · vercel.json (para el proyecto propio)
└── .claude/skills/     las cinco skills del proyecto
```

Decisiones que conviene conocer antes de tocar nada:

- **Las tipografías están en `fonts/`, no se piden a Google.** Es más rápido, no
  agrega una conexión a un tercero y no se rompe si mañana cambia una URL.
- **En `precios.html` los `<script>` están en el medio del body, no al final.**
  Es a propósito: así la lista se arma antes del primer pintado y la página no da
  un salto al cargar. Moverlos al final sube el CLS de 0 a 0,54.
- **Los colores que dependen del fondo salen de cuatro tokens** (`--suave`,
  `--eyebrow`, `--linea`, `--accion`) que se redefinen en un solo selector. Si
  agregás una sección con fondo oscuro, sumá su clase a ese selector.
- **El mapa no se carga solo.** Hay que tocar "Ver el mapa acá". Cargarlo de
  entrada arruina el rendimiento.
- Todo el texto que viene de `datos.js` pasa por `esc()` antes de entrar al HTML,
  así una reseña con comillas o con `<` no rompe la página.

El detalle completo del sistema de diseño está en
`.claude/skills/marca-pelos-design/SKILL.md`.

---

## Pendiente de confirmar con el salón

Nada de esto se inventó. Son los datos que quedaron sin cerrar:

1. **El teléfono.** Instagram, Google y el sitio anterior dicen **11 6794-1212**.
   El flyer de Canva dice **11 6818-6600**. Buscando el negocio también aparece
   un tercero, **11 4431-3839**, en directorios de terceros. El sitio usa el
   primero. Hay que confirmar cuál es y que quede uno solo en todos lados.
2. **Los horarios.** Cerrado lunes y jueves es poco habitual para una peluquería.
   Están puestos como los pasaron, pero conviene verificarlos contra Google.
3. **Los precios.** No hay ninguno cargado. La lista funciona y muestra
   "a consultar" en todo.
4. **Las reseñas.** Hay que elegir cuatro a seis de la ficha de Google y pegarlas
   en `datos.js`. No se cargó ninguna porque una reseña no se escribe de memoria.
5. **Las fotos de trabajos.** La galería está vacía a la espera de las fotos del
   salón. No se usó ni una foto de banco de imágenes.
6. **Medios de pago.** La pregunta frecuente está escrita pero sin respuesta, así
   que todavía no se muestra.
7. **Cuánto dura un balayage.** La respuesta actual manda a la consulta previa
   sin cargo en vez de dar un número, porque nadie confirmó cuánto lleva.
8. **`priceRange` en los datos de Google.** Se deja afuera hasta que haya precios
   cargados, para no declararle a Google una banda inventada.
