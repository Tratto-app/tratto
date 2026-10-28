# Revisión de acuerdos y privacidad — 28/10/2026

## Alcance de esta revisión

Se agregan explicaciones de herramientas voluntarias que se aceptan por operación: visita con persona
nombrada y foto declarada opcional, coordinación de horario, adicional separado, recibo de retiro y
expediente de reclamo. No se modifica la comisión, se reescribe un acuerdo anterior ni se habilitan
cobros por aceptar un aviso. La guía pública `confianza.html` enlaza los contratos completos.

Los términos ya prevén aviso de 10 días por correo y aplicación para cambios sustanciales (30 días para
comisiones). La revisión y el aviso de perfil no sustituyen ese procedimiento ni prueban aceptación.
No se enviaron correos por esta tarea. Una futura modificación sustancial debe completar el aviso
exigido y, cuando corresponda, la aceptación expresa antes de aplicarse.

## Correspondencia con el código

- `servicio_proponer` requiere un presupuesto aceptado no terminado ni pagado; propone el Proveedor.
  El Cliente acepta explícitamente. Persona/horario sustituidos requieren propuesta nueva.
- No hay comprobación documental, antecedentes, reconocimiento facial, seguimiento GPS ni seguro.
- Un adicional aceptado crea un presupuesto independiente, sin modificar el base ni su pago.
- El retiro tiene constancia descargable. La devolución se confirma por el Cliente; no es una renuncia
  a reclamar. Ninguna acción entrega dinero o certifica la calidad de lo recibido.
- Las pruebas nuevas se guardan en `servicio-evidencias`, privado, con enlaces temporarios y acceso
  restringido a participantes; soporte puede intervenir mediante mecanismo privilegiado.
- Soporte cambia estados con explicación mediante `servicio_soporte_reclamo`; no se presenta una
  resolución automática, atención 24x7 ni un reembolso garantizado. Los expedientes resueltos/cerrados
  no se reabren desde el cliente; se puede acudir a soporte o abrir otro caso.
- La calificación con estrellas/comentario tiene circuito sin IA. Generar etiquetas es opcional.
- `borrar_mi_cuenta` elimina mensajes/matches/perfiles/Auth. No existe un archivo de chat de cinco años
  ni una conservación de cuenta de treinta días. El trigger nuevo resguarda solo reclamos abiertos o
  retiros sin devolución por 180 días en esquema privado; excluye columnas de usuario, perfil, fotos
  y chat general, pero el texto libre puede identificar, por lo que no se lo llama anónimo.
- La purga diaria elimina resguardos vencidos y expedientes resueltos/cerrados de 180 días. Fotos se
  encolan y la función de limpieza elimina mediante Storage API antes de confirmar la tarea.
- Las visitas a perfiles no tienen tarea de agregación/borrado a treinta días: se corrige esa promesa.
  La baja del visitante quita su vínculo, y la del perfil visitado elimina esas visitas.
- App principal y legales sirven fuentes/SDK locales. No se amplía esa afirmación a cada herramienta
  o página independiente de todo el dominio.

## Controles y límites operativos

La documentación no acredita que una notificación por correo haya sido recibida ni que un operador
haya revisado un caso. La cola de reclamos requiere supervisión humana. El contacto legal vigente se
conserva (`trattoapp1@gmail.com`); que marketing envíe desde otra cuenta no cambia este domicilio.

Se mantienen las cláusulas previas de procedimientos de impago y atención humana. Esta revisión no
implementa de nuevo ese circuito ni demuestra su ejecución. Las obligaciones fiscales se describen
como conservación de documentos efectivamente emitidos según ley, no como evidencia de que exista un
archivo fiscal independiente en la base. Antes de anunciar esos mecanismos como automatizados debe
comprobarse su funcionamiento operativo específico.
