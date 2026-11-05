# Desglose de cuentas del CRM · 05/11/2026

Responsable: Codex. Rama: `codex/crm-cuentas-desglose-20261105`.

La consulta de producción `growth_users_private.accounts()` devuelve 59 cuentas:
51 oferentes, 4 clientes y 4 sin tipo guardado. Las cuatro últimas son cuentas
Auth reales sin servicio publicado ni rol de cliente/proveedor reconocido.
No corresponde asignarles un rol para hacer coincidir los contadores.

`growth/web/src/pages/AppUsers.tsx` muestra las tres categorías como métricas,
explica la suma junto al total y permite filtrar las cuentas sin perfil definido.
Se preservan la RPC, las cuentas y las configuraciones de envíos. El build
versionado de `crm/` usa la configuración pública de producción existente.

Validación: TypeScript, 46 pruebas unitarias, pruebas de navegador a 390 y
1440 píxeles (Auth/datos simulados), build de producción y revisión del repo.
La consulta real confirma que las tres categorías suman el total.
