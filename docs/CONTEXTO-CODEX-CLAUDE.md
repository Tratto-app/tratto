# Tratto: contexto compartido para Codex y Claude Code

Estado observado el 10/10/2026 UTC. Base de código revisada:
`e1d49f019c83a1e0666f87990e6997e8d15e95da`.

Este documento reúne evidencia del repositorio, los conectores autorizados y
el PDF «Tratto — Contexto para videos» del 27/09/2026. Del PDF se tomó el
contexto de producto; las instrucciones para grabar videos no son una tarea.
No representa una transcripción del chat privado de Claude.

## Qué hace la aplicación

Tratto conecta a personas que necesitan un servicio con proveedores
independientes de su zona y rubro. La persona publica un pedido, recibe
presupuestos con monto, alcance y plazo, conversa dentro de la app, compara y
elige. El proveedor publica servicios, arma su perfil y trayectoria, recibe
pedidos, cotiza y recibe calificaciones. El contador de trabajos cerrados por
Tratto se basa en trabajos cobrados por la app, no en cualquier presupuesto.

«Del pedido al presupuesto, sin vueltas» es la propuesta. La IA estima un
precio de referencia desde una foto o un texto y ayuda a comparar
presupuestos. Una referencia de precio no equivale a una cotización ni a una
garantía. No se promete verificación de matrículas o antecedentes.

El PDF enfoca el lanzamiento en arreglos del hogar y en zona oeste del GBA
(Tres de Febrero y alrededores), sumando proveedores antes de captar clientes.
La aplicación actual es más amplia: 46 rubros más la entrada personalizada,
con servicios de hogar, automóvil, clases, eventos, servicios digitales,
belleza, mascotas y otros. El alcance operativo del código y de la
prospección es CABA y Provincia de Buenos Aires. No inferir cobertura nacional.
Gas, electricidad y rubros profesionales regulados que requieren matrículas
no forman parte de la oferta admitida.

El cliente usa la app gratis; registrarse y publicar como proveedor no tiene
abono. La regla documentada de cobro por la app es 3 % del trabajo, con mínimo
de $1.500, más IVA cuando corresponda. Aceptar un presupuesto no cobra: el
checkout corresponde al trabajo terminado y el dinero va al proveedor con
el descuento de la comisión. El PDF del 27/09 describe Mercado Pago
en prueba. Hay código de integración y checkout; no se verificó un pago real
completo con los conectores disponibles. No convertir esa implementación en
una afirmación de cobro real ya validado.

La voz de producto es rioplatense, de vos, concreta y sin superlativos ni
números inventados. Verde bosque y latón son la identidad; para piezas nuevas
mandan los archivos y reglas actuales del repo sobre la guía histórica.

## Código y despliegue

| Componente | Implementación y ubicación |
| --- | --- |
| App principal | SPA HTML/CSS/JavaScript en `index.html`, un archivo de aproximadamente 334 KB; no es una app React |
| Hosting | Vercel, `vercel.json`, dominio `https://www.trattoapp.com.ar` |
| Datos y seguridad | Supabase PostgreSQL 17, Auth, PostgREST, RLS, triggers, RPC, Storage y Realtime |
| Integraciones de la app | n8n Cloud; workflows y herramientas bajo `tools/n8n/`; OpenAI, Mercado Pago y Brevo según código/documentación |
| Avisos | Edge Function `quick-service`, email y push, incluyendo APNs; triggers de la base |
| CRM Growth OS | React 19 + TypeScript + Vite en `growth/web/`; build versionado en `crm/`, servido en `/crm/` |
| Backend CRM | `growth/supabase/functions/`, migraciones propias y migraciones CRM de la raíz |
| Android | TWA en `tools/android-twa/` |
| iOS | Capacitor en `tools/ios-app/`, bundle `ar.com.trattoapp`, build en `codemagic.yaml` |
| Calidad y recuperación | `.github/workflows/ci.yml`, `backup-base.yml`, pruebas Supabase y Growth, herramientas de auditoría |

