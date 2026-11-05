# Cuentas sociales y cruce de registros · 05/11/2026

Responsable: Codex. Rama: `codex/crm-identidad-social-20261105`.

El listado ya incluía cuentas Auth de Google y Apple, pero el nombre se leía
solo de `nombre`. El helper privado ahora admite `full_name` y `name` como
alternativas, sin cambiar roles ni datos de la cuenta. Cuando Apple no aporta
nombre se muestra «Nombre no informado». El listado identifica el método de
ingreso usando metadata de Auth solo para presentación, nunca autorización.

El cruce de registros descartaba teléfonos públicos locales de Buenos Aires
de diez dígitos que comienzan con11. Se reconocen como equivalentes a sus
formatos +5411/+54911. No se completan otros prefijos ni longitudes. El conteo
de identidades sigue dejando las coincidencias múltiples para revisión.

La conciliación privada de cuentas existentes queda en el informe diario del
CRM; no se publican nombres, teléfonos ni IDs de personas en este repositorio.
No se crea ninguna cuenta ni se atribuyen registros a WhatsApp sin evidencia.

Validación:7 pruebas SQL del panel y permisos;12 pruebas del observador,
incluyendo teléfono compartido;46 unitarias frontend;2 pruebas de navegador
390/1440px; build de producción. Migración de producción20261105231159.
