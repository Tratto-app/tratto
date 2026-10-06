---
name: contenido-optimizacion
description: Mejora un contenido existente de Tratto (guion de reel, carrusel, historia, caption, publicación) reescribiendo los elementos que más restan según la rúbrica, con el formato HOOK ACTUAL / PROBLEMA / POR QUÉ NO FUNCIONA / NUEVAS OPCIONES / MEJOR OPCIÓN / POR QUÉ, y muestra el puntaje antes y después. Usar con "mejorá esto", "optimizá este guion", "cómo lo hago más viral", "reescribilo".
---

# Optimización de contenido

Seguí `tools/contenido/conocimiento/protocolo.md`.

## Método

1. **Puntaje inicial**: si no hay uno reciente, analizá con el método de `contenido-analisis` y corré `puntuar`. Guardá el JSON de dimensiones: lo vas a volver a usar.
2. **Prioridad**: ordená las dimensiones por *peso del formato × (100 − puntaje)*. Las 2 o 3 primeras son las que más suben el total. Si hay un **tope aplicado** (hook débil, retención débil, confuso, sin motivo de acción), eso va primero: mientras esté, el total no sube.
3. **Por cada elemento a mejorar** (hook, tramo, slide, CTA, caption), usá la plantilla de `conocimiento/plantillas-salida.md`:
   ```
   [ELEMENTO] ACTUAL: "…"
   PROBLEMA: qué le pasa al público al verlo
   POR QUÉ NO FUNCIONA: nivel de la rúbrica que cumple y el que no
   NUEVAS OPCIONES: 3 alternativas con texto completo
   MEJOR OPCIÓN: "…"
   POR QUÉ: …
   ```
   - Para hooks, generá y verificá con el método de `contenido-hooks`.
   - Mantené lo que ya funciona: no reescribas todo si el problema es el hook.
   - Respetá tono, palabras prohibidas y restricciones de la marca.
4. **Versión mejorada completa**: la pieza entera con los cambios aplicados, lista para usar.
5. **Verificar**: `node tools/contenido/cli.mjs verificar` sobre la versión nueva.
6. **Re-puntuar**: mismo formato e insumo, evidencias nuevas para lo que cambió. Mostrá:
   ```
   ANTES: NN/100 (banda) → DESPUÉS: NN/100 (banda)
   Dimensiones que cambiaron: hook 35 → 72, …
   ```
   Si no llega a 75, una ronda más (máximo dos). Si aun así no llega, decí qué lo limita (por ejemplo, el tema tiene poca tensión) y proponé otro ángulo.
7. **Memoria**: si la persona va a usar la versión mejorada, registrá o actualizá el `contenido` (`actualizar contenido <id>` con `guion`, `hook`, `puntaje`).

## Reglas

- No subas puntajes sin cambiar el texto: cada punto nuevo tiene que tener evidencia nueva.
- Si una mejora sube una dimensión pero baja otra (por ejemplo, un hook más fuerte pero menos claro), decilo.
