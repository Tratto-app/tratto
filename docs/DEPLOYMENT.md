# Cómo se publica cada parte

| Parte | Cómo se publica | Cómo se vuelve atrás |
|---|---|---|
| Web (`index.html`, legales, íconos) | merge a `main` → Vercel publica solo | Vercel → Deployments → el anterior → *Promote to Production* |
| Base de datos | migración nueva en `supabase/migrations/`, probada en staging, aplicada en producción | migración nueva que revierta (no se editan migraciones ya aplicadas) |
| Edge Functions | código en `tools/supabase-functions/<nombre>/`; se despliega con el CLI o el MCP de Supabase | desplegar la versión anterior del mismo archivo |
| n8n | se edita en n8n; antes de cambiar un workflow se guarda una copia (Workflow → Download) | importar la copia |
| App Android | carga la web: los cambios de la web llegan solos. Solo hace falta subir versión si cambia algo nativo (`tools/android-twa/`) | versión anterior en Play Console |
| App iPhone | igual que Android; build en Codemagic (`codemagic.yaml`) | versión anterior en App Store Connect |

## Antes de cada cambio a la base

1. Escribir la migración en `supabase/migrations/AAAAMMDDHHMMSS_nombre.sql`
   con un comentario arriba: qué cambia y por qué.
2. Aplicarla en **staging**.
3. Si toca políticas RLS: correr `supabase/tests/matriz_permisos.sql` y
   `supabase/tests/escrituras.sql` antes y después; los resultados tienen que
   ser iguales salvo lo que el cambio busca.
4. Si puede afectar rendimiento: correr la prueba de carga (LOAD_TESTING.md).
5. Aplicarla en producción y revisar los *advisors* de Supabase.

## CI

`.github/workflows/ci.yml` corre en cada push y PR: sintaxis del JavaScript
de los HTML, JSON válidos y búsqueda de credenciales en archivos versionados
(`tools/ci/revisar.py`). Si falla, no mergear.

## Staging

Proyecto Supabase "Tratto Staging" (sa-east-1). Tiene el mismo esquema que
producción, sin los triggers de matching y de notificaciones, así que nunca
llama a n8n ni manda avisos reales. Usuarios de prueba:
`carga<N>@staging.trattoapp.test` (1–2000 clientes, 2001–3000 proveedores).
