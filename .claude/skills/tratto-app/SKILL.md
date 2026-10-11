---
name: tratto-app
description: Desarrollo y revisión de la app principal de Tratto en index.html. Usar para solicitudes, presupuestos, chat, perfiles, calculadora, pagos o interfaz del marketplace; el CRM tiene otra skill.
---

# App principal

Las rutas se resuelven desde la raíz. Leé `AGENTS.md` y el contexto compartido.

- La app es HTML/CSS/JavaScript en `index.html`; no introduzcas una migración
  de framework incidental. El CRM React está en `growth/web/`.
- Trazá el flujo afectado: acción de usuario → Supabase o webhook n8n →
  respuesta → interfaz. Leé las funciones concretas y sus llamadas antes de
  editar; coordiná la propiedad del archivo con el otro agente.
- Para cambios visuales aplicá `.claude/skills/disenador-marketplace/SKILL.md`.
  Mantené las variables y tipografías actuales y el español rioplatense.
- Para datos, permisos o Realtime aplicá `tratto-backend`; para webhooks,
  Mercado Pago o avisos aplicá también `tratto-operaciones`. La validación
  en el navegador no sustituye las reglas de acceso del backend.
- Corré `python3 tools/ci/revisar.py` y verificá el recorrido modificado en
  navegador con usuarios/datos de prueba y el entorno identificado. Incluí
  errores, permisos y estados vacíos cuando correspondan al cambio.
- Distinguí implementación de verificación real: un checkout implementado
  no prueba que un cobro haya ocurrido. No hagas pagos reales para un smoke
  test ni prometas coberturas o verificaciones que el producto no ofrece.

Entregá qué cambió, el flujo probado, resultados y límites concretos. Si una
dependencia no es accesible, avanzá con el trabajo independiente y registrá
esa parte como pendiente de verificación.
