# Piezas gráficas de lanzamiento

Con la misma identidad que la app: verde bosque, latón e IBM Plex.

| Archivo | Uso | Tamaño |
|---|---|---|
| `01-foto-de-perfil.png` | Foto de perfil de Instagram, Facebook, TikTok y WhatsApp | 1080×1080 |
| `02-portada-facebook.png` | Portada de la página de Facebook | 1640×624 |
| `03-post-presentacion.png` | Primer post: qué es Tratto | 1080×1350 |
| `04-post-como-funciona.png` | Cómo funciona en 3 pasos | 1080×1350 |
| `05-post-proveedores.png` | Para sumar proveedores | 1080×1350 |
| `06-cartel-proveedores-A4` | Cartel para ferreterías y corralones (PDF para imprimir, PNG a 300 dpi) | A4 |
| `07-cartel-vecinos-A4` | Cartel para comercios del barrio | A4 |

Los QR de los carteles llevan a `trattoapp.com.ar` con
`utm_source=cartel&utm_medium=qr&utm_campaign=proveedores|vecinos`, así Vercel
Analytics muestra cuánta gente entró por cada cartel. Se verificó que se
leen bien y que la redirección a `www` conserva esos parámetros.

Para cambiar un texto: editar `piezas.html` y correr `python3 render.py`
(Playwright + Chromium). Las imágenes quedan en `salida/`.