La app principal lee y escribe Supabase directamente. Las reglas que protegen
datos y negocio viven en la base; no basta con validarlas en JavaScript.
RLS habilitado no demuestra por sí solo que todas las políticas sean correctas.
El chat usa `mensajes` y Realtime. Matching/notificaciones combinan triggers,
funciones y n8n; no se accedió al servicio n8n en vivo durante esta revisión.

Producción Vercel estaba READY en `main` con el SHA base indicado. El preview
de `claude/skill-designer-marketplace-qpsh5p` estaba READY con el mismo SHA.
Los últimos 20 despliegues listados estaban READY. La lectura de logs de build
y errores runtime respondió 403: READY acredita despliegue listo, no una
prueba de todos los flujos de negocio.

Los commits de esa rama incluyen el enlace exacto de la sesión del fundador:
https://claude.ai/code/session_01QYJkG6xcivQMJL8kfTpBMv.
Eso vincula el trabajo a la sesión; no concede acceso a su historial privado.

## Supabase: separar producción y staging

| | Producción | Staging |
| --- | --- | --- |
| Proyecto | MarketPlace Servicios | Tratto Staging |
| Ref | `qglsonbcsncgekzbfafk` | `hbnwrlflgpupeqnqajzo` |
| Estado consultado | ACTIVE_HEALTHY | ACTIVE_HEALTHY |
| Región | sa-east-1 | sa-east-1 |
| Tablas públicas | 60 | 54 |
| Migraciones registradas | 81 | 35 |
| Última migración | 09/10, `prospeccion_meta_maxima_promedio` | 02/10, `growth_prospect_created_filtro` |
| Publicación Realtime de `mensajes` | Sí | No observada |

En staging faltan `precios_referencia`, `radar_redes`,
`calculadora_respuestas`, `growth_mkt_items`, `growth_mkt_rotacion` y
`growth_mkt_ajustes`, además de columnas y métricas posteriores. Todas las
tablas públicas listadas tienen RLS habilitado. Staging no es hoy una réplica
completa del CRM, la calculadora ni marketing de producción.

Núcleo: `solicitudes`, `proveedores`, `matches`, `interesados`, `mensajes`,
perfil, publicaciones, reputación, bloqueos/reportes, conexión Mercado Pago y
dispositivos de notificaciones. El esquema admite cupo 5 por solicitud; el PDF
describe hasta 3 conexiones iniciales y postulaciones hasta ese cupo. No se
revalidó el matching externo en vivo.

## Captación y operación comercial

Desde el 07/10 el CRM está en producción en
https://www.trattoapp.com.ar/crm/ . Captura calculadora, registro, pedidos,
confirmación de email, permisos, sesiones y primera acción mediante triggers.
Está organizado por workspace, con miembros y RLS, fuentes, prospectos,
campañas, links medidos, automatizaciones, activación y retención.

El CRM separa clientes y proveedores. Las automatizaciones de Brevo solo
escriben a contactos con opt-in y contemplan bajas. Código con canales
WhatsApp, SMS e Instagram no equivale a que estén configurados y probados.
La documentación de Growth describe su IA por reglas cuando falta OpenAI;
esto es distinto de la IA de la app principal integrada mediante n8n.

Claude ya tiene un CMO y departamentos de redes, SEO local, contenido,
anuncios y operaciones definidos en `.claude/`. La cola está en
`growth_mkt_items` y la aprobación del fundador en `/crm/equipo`.
Preparar contenido no autoriza a publicarlo. Se conservan las reglas actuales
de aprobación, humanizador, links y programación manual de Metricool.

La prospección documentada rota los 46 rubros y zonas de CABA/PBA, usa solo
direcciones publicadas por el propio negocio, un contacto por dirección y
pausa ante bajas/rebotes/límites. Los cambios del 09/10 distinguen mails
entregados de rebotes y calculan la meta según presupuesto diario Firecrawl
dividido por créditos por mail, con máximo de 300 mails entregados por día;
si la cuenta no está sana, la meta vuelve a 70. El tope 300 es de mails, no de
créditos. Este resumen no
reactiva ese proceso ni verifica su estado diario. Gmail y Google Drive fueron
excluidos expresamente de esta puesta al día; la prospección no se ejecutó.

## Conectores revisados

