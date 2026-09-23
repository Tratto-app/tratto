-- Corrige H-02: cualquiera, sin sesion, puede listar el bucket "publicaciones"
-- (POST /storage/v1/object/list/publicaciones con la clave anonima), lo que
-- entrega los user_id de todos los que subieron fotos y las URLs de esas
-- fotos -- incluidas las del tasador (fotos de adentro de una casa).
--
-- Los buckets publicos sirven un archivo conocido por /object/public/... SIN
-- necesitar ninguna politica de SELECT para 'anon'. Esa politica solo sirve
-- para poder LISTAR el contenido, que es justo lo que no queremos. Por eso
-- borrarla no rompe nada: las fotos existentes siguen cargando igual en la
-- app (podés confirmarlo abriendo cualquier URL /object/public/... después).

-- 1) Ver que politica es la que permite esto (nombre puede variar)
select policyname, cmd, roles, qual
from pg_policies
where schemaname = 'storage' and tablename = 'objects'
  and qual ilike '%publicaciones%';

-- 2) Borrarla (reemplazá <nombre_de_la_politica> por el que apareció arriba)
-- drop policy "<nombre_de_la_politica>" on storage.objects;

-- 3) Verificar (correr esto DESPUES, ya sin la politica):
--    curl -s -X POST "https://qglsonbcsncgekzbfafk.supabase.co/storage/v1/object/list/publicaciones" \
--      -H "apikey: <la clave anon, la publica>" -H "Content-Type: application/json" \
--      -d '{"prefix":"","limit":3}'
--    Tiene que devolver [] o un error de permiso, no una lista de archivos.
--
--    Y confirmar que una foto YA EXISTENTE sigue cargando:
--    curl -s -o /dev/null -w "%{http_code}\n" \
--      "https://qglsonbcsncgekzbfafk.supabase.co/storage/v1/object/public/publicaciones/<una-ruta-real>.jpg"
--    Tiene que seguir siendo 200.
