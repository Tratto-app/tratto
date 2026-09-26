# Preparación para producción

Estado al 26/09/2026. Resume qué se hizo, con qué evidencia, y qué falta.
Detalle técnico en los otros documentos de esta carpeta.

## Veredicto

- **Lanzamiento controlado (hasta ~100 usuarios con la app abierta a la vez): sí**,
  una vez resuelto el punto 1 de "Falta" (mails del matching).
- **Campaña o crecimiento rápido: no en plan Free.** Medido: la capa de API
  se satura pasados ~450 usuarios simultáneos. Pasar a Supabase Pro antes.

## Qué se cambió en producción (y cómo se verificó)

| Cambio | Evidencia |
|---|---|
| **"Borrar mi cuenta" no funcionaba** para nadie con pedidos o servicios (error de tipos). Corregido; además borra dispositivos de notificaciones y anonimiza visitas | Probado en staging con un cliente y un proveedor con datos: cuenta y datos borrados (0 filas restantes) |
| 16 índices + políticas RLS optimizadas, sin cambiar quién ve qué | Matriz de visibilidad 5 usuarios × 21 tablas idéntica antes/después; 13 pruebas de escritura iguales salvo la visita falsa (ahora rechazada, a propósito); políticas de producción con el mismo hash que staging; advisors de rendimiento: 0 advertencias (antes 44) y 0 claves foráneas sin índice (antes 9) |
| Visitas de perfil solo a nombre propio y sin repetir en 1 h | Probado por la API: falsa → 403, repetida → descartada, propia → cuenta 1 |
| Topes anti-abuso (pedidos, servicios, publicaciones, antecedentes, postulaciones, mensajes) | Probado por la API: 6.º pedido y 21.º mensaje/min rechazados con texto claro |
| Fotos: 2 MB por archivo, 20/día y 150 por usuario | Política aplicada; la app muestra el aviso |
| Tareas programadas: vencer pedidos, reintentar matching, revisar salud, limpiar historial | Probadas en staging (vencimiento; 100 reintentos con el encabezado secreto correcto y sin repetidos) y ejecutadas una vez en producción |
| Alertas por mail (n8n y base) | Aviso de prueba enviado y aceptado por el servidor de correo desde los dos caminos |
| Asistente con tope de uso | Probado: responde normal y, pasado el tope, contesta el aviso sin llamar a OpenAI |
| Funciones auxiliares de RLS no ejecutables sin sesión | Advisor 0028 resuelto para esas 5 funciones |

## Qué queda en el repositorio y necesita merge para publicarse

- `index.html`: sondeo del chat más liviano con Realtime, conteo de visitas
  por encabezado, mensajes claros cuando se llega a un tope.
- `.github/workflows/ci.yml` (revisión en cada cambio) y
  `backup-base.yml` (apagado hasta configurarlo).
- `supabase/migrations/`, `supabase/tests/`, `tools/carga/`,
  `tools/supabase-functions/`, `docs/`.

## Falta (en orden de prioridad)

| # | Qué | Quién | Por qué |
|---|---|---|---|
| 1 | **Brevo → Security → Authorized IPs: desactivar el bloqueo** (o autorizar las IPs de n8n Cloud) | Dueño | Los mails que manda el matching fallan con 401 desde el 25/09 (verificado en las ejecuciones de n8n). Las conexiones se crean, pero nadie recibe el mail |
| 2 | Mergear el PR con el frontend nuevo | Dueño | Sin eso, la app muestra "error 400" genérico cuando alguien llega a un tope |
| 3 | Rotar las credenciales indicadas en el informe privado de auditoría | Dueño | Ver SECURITY.md → "Si se filtra una credencial" |
| 4 | Activar el backup diario (DISASTER_RECOVERY.md, ~15 min) | Dueño | Hoy no hay ningún backup |
| 5 | Supabase Pro antes de cualquier campaña | Dueño | Capacidad medida (LOAD_TESTING.md) + backups + protección de contraseñas filtradas |
| 6 | Aprobar la limpieza automática de fotos | Dueño | La función está lista; la primera corrida borraría 6 fotos (756 kB) de cuentas que ya no existen. No se activó sin confirmación porque es irreversible |
| 7 | UptimeRobot + tope de gasto en OpenAI | Dueño | MONITORING.md |
| 8 | Vercel: plan que permita uso comercial | Dueño | Términos de Vercel Hobby |
| 9 | Repetir la prueba de carga con Pro y el frontend nuevo | Equipo | Confirmar la capacidad nueva con datos |

## Riesgos aceptados (conscientemente)

- Las fotos no tienen backup (tampoco en Pro).
- La vista `pedidos_abiertos` corre con permisos de su dueño (advisor 0010):
  es a propósito, muestra pedidos ajenos filtrados por rubro sin exponer datos
  de contacto. Si se toca, revisar que no agregue columnas sensibles.
- El Asistente permite 15 preguntas por IP sin sesión: en redes compartidas
  (una oficina, un celular con IP de operador) varias personas comparten ese
  tope.
