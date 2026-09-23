-- H-02 — APLICADO el 23/09/2026 como migracion cerrar_listado_bucket_publicaciones.
-- Queda aca como registro.
--
-- La politica "fotos visibles" (SELECT, rol public, bucket_id = 'publicaciones')
-- dejaba a cualquiera, sin sesion, listar el bucket entero: 7 fotos de 6
-- usuarios, con sus user_id en la ruta. Los buckets publicos sirven cada
-- archivo por /object/public/... sin necesitar politica de SELECT, asi que
-- se reemplazo por una que solo deja a cada usuario ver su propia carpeta
-- (la usan la subida y el borrado).

drop policy if exists "fotos visibles" on storage.objects;
create policy "veo mis fotos" on storage.objects for select to authenticated
  using (bucket_id = 'publicaciones' and (storage.foldername(name))[1] = (auth.uid())::text);

-- P-12: la app solo sube JPEG achicados.
update storage.buckets
   set allowed_mime_types = array['image/jpeg','image/png','image/webp'],
       file_size_limit = 5242880
 where id = 'publicaciones';

-- Verificado despues de aplicar:
--   POST /storage/v1/object/list/publicaciones con la clave anon -> []
--   GET  /storage/v1/object/public/publicaciones/<foto existente> -> 200
