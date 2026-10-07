# Radar de redes

Workflow de n8n `RADAR - 25 cuentas por red para seguir a mano`
(id `xnreAo8sV8oyfGpR`, export en `../workflows/radar-cuentas-por-red.json`).

Todos los días a las 8:30 (hora de Argentina):

1. Elige 2 hashtags de Instagram y 2 búsquedas de TikTok, rotando entre muchos
   rubros (no solo oficios; sin gas, electricidad ni salud).
2. Con Apify trae los reels y videos de esas búsquedas, se queda con los 6 con
   más comentarios de cada red y baja hasta 100 comentarios de cada una.
3. Puntúa a cada persona que comentó: pregunta precio, busca un servicio, dice
   la zona, habla como en Argentina. Saca links, spam, los dueños de los posts,
   las cuentas de Tratto y a quien ya se sugirió en los últimos 60 días
   (tabla `public.radar_redes`).
4. Manda a trattoapp1@gmail.com las 25 mejores de cada red, con link al perfil,
   el comentario y el post. **Se siguen a mano desde el celular**: el workflow
   no sigue a nadie ni entra a las cuentas de Tratto.

Necesita la credencial de n8n **Apify** (tipo Header Auth, nombre
`Authorization`, valor `Bearer <token de Apify>`). Actores usados (pago por
resultado): `apify~instagram-hashtag-scraper`, `apidojo~instagram-comments-scraper`,
`clockworks~tiktok-scraper`, `apidojo~tiktok-comments-scraper`.

`armar.py` arma el workflow (se usa con `scratchpad/n8n/n8n.py` para subirlo).

## Costo

Está ajustado al plan gratis de Apify (USD 5 de uso por mes, sin tarjeta):
unos USD 0,15 por día. Cada llamada a Apify lleva `maxTotalChargeUsd` como tope
(0,04 + 0,06 + 0,04 + 0,04). Si se acaba el crédito del mes, Apify frena las
corridas y el mail llega con menos cuentas hasta el mes siguiente. Para 50 por
red con búsqueda completa hace falta el plan Starter (USD 29/mes): subir a 4
hashtags/búsquedas, 15 posts y 600 comentarios por red, y los topes.
