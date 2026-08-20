---
name: seo-local-ar
description: SEO local para negocios físicos en Argentina. Se usa al construir sitios de comercios, salones, estudios o consultorios que dependen de búsquedas por barrio, y al escribir titles, meta descriptions, datos estructurados o schema markup.
---

# SEO local argentino

## La búsqueda que importa

Para un negocio de barrio, la búsqueda que trae clientes no es el rubro solo: es
**rubro + barrio**. "Peluquería en Caballito" vale más que "peluquería Buenos
Aires". Optimizá para esa combinación y para las variantes con "cerca de mí".

## Datos estructurados

JSON-LD con el tipo específico del rubro (`HairSalon`, `Restaurant`, `Dentist`),
no el genérico `LocalBusiness`. Campos obligatorios:

- `name`, `image`, `url`, `telephone`
- `address` completo con `PostalAddress`, incluido `postalCode`
- `geo` con `latitude` y `longitude`
- `openingHoursSpecification` — un objeto por bloque de días
- `aggregateRating` con `ratingValue` y `reviewCount` — solo si son reales y
  verificables
- `sameAs` con las redes y la ficha de Google
- `priceRange` con símbolos de peso
- `areaServed` con el barrio y los limítrofes

Validá siempre en el Rich Results Test de Google antes de dar por cerrado.

## Title y meta

- **Title:** `Rubro en Barrio | Nombre` — máximo 60 caracteres.
- **Meta description:** máximo 155 caracteres, con la propuesta concreta, la
  dirección y una razón para hacer click. Sin relleno.
- Un solo `<h1>` por página, y que contenga la keyword local de forma natural.

## Piso técnico

- `sitemap.xml` y `robots.txt`
- Canonical en todas las páginas
- `og:image` propia de 1200×630, nunca una foto de stock
- Favicon en varios tamaños, más `apple-touch-icon`
- `lang="es-AR"`
- `alt` descriptivo real en todas las imágenes, sin amontonar keywords

## Reseñas de Google

No se pueden copiar sin atribución. Lo legal y gratis es seleccionar a mano
reseñas reales, mostrarlas con el nombre del autor y atribución visible a Google,
y linkear a la ficha. Nunca inventes reseñas ni infles el `reviewCount`.

## Fuera del sitio

Dejá anotado en el README: el perfil de Google Business tiene que apuntar al sitio
nuevo, y el NAP (nombre, dirección, teléfono) tiene que ser idéntico carácter por
carácter en el sitio, en Google y en Instagram. Una diferencia de formato en el
teléfono le cuesta posiciones al negocio.
