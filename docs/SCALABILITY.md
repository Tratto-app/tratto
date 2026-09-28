# Escalabilidad

Qué limita el crecimiento, en qué orden aparece cada límite y qué hacer.
Los números medidos están en LOAD_TESTING.md; lo demás son los topes
publicados de cada plan (verificar en cada proveedor, cambian).

## Cuellos de botella, del primero al último

| # | Límite | Hoy (plan Free) | Síntoma | Qué hacer |
|---|---|---|---|---|
| 1 | **Capa de API de Supabase (compute nano)** | medido: se degrada pasados ~450 usuarios simultáneos | errores 504/522, la app tarda o no carga | Supabase Pro (US$ 25/mes) + compute Small o mayor |
| 2 | **Sondeo del frontend** | cada usuario con la app abierta hace ~0,23 pedidos/s | la carga crece lineal con usuarios conectados | ya se bajó el sondeo del chat (30 s con Realtime); siguiente paso: latido por Realtime en vez de cada 12 s |
| 3 | Conexiones Realtime simultáneas | 200 (Free) / 500 (Pro) | por encima, el chat cae al sondeo rápido (sigue andando, más carga) | Pro; a futuro, Realtime solo con el chat abierto (ya es así) |
| 4 | Tamaño de la base | 500 MB (Free) | al 100 % queda en solo lectura | alerta al 80 % (ya está); Pro = 8 GB |
| 5 | Fotos (Storage) | 1 GB (Free) | no se pueden subir fotos | cuota por usuario (ya está) + alerta al 80 %; Pro = 100 GB |
| 6 | Ejecuciones de n8n | según plan (no verificado) | matching, asistente, tasador y MP dejan de andar | revisar plan; el matching ya tiene reintentos |
| 7 | Mails | Brevo según plan (Free: 300/día); SMTP de Supabase Auth con límite por hora | no llegan confirmaciones o avisos | plan pago de Brevo al crecer |
| 8 | Hosting web | Vercel Hobby no permite uso comercial | incumplimiento de términos, no técnico | Vercel Pro o hosting estático equivalente |

## Lo que ya se hizo para escalar (25/09/2026)

- 16 índices nuevos para las consultas que hace la app. Tiempo de base por
  corrida de carga: ~1.000 s → ~75 s.
- Políticas RLS que evalúan `auth.uid()` una vez por consulta y no por fila;
  sin políticas duplicadas.
- Topes por usuario en la base (pedidos, mensajes, fotos, asistente): un solo
  usuario ya no puede llenar la base ni gastar la cuota de OpenAI.
- Pedidos vencidos a los 15 días (no se acumulan en el feed).
- Sondeo del chat de 6 s a 30 s cuando Realtime está conectado.
- Conteo de visitas del Panel sin bajar filas (antes, además, se cortaba en
  1.000).

## Decisiones que NO se tomaron (y por qué)

- **No se agregó caché, colas ni servidor propio.** Con el volumen actual la
  base responde en milisegundos; el límite es el plan, no la arquitectura.
- **No se cambió de tecnología.** Supabase + Vercel escala varios órdenes
  más con planes pagos antes de necesitar otra cosa.
- **No se movió el matching de n8n a la base.** Funciona, y reescribirlo es
  riesgo sin beneficio medible hoy. Se le agregó reintento.

## Cuándo actuar

| Señal | Acción |
|---|---|
| Lanzamiento con campaña, o > 100 usuarios con la app abierta a la vez | Supabase Pro antes de la campaña |
| Alerta "La base está al 80 %" o "fotos al 80 %" | Pro, o limpieza de datos viejos |
| p95 de la API > 1 s en Supabase → Reports | Subir compute; revisar consultas lentas |
| n8n cerca del tope de ejecuciones | Subir plan de n8n |
