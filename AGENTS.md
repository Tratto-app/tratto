# Tratto: reglas para Codex

## Mapa del código (graphify): el mismo para Claude y Codex

Claude y Codex usan el mismo mapa del proyecto. Se arma con
`python3 tools/graphify/armar.py` (gratis, sin IA, unos 10 segundos; necesita
`pip install "graphifyy[sql]"`) y queda en `graphify-out/`, que no se sube al
repo: cada uno lo arma con el mismo código, así que es el mismo mapa.

- Para orientarte en una parte que no conocés (qué llama a qué, dónde vive
  algo, qué se rompe si tocás X), empezá por
  `graphify query "<pregunta>" --budget 1500`, `graphify explain "<función>"`
  o `graphify path "<A>" "<B>"` antes de leer archivos enteros.
- Si ya sabés el nombre exacto de lo que buscás, una búsqueda de texto (grep)
  gasta menos: usala.
- `graphify-src/index.html.js` es el código de `index.html` con los mismos
  números de línea: si el mapa dice L2901, es `index.html` línea 2901. Lo
  mismo para las otras páginas `.html`.
- Después de cambiar código, volvé a correr `python3 tools/graphify/armar.py`.
- Si graphify no está instalado y la tarea no lo necesita, seguí sin él.
