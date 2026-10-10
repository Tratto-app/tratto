# Tratto: contexto para agentes

Antes de trabajar, leé:

1. `docs/CONTEXTO-CODEX-CLAUDE.md`: producto, arquitectura, estado observado y fuentes.
2. `docs/COORDINACION-CODEX-CLAUDE.md`: tareas, ramas, archivos compartidos y traspasos.
3. `CLAUDE.md`: reglas existentes de contenido cuando la tarea involucre redes o marketing.

La app principal está en `index.html`. El CRM es un proyecto separado en
`growth/web/`; su salida compilada se sirve desde `crm/`. No confundas sus
arquitecturas. Verificá la fecha de la documentación y el estado actual antes
de implementar: producción y staging tienen diferencias documentadas.

Usá una rama por tarea y verificaciones proporcionales al cambio. Registrá en
el traspaso archivos, commit, pruebas, resultados y pendientes. Las
credenciales, datos de personas y backups privados quedan fuera del repo.
