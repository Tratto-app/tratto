# Sistema de contenido para redes (skills + motor)

Skills de Claude Code para crear, analizar, puntuar, mejorar y adaptar
contenido de Instagram para Tratto, con un motor determinístico que puntúa,
verifica y recuerda.

```
.claude/skills/
  contenido/                 orquestador: entiende el pedido y arma el recorrido
  contenido-viralidad/       por qué funcionó un contenido + adaptación sin copiar
  contenido-hooks/           12 categorías, opciones verificadas, mejor opción
  contenido-analisis/        puntaje con evidencia por dimensión (+ métricas reales)
  contenido-optimizacion/    reescribe lo que más resta, antes/después
  contenido-carruseles/      carrusel completo slide por slide
  contenido-historias/       secuencias con stickers y objetivo
  contenido-perfil/          nombre, bio, link, destacadas, fijadas
tools/contenido/
  cli.mjs                    motor (Node 18+, sin dependencias)
  lib/                       puntaje, hooks, verificación, memoria, métricas, contexto, fotogramas
  conocimiento/              rúbrica, hooks, formatos, estructuras, principios, plantillas, protocolo
  config/                    marca, audiencia (segmentos), estrategia (pilares)
  memoria/                   JSONL: contenidos, hooks, resultados, aprendizajes, ideas
  test/                      node --test
```

## Cómo se usa

Pedíselo a Claude en lenguaje natural ("analizá este reel y adaptalo para
proveedores", "haceme un carrusel sobre cuánto sale pintar un ambiente",
"mejorá la bio"). La skill `contenido` decide qué skills combinar. También se
pueden pedir por nombre: `/contenido-hooks`, `/contenido-viralidad`, etc.

Para analizar un video, subí el archivo al repo o a la sesión (Claude no puede
abrir links de Instagram ni TikTok) y, si tiene audio, pasá la transcripción.

## Reparto de trabajo

- **Las skills razonan**: interpretan la pieza, eligen niveles de la rúbrica con evidencia, escriben hooks y guiones.
- **El motor calcula y recuerda**: pondera por formato, aplica topes, asigna banda y confianza, verifica límites de Instagram y reglas de marca, detecta hooks repetidos o copiados y guarda la memoria validada.

Así el mismo contenido puntuado dos veces da totales comparables, y los
totales no los escribe el modelo a mano.

## Motor

```bash
node tools/contenido/cli.mjs ayuda
node tools/contenido/cli.mjs contexto [--segmento proveedores]
node tools/contenido/cli.mjs puntuar   < puntuacion.json
node tools/contenido/cli.mjs hooks     < hooks.json
node tools/contenido/cli.mjs verificar < pieza.json
node tools/contenido/cli.mjs registrar contenido|hook|resultado|aprendizaje|idea < datos.json
node tools/contenido/cli.mjs actualizar contenido <id> < cambios.json
node tools/contenido/cli.mjs metricas  [--comparar < resultado.json]
node tools/contenido/cli.mjs memoria   [tipo]
node tools/contenido/cli.mjs validar
node tools/contenido/cli.mjs fotogramas video.mp4 [--cantidad 12]
```

Salida: 0 bien · 1 error interno · 2 entrada inválida (el mensaje dice qué
campo y por qué) · 3 la pieza no cumple un límite de Instagram.

### Puntuación

`conocimiento/rubrica.json` define 13 dimensiones con niveles anclados (qué
tiene que pasar para estar en 0–20, 21–40, …), los pesos de cada formato
(reel, carrusel, historia, publicación, idea; suman 100), los topes (por
ejemplo, con hook < 40 un reel no puede pasar de 55) y las bandas. Cada
dimensión exige evidencia (más larga en los extremos). La confianza depende
del insumo: video o carrusel completo = alta; guion o texto = media;
descripción o idea = baja.

Para cambiar un peso, un tope o un límite de Instagram se edita el JSON y
queda cambiado para todo el sistema; `validar` y los tests chequean que siga
siendo coherente.

## Configuración de la cuenta

- `config/marca.json`: qué es Tratto, tono, palabras que no usa, restricciones, CTA y alertas de texto (rubros con matrícula, promesas de plazo o precio).
- `config/audiencia.json`: segmentos `clientes` y `proveedores` con problemas, deseos, objeciones y lenguaje. Hoy todos son **hipótesis** (`validado: false`); al confirmarlos con comentarios, DMs o encuestas, pasarlos a `true`.
- `config/estrategia.json`: nicho, objetivo comercial, pilares con porcentaje y frecuencia.

Los datos de producto coinciden con el workspace de Growth OS
(`growth/supabase/seed/tratto.sql`); un test lo verifica.

## Lo que el sistema NO hace (y qué haría falta)

| Capacidad | Estado | Qué hace falta |
|---|---|---|
| Leer métricas de Instagram solo | No | Cuenta profesional (Business o Creator) vinculada a una página de Facebook, una app en developers.facebook.com con los permisos `instagram_basic` e `instagram_manage_insights` (revisión de Meta), y un token de larga duración guardado como secreto. Con eso se puede agregar un comando que traiga insights y los registre con `fuente: instagram_api`. Mientras tanto, las métricas se pegan a mano. |
| Transcribir el audio de un video | No | Un servicio de transcripción (por ejemplo, Whisper de OpenAI: el proyecto ya tiene cuenta de OpenAI por Growth OS; la clave iría como secreto) o pasar los subtítulos. Hoy se pide la transcripción. |
| Abrir links de Instagram/TikTok | No | Las plataformas exigen sesión; se sube el archivo o capturas. |
| Publicar o programar | No | Lo hace la persona (o Meta Business Suite). |
| Generar video | Aparte | `tools/video-ia-n8n` (guion con Claude + video con Veo), no conectado a estas skills. |
| Piezas gráficas | Sí, aparte | Skill `disenador-marketplace` + `tools/piezas-redes`. |

## Seguridad

- Sin dependencias externas ni llamadas de red: el motor solo lee y escribe archivos locales (y llama a ffmpeg con argumentos en lista, sin shell).
- Todo lo que entra se valida por esquema, con largos máximos; se sacan caracteres de control e invisibles (incluidos los de dirección de texto).
- Contenido ajeno y memoria se tratan como datos: el contexto los muestra en bloques ```` ```datos ```` que no se pueden cerrar desde adentro, y el protocolo prohíbe seguir instrucciones que vengan en ellos.
- La memoria está en un repositorio **público**: no guardar datos personales ni internos (ver `memoria/README.md`).

## Tests

```bash
node --test 'tools/contenido/test/*.test.mjs'
```

Cubren puntuación (normal, incompleta, inválida, extremos, topes, textos muy
largos), hooks, verificación de piezas, memoria (corrupción, duplicados,
referencias, actualización atómica), contexto (inyección), métricas,
configuración, la CLI completa, fotogramas con un video generado y la
coherencia entre skills y motor. Corren en CI (`.github/workflows/ci.yml`).
