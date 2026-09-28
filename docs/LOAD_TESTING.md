# Pruebas de carga

Todo lo de este documento se midió el 25/09/2026 sobre **staging** (proyecto
Supabase aparte, plan Free, sa-east-1). Nunca se probó carga contra
producción. Lo que no se midió está marcado como tal.

## Cómo se prueba

- Script: `tools/carga/carga.py` (y `tools/carga/login.py` para las sesiones).
- **Datos:** 3.000 usuarios (2.000 clientes, 1.000 proveedores), 20.000
  pedidos, 38.000 conexiones, 288.000 mensajes, 100.000 visitas (~81 MB).
- **Usuarios virtuales (VUs):** cada uno es una sesión real distinta (1.000
  cuentas logueadas) y repite lo que hace `index.html`:
  - al entrar: sus pedidos, sus servicios y sus conexiones;
  - latido cada 12 s: sus pedidos + sus servicios (+ feed de pedidos
    abiertos si es proveedor y está en el Panel);
  - 30 % con un chat abierto: sondeo cada 6 s y un mensaje cada 45–90 s;
  - proveedores: Panel de estadísticas cada 5 min.
  - Mezcla 60 % clientes / 40 % proveedores.
- Rampa de 60 s, meseta de 120 s. Las métricas son solo de la meseta.
- Latencia medida en el cliente (incluye red). Además se leyó
  `pg_stat_statements` para separar el tiempo de la base.

Correr: `python3 tools/carga/login.py <dir> 600 400` y después
`python3 tools/carga/carga.py <dir> <VUs> 120 60 salida.json`
(`<dir>` con `.env` = URL y clave anónima de **staging**, y `.pass`). El
script se niega a correr contra producción.

## Limitaciones (leer antes de usar los números)

1. **Todo el tráfico sale de una sola máquina y una sola IP**, a través de un
   proxy. Usuarios reales vienen de miles de IPs. No se puede descartar que
   parte de la saturación a 1.000 VUs sea por eso.
2. Latencia base de red desde la máquina de prueba: ~180 ms por pedido (p50
   con carga baja). En Argentina, contra São Paulo, debería ser menor.
3. **No se simuló Realtime** (websockets del chat) ni subida de fotos ni
   llamadas a n8n/OpenAI.
4. El modelo de uso es el de la app **anterior** a este cambio (sondeo del
   chat cada 6 s siempre). El cambio nuevo del frontend (sondeo cada 30 s si
   Realtime anda) baja la carga del chat, pero **no se midió**.
5. Staging es Free: misma capacidad que producción hoy.

## Resultados: antes y después de los índices + RLS optimizado

Total de la meseta (latencias en ms):

| VUs | req/s | p50 | p95 | p99 | errores |
|---|---|---|---|---|---|
| 100 | 22.3 → 22.7 | 183 → 181 | 405 → **210** | 589 → **421** | 0 % → 0 % |
| 500 | 73.5 → 89.8 | 350 → 636 | 20.364 → 14.771 | 29.349 → 21.135 | 0,68 % → **0 %** |
| 1000 | 45.0 → 47.2 | ~31.000 → ~31.000 | timeout | timeout | 96,4 % → 78,5 % |

Con 100 VUs, por operación (p50 / p95):

| Operación | Antes | Después |
|---|---|---|
| sondeo del chat | 183 / 413 | 181 / 205 |
| latido (mis pedidos) | 185 / 408 | 182 / 210 |
| feed de pedidos abiertos | 219 / 256 | 182 / 202 |
| presupuestos del Panel | 220 / 493 | 209 / 357 |
| enviar mensaje | 188 / 222 | 187 / 226 |

Tiempo **dentro de la base** (pg_stat_statements, promedio por consulta):

| Consulta | Antes | Después |
|---|---|---|
| sondeo del chat (`mensajes` por conversación) | 92 ms | 4,7 ms |
| feed `pedidos_abiertos` | 173 ms | 4,8 ms |
| mis pedidos | 22,8 ms | < 1 ms (fuera del top) |
| visitas del Panel | 618 ms | 47 ms |
| **Tiempo total de base en la corrida** | **~1.000 s** | **~75 s** |

Antes, abrir un chat con 288.000 mensajes tardaba ~2 s porque no había
índice por conversación; la base recorría la tabla entera.

## Dónde se satura

- **500 VUs, después del cambio:** sin errores. Hubo un pico de latencia
  mientras entraban los usuarios (segundos 40–130) y después, con los 500
  activos, el p95 volvió a **~210 ms** (últimos 40 s de meseta). La meseta
  estable observada es corta: no alcanza para afirmar que 500 aguanta horas.
- **1.000 VUs:** colapsa antes y después. El quiebre aparece al pasar de
  ~450 usuarios simultáneos. Los logs de Supabase muestran **504** (el
  servidor de la API no respondió a tiempo) y **522** (Cloudflare no pudo
  conectarse al servidor), mientras la base casi no trabajaba. O sea: el
  límite ya no es la base sino la capa de API del plan Free (instancia nano),
  con la salvedad de la IP única del punto 1. Después de esa corrida, la API de
  staging dejó de responder a la máquina de prueba por un rato (la base seguía
  sana), lo que sugiere además un bloqueo por IP.

**Conclusión honesta:** con evidencia, el sistema aguanta **100 usuarios
simultáneos** con holgura (p95 ~210 ms, 0 % errores) y **500 simultáneos sin
errores** pero con picos de latencia al entrar muchos juntos. **1.000
simultáneos no aguanta en plan Free** con este modelo de uso. No hay
evidencia para afirmar números por encima de eso.

"Simultáneos" = con la app abierta a la vez. La cantidad de usuarios
registrados que eso representa depende de cuánto tiempo tienen la app abierta;
no se midió.

## Próxima medición recomendada

Repetir en staging después de: (a) pasar a Supabase Pro con compute Small, y
(b) publicar el frontend nuevo; idealmente desde 2–3 máquinas distintas.
