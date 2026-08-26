# Pelo's Design — sistema de diseño

## 1. El concepto

**Un taller de color.**

El salón tiene cuadros abstractos colgados sobre los espejos. Esa foto es el
brief: acá se mezcla pigmento, en la pared y en la cabeza. Todo el sistema sale
de ahí — papel crema, tinta cálida, un cobre sacado literalmente del pelo de una
clienta, y una composición de revista donde la fotografía manda.

### Sobre la referencia (Bleach London)

Se tomó **el nivel**, no el aspecto: fotografía protagonista, tipografía grande
con convicción, navegación mínima y una marca que se siente antes de leerse.

No se tomó nada más. Bleach London es punk, neón y alto contraste. Pelo's Design
es cálido, de barrio y artesanal — la estética correcta para este negocio es casi
la opuesta. No hay textos, estructura, componentes, colores ni código de la
referencia en este proyecto.

## 2. Paleta

Todos los pares de texto se verificaron con la fórmula de contraste de WCAG 2.2
antes de fijarse. Los valores están en `src/styles/globals.css`.

| Token | Valor | Rol | Contraste |
|-------|-------|-----|-----------|
| `--color-background` | `#FDF0E4` | Naranja muy suave, base | — |
| `--color-surface` | `#FFF9F3` | Durazno claro, superficies | — |
| `--color-surface-muted` | `#F8E3D0` | Naranja arena, bandas de sección | — |
| `--color-surface-deep` | `#241C17` | Negro suave, secciones invertidas | — |
| `--color-text-primary` | `#241C17` | Texto principal | **14.97:1** sobre el fondo |
| `--color-text-secondary` | `#6B5B50` | Texto secundario | **5.79:1** sobre el fondo |
| `--color-text-inverse` | `#FAF6F0` | Texto sobre oscuro | **15.56:1** |
| `--color-text-inverse-muted` | `#C4B4A6` | Secundario sobre oscuro | **8.32:1** |
| `--color-accent` | `#A8471F` | Cobre — acento | **5.23:1** sobre el fondo |
| `--color-accent-deep` | `#7A3517` | Hover del acento | 7.99:1 |
| `--color-accent-soft` | `#F7DCC6` | Durazno, sólo fondo | 12.77:1 con tinta |
| `--color-border` | `#EBD3BC` | Filete decorativo | decorativo |
| `--color-border-strong` | `#97836F` | Bordes de controles | **3.24:1** (SC 1.4.11) |
| `--color-success` | `#4F6B4A` | Estado positivo | 5.31:1 |

**Por qué dos bordes.** `--color-border` es una línea de composición: no
transporta información, así que no necesita 3:1. Todo borde que delimita algo
*interactivo* usa `--color-border-strong`, que sí cumple el criterio de contraste
de componentes no textuales.

**El naranja como base.** A pedido del salón, el fondo del sitio es un naranja
muy suave (`#FDF0E4`) en lugar del crema neutro original. Funciona porque el
trabajo del salón es cálido: los cobres y caramelos de las fotos se apoyan en el
fondo en vez de pelearse con él.

**El cobre sigue siendo acento**, no fondo: aparece en los números de sección, en
la palabra destacada de cada título, en el `+` de las preguntas y en algunos
enlaces. El cobre elegido es el del pelo de la foto de apertura, así que el
acento sale de la marca y no de una paleta prestada.

Sobre fondo oscuro el cobre no llega al contraste mínimo, así que
`.on-dark .heading-highlight` cambia el énfasis al durazno (12.77:1). La regla
está en el CSS y no en cada componente, para que no se pueda olvidar.

## 3. Tipografía

Tres familias, todas con soporte de latín extendido (imprescindible para
castellano).

### Display — **Fraunces**

Serif editorial con ejes variables `SOFT`, `WONK` y `opsz`. Tiene personalidad
sin volverse decorativa. Es variable: una sola descarga cubre todos los pesos.

Se fija `font-variation-settings: 'SOFT' 30, 'WONK' 0, 'opsz' 40`. El `WONK` en 0
apaga las terminaciones excéntricas de la fuente: con el eje alto se vuelve
caricaturesca, y acá se busca elegancia.

**Por qué no Playfair Display:** es la serif por defecto de todo sitio de
belleza. Se lee como plantilla.

### Texto — **Instrument Sans**

Sans humanista, muy legible en párrafos largos, con detalles de dibujo que la
distinguen de una grotesca neutra.

**Por qué no Inter:** el brief lo prohíbe con razón. Inter es la tipografía por
defecto de la interfaz generada automáticamente; usarla habría delatado el
origen del sitio antes de leer una palabra.

### La cursiva

**Toda la jerarquía de títulos va en cursiva** (Fraunces italic): h1, h2, h3 y h4.
Es la voz de la marca y lo primero que se lee en cada sección.

**El texto corrido se mantiene en redonda.** Es una decisión deliberada: un
párrafo largo en itálica se lee bastante peor, sobre todo en pantalla chica y con
la cantidad de acentos que tiene el castellano. La cursiva rinde donde está el
impacto —los títulos, el logotipo, los números— y el cuerpo sostiene la lectura.

Se usa `font-variation-settings: 'SOFT' 40, 'WONK' 0`. El `WONK` en 0 apaga las
terminaciones excéntricas de Fraunces: con el eje alto la itálica se vuelve
caricaturesca, y acá se busca elegancia.

**Palabra destacada dentro de un título:** como el título ya es cursivo, el
énfasis lo da el color (`.heading-highlight`), no un segundo cambio de
tipografía. Mezclar dos itálicas distintas al mismo tamaño ensucia la
composición.

