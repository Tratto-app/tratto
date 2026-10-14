---
name: tratto-growth
description: Desarrollo del CRM Growth OS de Tratto. Usar para React, TypeScript, Vite, pantallas del CRM, automatizaciones del CRM y su build publicado bajo /crm/.
---

# Growth OS

Las rutas se resuelven desde la raíz. Leé `AGENTS.md`, `growth/README.md` y
el contexto fechado antes de editar.

1. Editá fuentes en `growth/web/`, no el JavaScript compilado de `crm/`.
   Identificá el contrato de datos y la Edge Function o RPC del flujo.
2. Conservá React/TypeScript/Vite y la separación de workspaces y roles.
   Para backend, usá `tratto-backend`. Si están disponibles las skills
   oficiales de Vercel, aplicá `react-best-practices` al editar varios TSX
   y `verification` para una comprobación completa del recorrido.
3. Descubrí los scripts actuales en `growth/web/package.json`. Instalá con
   `npm ci` cuando haga falta, conservando el lockfile. Según el cambio,
   ejecutá allí `npm run typecheck`, `npm test` y `npm run build`.
4. `npm run build:crm` escribe el build versionado en `crm/`. Usalo solo
   cuando la tarea incluya actualizar esa salida, con base `/crm/` y las
   variables del entorno destino. No publiques un build apuntando a staging
   como si fuera producción. No expongas secretos en variables `VITE_*`.
5. Revisá `growth/web/playwright.config.ts` y `growth/tests/` antes de e2e.
   Las pruebas con una base real requieren datos/cuenta de prueba y pueden
   escribir o disparar automatizaciones: elegí el entorno y alcance adecuados.
   Un build local con valores ficticios no valida envíos ni integraciones.

Resumí archivos fuente/build modificados, entorno, resultados y pendientes.
La aprobación para desarrollar no equivale a autorización para enviar
campañas, publicar contenido o ejecutar automatizaciones contra personas.
