# Pelo's Design — estrategia de producto

## 1. Qué es el negocio

Pelo's Design es una peluquería de barrio en **Yerbal 880, Caballito, CABA**,
especializada en **color y corte**.

No es una cadena ni un salón de shopping. De las fotos que entregó el negocio
salen tres cosas que definen la marca mejor que cualquier adjetivo:

1. **El color es el oficio de la casa.** Los trabajos publicados son cobres,
   caramelos, castaños cálidos y aclarados con papel. No es un salón que "también
   hace color": es lo que sabe hacer.
2. **Hay obra colgada en las paredes.** Dos pinturas abstractas de gran formato
   sobre los espejos. El nombre dice "Design" y la casa lo sostiene: el color es
   una obsesión adentro y afuera de la cabeza.
3. **Es un lugar real, no un set.** Sillas rojas, marcos de madera, luz de tubo.
   Las fotos no están retocadas y esa honestidad es un activo, no un problema.

## 2. A quién le habla

Mujeres de Caballito y barrios linderos (Flores, Almagro, Villa Crespo, Boedo,
Parque Chacabuco) que:

- ya se tiñen y buscan alguien que les entienda el pelo, no que les aplique una
  fórmula de catálogo;
- vienen del Instagram del salón y quieren confirmar que es serio antes de escribir;
- necesitan saber **dónde queda, cuánto sale y cómo sacar turno** en menos de un minuto.

## 3. Posicionamiento

> El salón de Caballito donde el color se piensa antes de mezclarse.

La promesa no es "somos los mejores": es **criterio**. Miramos el pelo antes de
tocarlo. Eso justifica el turno previo, el tiempo que lleva y el precio.

## 4. Objetivos, por orden de importancia

| # | Objetivo | Cómo lo resuelve el sitio |
|---|----------|---------------------------|
| 1 | Generar consultas y turnos | CTA primario "Reservar turno" en hero, nav, barra fija móvil y bloque final. Bloque de reserva que dice qué mandar en el primer mensaje. |
| 2 | Mostrar la calidad del trabajo | Galería editorial con las fotos reales y comparador antes/después. |
| 3 | Generar confianza | Fotos sin retoque, reseñas enlazadas a la ficha real de Google, cero datos inventados. |
| 4 | Facilitar el contacto | WhatsApp cuando esté configurado; Instagram siempre, como canal verificado. |
| 5 | Mostrar la ubicación | Sección "Encontranos" con dirección, mapa, "Cómo llegar" y respaldo si el mapa no carga. |
| 6 | Consultar precios | Documento oficial en PDF, abrible y descargable, con una sola fuente de verdad. |
| 7 | Posicionar en Google | SEO técnico + Local SEO con `HairSalon`, NAP consistente e intención local. |
| 8 | Ser legible por IA | JSON-LD, contenido "respuesta primero" y `/llms.txt` generado del mismo dato. |

## 5. Jerarquía de conversión

- **Primario — Reservar turno.** Bloque de tinta, el único elemento de ese peso
  visual en cada pantalla.
- **Secundario — Consultar por WhatsApp** (o Instagram si no hay número).
  Contorno fino.
- **Terciario — Ver precios.** Enlace subrayado, sin caja.

No hay más de un CTA primario por pantalla. Los botones se ganan el lugar; no se
reparten por toda la página.

## 6. Qué responde cada sección

| Sección | Pregunta que contesta |
|---------|----------------------|
| Hero | Qué es, dónde queda, qué puedo hacer ahora |
| 01 Servicios | Qué hacen |
| 02 Trabajos | Cómo queda el trabajo, en pelo real |
| Transformaciones | Cuánto puede cambiar mi pelo |
| 03 Opiniones | Qué dicen otras clientas |
| 04 El salón | Por qué acá y no en cualquier otro lado |
| 05 Precios | Cuánto sale y cómo se cotiza |
| Reservar | Cómo saco turno, qué tengo que decir |
| Instagram | Qué están haciendo ahora |
| 06 Encontranos | Cómo llego, cómo los contacto |
| 07 Preguntas | Todo lo que quedó suelto |

## 7. Reglas de contenido innegociables

Estas reglas están codificadas y cubiertas por tests, no sólo escritas acá:

1. **No se inventan reseñas ni puntajes.** Sin API configurada, la sección
   explica por qué no hay números y manda a la ficha de Google.
2. **No se inventan horarios.** Los directorios que copian la ficha de Google no
   coinciden entre sí, así que no se publica ninguno hasta que el salón confirme.
3. **No se inventan precios.** Ningún importe vive en el HTML.
4. **El teléfono lo confirmó el salón** (+54 9 11 6792-1212) y está cargado en
   `src/data/business.ts`. Antes de eso el sitio usaba Instagram como canal,
   porque en los directorios públicos circulaban dos números distintos y
   ninguno estaba verificado. El respaldo a Instagram sigue en el código por si
   alguna vez se quita el número.
5. **No se inventan servicios.** Cada uno declara en `evidence` de dónde salió.
6. **No se inventan textos legales.** Las páginas legales muestran un marcador
   visible de "pendiente de redacción".

Cuando falta un dato, la interfaz **degrada con elegancia**: nunca muestra un
hueco, un cero ni un enlace roto.

## 8. Métricas a mirar cuando esté publicado

- Clics en "Reservar turno" y en el CTA de contacto (los eventos están listos
  para GA4 en cuanto se cargue el ID).
- Descargas / aperturas de `precios.pdf`.
- Tráfico de búsquedas con intención local ("peluquería en Caballito").
- Posición en el paquete local de Google para el barrio.
