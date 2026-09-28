# Recuperación ante desastres

## Qué se respalda y qué no

| Dato | Respaldo hoy | Nota |
|---|---|---|
| Base (tablas de la app, `privado`) | **Ninguno automático en plan Free.** Workflow `backup-base.yml` listo, apagado hasta configurarlo (abajo) | Con Supabase Pro: backup diario de 7 días incluido |
| Cuentas (`auth.users`, `auth.identities`) | Mismo workflow, archivo aparte | Incluye hashes de contraseña: el backup es tan sensible como la base |
| Fotos (Storage) | **Ninguno** | Ni Pro las respalda. Si se pierden, se pierden. Riesgo aceptado por ahora (son fotos de pedidos y publicaciones, no documentos) |
| Código web | Git (GitHub) + deploys de Vercel | |
| Workflows de n8n | Copias manuales | Descargar cada workflow antes de tocarlo |
| Secretos | Solo en los paneles (Supabase, n8n, Vercel, Brevo, MP) | Guardarlos en un gestor de contraseñas |

**Objetivos (propuestos, a confirmar por el dueño):** RPO 24 h (se puede
perder hasta un día de datos), RTO 4 h (volver a funcionar en 4 horas).

## Activar el backup diario (una sola vez, ~15 min)

1. Instalar `age` en tu computadora (https://age-encryption.org) y crear el par:
   `age-keygen -o tratto-backup.key` → muestra la clave pública (`age1...`).
   **Guardá `tratto-backup.key` fuera de GitHub** (gestor de contraseñas + una
   copia offline). Sin esa clave los backups no se pueden abrir.
2. Supabase → Project Settings → Database → Connection string → **Session
   pooler** (URI). Reemplazar `[YOUR-PASSWORD]` por la contraseña de la base.
3. GitHub → el repo → Settings → Secrets and variables → Actions:
   - Secret `SUPABASE_DB_URL` = la URI del paso 2
   - Secret `BACKUP_AGE_RECIPIENT` = la clave pública `age1...`
   - Variable `BACKUP_ACTIVO` = `si`
4. Actions → "Backup de la base" → *Run workflow*. Tiene que terminar en verde
   y dejar un artefacto `backup-base`.

El workflow verifica cada backup (`pg_restore --list` y que tenga la tabla
`solicitudes`) antes de cifrarlo. Guarda 30 días.

## Restaurar (probarlo una vez por trimestre en staging)

1. Descargar el artefacto de Actions y descifrar:
   `age -d -i tratto-backup.key -o b.tar tratto-AAAAMMDD-HHMM.tar.age && tar -xf b.tar`
2. Tener un proyecto Supabase destino (staging para practicar, o uno nuevo).
3. Cuentas primero (el esquema `auth` ya existe en todo proyecto Supabase):
   `pg_restore --data-only -d "$DESTINO" tratto-*-cuentas.dump`
4. App: `pg_restore --no-owner --no-privileges -d "$DESTINO" tratto-*-app.dump`
5. Volver a crear lo que no viaja en el dump:
   - permisos de tablas y funciones: aplicar las migraciones de
     `supabase/migrations/` (son idempotentes en lo que importa) y revisar
     con `supabase/tests/`;
   - tareas de pg_cron (migración `tareas_programadas`);
   - secretos de Vault (`push_firma_quick_service`) y de Edge Functions;
   - triggers de matching (usan el secreto del webhook de n8n).
6. Apuntar la web al proyecto nuevo solo si el original no vuelve
   (`SUPABASE_URL` y la clave anónima en `index.html`).
7. Correr `supabase/tests/escrituras.sql` y una prueba de humo en la app.

## Escenarios

| Qué pasa | Qué hacer |
|---|---|
| Borrado accidental de datos | Restaurar el último backup en staging y copiar solo lo perdido. No pisar producción entera. |
| Supabase caído | Nada que hacer del lado nuestro; status.supabase.com. La app muestra errores de conexión. |
| n8n caído | Pedidos nuevos quedan sin proveedores: `reintentar-matching` los re-avisa hasta 3 veces cuando vuelve. Asistente/tasador/MP no andan mientras tanto. |
| Se filtró una clave | SECURITY.md → "Si se filtra una credencial". |
| Base llena (plan Free, 500 MB) | Llega alerta al 80 %. Pasar a Pro o limpiar. Al 100 % Supabase la deja en solo lectura. |
| Deploy web roto | Vercel → Deployments → anterior → Promote. |
