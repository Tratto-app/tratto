# Skills y herramientas para Tratto

Configuración preparada el 11/10/2026 en la rama de coordinación. Es una
configuración del repositorio y de este entorno, no una instalación en el
celular ni un cambio de suscripción.

## Skills compartidas

La fuente de las skills vive en `.claude/skills/`. Codex las descubre mediante
enlaces relativos en `.agents/skills/`, siguiendo el formato oficial. No se
duplican instrucciones ni se mantienen dos versiones del mismo contenido.

| Skill nueva | Para qué sirve |
| --- | --- |
| `tratto-contexto` | Contexto, reparto de tareas y traspasos entre agentes |
| `tratto-app` | App principal HTML/CSS/JS y comprobación de sus recorridos |
| `tratto-growth` | CRM React/TypeScript/Vite y su build bajo `/crm/` |
| `tratto-backend` | Supabase, permisos, migraciones y Edge Functions |
| `tratto-operaciones` | n8n, integraciones, Vercel, CI y backups |

También se exponen a Codex las 14 skills existentes `contenido*` y
`disenador-marketplace`: 20 skills en total disponibles en `.agents/skills/`.
Las originales no se modifican. El CMO y `video-publicidad` siguen donde
estaban en Claude; no se ejecutan por instalar esta configuración. En
particular, la rutina de prospección Gmail queda fuera del alcance acordado.

Para usar las nuevas skills en Claude, actualizar el checkout con esta rama
o con el PR integrado y abrir una sesión que descubra sus archivos. En Codex,
trabajar desde la raíz del repo o una subcarpeta. Si la interfaz no muestra
las skills nuevas, recargar la sesión. El listado local `skills/list` de
Codex detectó las 20 skills habilitadas, sin errores de carga. No se inició
generación de otro agente ni una sesión de Claude para comprobar su selector.

## Plugins y conectores existentes

| Capacidad | Estado comprobado y uso |
| --- | --- |
| GitHub | Plugin instalado; código, historial, ramas y PRs |
| Supabase | Plugin instalado y skills oficiales disponibles; datos y backend |
| Vercel | Plugin instalado y skills oficiales disponibles; hosting y despliegues |
| Firecrawl | Plugin instalado y skill disponible; fuentes y documentación web |
| Metricool | Plugin instalado; canales y analítica conectados |
| Brevo | Herramientas conectadas y lectura de cuenta verificada en la puesta al día; no apareció como plugin independiente en la búsqueda por nombre |

Las skills oficiales de Supabase y Vercel se cargan cuando la tarea las
necesita, sin copiar su biblioteca al repo. La búsqueda no identificó un
plugin específico para n8n o para la sesión privada de Claude Code. No se
instalaron sustitutos que cambien la arquitectura de Tratto. Google Drive y
Gmail quedan excluidos; tener otras herramientas disponibles no las autoriza
para esta tarea.

## Claude Code

El CLI oficial 2.1.296 ya está instalado fuera del repo, en el entorno de
Codex. La autenticación sigue pendiente y el acceso a la sesión cloud requiere
la misma cuenta de Claude y uso disponible. Los conectores de Codex no
transfieren sus credenciales a Claude. El procedimiento y mensaje de traspaso
están en [COORDINACION-CODEX-CLAUDE.md](COORDINACION-CODEX-CLAUDE.md).

Los archivos compartidos pueden persistir al integrar el PR; el CLI y sus
credenciales locales dependen del ciclo de vida de este entorno. Actualizar
el checkout no implica autenticar herramientas ni iniciar trabajo paralelo.

## Verificación

Se verifican metadatos de las cinco skills nuevas, resolución de los veinte
enlaces, referencias locales, descubrimiento local de Codex, diff y el check
de credenciales/sintaxis del repo (571 archivos revisados). La configuración
no cambia app, esquema, campañas ni producción.

Formato y descubrimiento oficial de skills Codex:
https://developers.openai.com/codex/skills/.
