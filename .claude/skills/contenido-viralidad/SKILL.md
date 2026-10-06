---
name: contenido-viralidad
description: Analiza por qué un contenido (reel, carrusel, publicación, propio o de otra cuenta) funcionó o se hizo viral, descompone sus componentes, detecta su estructura real, extrae el principio que lo hace funcionar, lo puntúa (VIRALIDAD /100 con justificación por dimensión) y lo adapta al público de Tratto sin copiarlo. Usar con "analizá este viral", "por qué funcionó", "adaptá este reel", "quiero algo como esto".
---

# Viralidad: entender, puntuar y adaptar

Seguí `tools/contenido/conocimiento/protocolo.md`. Material de apoyo:
`conocimiento/estructuras.md`, `conocimiento/principios.md`,
`conocimiento/rubrica.json`, `conocimiento/plantillas-salida.md`.

La meta no es describir el contenido sino encontrar **el mecanismo** que lo
hizo funcionar y llevarlo a otro tema, otro ejemplo y otro público sin que
nadie pueda decir que es una copia.

## Paso 0 — Contexto e insumo

1. `node tools/contenido/cli.mjs contexto` (y `--segmento` si la adaptación es para proveedores).
2. Conseguí el material:
   - Video: `node tools/contenido/cli.mjs fotogramas <ruta> --cantidad 12` y leé cada imagen. Los primeros fotogramas (0, 1, 2 s) son el hook visual.
   - Audio: pedí transcripción o subtítulos. Sin eso, decí que el análisis del texto hablado no se hizo y usá `insumo: descripcion` o `video` según lo que haya.
   - Link: no se puede abrir; pedí el archivo, capturas o el texto.
   - Si hay métricas del original (vistas, likes, compartidos), anotarlas como dato de contexto, sin inventar las que faltan.

## Paso 1 — Descomposición (15 componentes)

Para cada uno: qué hay (cita "…" o descripción […]), en qué momento o slide, y qué efecto busca. Si un componente no está, decilo: la ausencia también explica.

1. **Hook verbal**: la primera frase dicha o escrita.
2. **Hook visual**: lo que se ve en el primer segundo (encuadre, movimiento, texto en pantalla, cara, objeto).
3. **Promesa**: qué se le dice al público que va a obtener.
4. **Brechas de curiosidad / loops**: preguntas abiertas y cuándo se cierran.
5. **Estructura**: tramos en orden (paso 2).
6. **Ritmo y edición**: cortes, cambios de plano o de slide, velocidad del habla, silencios.
7. **Tensión / storytelling**: qué está en juego y cómo escala.
8. **Emoción dominante**: sorpresa, gracia, bronca justa, alivio, ternura, miedo.
9. **Identificación**: situación, lenguaje o personaje en el que el público se reconoce.
10. **Valor**: lo que la persona se lleva (dato, regla, precio, paso).
11. **Prueba / autoridad**: por qué creerle (demostración, número, experiencia, antes/después).
12. **Novedad / ángulo contraintuitivo**: qué rompe lo esperado.
13. **Payoff**: cómo y cuándo cumple la promesa.
14. **CTA**: qué pide y si tiene motivo.
15. **Disparadores de acción**: por qué alguien lo compartiría (moneda social, utilidad para otro), lo guardaría o comentaría.

## Paso 2 — Estructura real

Dividí en tramos y etiquetá cada uno con los tipos de `conocimiento/estructuras.md`. Recién después compará con los arquetipos. **No fuerces una plantilla**: si no encaja, informá la secuencia propia ("gancho → item → giro → item → remate"). Marcá dónde se cae la retención y por qué.

## Paso 3 — Principio

Escribí el principio con la fórmula de `conocimiento/principios.md`:

> Funciona porque [mecanismo] hace que [público] sienta/quiera [efecto], lo que genera [acción].

Puede haber un principio principal y uno secundario. Separá **transferible** (mecanismo, estructura, tipo de hook, ritmo, tipo de prueba, tipo de CTA) de **no transferible** (fama del creador, tendencia, audio viral, producción cara, chistes de otra comunidad).

## Paso 4 — Puntuar el original

Armá el JSON con las 13 dimensiones (o las que pide el formato) y corré:

```bash
node tools/contenido/cli.mjs puntuar --etiqueta VIRALIDAD <<'JSON'
{ "formato": "reel", "insumo": "video", "titulo": "…", "dimensiones": { "hook": { "puntaje": 84, "evidencia": "…" }, … } }
JSON
```

El puntaje mide el potencial **para su propio público**. Si hay métricas reales del original, usalas como evidencia, no como puntaje.

## Paso 5 — Adaptar al público de Tratto

1. Buscá en el contexto (problemas, deseos, objeciones, lenguaje del segmento; pilares) una situación donde el mismo mecanismo funcione.
2. Cambiá **tema, hook, ejemplo, desarrollo y CTA**; mantené **mecanismo, estructura y ritmo**.
3. Hooks: generá opciones con el método de la skill `contenido-hooks` y verificá pasando las frases del original en `evitar`:
   ```bash
   node tools/contenido/cli.mjs hooks <<'JSON'
   { "formato": "reel", "evitar": ["frase 1 del original", "frase 2"], "hooks": [ { "texto": "…", "categoria": "…", "criterios": { … } } ] }
   JSON
   ```
4. Escribí la pieza adaptada completa en el formato de destino (guion por tramos con tiempos, o slides, o pantallas) y corré `verificar`.
5. Puntuá la adaptación (insumo `guion`, `carrusel` o `texto`). Tiene que superar al original en **identificación** con el público propio. Si queda por debajo de 75, hacé hasta dos rondas de mejora.
6. Control anti-copia: ninguna frase igual o casi igual (el motor la marca), ningún elemento no transferible, y que se entienda sin haber visto el original.

## Paso 6 — Entregar

Usá la plantilla "Análisis viral" de `conocimiento/plantillas-salida.md`, con estas secciones en este orden:

```
VIRALIDAD: NN/100 (tabla del motor)
ESTRUCTURA DETECTADA
COMPONENTES (los 15)
PRINCIPIO
QUÉ FUNCIONA
QUÉ NO FUNCIONA
QUÉ COPIAR CONCEPTUALMENTE
QUÉ EVITAR
CÓMO ADAPTARLO (pieza completa para Tratto + por qué mantiene el mecanismo + qué cambió)
VIRALIDAD DE LA ADAPTACIÓN (tabla del motor)
QUÉ MEJORAR (antes de producirla)
```

## Paso 7 — Memoria

- Registrá la adaptación como `contenido` (`estado: borrador`, `inspiracion`: el principio en una frase, nunca el texto del original).
- Si el análisis dejó una conclusión reutilizable, registrala como `aprendizaje` de tipo `hipotesis` con su evidencia.
