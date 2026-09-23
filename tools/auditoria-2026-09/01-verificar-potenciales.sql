-- Ejecutar en el SQL Editor de Supabase (proyecto qglsonbcsncgekzbfafk).
-- Es de SOLO LECTURA: no modifica nada. Sirve para confirmar o descartar los
-- hallazgos POTENCIALES del reporte SECURITY-AUDIT.md antes de escribir los
-- triggers de 02-triggers-mensajes-perfil.sql.
--
-- Pegá el resultado de cada bloque tal cual, uno por uno.

-- ============================================================
-- P-01 / P-06: politicas RLS de todas las tablas (que permiten y con que condicion)
-- ============================================================
select tablename, policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname = 'public'
order by tablename, cmd;

-- ============================================================
-- P-01 / P-02: hay algun trigger que ya proteja columnas de mensajes o perfil_proveedor?
-- ============================================================
select c.relname as tabla, t.tgname as trigger, pg_get_triggerdef(t.oid) as definicion
from pg_trigger t
join pg_class c on c.oid = t.tgrelid
where not t.tgisinternal
  and c.relname in ('mensajes', 'perfil_proveedor', 'solicitudes', 'interesados')
order by c.relname;

-- ============================================================
-- P-01 / P-02: permisos SQL crudos (mas alla de RLS) sobre esas tablas
-- ============================================================
select table_name, grantee, privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and grantee in ('anon', 'authenticated')
  and table_name in ('mensajes', 'perfil_proveedor', 'solicitudes', 'proveedores', 'interesados')
order by table_name, grantee;

-- ============================================================
-- P-01 / P-02: permisos por columna (si existen, acotan un UPDATE amplio)
-- ============================================================
select table_name, column_name, grantee, privilege_type
from information_schema.column_privileges
where table_schema = 'public'
  and grantee = 'authenticated'
  and table_name in ('mensajes', 'perfil_proveedor')
order by table_name, column_name;

-- ============================================================
-- P-07: la vista pedidos_abiertos, es security_invoker? (si no lo es, puede
-- saltear el RLS de solicitudes para usuarios logueados)
-- ============================================================
select relname, reloptions
from pg_class
where relname = 'pedidos_abiertos';

-- ============================================================
-- P-12: el bucket de fotos, permite cualquier tipo de archivo?
-- ============================================================
select id, public, allowed_mime_types, file_size_limit
from storage.buckets;

-- ============================================================
-- H-02: la politica que hoy permite listar el bucket "publicaciones" (para
-- confirmar el nombre exacto antes de borrarla en 03-fix-storage.sql)
-- ============================================================
select policyname, cmd, roles, qual
from pg_policies
where schemaname = 'storage' and tablename = 'objects';

-- ============================================================
-- P-13: las funciones RPC, corren con SECURITY DEFINER? tienen search_path fijo?
-- ============================================================
select p.proname, p.prosecdef, p.proconfig
from pg_proc p
where p.pronamespace = 'public'::regnamespace
  and p.proname in ('borrar_mi_cuenta', 'registrar_push_subscripcion', 'marcar_publicacion');

-- P-11 (contraseña mínima) no se verifica por SQL: es un ajuste de la API de
-- Auth, no de la base. Se revisa en el panel de Supabase, en Authentication
-- -> Policies -> Password requirements. No hace falta consultar auth.users.
