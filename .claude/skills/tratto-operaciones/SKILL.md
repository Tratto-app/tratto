---
name: tratto-operaciones
description: "Operación técnica de Tratto: n8n, integraciones, Vercel, CI y backups. Usar para diagnosticar webhooks, despliegues, avisos, fallos de workflows o recuperación, sin activar campañas de marketing."
---

# Operación e integraciones

Las rutas se resuelven desde la raíz. Leé el contexto y la documentación del
componente afectado antes de intervenir.

- n8n: `tools/n8n/README.md` y `tools/n8n/workflows/` son copias de referencia;
  el servicio en vivo es la fuente de verdad. Compará versiones antes de
  importar y conservá settings y credenciales. La presencia de JSON en Git
  no demuestra que un workflow esté activo ni concede acceso al servicio.
- Trazá webhooks y su autenticación, validación, idempotencia y tratamiento
  de errores. Mercado Pago, Brevo, OpenAI y las notificaciones tienen efectos
  externos; verificá con el alcance y entorno que corresponda a la tarea.
- Vercel: revisá `vercel.json`, rama, commit y destino. Aprovechá el conector
  y las skills oficiales `deployments-cicd`, `env-vars` o `vercel-cli` cuando
  apliquen. READY confirma un despliegue, no todo el flujo de negocio.
- CI: leé `.github/workflows/ci.yml` y ejecutá checks pertinentes al diff.
  Para backups, revisá `.github/workflows/backup-base.yml`, permisos, logs y
  restaurabilidad. Un fallo histórico es una pista, no un diagnóstico actual.
  Bajo `pipefail`, verificá el código de todos los procesos de una tubería.
- Cambios de contenido siguen `CLAUDE.md`; envío, publicación y gasto requieren
  el alcance autorizado. Esta skill no habilita una corrida de marketing.
  Google Drive y Gmail siguen excluidos.

Preferí diagnóstico sin efectos externos cuando aún no esté identificado el
problema. Completá arreglos reversibles autorizados, probalos y documentá
evidencia y límites. No guardes credenciales, logs con datos privados ni
backups en Git.
