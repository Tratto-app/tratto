---
name: tratto-contexto
description: Puesta al día y coordinación de tareas en Tratto. Usar al retomar el proyecto, repartir trabajo entre Codex y Claude, revisar contexto o preparar un traspaso.
---

# Contexto y coordinación de Tratto

Las rutas de esta skill se resuelven desde la raíz del repositorio.

1. Leé `AGENTS.md`, `docs/CONTEXTO-CODEX-CLAUDE.md` y
   `docs/COORDINACION-CODEX-CLAUDE.md`. Contrastá sus fechas con el código y
   el estado actual; son evidencia fechada, no una garantía permanente.
2. Identificá la tarea, rama, responsable, archivos y entorno destino.
   Conservá cambios ajenos. Para trabajo simultáneo en una máquina, usá
   un worktree por agente; coordiná especialmente `index.html`, `crm/`,
   `vercel.json` y la secuencia de migraciones.
3. Elegí `tratto-app`, `tratto-growth`, `tratto-backend` o
   `tratto-operaciones` según el componente. Para contenido, leé `CLAUDE.md`
   y `.claude/skills/contenido/SKILL.md` antes de producir piezas.
4. Completá la tarea autorizada y las verificaciones necesarias. Entregá
   problema, cambio, rama/commit, archivos, pruebas y pendientes.

Google Drive y Gmail están excluidos del alcance acordado. La configuración
de herramientas no autoriza enviar mensajes, publicar campañas ni gastar.
No guardes secretos, datos de personas ni backups privados en Git.

GitHub permite compartir código y traspasos; no autentica Claude ni concede
acceso al chat privado. Solo informá que ambos agentes trabajan cuando haya
evidencia de actividad. El puente CLI requiere login de la misma cuenta de
Claude y uso disponible. Consultá `docs/CONFIGURACION-AGENTES.md`.