### Acento chico — **Instrument Serif Italic**

Itálica editorial de más contraste, reservada para piezas pequeñas: los números
de sección (`01`, `02`, `03`…), el `Design` del logotipo y el `404`. A ese tamaño
convive bien con la display sin competirle.

### Escala

Fluida con `clamp()`, de 375 px a 1440 px. Los títulos llevan `text-wrap: balance`
y los párrafos `text-wrap: pretty`, para que ninguna línea quede huérfana.

```
--text-display  clamp(2.75rem, 1.2rem + 7vw, 7rem)
--text-h1       clamp(2.25rem, 1.1rem + 5.2vw, 5rem)
--text-h2       clamp(1.75rem, 1rem + 3.2vw, 3.25rem)
--text-h3       clamp(1.3rem, 1rem + 1.3vw, 1.9rem)
--text-lead     clamp(1.0625rem, 0.98rem + 0.5vw, 1.375rem)
--text-body     1.0625rem
```

## 4. Grilla y ritmo

- Contenedor `.shell`: máximo 90rem, con canaleta fluida
  `clamp(1.25rem, 0.5rem + 3vw, 3.5rem)`.
- Grilla de 12 columnas en escritorio. **Las secciones no se centran**: alternan
  bloques de 4, 5, 6 y 7 columnas con arranques distintos. Esa asimetría es lo
  que da lectura de revista en lugar de lectura de plantilla.
- Ritmo vertical: `--space-section: clamp(4.5rem, 2rem + 9vw, 9.5rem)`.
- **Numeración editorial.** Cada sección abre con `01`, `02`, `03`… en itálica
  cobre. Es el recurso que ordena la página y evita la sucesión de bloques
  intercambiables.

### La galería

Colocación **explícita por índice** en `LAYOUT` (`src/components/sections/gallery.tsx`),
no deducida con `nth-of-type`. Cada foto declara su tramo de columnas, su
desplazamiento vertical y su proporción.

Los desplazamientos están calculados para que el hueco que deja la columna más
corta quede **arriba** de la foto y no debajo: así se lee como escalonado
deliberado y no como un vacío al pie de la sección.

## 5. Componentes

**Botones rectangulares, no píldoras.** El primario es un bloque de tinta; el
secundario, un contorno de un píxel. Sin sombras, sin degradados, sin esquinas
redondeadas grandes.

Las variantes para fondo oscuro (`primary-inverse`, `secondary-inverse`) son
variantes propias y **no clases sueltas encima de `primary`**: dos utilidades de
Tailwind del mismo tipo se resuelven por el orden del CSS generado, no por el
orden en el atributo `class`. Un override así queda librado a la suerte — de
hecho, durante el desarrollo produjo un botón de tinta sobre tinta, invisible.

**Filetes, no tarjetas.** Servicios, precios y preguntas son listas separadas por
líneas de un píxel. Las tarjetas con sombra son el recurso que más rápido delata
una plantilla.

## 6. Movimiento

Cinco microinteracciones, todas con `cubic-bezier(0.22, 1, 0.36, 1)`:

1. Aparición al entrar en pantalla (`IntersectionObserver`, sin escuchar scroll).
2. Zoom de imagen al pasar el cursor, tope 1.03.
3. Subrayado que se dibuja de izquierda a derecha.
4. Cabecera que pasa de transparente a sólida al bajar.
5. El `+` de las preguntas gira 45° al abrirse.

**`prefers-reduced-motion: reduce` apaga todo** y deja el contenido visible: no
hay contenido que dependa de una animación para aparecer.

El estado de scroll de la cabecera se escribe como atributo `data-scrolled` en el
nodo y se estiliza por CSS, en lugar de guardarse en estado de React: evita
re-renderizar la cabecera entera cada vez que se cruza el umbral.

## 7. Anti-referencias

Lo que este sitio deliberadamente **no** hace:

- Inter, Arial ni ninguna sans por defecto.
- Degradados violeta o "tecnológicos".
- Tarjetas idénticas en grilla regular.
- Botones píldora repartidos por toda la página.
- Iconos dentro de cuadrados redondeados.
- Sombras difusas, glassmorphism, blobs.
- Secciones que se repiten con la misma estructura.
- Fotos de banco de imágenes: **todas las fotos son del salón**.
- Texto de relleno o copy genérico de plantilla.

## 8. Voz

Español rioplatense, voseo. Cálida y segura, sin exageraciones.

- ✅ "Miramos tu pelo antes de tocarlo."
- ✅ "Un corte lindo que no podés reproducir en casa no sirve."
- ✅ "Preferimos no publicar acá números que no podamos respaldar."
- ❌ "Bienvenidos a nuestra web."
- ❌ "Los mejores profesionales del rubro."

La honestidad es parte del tono, no sólo una regla técnica: cuando falta un dato,
el sitio lo dice con las mismas palabras con las que hablaría el salón.

## 9. Fotografía

Seis fotos, todas del negocio. El trabajo de preparación
(`scripts/prepare-images.mjs`) fue real:

- Al posteo de Instagram se le **recortó el chrome de iOS** (barra de estado,
  botones, pill de autoría). El recorte se midió analizando la luminancia por
  fila para encontrar dónde empieza y termina la fotografía.
- El collage "antes y después" se **partió en dos imágenes independientes del
  mismo tamaño**, detectando la costura por discontinuidad de columnas, para que
  el comparador alinee bien.
- Todo se normaliza a masters comprimidos que después optimiza `next/image`
  (AVIF/WebP, `srcset` y placeholder borroso).

Los `alt` describen lo que se ve **sin afirmar qué servicio se aplicó**, porque
eso no se puede verificar desde una foto.
