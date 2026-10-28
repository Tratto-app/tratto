# Pruebas de acuerdos y calificaciones

Desde esta carpeta:

```sh
npm ci --no-audit --no-fund
npx playwright install --with-deps chromium
npm test
```

La suite usa las migraciones SQL reales con PostgreSQL aislado (PGlite), los
archivos reales `index.html` y `servicio-acuerdos.js`, y un navegador Chromium.
Los flujos de navegador tienen un backend simulado y bloquean las conexiones
externas: no envían mensajes, correos, pagos, notificaciones ni datos de personas.
No prueban Mercado Pago ni el procesamiento de IA reales.

- `backend.test.mjs`: roles, RLS, versiones, aceptación de adicionales sin
  modificar el original, estados de retiro, reclamos y limpieza privada.
- `rating.test.mjs`: solo el cliente del trabajo terminado puede calificar;
  idempotencia y permisos sin IA.
- `browser.test.mjs`: móvil de 320 y 390 píxeles, uso por teclado, visitas,
  adicionales, retiros, reclamos, errores, XSS, consentimiento opcional de IA,
  carga JPEG privada y URL firmada, y cambios de chat durante una operación.
- `../confianza-ui.test.mjs`: referencias privadas, URLs firmadas, constancias
  y mensajes de error que no aseguran resultados desconocidos.

La validación de producción y la implementación de estas migraciones se hacen
por separado. Pasar esta suite no demuestra identidad verificada, entrega de
notificaciones, cobros ni respuesta de soporte.
