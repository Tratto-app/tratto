# Video IA — n8n + Veo (fiel al video de referencia)

Sistema real de generación y publicación automática de videos, calcado del
flujo que se ve en las capturas que pasaste: **n8n orquesta, Google Veo
genera el MP4 vertical con audio en un solo paso, y n8n lo publica en
Facebook y TikTok con verificación de estado.**

No usa Vidnoz ni Remotion — el video de referencia tampoco los usa. Si más
adelante querés retomar el video de tu clon en Vidnoz o las animaciones de
marca en Remotion, son piezas aparte que ya dejamos armadas en otra
carpeta (`tools/video-pipeline` para edición, y el proyecto Remotion de
prueba), pero no forman parte de este flujo.

## Por qué no hay Postgres, Redis, Docker ni dashboard

El pedido original pedía una plataforma SaaS completa (base de datos
propia, cola con Redis, contenedores, panel multiusuario, facturación).
Eso tiene sentido para un producto con varios clientes — no para vos
armando contenido de Tratto solo. Levantar esa infraestructura acá no
serviría de nada: es un entorno de sesión que se recicla, no un servidor
donde eso quede corriendo.

En su lugar, reusamos lo que ya está realmente desplegado:

- **Base de datos y cola de trabajos** → una tabla (`video_jobs`) en el
  mismo proyecto de Supabase que ya usa Tratto. El "estado" de cada fila
  (`guion_listo`, `veo_enviado`, `veo_listo`, `publicado`...) hace de cola:
  cada workflow de n8n busca las filas en el estado que le toca atender.
- **Storage** → un bucket público (`videos-generados`) en el mismo
  Supabase, para que Facebook y TikTok puedan descargar el video por URL.
- **Orquestación y "workers"** → n8n mismo, con 3 workflows separados que
  se comunican a través del estado en la base — así cada uno se puede
  tocar o reemplazar sin romper los demás, tal como pedía el punto 3 del
  prompt original.

## Los 3 workflows

Importalos en n8n en este orden (`Workflows → Import from File`):

1. **`01-generar-video.json`** — Todos los días genera un guion con Claude,
   arma el prompt para Veo, lo manda a generar y guarda el `operation_name`.
2. **`02-verificar-veo.json`** — Cada 5 minutos revisa los jobs en
   `veo_enviado`, pregunta a Veo si terminó, y si terminó descarga el
   video y lo sube a Supabase Storage.
3. **`03-publicar-video.json`** — Cada 15 minutos toma los jobs con video
   listo y los publica en tu página de Facebook y tu cuenta de TikTok.

En cada uno, completá el nodo **"Configuracion"**.

## Credenciales que hacen falta — dónde conseguirlas y cómo probarlas

### 1. `serviceRole` (Supabase) — ya la tenés
La misma clave de servicio que usás en los otros workflows de Tratto
(`novedades`, notificaciones). Dashboard de Supabase → Settings → API →
`service_role`.

### 2. `anthropicApiKey` — generar guiones
console.anthropic.com → Settings → API Keys → Create key. Empieza con
`sk-ant-`. Probarla:
```
curl https://api.anthropic.com/v1/messages \
  -H "x-api-key: TU_CLAVE" -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d '{"model":"claude-sonnet-4-5","max_tokens":16,"messages":[{"role":"user","content":"hola"}]}'
```
Si responde con texto, funciona.

### 3. `geminiApiKey` — generación de video con Veo
aistudio.google.com → Get API key. **Importante:** Veo consume créditos
pagos incluso con clave de Google AI Studio — no hay tier gratuito para
generación de video. Confirmá el precio vigente en la cuenta antes de
dejarlo corriendo todos los días. Probarla:
```
curl -X POST "https://generativelanguage.googleapis.com/v1beta/models/veo-3.1-generate-preview:predictLongRunning" \
  -H "x-goog-api-key: TU_CLAVE" -H "Content-Type: application/json" \
  -d '{"instances":[{"prompt":"un gato caminando por una playa al atardecer"}],"parameters":{"aspectRatio":"9:16","durationSeconds":"8","generateAudio":true}}'
```
Si responde `{"name":"operations/..."}`, funciona. Ese mismo `name` se
consulta con GET en `https://generativelanguage.googleapis.com/v1beta/{name}`.

