# Coordinación de Codex y Claude Code

Preparado el 10/10/2026 para el repositorio `Tratto-app/tratto` y la sesión
https://claude.ai/code/session_01QYJkG6xcivQMJL8kfTpBMv.

## Estado concreto

- Codex recuperó contexto del código, historial y conectores y leyó el PDF.
- El contexto compartido está en [CONTEXTO-CODEX-CLAUDE.md](CONTEXTO-CODEX-CLAUDE.md).
- La rama de trabajo de Claude observada es
  `claude/skill-designer-marketplace-qpsh5p`.
- Se propone compartir cambios por GitHub mediante ramas y PRs. GitHub
  conectado no autentica automáticamente la cuenta de Claude.
- El fundador indicó que Claude no tiene uso disponible hasta el martes.
  Esta preparación no significa que Claude esté ejecutando tareas ni que se
  haya leído su chat privado.
- Se instaló el CLI oficial Claude Code 2.1.296 en el entorno de Codex, fuera
  del repositorio. `claude --version` funcionó; `claude auth status --text`
  informó `Not logged in`. No se inició login, generación ni envío de mensajes.

## Dos carriles con tareas separadas

Propuesta de reparto inicial, sin iniciar cambios funcionales por este documento:

| Agente | Próximo trabajo propuesto | Archivos/recursos |
| --- | --- | --- |
| Codex | Diagnóstico y arreglo verificable de la verificación del backup; luego plan de paridad staging/producción | `.github/workflows/backup-base.yml`, pruebas específicas, documentos de paridad |
| Claude Code | Continuar las tareas de producto/captación ya acordadas con el fundador, conservando aprobaciones vigentes | Rama Claude existente; marketing, CRM y piezas pendientes según la tarea elegida |

Una tarea tiene un responsable, una rama y alcance de archivos. Antes de
empezar otra, registrar el reparto concreto. No inferir autorización de envío,
publicación o gasto de esta propuesta. Para esta puesta al día Gmail y Drive
están excluidos; un trabajo posterior que los necesite debe tener alcance
autorizado por el fundador.

## Cómo compartir trabajo

1. Cada agente lee el contexto, esta coordinación y las instrucciones del
   repo antes de editar.
2. Usa su propia rama; si ambos corren en la misma máquina, un `git worktree`
   por agente. En las sesiones cloud separadas, cada una tiene su checkout.
3. Antes de integrar, obtiene el main actual y revisa las diferencias. No
   pisa ni reescribe la rama del otro agente.
4. Entrega un PR con problema, cambio, pruebas, riesgos y pendientes. El otro
   agente puede revisar el diff y sus resultados desde GitHub.
5. Integrar una tarea por vez y actualizar el contexto si cambió el producto
   o infraestructura. La sesión cloud existente de Claude no se sincroniza
   automáticamente con main: al retomar debe actualizar su checkout.

Los archivos `index.html`, `vercel.json`, el build `crm/` y las migraciones
necesitan un responsable por tarea cuando ambos trabajos los involucren.
Para CRM se edita `growth/web/`; se recompila `crm/` con las variables del
entorno correspondiente. No confundir un build para staging con producción.
Las migraciones se coordinan también por base destino y secuencia, no solo
por nombre de archivo.

## Verificaciones proporcionales

- Documentación: comprobar enlaces, exactitud, ausencia de secretos y diff.
- App principal: `python3 tools/ci/revisar.py` y pruebas del flujo modificado.
- CRM: typecheck, unitarios/build; e2e si el flujo lo exige y hay entorno de
  prueba apropiado. Un build listo no prueba que todas las integraciones estén
  configuradas.
- Supabase: pruebas de permisos y comportamiento en un entorno con el esquema
  necesario; staging tiene diferencias inventariadas.
- Contenido: seguir `CLAUDE.md`, su pipeline y el estado de aprobación existente.

## Traspaso mínimo por tarea

```text
Tarea y responsable:
Rama y commit:
Archivos o recursos modificados:
Qué cambió y por qué:
Pruebas ejecutadas y resultados:
Pendientes o bloqueos:
Archivos que el otro agente debe evitar mientras esta tarea esté activa:
```

Los registros de tarea viven con el PR o en documentación de la rama. No se
guardan claves, tokens/cookies de sesión, conversaciones de clientes ni dumps
en el repositorio.

## Puente oficial hacia la sesión Claude

El CLI oficial admite encolar un mensaje en una sesión cloud existente:

```bash
claude -p "mensaje de coordinación" --cloud session_01QYJkG6xcivQMJL8kfTpBMv
```

Requiere `claude auth login` con la misma cuenta de Claude. Una clave API de
Anthropic y la autorización de GitHub no reemplazan ese login para una sesión
cloud. El comando envía un mensaje y termina; no espera ni confirma que el
trabajo haya terminado. No se ejecutó durante la puesta al día.

`claude --teleport <session-id>` puede traer la rama y el historial a una
copia local, pero los turnos locales posteriores no se reflejan en la sesión
web. No equivale a mantener dos agentes sincronizados en la misma conversación.

Fuentes oficiales: [mensajes a sesiones cloud](https://code.claude.com/docs/en/claude-code-on-the-web#send-follow-ups-from-the-cli),
[teleport](https://code.claude.com/docs/en/claude-code-on-the-web#continue-a-cloud-session-in-your-terminal).

## Mensaje listo para que Claude retome

```text
Codex revisó GitHub, Supabase, Vercel, Brevo, Metricool y Firecrawl y leyó el
PDF de contexto. Leé los archivos docs/CONTEXTO-CODEX-CLAUDE.md y
docs/COORDINACION-CODEX-CLAUDE.md de la rama
codex/contexto-coordinacion-2026-10-10 (o su PR) antes de continuar.
Actualizá tu checkout con el main actual y conservá tus cambios pendientes.
El reparto propuesto deja backup/paridad a Codex y tus tareas de
producto/captación en tu rama. Confirmá la tarea que vas a tomar y los archivos
que editarás para evitar superposición. Conservá la aprobación pendiente del
PR #59 y las reglas de publicación/envío del proyecto.
```

La coordinación por repositorio queda preparada. Para la comunicación directa
desde este entorno falta la autenticación de Claude; para que Claude ejecute
tareas también debe tener uso disponible.
