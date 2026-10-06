# Plantillas de salida

Todas las skills entregan resultados con la misma lógica: **lo que hay → el
problema → por qué → opciones → la mejor y por qué**. Nada de consejos sueltos
("usá un buen hook"): cada recomendación va con el texto concreto.

## Mejora de un elemento (hook, CTA, slide, bio)

```
HOOK ACTUAL:
"…"

PROBLEMA:
…(qué le pasa al público al leerlo)

POR QUÉ NO FUNCIONA:
…(referencia al criterio de la rúbrica)

NUEVAS OPCIONES:
1. [categoría] "…"
2. [categoría] "…"
3. [categoría] "…"

MEJOR OPCIÓN:
"…"

POR QUÉ:
…
```

## Puntuación

La tabla sale del motor (`node tools/contenido/cli.mjs puntuar`), no se escribe a mano:
el total, los topes y la confianza los calcula el código.

```
VIRALIDAD: 72/100 (bueno · confianza media)

| Dimensión | Puntaje | Peso | Evidencia |
|---|---|---|---|
| Hook | 80 | 18 | "…" |
…
Topes aplicados: …
```

Después de la tabla:

```
QUÉ FUNCIONA:
- …(con cita)

QUÉ NO FUNCIONA:
- …(con cita y el criterio que no cumple)

QUÉ HARÍA PARA MEJORARLO:
1. …(cambio concreto con el texto nuevo)
```

## Análisis viral

```
INSUMO: reel (fotogramas + transcripción) · confianza alta
ESTRUCTURA DETECTADA: …(ver conocimiento/estructuras.md)
COMPONENTES: hook, promesa, curiosidad, … (cada uno con cita y lectura)
PRINCIPIO: Funciona porque … hace que … sienta … lo que genera …
TRANSFERIBLE: …
NO TRANSFERIBLE: …
QUÉ COPIAR CONCEPTUALMENTE: …
QUÉ EVITAR: …
ADAPTACIÓN PARA [segmento]:
  Tema nuevo · Hook nuevo · Ejemplo nuevo · Desarrollo · CTA nuevo
  Por qué mantiene el mecanismo: …
  Qué cambió respecto del original: …
VIRALIDAD (original) / VIRALIDAD (adaptación): tablas del motor
```

## Reglas de redacción

- Español rioplatense, con voseo, como habla el público (`config/audiencia.json`).
- Citas textuales entre comillas; descripciones de imagen entre corchetes: [primer plano de una canilla goteando].
- Si un dato no se pudo observar (por ejemplo, el audio de un video sin transcripción), decirlo y bajar la confianza; no inventarlo.
