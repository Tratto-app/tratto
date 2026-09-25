# Logo de Tratto

`logo-original-referencia.jpg` es el logo elegido por el dueño (25/09/2026).
Se redibujó en vector con sus mismas medidas y colores, para que salga nítido
en cualquier tamaño y sin las esquinas negras ni la compresión del JPG:

| Elemento | Medida (lienzo de 1179) | Color |
|---|---|---|
| Anillo menta | centro (414.5, 318), radios 76.5–124.5 | `#9EECD4` |
| Anillo amarillo | centro (754, 653.5), radios 70–113 | `#F7CA55` |
| Conector | ancho 46, del hueco de un anillo al del otro | `#96E7CE` → `#62AD98` |
| Texto | Montserrat 500, altura de mayúscula 88, muy espaciado | `#E8EBEA` |
| Fondo | degradé en diagonal | `#0A231E` → `#123028` |

- `dibujar.js` + `render_logo.py`: generan todos los PNG (íconos de la web,
  maskable de Android, iPhone, tiendas, pantalla de inicio de iOS, favicon).
  Ejemplo: `python3 render_logo.py '[["icon-512.png",{"tam":512,"redondeo":0.225}]]'`
  (necesita Playwright y la fuente Montserrat en esta carpeta).
- `glifo.svgpart`: el símbolo en SVG (viewBox 32×32), el que usa la app en la
  barra de arriba, la pantalla de carga y las páginas legales.
- En la app, el nombre "TRATTO" va en Montserrat 500 con espaciado .3em.