### 4. `facebookPageId` + `facebookPageToken` — publicar en Facebook
Requiere una app de Meta (developers.facebook.com → Mis apps → Crear app
→ tipo "Negocios"). Con la app en modo desarrollo y tu usuario como admin,
ya podés publicar en una página que vos administrás **sin pasar la
revisión de Meta** — la revisión solo hace falta para publicar en páginas
que no son tuyas. Conseguís el Page Access Token en Graph API Explorer,
seleccionando tu página y el permiso `pages_manage_posts`. Probarlo:
```
curl -X POST "https://graph.facebook.com/v21.0/TU_PAGE_ID/videos" \
  -F "access_token=TU_TOKEN" -F "file_url=https://URL_DE_UN_MP4_PUBLICO"
```

### 5. `tiktokAccessToken` — publicar en TikTok
**Esta es la que requiere una aprobación externa de verdad.** Hace falta:
1. Crear una app en developers.tiktok.com.
2. Solicitar el scope `video.publish` de la Content Posting API.
3. Mientras la app no esté auditada ("unaudited"), TikTok solo deja
   publicar en cuentas que vos mismo agregaste como "target users" de la
   app, y los videos quedan en modo privado/borrador — no es apto para
   producción real hasta que TikTok audite la app (puede tardar días).

Hasta que esa auditoría esté lista, el workflow 3 va a fallar en el nodo
"Publicar en TikTok" — es esperable, no es un bug. Facebook mientras tanto
puede funcionar solo.

## Cómo probar sin gastar en Veo

Podés correr `01-generar-video.json` hasta el nodo "Guardar guion en
Supabase" y desconectar ahí para revisar que los guiones te gustan, antes
de conectar el nodo que manda a Veo (que es el que cuesta dinero por cada
corrida).

## Esquema (ya aplicado en el Supabase de Tratto)

Por si alguna vez hay que recrearlo en otro proyecto:

```sql
create table public.video_jobs (
  id uuid primary key default gen_random_uuid(),
  tema text not null,
  guion jsonb,
  estado text not null default 'creado'
    check (estado in ('creado','guion_listo','veo_enviado','veo_generando',
      'veo_listo','veo_fallido','publicando','publicado','publicado_parcial','fallido')),
  veo_operation_name text,
  veo_video_uri text,
  video_local_url text,
  plataformas jsonb not null default '[]'::jsonb,
  publicaciones jsonb not null default '{}'::jsonb,
  intentos_veo int not null default 0,
  intentos_publicacion int not null default 0,
  error text,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

alter table public.video_jobs enable row level security;
-- Sin policies a propósito: solo entra con la service_role (n8n), igual
-- que config_app y demás tablas internas de Tratto.

create function public.marcar_publicacion(p_id uuid, p_plataforma text, p_resultado jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.video_jobs
  set publicaciones = coalesce(publicaciones, '{}'::jsonb) || jsonb_build_object(p_plataforma, p_resultado),
      estado = 'publicado'
  where id = p_id;
end;
$$;
revoke all on function public.marcar_publicacion(uuid, text, jsonb) from public;
grant execute on function public.marcar_publicacion(uuid, text, jsonb) to service_role;
```

Bucket de Storage: `videos-generados`, público, ya creado.

## Qué guarda la tabla `video_jobs`

```sql
select id, tema, estado, veo_operation_name, video_local_url,
       publicaciones, intentos_veo, error, creado_en
from public.video_jobs
order by creado_en desc;
```

`publicaciones` queda como `{"facebook": {...respuesta cruda...}, "tiktok": {...}}`
— ahí ves el error real de cada plataforma si algo falla.

## Limitaciones honestas

- Veo 3.1 genera clips de **8 segundos**. Para algo más largo hace falta
  encadenar generaciones (la propia API de Veo tiene una función de
  "extender video") — no está implementado acá todavía.
- Si Veo tarda más de ~100 minutos (20 consultas × 5 min), el job queda
  en `veo_fallido` y no se reintenta solo.
- El estado final `publicado` se marca apenas la primera plataforma
  confirma — revisá igual el campo `publicaciones` de cada job, porque
  puede haber quedado publicado en una red y fallado en la otra.
- No hay reintento automático de publicación fallida: si TikTok o
  Facebook devuelven error, hay que volver a disparar el workflow 3 a mano
  para esa fila (o repetirlo por completo, ya que la consulta busca por
  `estado=veo_listo`, y un fallo de publicación no cambia ese estado del
  origen — así que el intento automático de las 15 min lo va a reintentar solo,
  de hecho).
