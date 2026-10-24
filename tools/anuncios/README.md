# Sistema de anuncios de Tratto

Pedido del fundador del 23/10/2026: armar para Tratto el sistema de un video
("Sistema de IA que reemplaza un equipo de marketing", @santino.ai.builder),
sin pagar herramientas. Lo que cuesta es la publicidad en sí: 50.000 pesos por
semana, 25.000 en Instagram y 25.000 en TikTok. Nada se gasta sin que el
fundador lo apruebe.

## Las cuatro partes

| Parte del video | En Tratto | Dónde vive |
|---|---|---|
| Anuncios: mirar a la competencia, escribir, hacer el video, la voz, mover la plata a los ganadores | Anuncios para clientes armados con nuestro armador de videos (gratis) y, cuando el fundador grabe, con su voz. Cada anuncio con su link con nombre. La plata se mueve dentro del tope semanal. | Esta carpeta, `tools/piezas-redes/reels/anuncio-*.html`, rutina "Anuncios · optimización y resumen de la mañana" (`trig_0176yLQFUAZ2ZKWJwQ2vqMch`, 8:37) |
| Leer comentarios y mensajes | Instagram y Facebook: se leen y se responden con el link que corresponde. TikTok no deja leerlos desde afuera: queda a mano. | Rutina "Redes · comentarios y mensajes de Instagram y Facebook" (`trig_01WjAbJVR8vWXYwqJqNzVc2y`, 11:17, 15:17 y 20:17) |
| Agente que llama por teléfono | No va: las llamadas se pagan por minuto y en Tratto la "venta" es que la persona se anote. Lo reemplaza **trabajo listo**. | `supabase/migrations/20261023230000_trabajo_listo.sql`, `tools/n8n/workflows/trabajo-listo.json` |
| Ver qué anuncio trajo a quién y un resumen por la mañana | Links con nombre por anuncio (`growth_tracking_links`) y registros con su `link_id`. Resumen de una página a las 8:37. | Rutina "Anuncios · optimización y resumen de la mañana" |

## Herramientas pagas y su reemplazo gratis

- **Higgsfield** (fotos a video): nuestro armador (`tools/piezas-redes/reels/hacer-video.py`, formatos quiz, chat, lista, nota y producto) y los videos reales de las recorridas del fundador. No hay un reemplazo gratis con la misma calidad; en servicios, lo real da más confianza.
- **ElevenLabs** (voz): la voz del fundador grabada en el celular (preferida, 23/10/2026: "me gustaría que sea más humanizada") o, desde que apruebe la muestra del 24/10/2026, su voz clonada con Chatterbox (gratis, licencia MIT, `tools/voz-en-off/clonar.py`). De reserva, Piper con la voz `es_AR-daniela-high` (gratis, licencia CC BY-SA 4.0); suena menos natural, siempre con subtítulos.
- **Biblioteca de anuncios de Meta y Creative Center de TikTok**: gratis, pero no se pueden leer desde la sesión (Facebook y el Creative Center bloquean la lectura automática). La base son nuestros números: los quiz de precios y los carruseles fueron lo que más rindió.

## Primera campaña (para clientes)

- **Instagram (Meta Ads Manager), 25.000 por semana**, unos 3.570 por día, objetivo Tráfico, 7 días, AMBA, 25 a 60 años, ubicaciones automáticas. Tres anuncios en el mismo conjunto:
  1. Quiz de precios (`anuncio-quiz-precios.html`, música pop) → `/r/ad-ig-quiz` (calculadora).
  2. Chat "se te rompió la canilla un domingo" (`anuncio-chat-canilla.html`, acústico, ficción aclarada en el texto) → `/r/ad-ig-chat` (web, para pedir).
  3. Lista "antes de contratar a alguien" (`anuncio-lista-contratar.html`, house) → `/r/ad-ig-lista` (web, para pedir).
- **TikTok, 25.000 por semana con Promocionar** (Ads Manager pide 50 dólares por día como mínimo). Se publica el quiz en TikTok y se promociona ese video con objetivo "visitas al sitio web" → `/r/ad-tt-quiz`. Si la app no deja ese monto, va todo a Instagram.
- A las 48 a 72 horas se apaga el anuncio de Instagram con peor costo por clic a la web y su parte pasa a los otros dos. Con menos de 10 registros es poca muestra: se decide por clics y se dice.
- Los pedidos que traigan los anuncios en rubros sin nadie disparan **trabajo listo**.

## Lo que falta del fundador

1. Crear la cuenta publicitaria de Meta (moneda pesos, zona horaria Buenos Aires, tarjeta) y conectarla a Composio (`metaads`), así la rutina lee los resultados y ajusta dentro del tope.
2. Aprobar el texto del mail "trabajo listo" (`growth_mkt_ajustes.trabajo_listo.envio_aprobado` pasa a true).
3. Grabar los guiones con su voz (cuando lo haga, se arma la versión con voz con `comun-voz.js`).

## Dónde quedó cada cosa (23/10/2026)

- Campaña en la cola del equipo: item `campania_clientes_1` (`para_aprobar`), con los textos y los pasos para cargarla.
- El quiz sale en TikTok el lunes 26/10 a las 13:00 por Buffer (post `6adbec2f0b5343d070555c91`) para promocionarlo desde la app.
- Videos: `redes/anuncio-quiz-precios.mp4`, `redes/anuncio-chat-canilla.mp4` y `redes/anuncio-lista-contratar.mp4`.
