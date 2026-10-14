# Recorridos de Mail y WhatsApp

Pedido del fundador del 14/10/2026: dos entradas debajo de Cerebro de las
piezas, `/crm/recorridos/mail` y `/crm/recorridos/whatsapp`.

La pantalla es de lectura, limitada al workspace autenticado. Lee los 46
rubros de `growth_mkt_rotacion`, las tarjetas `recorrido_contactos_dia`, los
prospectos de prospección/WhatsApp manual y el ajuste `prospeccion_geografia`.
Las lecturas de prospectos y calendario tienen paginación. No llama
`mkt_rubro_del_dia`, no altera contadores, no envía ni reserva contactos.

Un primer contacto Gmail requiere `datos.prospeccion.gmail_thread` y
`enviado_at`; una fecha de guardar o `contacted_at` sola no prueba un envío.
Los recordatorios aceptados se muestran aparte. Un rechazo definitivo tiene
prioridad sobre una demora anterior. Sin rebote observado no acredita
entrega final. En WhatsApp se separan las listas entregadas de la confirmación
manual de contacto; ni los enlaces ni los clics marcan un envío.

Desde el nuevo pedido, candidatos nuevos sólo de CABA con evidencia pública
de ubicación. Norte, Oeste y Sur son etapas posteriores, sin fecha ni avance
automático. Se conserva el historial previo de Provincia y las bajas.
Los barrios sin actividad registrada no equivalen a una zona completamente
inexplorada: los contactos genéricos de CABA/comuna no se asignan a barrios.
El panel no considera completado un rubro o una zona por un solo contacto.

La regla geográfica se conserva en planes y tareas futuras, en
`growth_mkt_ajustes.prospeccion_geografia`, y en los prompts vigentes de las
rutinas. Consultarla antes de investigar, incluso para reposiciones. No
completar faltantes con otras zonas ni repetir proveedores de otro canal.
