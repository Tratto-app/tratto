# Sitio del laboratorio fotográfico

Sitio estático hecho con Astro y Tailwind. No tiene base de datos ni servidor:
cada vez que se guarda un cambio en GitHub, Vercel lo arma y lo publica solo
(tarda alrededor de un minuto).

## Cómo cambiar textos, precios, promos o fotos

Todo está en **un solo archivo**: `src/data/contenido.yaml`.

1. Abrí el archivo en GitHub y tocá el lápiz (✏️) para editarlo.
2. Cambiá lo que necesites. El archivo tiene notas en español que explican cada parte.
3. Tocá **Commit changes** (guardar). En un minuto el sitio queda actualizado.

Si algo quedó mal escrito, el cambio **no se publica** y sigue online la versión
anterior. En Vercel aparece un mensaje en español que dice qué línea revisar.

### Fotos

- Se suben a `src/assets/fotos/` (por ejemplo `src/assets/fotos/servicios/`).
- En `contenido.yaml` se escribe la ruta desde esa carpeta: `servicios/mi-foto.jpg`.
- Sirven JPG, PNG o WebP. El sitio las achica y las convierte a WebP solo.
- Las fotos actuales son de muestra (Unsplash, uso libre). Los nombres dicen qué
  va en cada una, así es fácil reemplazarlas por fotos reales del laboratorio.

## Estructura

```
lab-fotografico/
├── src/data/contenido.yaml     👈 todo el contenido (lo único que hace falta tocar)
├── src/assets/fotos/           fotos del sitio
├── src/components/             secciones (portada, promos, servicios, pantalla vs papel…)
├── src/lib/contenido.ts        lee y revisa contenido.yaml, arma los links de WhatsApp
├── src/styles/global.css       colores, tipografías y estilos comunes
├── public/fuentes/             tipografías (Instrument Serif, Instrument Sans, IBM Plex Mono)
└── vercel.json                 cabeceras de caché
```

## Para quien programa

```bash
cd lab-fotografico
npm install
npm run dev      # http://localhost:4321
npm run build    # deja el sitio listo en dist/
```

Paleta "Tintas de impresión": blanco, negro, magenta `#D1006C`, cian `#00A3E0`
(texto: `#0077B6`) y amarillo `#FFD100`. Tipografías: Instrument Serif (títulos),
Instrument Sans (textos) e IBM Plex Mono (medidas y etiquetas).

## Tienda online

El botón "Tienda online" toma el link de `negocio.tienda_online`. Si está vacío,
lleva al catálogo de WhatsApp (`negocio.catalogo_whatsapp`). Para sumar Tiendanube
alcanza con pegar el link de la tienda; para Mercado Pago se pueden agregar links de
pago por producto en el mismo archivo.
