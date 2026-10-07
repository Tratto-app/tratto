# Radar de redes

Workflow de n8n `RADAR - 50 cuentas por red para seguir a mano`
(id `xnreAo8sV8oyfGpR`, export en `../workflows/radar-cuentas-por-red.json`).

Todos los días a las 8:30 (hora de Argentina):

1. Elige 1 hashtag de Instagram y 1 búsqueda de TikTok, rotando entre muchos
   rubros (no solo oficios; sin gas, electricidad ni salud).
2. Con Apify trae los reels y videos de esas búsquedas y elige los mejores posts de cada
   red donde más rinde cada comentario: los que hablan de precio o de pedir un
   servicio, con una cantidad normal de comentarios (los virales se llenan de
   chistes). Baja ~45 comentarios por red.
3. Puntúa a cada persona que comentó: pregunta precio, busca un servicio, dice
   la zona, habla como en Argentina. Saca links, spam, los dueños de los posts,
   las cuentas de Tratto y a quien ya se sugirió en los últimos 60 días
   (tabla `public.radar_redes`).
4. Manda a trattoapp1@gmail.com hasta 50 cuentas de cada red, ordenadas por
   intención, con link al perfil, el comentario y el post. **Se siguen a mano
   desde el celular**: el workflow no sigue a nadie ni entra a las cuentas.

Necesita la credencial de n8n **Apify** (tipo Header Auth, nombre
`Authorization`, valor `Bearer <token de Apify>`).

## Costo: plan gratis de Apify (USD 5/mes)

Muchas herramientas baratas de Apify le dan solo 10 resultados a las cuentas
gratis (o piden un mínimo de USD 3 por corrida, o permisos que el plan gratis
no da). Estas sí funcionan en el plan gratis (probadas el 2026-10-07):

| Paso | Herramienta | Precio por resultado |
|---|---|---|
| Posts de Instagram por hashtag (1 hashtag, ~10 posts) | `publicsignallabs~instagram-hashtag-scraper` | USD 0,00024 |
| Comentarios de Instagram (7 por post, ~6 posts) | `datadoping~instagram-comments-and-replies-scraper` | USD 0,00155 |
| Videos de TikTok por búsqueda (1 búsqueda, ~20 videos) | `novi~tiktok-search-api` | USD 0,0004 |
| Comentarios de TikTok (6 por video, 8 videos) | `clockworks~tiktok-comments-scraper` | USD 0,00125 |

Corrida medida: ~USD 0,15 (≈ 4,5 por mes). Primera corrida real: 17 cuentas
de Instagram y 33 de TikTok. Cada llamada lleva `maxTotalChargeUsd` como tope
y `executeOnce` (una sola corrida por día; sin eso n8n la repetía por cada
ítem recibido y Apify cortaba por el límite de 5 corridas a la vez). Para 50
por red todos los días hace falta el plan Starter (USD 29/mes), que habilita
las herramientas más baratas sin el límite de 10.

`armar.py` arma el workflow (se usa con `scratchpad/n8n/n8n.py` para subirlo).
