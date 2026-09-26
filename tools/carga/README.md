# Prueba de carga

Scripts de `docs/LOAD_TESTING.md`. **Solo contra staging** (el script se
niega a correr contra la URL de producción).

- `login.py <dir> <clientes> <proveedores>`: inicia sesión con los usuarios
  de prueba `carga<N>@staging.trattoapp.test` y guarda los tokens en
  `<dir>/.tokens.json`. Supabase limita los logins por IP: 1.000 sesiones
  tardan ~8–12 min. Los tokens duran 1 hora.
- `carga.py <dir> <VUs> <meseta_s> <rampa_s> <salida.json>`: simula la app.

`<dir>` es una carpeta fuera del repo con `.env` (`URL=` y `ANON=` de
staging) y `.pass` (la contraseña de los usuarios de prueba). Nunca
versionar esa carpeta.
