# Usuarios de la app

El acceso `/crm/users` está en el primer grupo del menú, debajo de Claude / Codex.
El resumen lee las cuentas de la aplicación aunque todavía no hayan generado
un evento de marketing. No repara ni crea registros CRM y no dispara envíos.

- **Cuenta**: Auth existente y no eliminada. Se excluyen las cuentas demo por
  `app_metadata.demo` y, defensivamente, por servicios marcados como demo.
- **Oferente**: rol actual proveedor o un servicio real publicado. El rol se
  usa como dato de perfil, nunca como autorización. El resto conserva su rol
  cliente o se muestra sin tipo; una cuenta no suma en dos tipos.
- **Rubro**: servicios publicados (sin repetir el mismo rubro por cuenta), o
  rubro declarado al registrarse si todavía no publicó. Una persona con varios
  rubros puede figurar en varias barras; el total no duplica cuentas.
- **Notificaciones**: al menos una suscripción push con endpoint registrado.
  Se muestran personas y dispositivos por separado. No acredita permiso actual,
  vigencia del endpoint ni recepción final. No se envía una prueba.
- **Servicios**: registros reales en `proveedores`. **Trabajos del perfil**:
  publicaciones de tipo trabajo y estado publicado; no equivale a trabajos
  terminados, contratados ni cobrados. Los clientes muestran sus pedidos.
- **Altas**: creación de la cuenta, día de Buenos Aires. La gráfica muestra
  catorce días y el panorama general todas las fechas. Los filtros de tipo,
  búsqueda, rubro y estado sólo filtran la lista paginada (cincuenta por página).

## Datos y acceso

`growth_app_users_overview` es una RPC de sólo lectura con `search_path` vacío.
Su acceso requiere `auth.uid()`, pertenencia real en `growth_members` y el
workspace Tratto de esta aplicación. No admite consultar Auth desde otro
workspace ni como anónimo. El helper `growth_users_private.accounts` está en
un esquema privado sin USAGE/EXECUTE para clientes. El navegador recibe sólo
campos necesarios de perfil, conteos e ID de ficha CRM si existe; no recibe
metadata completa, secretos de Auth ni claves/endpoints de push.

El lint de Supabase sobre RPC SECURITY DEFINER ejecutable por authenticated
es esperado para este endpoint: el control de sesión, miembro y workspace es
obligatorio antes de leer. Las pruebas cubren rechazo anónimo/no miembro y
workspace ajeno, además de ACL del helper privado.

La página actualiza al entrar, al recuperar foco, cada minuto mientras está
visible o con Actualizar. Muestra el corte real y permite reintentar errores.
La autoactualización sólo consulta; no envía notificaciones ni mensajes.

## Verificación

- `npm test --prefix tools/app-users`: PostgreSQL local con datos sintéticos;
  cuentas sin servicio, demos/clientes, eliminadas, dispositivos múltiples,
  conteos por rubro, zona horaria, filtros, paginación y permisos.
- `npm test --prefix growth/web` y `npm run typecheck --prefix growth/web`.
- Desde `growth/web`: `npx playwright test --config playwright-users.config.ts`.
  Navegador en 390 y 1440 px, Auth/API simulados, sin datos privados ni envíos.
- Compilar `crm/` con la URL y clave pública anon de producción y
  `VITE_SOLO_MIEMBROS=1`. Verificar RPC real y assets publicados por separado.
