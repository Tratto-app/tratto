---
name: qa-web
description: Checklist de control de calidad para sitios web antes de publicar. Se usa cuando se termina una sección, antes de un deploy, o cuando se pide revisar, testear o validar un sitio.
---

# QA web

Corré esto con Playwright y Lighthouse. Devolvé **una lista de hallazgos con su
ubicación exacta**, no un "está todo bien". Si no encontraste nada, buscá mejor.

## 1. Datos

- [ ] Un solo número de teléfono en todo el sitio, y coincide con el confirmado
- [ ] Los horarios del sitio coinciden con los de Google
- [ ] La dirección está escrita idéntico en todos lados
- [ ] Ningún texto placeholder, ningún lorem ipsum, ninguna fecha vencida
- [ ] Ningún dato inventado: reseñas, estadísticas, nombres

## 2. Links

- [ ] Todos los links de WhatsApp abren con el mensaje pre-cargado correcto
- [ ] El badge de Google linkea a la ficha real
- [ ] Los links de Instagram funcionan
- [ ] Ningún link roto, ningún `href="#"` olvidado

## 3. Responsive

Capturá en 320, 390, 768 y 1440.

- [ ] Cero scroll horizontal en 320px
- [ ] Ningún texto cortado ni superpuesto
- [ ] Los targets táctiles miden 44×44 px como mínimo
- [ ] El CTA sticky no tapa contenido ni el footer

## 4. Accesibilidad

- [ ] Navegación completa con Tab, en orden lógico
- [ ] Foco siempre visible, nunca `outline: none` sin reemplazo
- [ ] Contraste AA mínimo en todo texto — medilo, no lo estimes
- [ ] Todas las imágenes con `alt`; las decorativas con `alt=""`
- [ ] Jerarquía de headings sin saltos
- [ ] `prefers-reduced-motion` desactiva de verdad las animaciones
- [ ] Los botones son `<button>` y los links son `<a>`

## 5. Rendimiento

`npx lighthouse <url> --form-factor=mobile --quiet`

- [ ] Los cuatro puntajes ≥ 95 — reportá los cuatro números
- [ ] LCP < 2,0 s
- [ ] CLS < 0,1
- [ ] Todas las imágenes en WebP con `width` y `height` declarados
- [ ] Nada bloqueando el render arriba del fold

Medí siempre contra un servidor con compresión: sin gzip o brotli los números no
se parecen a los de producción y te mandan a optimizar lo que no hace falta.

## 6. SEO

- [ ] JSON-LD válido en el Rich Results Test
- [ ] Un solo `<h1>`
- [ ] Title y meta description dentro de largo
- [ ] `og:image` carga y se ve bien
- [ ] `sitemap.xml` y `robots.txt` presentes

## 7. Consola

- [ ] Cero errores en la consola del navegador
- [ ] Cero requests fallidos en la pestaña de red

## Formato del reporte

Para cada hallazgo: qué está mal, dónde exactamente (archivo y línea o sección y
viewport), y qué tan grave es (bloqueante / importante / menor). Nada más.
