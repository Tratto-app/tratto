# Hair Beauty Salón — Didy Zárate

Sitio del salón. **Proyecto aparte de Tratto**: vive entero en esta
carpeta y no comparte un solo archivo con el marketplace. Se puede
mover a su propio repo copiando la carpeta tal cual.

Para verlo: abrí `index.html` en el navegador. No necesita servidor ni
instalar nada.

## Lo que falta que mande Didy

> ⚠️ **Las fotos que están hoy en `fotos/` son de muestra, no son
> trabajos de Didy.** Sirven para mostrarle el diseño; el sitio no se
> puede publicar así. Ver `fotos/LEEME-IMPORTANTE.txt`.

- [ ] **Foto principal** → guardarla como `fotos/hero.jpg`.
      Vertical, la clienta mostrando el color (de espaldas o de 3/4),
      con buena luz y **sin filtro**.
- [ ] **Fotos de trabajos** para la galería. Van con estos nombres
      exactos dentro de `fotos/`:
      - `trabajo-01.jpg` … `trabajo-04.jpg` (verticales)
      - `antes-01.jpg` y `despues-01.jpg` — el par antes/después.
        Que sean **el mismo encuadre y la misma luz**: si el "antes"
        está sacado con luz fea, el "después" parece photoshop.

      El camino más rápido para tener el sitio real: bajar ocho fotos
      del propio Instagram de Didy (@didy_zarate) y guardarlas con
      esos nombres. Son de ella y ya son trabajos reales.
- [ ] **Una foto de Didy** para la sección "Quién te atiende" →
      `fotos/didy.jpg`, vertical. Sirve una en el salón, trabajando o
      mirando a cámara; no hace falta que sea de estudio.
- [ ] **Que Didy escriba su propio "sobre mí".** Lo que hay ahora es
      un borrador armado solo con lo confirmado: su nombre, el barrio
      y sus tres especialidades. No hay años de experiencia, ni
      premios, ni cantidad de clientas — eso lo pone ella si quiere.
- [ ] **Que Didy lea los textos de Servicios.** Están escritos como
      borrador, con sus tres especialidades (balayage, rubios,
      morochas), para que los cambie por sus palabras. Si hace más
      cosas, se agregan.
- [ ] **Confirmar cómo cotiza.** Hoy el sitio dice que el precio
      depende del largo y del estado del pelo, y invita a mandar una
      foto por WhatsApp. Si ella prefiere publicar una lista de
      precios, se reemplaza ese bloque.
- [ ] **Días y horarios** de atención. En la sección "Dónde estoy"
      hay un hueco marcado esperándolos; adentro del HTML quedó la
      lista ya armada y comentada, así se completa cambiando los
      textos, sin tocar nada de diseño.
- [ ] **El logo** en archivo → `fotos/logo.png` (PNG con fondo
      transparente, o el original). El sitio ya lo está esperando: si
      aparece ese archivo, se usa el logo de verdad arriba de todo, con
      el círculo y todo. Si no está, se arma el nombre con tipografía.
      La manuscrita quedó en Sacramento, que es la que más se le parece
      a la del logo, pero no es la misma.

- [ ] **Verificar los precios uno por uno.** Se transcribieron del
      catálogo de Instagram a partir de una captura, así que hay que
      confirmarlos antes de publicar.

- [ ] **Los precios de uñas, pestañas y cejas**, que no estaban en la
      lista. Por ahora esos tres dicen "Consultá".

- [ ] **Confirmar el usuario de Instagram.** El logo dice
      `@didy_zarate` y el catálogo aparece como `didyzarate7`. El sitio
      hoy usa `@didy_zarate`; si el bueno es el otro, hay que cambiar
      los dos links.

Nada de esto se inventa: hasta que llegue, la sección queda con el
lugar marcado.

## Datos confirmados

- Dirección: Maza 1193, Boedo, CABA
- WhatsApp: 11 6872-3710
- Instagram: [@didy_zarate](https://instagram.com/didy_zarate)

## El sitio está armado

Las seis secciones están hechas y probadas en pantallas de 320 a
1280px. Lo que falta es contenido de Didy, no diseño: apenas lleguen
las fotos y los horarios, el sitio queda listo para publicar.

## Secciones

1. [x] Hero
2. [x] Trabajos (galería de color)
3. [x] Servicios (con precios del catálogo de Instagram)
4. [x] Sobre Didy
5. [x] Dónde estoy
6. [x] Cierre con WhatsApp + Instagram

## Para mandar por WhatsApp

En `para-mandar/` hay tres archivos listos para reenviar:

- `hair-beauty-para-mostrar.html` — **el sitio entero en un solo
  archivo**, con las fotos y las tipografías adentro. Se manda y se
  abre de un toque, sin descomprimir nada ni tener internet.
- `Hair-Beauty-que-tiene-el-sitio.pdf` — el documento que le explica a
  Didy qué tiene el sitio y qué le falta mandar.
- El mismo documento en `.html`, por si lo prefiere en el navegador.

Cuando cambien las fotos o los textos hay que rearmarlos, si no lo que
mandás lleva la versión vieja adentro:

    python3 hair-beauty/armar-para-mandar.py

El PDF se rehace abriendo el `.html` del documento e imprimiendo a PDF,
con la opción de gráficos de fondo activada (si no sale en blanco).

## Cómo publicarlo

Es una carpeta de archivos comunes: no necesita servidor, ni base de
datos, ni instalar nada. Cualquier hosting de archivos estáticos sirve
(Netlify, GitHub Pages, Vercel, o el hosting que ya tengan).

El camino más corto: entrar a `app.netlify.com/drop` y arrastrar ahí la
carpeta `hair-beauty` entera. Devuelve un link en unos segundos, y ese
link es el que va en la bio de Instagram.

**Antes de publicar, un solo cambio:** en el `<head>` del `index.html`
está la línea `og:image` apuntando a `fotos/hero.jpg`. Cambiala por la
dirección completa (por ejemplo `https://eldominio.com/fotos/hero.jpg`).
Si queda como está, cuando alguien comparta el link por WhatsApp no se
va a ver la miniatura. Está señalado con un comentario en el archivo.

## Para el próximo que lo toque

El sitio tiene su propia guía de diseño en
`.claude/skills/disenador-hairbeauty/SKILL.md`: la paleta, las dos
tipografías, cómo funciona el barrido y qué cosas no hay que hacer.
Conviene leerla antes de agregar una sección nueva, para que el sitio
siga siendo uno solo y no un collage.
