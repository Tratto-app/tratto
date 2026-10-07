# Radar de redes

Workflow de n8n `RADAR - 50 cuentas por red para seguir a mano`
(id `xnreAo8sV8oyfGpR`, export en `../workflows/radar-50-cuentas-por-red.json`).

Todos los días a las 8:30 (hora de Argentina):

1. Elige 4 hashtags de Instagram y 4 búsquedas de TikTok, rotando entre muchos
   rubros (no solo oficios; sin gas, electricidad ni salud).
2. Con Apify trae los reels y videos de esas búsquedas, se queda con los 15 con
   más comentarios de cada red y baja hasta 600 comentarios de cada una.
3. Puntúa a cada persona que comentó: pregunta precio, busca un servicio, dice
   la zona, habla como en Argentina. Saca links, spam, los dueños de los posts,
   las cuentas de Tratto y a quien ya se sugirió en los últimos 60 días
   (tabla `public.radar_redes`).
4. Manda a trattoapp1@gmail.com las 50 mejores de cada red, con link al perfil,
   el comentario y el post. **Se siguen a mano desde el celular**: el workflow
   no sigue a nadie ni entra a las cuentas de Tratto.

Necesita la credencial de n8n **Apify** (tipo Header Auth, nombre
`Authorization`, valor `Bearer <token de Apify>`). Actores usados (pago por
resultado): `apify~instagram-hashtag-scraper`, `apidojo~instagram-comments-scraper`,
`clockworks~tiktok-scraper`, `apidojo~tiktok-comments-scraper`.

`armar.py` arma el workflow (se usa con `scratchpad/n8n/n8n.py` para subirlo).
