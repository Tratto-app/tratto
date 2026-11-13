# Cobranza sin vueltas

Micro app para negocios chicos: carga quién debe, arma el recordatorio de
WhatsApp y cobra con un link de Mercado Pago. Se vende a un pago único y cada
negocio la corre en **sus propias cuentas gratis** (Cloudflare, Mercado Pago y,
si quiere avisos automáticos, Meta). No usa servidores ni cuentas de Tratto.

Es un producto aparte de Tratto: vive en esta carpeta y está excluido del sitio
(`.vercelignore`).

## Qué hay acá

```
cobranza/
├── dist/worker.js        👈 la app entera en un archivo: se pega en Cloudflare
├── dist/demo.html        👈 la demo: se abre sola en cualquier navegador
├── docs/MANUAL-INSTALACION.md   instalar en las cuentas de un cliente, paso a paso
├── docs/HOJA-CLIENTE.md         la hoja de una página para entregar
├── src/logica.js         reglas puras: horario, etapas de aviso, textos, lectura de listas
├── src/nucleo.js         el servidor: acceso, deudas, avisos, pagos, tareas
├── src/servicios.js      Mercado Pago, WhatsApp (API oficial) y Resend
├── src/datos.js          la base: D1 de Cloudflare o memoria (demo y pruebas)
├── src/xlsx.js           lector de planillas .xlsx sin librerías
├── src/worker.js         entrada en Cloudflare
├── web/                  las pantallas (sin librerías)
├── test/                 72 pruebas
└── tools/                armar, correr en la compu, recorrer las pantallas
```

## Las micro apps de nicho

De la misma base salen cuatro apps que corren enteras en el celular del
comprador, sin servidor: **Cuotas al día**, **Control al día**, **Libreta** y
**Combi al día**. Cada una tiene su archivo para vender y su demo en `dist/`.
Qué hace cada una, cómo se entregan y qué decirle al comprador está en
`docs/MICRO-APPS.md`. Los rubros se definen en `src/rubros.js`, la entrada es
`web/basica.js` y los datos de las demos están en `web/ejemplos.js`. La tienda que
las vende sola (páginas de venta, cobro con Mercado Pago y licencia) está en
`tienda/` y se arma en `dist/tienda/`. La tipografía es Plus Jakarta Sans
(licencia OFL), embebida en cada archivo.

## Comandos

```bash
npm install          # una vez (solo trae esbuild, para armar)
npm run probar       # las 72 pruebas, sobre memoria y sobre SQLite
npm run armar        # genera dist/worker.js y dist/demo.html
SIMULAR=1 npm run local               # la app en http://localhost:8788 sin cuentas reales
node tools/probar-pantallas.mjs       # recorrido de la app instalada con un navegador de celular
node tools/probar-nichos.mjs          # recorrido de las cuatro micro apps y sus demos
node tools/probar-tienda.mjs          # una compra completa en la tienda, con Mercado Pago simulado
node tools/tienda-local.mjs           # la tienda en http://localhost:8793 para verla
node tools/tienda-cloudflare.mjs      # la tienda lista para Cloudflare Pages en dist-cloudflare/
```

`dist/` está subido a propósito: quien instala no necesita armar nada.

## Las reglas de envío (y dónde se prueban)

| Regla | Prueba en `test/reglas.test.mjs` |
|---|---|
| Al pagar se cortan los mensajes (a mano o por Mercado Pago) | `1 · …` |
| Nadie recibe dos mensajes el mismo día | `2 · …` |
| Nada fuera de lunes a sábado de 9 a 20 (hora de Argentina) | `3 · …` |
| Quien responde BAJA no recibe más | `4 · …` |
| Secuencia: 3 días antes, el día, +3 y +7; después nada | `la secuencia completa…` |
| Solo a quien aceptó, no está en pausa y tiene celular | `no se le escribe a…` |

Las mismas reglas valen para el modo un toque y el automático: las dos usan
`avisosDelDia()` de `src/logica.js`.

## Decisiones de diseño

- **Un solo Worker** sirve pantallas, API, link de pago y avisos entrantes, y
  corre la tarea de cada 15 minutos. Así la instalación es pegar un archivo.
- **La base se crea sola** en el primer pedido (no hay que correr SQL a mano).
- **Límites del plan gratis** (100.000 pedidos y 100.000 escrituras por día,
  10 ms de procesador, 50 llamadas externas y 50 consultas por ejecución):
  los avisos automáticos salen de a 15 por tanda, la carga masiva va de a 10
  y hay una prueba que cuenta las consultas de una tanda completa.
- **Contraseña:** se estira en el navegador (PBKDF2, 600.000 vueltas) y el
  servidor guarda solo un SHA-256 de ese resultado, porque 10 ms de procesador
  no alcanzan para estirarla del lado del servidor. Sesión en una cookie
  `HttpOnly; Secure; SameSite=Strict`, cinco intentos y bloqueo de 15 minutos.
- **Claves de las cuentas** (Mercado Pago, Meta, Resend): son secretos del
  Worker. No se guardan en la base ni viajan al navegador.
- **Pagos:** el aviso de Mercado Pago se valida con su firma y, además, la app
  siempre le pregunta a Mercado Pago por el pago antes de marcar nada. El cobro
  se arma recién cuando el cliente toca "Pagar" (abrir el link no crea nada).
- **WhatsApp automático:** solo la API oficial de Meta, con mensajes aprobados
  de categoría utilidad y el link en un botón. Los avisos entrantes se validan
  con la firma de Meta. Nada de automatizar WhatsApp Web.
- **Demo:** es la app real corriendo en el navegador con datos en memoria; no
  hay servidor ni red.

## Lo que falta probar con cuentas reales

Las pruebas usan servicios simulados. `dist/worker.js` se probó además en el
motor local de Cloudflare (workerd con D1). Falta, y se hace en la primera
instalación real siguiendo el manual:

- desplegar en una cuenta real de Cloudflare y medir el procesador por pedido;
- un pago real de Mercado Pago de punta a punta;
- crear los cuatro mensajes en Meta, que los aprueben, y un envío real.

Tarifa de Meta usada en la hoja del cliente: USD 0,026 o $ 37,68 por mensaje de
utilidad a Argentina, leída de su planilla oficial vigente desde el 1/10/2026.
