# Tipografías de Tratto, servidas desde el mismo sitio

Se conservaron las declaraciones de Google Fonts que usaba `index.html` al
28/10/2026, con `font-display: swap`, pesos y rangos Unicode originales:

- Montserrat 500, subconjunto del logotipo `TRAO`.
- IBM Plex Sans 400, 450, 500 y 600.
- IBM Plex Sans Condensed 600 y 700.
- IBM Plex Mono 400, 500 y 600.

La copia contiene treinta archivos WOFF2 (406.732 bytes en total). Los
distintos rangos de idioma se cargan solo cuando el navegador los necesita;
no se precargan todos. Las declaraciones con el mismo archivo comparten la
misma copia local. Se conservan las licencias SIL Open Font License 1.1.

Integración en páginas de la raíz:

```html
<link rel="stylesheet" href="/assets/fonts/tratto-fonts.css">
```

Esto reemplaza los enlaces de Google Fonts y permite retirar los preconnects
a `fonts.googleapis.com` y `fonts.gstatic.com` en esas páginas. No cambia
automáticamente otras páginas del repositorio que sigan usando Google Fonts.
No se debe afirmar que todo el dominio dejó de cargar terceros basándose solo
en esta copia.

`SOURCES.json` contiene las URLs públicas exactas, hashes SHA-256 y tamaños.
No se cambió la identidad visual ni se generaron fuentes nuevas.

## SDK de Supabase

`/vendor/supabase-2.117.0.js` es la copia **idéntica** al UMD 2.117.0 usado
por la aplicación. Su licencia MIT está en `/vendor/LICENSE-supabase-js.txt`.

```html
<script src="/vendor/supabase-2.117.0.js"
  integrity="sha384-xPW3QHswsICVC2mW6BFNwMbhpLkbZ133fKOhxNx3QGGgAOJfL3O9t8r2aWn1aez6"
  crossorigin="anonymous"></script>
```

La actualización futura del SDK debe cambiar nombre, contenido, recibo y SRI
juntos. No cargar por error un archivo de otra versión con este mismo nombre.
