# Radar de redes

Workflow de n8n `RADAR - 50 cuentas por red para seguir a mano`
(id `xnreAo8sV8oyfGpR`, export en `../workflows/radar-cuentas-por-red.json`).

Todos los días a las 8:30 (hora de Argentina):

1. Elige 4 hashtags de Instagram y 4 búsquedas de TikTok, rotando entre muchos
   rubros (no solo oficios; sin gas, electricidad ni salud).
2. Con Apify trae los reels y videos de esas búsquedas y elige los 10 de cada
   red donde más rinde cada comentario: los que hablan de precio o de pedir un
   servicio, con una cantidad normal de comentarios (los virales se llenan de
   chistes). Baja ~130 comentarios de Instagram y ~160 de TikTok.
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

| Paso | Herramienta (pago por resultado) | Por día |
|---|---|---|
| Posts de Instagram por hashtag (48) | `apidojo~instagram-hashtag-scraper`, USD 0,0004 | ~0,02 |
| Comentarios de Instagram (130) | `apidojo~instagram-comments-scraper`, USD 0,0005 | ~0,065 |
| Videos de TikTok por búsqueda (40) | `xmolodtsov~tiktok-search-scraper`, USD 0,0003 | ~0,012 |
| Comentarios de TikTok (160) | `apidojo~tiktok-comments-scraper`, USD 0,0003 | ~0,048 |

Unos USD 0,15 por día (~4,5 por mes). Cada llamada lleva `maxTotalChargeUsd`
como tope (0,025 + 0,07 + 0,015 + 0,05). Si se acaba el crédito del mes, Apify
frena las corridas y el mail llega con menos cuentas hasta el mes siguiente.
Las primeras corridas sirven para medir cuántas cuentas útiles salen; si son
pocas, se suben los comentarios (y el costo) o se ajusta la búsqueda.

`armar.py` arma el workflow (se usa con `scratchpad/n8n/n8n.py` para subirlo).