| Conector | Qué se pudo verificar |
| --- | --- |
| GitHub | Acceso al repo, código, documentos, ramas, historial de PRs y Actions |
| Supabase | Dos proyectos, esquema, migraciones, funciones, cron y buckets; sin leer filas de personas ni secretos |
| Vercel | Proyecto, dominios, repositorio y despliegues; logs y ciertos datos de equipo/runtime limitados por 403 |
| Brevo | SMTP habilitado y remitente activo `info@trattoapp.com.ar`; 0 campañas visibles; endpoint plantillas devolvió un objeto vacío |
| Metricool | Marca `trattoapp`, Instagram `@trattoapp_`, TikTok `@trattoapp`, zona Buenos Aires |
| Firecrawl | Conexión operativa; sin monitores guardados; lectura actual de la web pública, HTTP 200 |

La guía PDF usa handles genéricos anteriores; para Instagram se verificó
`@trattoapp_`. La cuenta conserva el nombre PropuestaYA en servicios. Sites
no devolvió proyectos; no es el hosting de Tratto observado. Remotion aporta
guías para video, no historial técnico de la aplicación, y no se utilizó para
generar contenido. Google Drive y Gmail no se consultaron.

## Pendientes y límites importantes

1. **Backup del 10/10 falló.** [Run 38053569057](https://github.com/Tratto-app/tratto/actions/runs/38053569057):
   error `pg_restore: could not write to file: Broken pipe`, seguido por el
   aviso de que falta `solicitudes`. El pipeline `pg_restore --list | grep -q`
   bajo `pipefail` puede producir ese falso negativo: `grep -q` corta la
   lectura al encontrar la tabla. Es una causa probable, no una prueba de
   pérdida de datos. Último éxito visible: [09/10](https://github.com/Tratto-app/tratto/actions/runs/37937992799).
   No se descargaron backups ni se reejecutó el workflow.
2. **Staging atrasado.** Antes de probar cambios del CRM, preparar un plan
   de paridad y datos de prueba, incluyendo Realtime. No aplicar automáticamente
   migraciones de producción por el solo hecho de encontrar diferencias.
3. **PR de contenido pendiente.** [PR #59](https://github.com/Tratto-app/tratto/pull/59)
   requiere aprobación de las piezas en `/crm/equipo`; no fusionar por este
   onboarding.
4. **Tiendas y pagos.** Hay paquetes Android/iOS y documentos de revisión de
   Apple, pero no acceso a Play Console/App Store Connect ni prueba actual de
   cobro real completo. No anunciar publicación o pago validado sin evidencia.
5. **Documentación histórica.** `docs/ARCHITECTURE.md` y algunas listas de
   pendientes de septiembre describen estados anteriores. Para cambios
   actuales contrastar con código, migraciones y evidencia de conectores.

El clone revisado tiene 288 commits alcanzables desde main, desde el
16/08/2026 hasta el 09/10/2026. No se recuperaron mensajes privados anteriores
ni los cuatro meses completos de conversaciones. Las decisiones que no
quedaron en esos archivos siguen siendo una brecha de contexto.

## Fuentes para continuar

- [Arquitectura principal](ARCHITECTURE.md), [estado de producción histórico](PRODUCTION_READINESS.md), [recuperación](DISASTER_RECOVERY.md).
- [Growth README](../growth/README.md), [captación](../growth/docs/CAPTACION.md), [integraciones](../growth/docs/INTEGRACIONES.md).
- [Equipo de marketing](../growth/docs/EQUIPO-MARKETING.md), [agente de prospección](../.claude/agents/mkt-prospeccion.md), [reglas Claude](../CLAUDE.md).
- [Rama de Claude](https://github.com/Tratto-app/tratto/tree/claude/skill-designer-marketplace-qpsh5p), [aplicación](https://www.trattoapp.com.ar).
- PDF proporcionado por el fundador: 6 páginas, versión 27/09/2026; contexto de producto, público, lanzamiento, voz y restricciones de promesas.

Actualizar este documento al cambiar producción, decisiones de producto o
evidencia de integraciones. Registrar fecha y commit; no mantener afirmaciones
de implementación como si fueran pruebas en vivo.
