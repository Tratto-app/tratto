# Don Gato Veterinaria & Pet Shop — página de muestra

Página para mostrarle al dueño de Don Gato (Calle 12 N° 4842, Berazategui) cómo
quedaría su sitio. Pensada para el celular.

```
dongato/
├── index.html            la página (CSS y JavaScript adentro)
├── logo.png              logo tal cual lo usan (recortado de su perfil)
├── og.jpg                imagen para la vista previa al compartir el link
├── favicon.png, apple-touch-icon.png
├── fotos/                productos (de sus historias destacadas de Instagram),
│                         6 fotos de su grilla y 8 de Pexels para los EJEMPLO
├── dongato-muestra.html  todo en un solo archivo, para mandar por WhatsApp
├── tools/archivo-unico.py  arma dongato-muestra.html
└── tests/e2e.mjs         89 chequeos con Playwright
```

## Dónde se cambia cada cosa

Todo está al principio de `index.html`, en el primer `<script>`:

- `CONFIG`: WhatsApp, dirección, horarios, envío, pagos, urgencias, promo del mes
  y servicios de la veterinaria (solo se ven los que tienen `confirmado: true`).
- `CATEGORIAS` y `ESPECIES`.
- `PRODUCTOS`: un renglón por producto. `precio: null` muestra "Precio a
  confirmar"; con número (`18500`) suma en el carrito. `precioAnterior` mayor al
  precio muestra la etiqueta "Oferta". `ejemplo: true` = producto de muestra.

El bloque JSON-LD del `<head>` (lo que lee Google) repite dirección, teléfono y
horarios: si cambian, actualizarlo también.

## Cómo funciona

- Carrito guardado en el navegador; el pedido sale por `wa.me/5491142165130`
  con el mensaje armado. Después de mandarlo aparece "Repetir mi último pedido".
- Turnos: formulario corto que valida domingos (cerrado) y sábados (solo mañana).
- "Abierto ahora / Cerrado ahora" con la hora de Argentina y `CONFIG.horarios`.
- Los botones de WhatsApp no usan `window.open` en el celular (el navegador de
  Instagram lo bloquea).

## Probar

```bash
cd dongato && python3 -m http.server 8765        # en una terminal
node dongato/tests/e2e.mjs                       # en otra, desde la raíz del repo
python3 dongato/tools/archivo-unico.py           # rearma dongato-muestra.html
```

## Pendiente de Don Gato ([COMPLETAR] en el código)

1. Precios de todos los productos (y precio anterior si hay ofertas).
2. Lista de su catálogo de WhatsApp con fotos, presentaciones y kilos.
3. Zona de envío y monto mínimo para el envío gratis (si hay).
4. Hasta qué hora se toman pedidos para entregar en el día.
5. Formas de pago.
6. Si atienden urgencias y con qué número.
7. Qué servicios hacen además de consultas, vacunación y desparasitación.
8. Qué venden de farmacia.
9. Productos reales de aves, roedores, peces y otros (hoy hay 8 EJEMPLO).
10. Fotos de Royal Canin seco, comedero de acero y cuello inflable.
11. Vigencia de la promo del mes.
12. Confirmar los días y horarios (salen de su historia "Nuestros horarios").
13. Código postal (WhatsApp dice B1866; Google, B1880/B1884).
14. Dominio propio (hoy está en https://dongatobegui.vercel.app).
