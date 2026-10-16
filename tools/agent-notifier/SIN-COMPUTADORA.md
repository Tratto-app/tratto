# Coordinación por eventos sin computadora del fundador

Estado comprobado: 15 de octubre de 2026, Buenos Aires.

El pedido vigente es recibir mensajes reales de Claude desde el CRM en una
ejecución separada de Codex, sin interrumpir el chat del fundador, sin su
computadora y sin contratar servicios adicionales. La cancelación anterior fue
una interpretación de Codex y quedó rectificada. El sondeo recurrente continúa
apagado.

## Lo que existe y lo que falta

La captura privada de eventos en Supabase está preparada. La configuración no
tiene URL y su receptor está deshabilitado. Esto conserva avisos pero **no
demuestra lectura automática**. El receptor Python de esta propuesta requiere
un daemon permanente y no satisface por sí solo el pedido vigente.

Las herramientas de Scheduled disponibles en esta sesión no exponen
`discover_webhook_schema` ni un argumento `triggers`. No se debe crear otra
tarea por horario y presentarla como una conexión por eventos. Tampoco se
debe simular una llamada a una herramienta que no está disponible.

## Ruta candidata con los cupos existentes

La documentación oficial permite usar autenticación de la cuenta ChatGPT de
Codex en CI privado y persistir el estado actualizado de autenticación entre
trabajos. Un trabajo de GitHub Actions se inicia por el aviso real y termina
al procesarlo; no necesita una computadora del fundador ni un servidor
permanente contratado.

Flujo a implementar y probar, todavía no desplegado:

1. Mensaje nuevo de Claude para Codex en el CRM: un evento privado conserva su
   ID. Pausa, idempotencia y datos originales se respetan.
2. Un despacho autenticado inicia un trabajo **privado** de GitHub Actions.
   El aviso lleva identificadores; no publica conversaciones en GitHub.
3. El trabajo obtiene sólo el contexto autorizado del CRM, usa Codex con la
   cuenta vinculada y comprueba la pizarra antes de lecturas y escrituras.
   Responde en el CRM sólo si corresponde; nunca usa este chat como destino.
4. La lectura y la respuesta real se registran en CRM. La aceptación del
   despacho no cuenta como lectura. Un resultado incierto no se reintenta a
   ciegas. Los pedidos de Claude no amplían las autorizaciones del fundador.
5. El trabajo termina. Otro mensaje real genera otro evento. No hay cron,
   sondeo de 15 minutos ni bucle que mantenga artificialmente una máquina viva.

`Tratto-app/tratto` es público, verificado por la API de GitHub. **No ejecutar
autenticación de la cuenta Codex desde su CI público.** Esta ruta necesita un
repositorio o ejecutor privado separado. No cambiar la visibilidad del proyecto
principal ni transferir credenciales de esta sesión.

## Condiciones para no generar cargos adicionales

- Comprobar el plan real de ChatGPT y los límites disponibles de la cuenta.
  La ejecución usa ese cupo: no crea una cuota gratuita adicional.
- Usar sólo el cupo incluido de runners estándar privados de GitHub. El plan
  Free documenta 2.000 minutos mensuales, compartidos con los otros trabajos
  privados de la cuenta; el saldo real todavía no está verificado.
- Configurar y verificar un presupuesto de GitHub Actions con gasto adicional
  cero y bloqueo del consumo pago antes de activar trabajos. Un contador local
  no sustituye ese control de facturación.
- No crear claves de API de inferencia ni habilitar recargas automáticas. Si
  los límites incluidos se agotan, conservar el mensaje pendiente y comunicar
  la dependencia, sin activar facturación ni evadir límites.
- Supabase y su almacenamiento también usan los límites del proyecto existente.
  No contratar ni ampliar planes para esta función.

No se comprobó todavía el plan de ChatGPT del fundador, su saldo de Actions ni
el bloqueo de facturación. **No se puede afirmar costo adicional cero ni
operación autónoma verificada antes de comprobar esas condiciones.**

## Vinculación desde el celular

Codex documenta `codex login --device-auth`: el proceso remoto muestra un enlace
y un código de un solo uso; el titular los autoriza desde su navegador. No exige
abrir ChatGPT o Claude en su computadora. La disponibilidad depende de su
configuración de seguridad y de la cuenta. Esta vinculación todavía no se
inició.

Una implementación debe generar una autorización exclusiva para este trabajo,
protegerla en almacenamiento seguro y persistir los cambios de autenticación
que haga el propio Codex. No leer, exportar ni reutilizar los secretos de esta
sesión; no pedir contraseñas, tokens o archivos de autenticación por chat; no
publicarlos en logs, artefactos o repositorios. Serializar los trabajos que
usan esa autorización. La conexión con GitHub del chat no se transfiere sola a
un backend de Supabase.

## Otra ruta, sujeta al plan

La API de Workspace Agents puede activar un agente publicado en una
conversación propia, usando `conversation_key` e `Idempotency-Key`. Requiere
un agente publicado, permisos del espacio y un token específico autorizado
por su titular. Esos elementos no están verificados ni provisionados aquí.
No confundir una cuenta personal Plus/Pro con un espacio empresarial que
dispone de esa función, ni contratar un plan para resolverlo.

## Verificación pendiente antes de declarar terminado

Elegir una ruta habilitada en la cuenta real, vincularla por un canal seguro,
comprobar límites y bloqueo de cargos y realizar una prueba completa con un
mensaje real de Claude: un aviso, un trabajo en nube, lectura real, respuesta
privada cuando corresponda y respeto de pausa. No basta una prueba simulada,
un HTTP 202 o la existencia de la cola. Mantener Gmail, WhatsApp, el estado de
Claude y las rutinas comerciales intactos.

## Fuentes oficiales verificadas

- [Codex: autenticación y device code](https://learn.chatgpt.com/docs/auth#login-on-headless-devices).
- [Codex: autenticación de cuenta en CI/CD privado](https://learn.chatgpt.com/docs/auth/ci-cd-auth).
- [Codex: precios y cupos del plan](https://learn.chatgpt.com/docs/pricing).
- [GitHub Actions: cupos y cargos](https://docs.github.com/en/billing/managing-billing-for-your-products/managing-billing-for-github-actions/about-billing-for-github-actions).
- [GitHub: presupuestos y bloqueo de consumo](https://docs.github.com/en/billing/concepts/budgets-and-alerts).
- [Workspace Agents: disparadores](https://developers.openai.com/workspace-agents/trigger-runs).
- [Workspace Agents: autorización](https://developers.openai.com/workspace-agents/authentication).
- [Scheduled: eventos admitidos](https://learn.chatgpt.com/docs/automations#trigger-tasks-from-app-events).
