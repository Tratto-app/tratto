---
name: marca-pelos-design
description: Sistema de diseño de Pelo's Design: paleta, tipografía, espaciado y componentes. Se usa al construir o modificar cualquier pantalla, sección o componente del sitio de Pelo's Design.
---

# Marca Pelo's Design

## El concepto, en una frase

**La carta de color de un colorista.** Los fondos del sitio son niveles de una
escala de tonos que va del negro natural al rubio claro, y el acento es el violeta
del matizador: el producto con el que se corrige el color. Abelardo aparece
nombrado en las reseñas justamente por color y corrección de color, así que la
escala no es decoración, es el oficio de la casa puesto en la pantalla.

Regla que ordena todo el sitio: **fondo oscuro para lo que es clima y personas**
(hero, reseñas, trabajos, equipo, pie), **fondo claro para lo que es información y
decisión** (servicios, precios, cómo llegar, preguntas).

## Tokens

Están todos en `css/estilo.css`, dentro de `:root`.

### Fondos — niveles de la escala

| Token | Hex | Uso |
|---|---|---|
| `--noche` | `#16110F` | Nivel 01. Fondo de hero, reseñas, trabajos y pie |
| `--humo` | `#221A16` | Nivel 02. Superficie elevada sobre noche (equipo, tarjetas de reseña) |
| `--lino` | `#F1EBE3` | Nivel 09. Fondo de las secciones de información |
| `--papel` | `#FCFAF7` | Nivel 10. Tarjetas sobre lino |

### Texto

| Token | Hex | Uso |
|---|---|---|
| `--tinta` | `#1C1512` | Texto principal sobre fondo claro |
| `--tinta-suave` | `#6A5A50` | Texto secundario sobre fondo claro |
| `--crema` | `#F1EBE3` | Texto principal sobre fondo oscuro |
| `--crema-suave` | `#A99C92` | Texto secundario sobre fondo oscuro |

### Acentos

| Token | Hex | Uso |
|---|---|---|
| `--violeta` | `#6B4A9C` | El matizador. Acción principal sobre fondo claro |
| `--violeta-luz` | `#C0A8E6` | La versión que se lee sobre fondo oscuro |
| `--laton` | `#C08A4E` | Reflejo cobrizo. **Solo sobre fondo oscuro** |
| `--laton-osc` | `#7C4E1D` | La versión que se lee sobre fondo claro |

### La escala de tonos

`--t1` a `--t8`: `#16110F`, `#2A1D18`, `#3F2C22`, `#5A3E2E`, `#7A553A`,
`#9C744C`, `#BE9868`, `#DCC49B`. Una por sección, en orden.

### Tokens que cambian según el fondo

Esto es lo que evita que un texto quede negro sobre negro. En `:root` valen para
fondo claro; el selector `.hero, .oscuro, .oscuro-2, .pie, .tapa-precios, .panel,
.barra, .sticky` los redefine para fondo oscuro.

`--suave` (texto secundario) · `--eyebrow` (color del eyebrow) ·
`--linea` (divisorias) · `--accion` (acento interactivo y color del foco).

**Si agregás una sección con fondo oscuro, sumala a ese selector.** Es el único
lugar donde hay que acordarse de algo.

## Tipografía

Dos familias, tres roles. Las dos están en `fonts/`, no se piden a Google.

| Rol | Familia | Ajustes |
|---|---|---|
| Display | Archivo, eje `wdth` 118 / `wght` 600 | `letter-spacing: -.03em`, `line-height: 1.03` |
| Datos y eyebrows | Archivo, eje `wdth` 76 / `wght` 550 | Mayúsculas, `letter-spacing: .16em`, `.72rem` |
| Lectura | Newsreader 300–400 | `line-height: 1.55` |

**La firma tipográfica es el contraste de anchos dentro de una misma familia.**
Archivo expandida al 118 contra Archivo condensada al 76. No metas una tercera
familia: ese contraste se diluye.

Clases listas: `.expandida`, `.condensada`, `.titulo`, `.lead`, `.numero`
(números tabulares, para precios y horarios).

## Espaciado y radios

Escala de espaciado: `--e1` .5rem · `--e2` 1rem · `--e3` 1.5rem · `--e4` 2.5rem ·
`--e5` 4rem · `--e6` 6rem · `--e7` 9rem.

`--seccion: clamp(4rem, 9vw, 7.5rem)` es el padding vertical de toda sección.
`--borde: clamp(1.25rem, 5vw, 3rem)` es el margen lateral del contenido.
`--ancho: 72rem` es el ancho máximo del contenido.

Radios: `--r1` 3px (muestras de tono, avisos) · `--r2` 8px (tarjetas) ·
`--r3` 18px (paneles grandes) · `--pill` 999px (botones y etiquetas).

El sitio es de radios chicos. Los pill son solo para botones y chips.

## Componentes

- **`.escala`** — el rail vertical con las ocho muestras de tono. Es el elemento
  firma: índice, progreso y marca al mismo tiempo. Aparece desde 1280px, con los
  números de nivel desde 1440px. Abajo de 1280px se convierte en `.escala-mobile`,
  una franja de progreso de 3px arriba de todo.
- **`.boton` + `.boton-1` / `.boton-2`** — `--boton-1` es violeta con texto
  blanco; `--boton-2` es contorno y hereda el color del fondo donde está.
  Altura mínima 52px.
- **`.largo`** — el selector de largo de cabello en `precios.html`. Usa la misma
  muestra de tono que el rail, en horizontal.
- **`.reputacion` y `.google-badge`** — el 5,0. El número va en display grande y
  las estrellas en látón. Siempre linkea a la ficha real.
- **`.aviso`** — el cartel amarillo que ve solo el dueño del salón mientras falte
  cargar datos. Desaparece solo.
- **`.sin-datos`** — lo que ve el visitante cuando todavía no hay reseñas o fotos
  cargadas. Nunca un recuadro roto: siempre una salida a Google o a Instagram.

## Así sí, así no

**1. El látón sobre fondo claro.**
Así no: `color: var(--laton)` sobre `--lino`. Da 2,54 de contraste y no pasa AA.
Así sí: `color: var(--laton-osc)`. O mejor, usá `var(--eyebrow)` y que el token
resuelva solo según el fondo.

**2. Colores secundarios a mano.**
Así no: `color: var(--tinta-suave)` en una sección oscura, porque "es el gris".
Así sí: `color: var(--suave)`. El token ya sabe en qué fondo está.

**3. Numeración decorativa.**
Así no: poner 01/02/03 en las tarjetas de servicios porque queda lindo. Los ocho
servicios no son una secuencia, se eligen sueltos.
Así sí: numerar las secciones, que sí se recorren en orden, y darle a cada una su
nivel de tono. El número dice algo verdadero.

## Reglas del logo

Hoy el logo es un **placeholder tipográfico**: `pelo's design` en Archivo
expandida 620, con el apóstrofo en `--laton`. Cuando llegue el archivo real:

- Tamaño mínimo: 120px de ancho en pantalla.
- Aire alrededor: como mínimo la altura de la "p" por cada lado.
- Va sobre `--noche` y sobre `--lino`. Nunca sobre una foto sin una capa de
  contraste debajo, ni sobre `--violeta`.
- El ícono de la marca (`img/favicon.svg`) son cuatro barras de la escala de
  tonos, la última en violeta. Se puede usar suelto como sello.
