---
name: contenido-humanizador
description: Humanizador de textos de Tratto para TikTok e Instagram. Limpia de un caption, una descripción, un guion o el texto de una placa todo lo que suena a inteligencia artificial en castellano rioplatense (vocabulario de folleto, frases hechas, remates armados, "no es solo X, es Y", tuteo, emojis y signos de más) y muestra cuánto suena a IA antes y después. Se aplica sola, sin que nadie la pida, a todo texto que va a salir publicado con el nombre de Tratto (redes y también guías, anuncios y mails nuevos) antes de entregarlo o dejarlo para aprobar; además corre en código dentro de `verificar` y antes de programar en Metricool. También con "que no suene a IA".
---

# Humanizador de texto (TikTok + Instagram)

Pieza 6 de 9. Antes de empezar leé `tools/contenido/conocimiento/protocolo.md`.
Criterio adaptado de instagram-skills (Sergey Bulaev, MIT) al castellano de
Argentina.

**Qué es y qué no:** saca lo que notan los lectores. No es un detector y no
promete pasar ninguno (con textos de menos de 300 palabras los detectores
fallan igual). Si alguien pregunta "¿esto pasa el detector?", decí eso.

## Pasos

1. **Medir.** `node tools/contenido/cli.mjs humanizar --texto "…"` (o con
   `{ "texto": "…" }` por `--archivo`). Devuelve el % "suena a IA", las marcas
   por párrafo y qué hacer con cada una.
2. **Corregir** solo lo marcado, en este orden:
   - **Siempre:** remates armados ("¿El resultado?", "Spoiler:"),
     "no es solo X, es Y", frases de sinceridad ("te lo digo claro",
     "seamos honestos"), tuteo ("tú puedes", "descubre") y cierres de relleno
     ("comentá SÍ", "doble tap").
   - **Párrafo con 3 marcas o más:** reescribirlo entero, no palabra por palabra.
   - **Una marca suelta de vocabulario:** dejarla. Una sola no es un problema.
   - **Formato:** 1 a 3 emojis, 3 a 5 hashtags, como mucho una raya (—) cada
     100 palabras, no más de 2 signos de exclamación, sin renglones de una
     palabra para dar drama.
3. **Sumar lo humano** si el texto lo permite: un número con su referencia
   ("$53.000 a $73.000 un flete chico en octubre"), un nombre propio (barrio,
   rubro, Tratto) y un detalle concreto. Si falta, pedilo: **nunca inventes**.
4. **Volver a medir** y mostrar antes y después.
5. **No sobrecorregir:** si quedó todo plano (sin un solo emoji en una voz que
   los usa, todo en el mismo tono), devolvé lo que tenía la persona. Un texto
   limpio se toca dos o tres veces, no más.

## Salida

```
ANTES: 81% suena a IA
"Te lo digo claro: … En conclusión, desbloquea tu potencial."

DESPUÉS: 6% suena humano
"…"

Qué cambié:
- "En conclusión, desbloquea tu potencial" → "Probalo hoy" (frase hecha + tuteo)
```

## Reglas

- No cambies lo que el texto afirma. Si falta un dato, preguntá.
- No agregues frases de sinceridad ni dudas que la persona no escribió.
- Respetá el formato: una placa de carrusel sigue siendo una placa.
