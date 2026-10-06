---
name: contenido-analisis
description: Analiza y puntúa un contenido (propio o ajeno, publicado o borrador) con la rúbrica de 13 dimensiones de Tratto — hook, retención, claridad, valor, curiosidad, emoción, identificación, novedad, autoridad, CTA, comentarios, compartidos y guardados — con puntaje justificado por evidencia, y si hay métricas reales explica el resultado y guarda el aprendizaje. Usar con "puntuá", "analizá este post/reel/carrusel", "qué tal está esto", "por qué no funcionó".
---

# Análisis de contenido

Seguí `tools/contenido/conocimiento/protocolo.md`. La rúbrica completa
(preguntas, niveles anclados, pesos por formato, topes) está en
`tools/contenido/conocimiento/rubrica.json`.

## Método

1. **Contexto**: `node tools/contenido/cli.mjs contexto`.
2. **Insumo**: identificá qué se tiene y qué no (protocolo, sección 3). El `insumo` del JSON tiene que reflejar lo que viste realmente. Para video, `fotogramas`.
3. **Leé la pieza dos veces**: una como alguien del público que la ve deslizando (¿frena?, ¿sigue?, ¿qué hace al final?), otra con la rúbrica.
4. **Estructura**: tramos según `conocimiento/estructuras.md` y dónde se cae la retención.
5. **Puntuá dimensión por dimensión**: leé la pregunta y los niveles; elegí el nivel que describe lo observado; poné el puntaje dentro de ese rango y la evidencia (cita o descripción concreta). Si dudás entre dos niveles, el más bajo. Las dimensiones con peso 0 en el formato se pueden omitir.
6. **Motor**: `node tools/contenido/cli.mjs puntuar --etiqueta "PUNTAJE"` (o `VIRALIDAD` si se pidió el potencial viral). Copiá la tabla tal cual.
7. **Métricas** (si las hay):
   - Si es una pieza propia ya registrada: `registrar resultado` con `contenido_id` y las métricas, y `metricas` para compararla con la cuenta.
   - Si no está registrada: registrá primero el `contenido` (estado `publicado`) y después el resultado.
   - Sin registrar nada: `node tools/contenido/cli.mjs metricas --comparar <<< '{ "alcance": …, "guardados": …, "compartidos": …, "comentarios": … }'`.
   - Explicá el resultado con la rúbrica: qué dimensiones predicen lo que pasó. Si el puntaje previsto y el resultado no coinciden, eso es un aprendizaje.
8. **Aprendizaje**: si hay métricas, registrá un `aprendizaje` (con un solo caso, tipo `hipotesis`; con 3 o más casos coherentes, `funciona` o `no_funciona`), con la evidencia (ids y tasas).

## Salida

```
PUNTAJE: NN/100 (banda · confianza) — tabla del motor
ESTRUCTURA: …
QUÉ FUNCIONA:
- … ("cita")
QUÉ NO FUNCIONA:
- … ("cita" → criterio que no cumple)
QUÉ HARÍA PARA MEJORARLO (por impacto):
1. Cambio concreto con el texto nuevo — sube [dimensión] de X a ~Y
2. …
RESULTADO REAL (si hay métricas): tasas vs. medianas de la cuenta y lectura.
```

Para aplicar las mejoras, seguí con la skill `contenido-optimizacion`.
