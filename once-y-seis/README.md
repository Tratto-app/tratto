# Web de Once y Seis · Café de especialidad

Sitio estático hecho con Astro y Tailwind. No tiene base de datos ni servidor:
cada vez que se guarda un cambio en GitHub, Vercel lo arma y lo publica solo
(tarda alrededor de un minuto).

## Cómo cambiar la carta, los precios, la obsesión del mes o los horarios

Todo está en **un solo archivo**: `src/data/contenido.yaml`.

1. Abrí el archivo en GitHub y tocá el lápiz (✏️) para editarlo.
2. Cambiá lo que necesites. El archivo tiene notas en español que explican cada parte.
3. Tocá **Commit changes** (guardar). En un minuto la web queda actualizada.

Si algo quedó mal escrito, el cambio **no se publica** y sigue online la versión
anterior. En Vercel aparece un mensaje en español que dice qué línea revisar.

### Precios

- Cada producto tiene `precio` (el que se muestra) y `pdf` (el del menú en PDF, como referencia).
- Si `precio` está vacío, la web dice "a completar".
- Atajo: `carta → mostrar_precios_del_pdf: si` muestra en toda la carta los precios del PDF
  donde `precio` esté vacío.

### Fotos

- Se suben a `src/assets/fotos/` (por ejemplo `src/assets/fotos/carta/`).
- En `contenido.yaml` se escribe la ruta desde esa carpeta: `carta/croissant.jpg`.
- Sirven JPG, PNG o WebP. La web las achica y las convierte a WebP sola.
- Las fotos actuales son de muestra (Unsplash, uso libre). Los nombres dicen qué
  va en cada una: para usar la real, se sube una foto con el mismo nombre.

### Logo

El logo es provisorio (`src/components/Logo.astro` y la marca del encabezado en
`src/components/Header.astro`). Cuando esté el archivo original (ideal SVG), se reemplaza ahí.

## Estructura

```
once-y-seis/
├── src/data/contenido.yaml     👈 todo el contenido (lo único que hace falta tocar)
├── src/assets/fotos/           fotos de la web
├── src/components/             secciones (portada, obsesión del mes, carta…)
├── src/lib/contenido.ts        lee y revisa contenido.yaml, arma links y precios
├── src/lib/horario.ts          horarios, cartel "Abierto ahora" y datos para Google
├── src/styles/global.css       colores, tipografías y estilos comunes
├── public/fuentes/             tipografías (Playfair Display, Oooh Baby, Montserrat)
├── tools/archivo-unico.py      arma la muestra en un solo archivo HTML para el cliente
└── vercel.json                 cabeceras de caché
```

## Para quien programa

```bash
cd once-y-seis
npm install
npm run dev      # http://localhost:4321
npm run build    # deja el sitio listo en dist/
```

Paleta (sale del menú del café): crema `#EFE6D6`, trigo `#E8E2C6`, blanco roto `#FAF6EE`,
verde salvia `#8A9A7B` (marca), salvia profunda `#55644A` (botones, 5,9:1 con blanco roto),
salvia clara `#C9CFB8`, café `#3B2A22` (texto, 11:1 sobre crema) y terracota `#9A4330` (acento).
El blanco sobre verde salvia da 3:1: no se usa para textos chicos.

Tipografías: Playfair Display (títulos), Oooh Baby (palabras manuscritas, la más parecida
a la letra del logo) y Montserrat (textos y bajadas en mayúsculas espaciadas). Licencia OFL.

## Publicación (Vercel)

- Proyecto de Vercel: **once-y-seis** (carpeta raíz `once-y-seis` del repo Tratto-app/tratto).
- Link actual: https://once-y-seis.vercel.app
- Si un cambio en `contenido.yaml` está mal escrito, la publicación falla y queda online la anterior.

## Muestra en un solo archivo (para mandar por WhatsApp o mail)

```bash
npm run build && python3 tools/archivo-unico.py dist once-y-seis-muestra.html
```
