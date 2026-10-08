---
name: contenido-hooks
description: Genera y elige hooks (primera frase, primer segundo, primer slide) para reels y videos de TikTok e Instagram, carruseles, historias y publicaciones de Tratto, usando 12 categorías (curiosidad, contrarian, problema, resultado, error, lista, historia, pregunta, shock, autoridad, identificación, intriga). Da varias alternativas, las verifica con el motor y selecciona la mejor por retención, claridad, curiosidad, identificación y viralidad. Usar con "haceme hooks", "mejorá este hook", "cómo arranco este reel".
---

# Generador de hooks

Seguí `tools/contenido/conocimiento/protocolo.md`. Las categorías, sus
mecanismos, plantillas y riesgos están en `tools/contenido/conocimiento/hooks.json`.

## Método

1. **Contexto**: `node tools/contenido/cli.mjs contexto`. Mirá los hooks ya usados (no repetir) y qué funcionó.
2. **Definí la tensión**: en una frase, qué le pasa al público con este tema (problema, deseo u objeción del segmento). Un hook sin tensión es una etiqueta.
3. **Elegí categorías**: de las 12, las 4 a 6 que mejor encajan con el tema y el objetivo (por ejemplo: precios → shock, pregunta, error; proveedores → identificación, resultado, contrarian). Decí por qué descartás las otras en una línea.
4. **Generá** al menos 2 opciones por categoría elegida (mínimo 8 en total). Reglas:
   - Específicas: un número, un objeto o una situación concreta del público.
   - Cortas: respetar la guía del formato (`conocimiento/formatos.json`).
   - Con el lenguaje del público (`Cómo habla` en el contexto), en voseo.
   - Sin aperturas genéricas ("hoy te voy a…", "tips de…").
   - Que el resto del contenido pueda cumplir lo que prometen (si no, es clickbait y baja la retención).
   - Para video, proponé también el **hook visual** (qué se ve en el primer segundo).
5. **Puntuá cada opción** de 0 a 100 en los 5 criterios de `criterios_seleccion` (retención, claridad, curiosidad, identificación, viralidad), honestamente: no todas pueden tener 80.
6. **Verificá con el motor**:
   ```bash
   node tools/contenido/cli.mjs hooks <<'JSON'
   { "formato": "reel", "hooks": [
     { "texto": "¿Te cobraron $80.000 por destapar la pileta?", "categoria": "shock",
       "criterios": { "retencion": 75, "claridad": 85, "curiosidad": 70, "identificacion": 80, "viralidad": 70 } }
   ] }
   JSON
   ```
   Si se adapta un contenido ajeno, agregá `"evitar": [frases del original]`. Las opciones con ✗ se reescriben o se descartan; la mejor opción es la que indica el motor entre las aptas (si elegís otra, justificalo).
7. **Precios**: si un hook menciona un monto, tiene que salir de la tabla de referencia del tasador (`precios_referencia`) o de un relevamiento con fecha; si no hay dato, usá la pregunta sin número.

## TikTok y fórmulas probadas

Pieza 8 de 9 del sistema. Además de las 12 categorías, usá y alterná las
fórmulas de `tools/contenido/conocimiento/plataformas.md` (número primero, mito
vs. realidad, antes/después, confesión). En TikTok el gancho se **dice y se
escribe** en el primer segundo e incluye la palabra clave que la gente busca
("cuánto sale un flete"). En Instagram, el del caption entra en los primeros
~125 caracteres. Para sacar el gancho de un video ajeno que funcionó, usá
`contenido-radar` y `contenido-viralidad`.

## Salida

```
HOOK ACTUAL: (si había uno) "…"
PROBLEMA: …
POR QUÉ NO FUNCIONA: … (criterio de la rúbrica)

NUEVAS OPCIONES:
1. [shock] "…" — ret 75 · cla 85 · cur 70 · ide 80 · vir 70
2. [pregunta] "…" — …
…

MEJOR OPCIÓN: "…"   (+ hook visual: […] para video)
POR QUÉ: mecanismo, a quién le habla, qué brecha abre y cómo la cierra el contenido.
```

Si no había hook previo, omití las tres primeras líneas.

## Memoria

Cuando la persona elige un hook para una pieza, registrá el `contenido` con ese `hook` (queda en el historial automáticamente). Para guardar solo el hook: `registrar hook` con `{ "texto", "categoria", "formato" }`.
