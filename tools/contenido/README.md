# Sistema de contenido para redes (skills + motor)

Skills de Claude Code para planificar, escribir, crear, analizar, puntuar,
mejorar y adaptar contenido de **TikTok e Instagram** para Tratto, con un motor
determinístico que puntúa, verifica, revisa si un texto suena a IA y recuerda.

Las 9 piezas (inspiradas en instagram-skills de Sergey Bulaev, MIT, y
adaptadas a Tratto, a TikTok y al castellano de Argentina): planificador,
redactor, carruseles, hashtags, perfil, humanizador, radar viral, ganchos y
reutilizador. Las diferencias entre las dos redes están en
`conocimiento/plataformas.md`.

```
.claude/skills/
  contenido/                 orquestador: entiende el pedido y arma el recorrido
  contenido-viralidad/       por qué funcionó un contenido + adaptación sin copiar
  contenido-hooks/           12 categorías, opciones verificadas, mejor opción
  contenido-analisis/        puntaje con evidencia por dimensión (+ métricas reales)
  contenido-optimizacion/    reescribe lo que más resta, antes/después
  contenido-carruseles/      carrusel completo slide por slide
  contenido-historias/       secuencias con stickers y objetivo
  contenido-perfil/          nombre, bio, link, destacadas, fijadas (IG y TikTok)
  contenido-planificador/    1 · la semana: qué, cuándo y en qué formato, en las dos redes
  contenido-redactor/        2 · caption de IG y texto de TikTok con fórmulas de ganchos
  contenido-hashtags/        4 · 3 a 5 hashtags con tamaño + palabras clave de TikTok
  contenido-humanizador/     6 · que no suene a IA (con el comando humanizar)
  contenido-radar/           7 · lo que mejor rinde en el nicho y su fórmula en blanco
  contenido-reutilizador/    9 · una pieza → todas las redes y formatos
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
node tools/contenido/cli.mjs humanizar --texto "…"   # cuánto suena a IA y qué reescribir
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
| Leer métricas | TikTok sí (Metricool) · Instagram pendiente | Conector de Metricool en claude.ai. TikTok ya está conectado. Para Instagram: pasar la cuenta a profesional (Empresa o Creador) y conectarla en Metricool con "Conectar con Instagram" (no requiere página de Facebook). Ver `conocimiento/protocolo.md`, sección 9. |
| Programar publicaciones | Sí, con aprobación | Metricool `createScheduledPost`; necesita el video subido a una URL pública. |
| Diseñar piezas | Sí | Conector de Canva (sin kit de marca: la identidad va en el pedido) o `tools/piezas-redes`. |
| Transcribir el audio de un video | No | Un servicio de transcripción (por ejemplo, Whisper de OpenAI: el proyecto ya tiene cuenta de OpenAI por Growth OS; la clave iría como secreto) o pasar los subtítulos. Hoy se pide la transcripción. |
| Abrir links de Instagram/TikTok | No | Las plataformas exigen sesión; se sube el archivo o capturas. |
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
