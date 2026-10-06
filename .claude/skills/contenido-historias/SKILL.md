---
name: contenido-historias
description: Crea secuencias de historias de Instagram para Tratto con objetivo claro (conversación, encuesta, tráfico al link, confianza, lanzamiento), pantalla por pantalla, con stickers interactivos y CTA, verificadas y puntuadas. Usar con "haceme historias", "secuencia de stories", "qué subo hoy a historias".
---

# Historias

Seguí `tools/contenido/conocimiento/protocolo.md`. Guías del formato en
`tools/contenido/conocimiento/formatos.json` (historia).

Las historias las ven sobre todo los que ya siguen la cuenta: sirven para
**conversación, confianza y conversión**, no para alcance. Se miden por
respuestas, toques en stickers y clics al link, y por cuánta gente llega a la
última pantalla.

## Método

1. **Contexto**: `node tools/contenido/cli.mjs contexto`. Revisá si hay un reel o carrusel reciente para empujar o una idea pendiente.
2. **Objetivo de la secuencia** (uno solo): conversación (preguntas, encuestas), validación (testear un tema o un hook antes de hacer un reel), confianza (detrás de escena, cómo funciona, testimonios con permiso), tráfico (link a la web con `utm_source=instagram&utm_medium=historia`), o recordatorio de un contenido nuevo.
3. **Secuencia** de 3 a 8 pantallas:
   - Pantalla 1: hook (pregunta o situación del público, guía de palabras del formato). Se decide en 1–2 segundos.
   - Medio: una idea por pantalla; al menos un **sticker** (encuesta, pregunta, quiz, slider) que haga participar.
   - Última: la acción (link, "respondé esta historia", "mandame DM con la palabra PRECIO").
   - Por pantalla: texto, qué se ve (foto, video corto, captura de la app) y el sticker.
4. **Validar hipótesis**: si el contexto tiene problemas u objeciones marcados como hipótesis, aprovechá encuestas y preguntas para validarlas. Cuando haya respuestas, registralas como `aprendizaje` (con el conteo como evidencia) y proponé pasar el ítem a `validado: true` en `config/audiencia.json`.
5. **Verificar**:
   ```bash
   node tools/contenido/cli.mjs verificar <<'JSON'
   { "formato": "historia", "pantallas": ["…", "…"], "sticker": true }
   JSON
   ```
6. **Puntuar** con `formato: historia` (insumo `guion`). En historias pesan más retención, comentarios (respuestas) y CTA.
7. **Memoria**: `registrar contenido` con `formato: historia`. Las respuestas de encuestas se cargan como `resultado` (alcance = vistas de la primera pantalla; comentarios = respuestas; compartidos; guardados = 0 si no aplica).

## Salida

```
HISTORIAS: objetivo · segmento · día/horario sugerido
1. [texto] "…" · [visual] … · [sticker] …
2. …
VERIFICACIÓN y PUNTAJE (motor)
CÓMO MEDIRLA: qué mirar en las estadísticas de la historia a las 24 h
```
