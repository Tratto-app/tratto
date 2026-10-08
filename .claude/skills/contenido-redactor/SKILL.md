---
name: contenido-redactor
description: Redactor de publicaciones de Tratto para TikTok e Instagram. Escribe el texto del post (caption de Instagram con la primera línea que se entiende sola, descripción de TikTok con la palabra clave arriba), el texto en pantalla y el guion hablado, partiendo de fórmulas de ganchos probadas (número primero, mito vs. realidad, antes/después, confesión) y pasando el humanizador antes de entregar. Usar con "escribí el caption", "texto para TikTok", "redactá la publicación", "guion para el reel".
---

# Redactor de publicaciones (TikTok + Instagram)

Pieza 2 de 9. Antes de empezar leé `tools/contenido/conocimiento/protocolo.md`
y `tools/contenido/conocimiento/plataformas.md`.

## Pasos

1. **Qué y para quién.** Tema, pilar, segmento (clientes o proveedores), red o
   redes, formato y link con nombre (`trattoapp.com.ar/r/tt-…` o `/r/ig-…`).
   Datos y precios solo de la tabla `precios_referencia` o de pantallas
   reales (protocolo, sección 7).
2. **Gancho.** Pedí 3 opciones a `contenido-hooks` con fórmulas distintas
   (`conocimiento/plataformas.md`) y elegí una con su porqué.
3. **Escribir por red** (mismo mensaje, distinta forma):
   - **Instagram:** primera línea de hasta ~125 caracteres que se entienda
     sola. Después 2 a 4 renglones con el valor (números concretos), una
     acción clara (guardar, mandárselo a alguien, entrar al link de la bio) y
     al final 3 a 5 hashtags de `contenido-hashtags`.
   - **TikTok:** primera línea con la palabra clave que la gente busca, el
     link escrito (no hay link clickeable), una pregunta que invite a
     comentar algo concreto y 3 a 5 hashtags. Más corto que en Instagram.
   - **Texto en pantalla y guion:** si es un video, por tramos con tiempos
     (`[0–2 s] gancho dicho y escrito`), según `conocimiento/estructuras.md`.
4. **Humanizar.** `node tools/contenido/cli.mjs humanizar` con cada texto
   (skill `contenido-humanizador`). Si da "mixto" o "suena a IA", corregí lo
   marcado y volvé a pasarlo.
5. **Verificar y puntuar.** `node tools/contenido/cli.mjs verificar` con el
   formato y, si es una pieza completa, puntuar (protocolo, sección 4).

## Salida

```
GANCHO ELEGIDO: "…" (fórmula · por qué)

INSTAGRAM (caption)
…
#… #… #…

TIKTOK (descripción)
…
#… #… #…

TEXTO EN PANTALLA / GUION (si es video)
[0–2 s] …

Suena a IA: IG [x]% · TikTok [y]%
```

## Reglas

- Voseo siempre. Nada de "tú", "descubre", "desbloquea", "al siguiente nivel".
- Un CTA por texto. Nada de "comentá SÍ", "doble tap" ni "etiquetá a 3 amigos";
  sí un envío concreto ("mandáselo a quien está por contratar un flete").
- No inventes testimonios, cifras ni reseñas. Si falta un dato, pedilo.
- No prometas plazos ni precios exactos (alertas de `config/marca.json`).
