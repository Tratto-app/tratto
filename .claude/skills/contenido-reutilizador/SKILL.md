---
name: contenido-reutilizador
description: Reutilizador de contenido de Tratto. Convierte una pieza en todas las demás sin repetirla igual - un reel de TikTok en reel de Instagram, carrusel, historias y post; una guía o página de precios de la web en carrusel y reel; un carrusel de Instagram en carrusel de fotos de TikTok - adaptando gancho, texto, link con nombre y hashtags a cada red. Se aplica sola, sin que nadie la pida - al terminar cada pieza nueva (arma la versión para la otra red), cuando una pieza aprobada o publicada no tiene su gemela, cuando se publica una guía o página de precios nueva y cuando una pieza rinde muy por encima de la mediana. También con "pasalo a TikTok".
---

# Reutilizador (TikTok ↔ Instagram ↔ web)

Pieza 9 de 9. Antes de empezar leé `tools/contenido/conocimiento/protocolo.md`
y `tools/contenido/conocimiento/plataformas.md`.

## Qué se puede convertir en qué

| Desde | Hacia |
|---|---|
| Reel / video de TikTok | Reel de Instagram · carrusel (las ideas del video, placa por placa) · 3 a 5 historias · post |
| Carrusel de Instagram | Carrusel de fotos de TikTok (9:16 o 4:5, con música) · guion de reel · historias |
| Guía o página de precios de la web (`guias/`, `precios/`) | Carrusel · reel de precios · historias con encuesta |
| Respuesta o pregunta frecuente | Reel corto · historia |
| Resultado real (un pedido, un cliente) | Solo con permiso y sin datos personales: historia o reel |

## Pasos

1. **La idea central.** Una oración: qué tiene que llevarse quien lo ve.
2. **Elegir destinos** que sumen, no todos por las dudas. Si la pieza ya salió
   en una red, la versión de la otra sale con 1 a 3 días de diferencia.
3. **Adaptar, no copiar y pegar:**
   - **Gancho** nuevo para cada formato (`contenido-hooks`): el de un video se
     dice; el de un carrusel se lee en la placa 1; el de Instagram vive en los
     primeros ~125 caracteres.
   - **Texto** con `contenido-redactor` y **hashtags** con
     `contenido-hashtags`, distintos por red.
   - **Link con nombre** distinto por red (`/r/tt-…` y `/r/ig-…`) para saber
     qué trajo a cada persona. En TikTok va escrito.
   - **Formato:** carrusel con `contenido-carruseles`, historias con
     `contenido-historias`, video con la skill `video-publicidad`.
4. **Humanizar** cada texto (`node tools/contenido/cli.mjs humanizar`) y
   **verificar** cada pieza (`node tools/contenido/cli.mjs verificar`).
5. **Registrar** cada versión con referencia a la original
   (`node tools/contenido/cli.mjs registrar contenido`).

## Salida

```
ORIGINAL: [pieza] · idea central: "…"

| Destino | Gancho | Qué cambia | Link | Cuándo |
|---|---|---|---|---|
| Reel IG | "…" | caption con primera línea… | /r/ig-… | +2 días 12:00 |
| Carrusel IG | "…" | 7 placas: … | /r/ig-… | … |
| Carrusel fotos TikTok | … | … | /r/tt-… | … |

Después: cada pieza con su skill y a la cola para aprobar.
```

## Reglas

- Mismos datos y precios en todas las versiones (con su fecha).
- Nada de marcas de agua de otra red en el video (TikTok en Instagram o al
  revés): se exporta limpio desde el original.
