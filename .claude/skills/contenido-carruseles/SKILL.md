---
name: contenido-carruseles
description: Crea carruseles de Instagram para Tratto de punta a punta — ángulo, estructura, texto slide por slide, slide de hook, cierre con CTA, caption y notas de diseño — verificados contra los límites de la plataforma y puntuados con la rúbrica. Usar con "haceme un carrusel", "armá slides sobre…", "convertí esto en carrusel".
---

# Carruseles

Seguí `tools/contenido/conocimiento/protocolo.md`. Guías del formato en
`tools/contenido/conocimiento/formatos.json` (carrusel).

Un carrusel rinde por **guardados y compartidos**: tiene que ser algo que la
persona quiera tener a mano o mandarle a alguien. Cada slide tiene que dar un
motivo para pasar al siguiente.

## Método

1. **Contexto**: `node tools/contenido/cli.mjs contexto` (pilar y segmento; ideas pendientes sobre el tema).
2. **Ángulo**: en una frase, qué se lleva la persona y por qué lo guardaría. Si el tema es amplio ("plomería"), achicá a una decisión concreta ("qué tiene que incluir un presupuesto de plomería").
3. **Estructura**: elegí un arquetipo de `conocimiento/estructuras.md` (lista, error común, comparación, revelación de precio, tutorial, mito vs realidad) o una secuencia propia. Plan de slides antes de escribir:
   - Slide 1: hook (método `contenido-hooks`, guía de palabras del primer slide).
   - Slide 2: confirma la promesa o suma tensión (acá se decide si siguen).
   - Desarrollo: una idea por slide; el ítem más fuerte no va primero (dejá un loop: "el 4 es el que más plata te ahorra").
   - Penúltimo: payoff o resumen guardable (checklist, tabla, regla).
   - Último: CTA con motivo ("Guardalo para cuando llames al plomero" / "Mandáselo a quien se está mudando") + `cta_principal` de la marca si el objetivo es conversión.
4. **Texto de cada slide**: título corto + apoyo breve. Respetá `slide_max_palabras`. Números de la tabla de referencia del tasador (con fecha) o ninguno.
5. **Caption**: primera línea que complete el hook sin repetirlo, 2–4 líneas de valor, CTA, y 3–5 hashtags específicos (rubro + ciudad/zona si aplica).
6. **Verificar**:
   ```bash
   node tools/contenido/cli.mjs verificar <<'JSON'
   { "formato": "carrusel", "slides": ["…", "…"], "texto": "caption" }
   JSON
   ```
7. **Puntuar** con `formato: carrusel`, `insumo: carrusel` (si el texto de todos los slides está escrito) y mejorar si queda por debajo de 75.
8. **Diseño**: notas por slide (qué se ve: foto, ícono, número grande, tabla). La producción gráfica sigue la identidad de la skill `disenador-marketplace`; las placas se pueden generar agregando el carrusel a `tools/piezas-redes/piezas.html` y corriendo `python3 tools/piezas-redes/render.py` (1080×1350, 4:5).
9. **Memoria**: `registrar contenido` con `formato: carrusel`, `titulo`, `pilar`, `segmento`, `hook`, `guion` (los slides numerados), `cta`, `puntaje`.

## Salida

```
CARRUSEL: título interno · pilar · segmento · objetivo
ESTRUCTURA: arquetipo o secuencia y por qué

SLIDE 1 (hook): "…"            [diseño: …]
SLIDE 2: "…"                   [diseño: …]
…
SLIDE N (CTA): "…"

CAPTION:
…

VERIFICACIÓN: (salida del motor)
PUNTAJE: (tabla del motor) + qué lo subiría
```
