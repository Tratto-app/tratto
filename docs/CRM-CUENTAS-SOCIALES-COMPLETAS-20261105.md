# Fichas completas de cuentas sociales · 05/11/2026 Buenos Aires

Responsable: Codex. Rama: `codex/crm-social-cuentas-completas-20261105`.

El listado muestra servicios, trabajos del perfil y pedidos para todas las
cuentas, incluidas las que todavía no tienen tipo de perfil. Son cantidades
reales por Auth user_id; no se supone que una cuenta haya publicado un servicio.

Los nombres disponibles de Google/Apple se sincronizan con la ficha CRM al
crear la cuenta y al cambiar sus datos de perfil. Se recuperan nombres ausentes
de fichas existentes. Los nombres editados manualmente se conservan. La
sincronización solo escribe growth_app_users.name: no modifica roles,
consentimientos, registros, activaciones, campañas, colas ni eventos.

El ingreso nativo conserva el nombre que Apple entrega fuera del token la
primera vez, sin marcar el formulario completo ni aceptar términos. Un fallo
de esa escritura no invalida la sesión y la espera tiene un límite de5 segundos.
Si Apple no entrega nombre, el CRM lo indica; puede usar un nombre real
confirmado manualmente en la ficha sin modificar la identidad Auth.

Pruebas:8 SQL de cuentas/permisos/sincronización;46 unitarias del panel;
2 navegador390/1440px;8 recuperación Auth;3 nombre social; build CRM y revisión
de sintaxis de la app. Migración aplicada20261106012212. Sin datos de personas
ni credenciales en este documento.
