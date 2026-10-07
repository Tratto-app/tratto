# Radar de redes

Workflow de n8n `RADAR - 50 cuentas por red para seguir a mano`
(id `xnreAo8sV8oyfGpR`, export en `../workflows/radar-cuentas-por-red.json`).

Todos los días a las 8:30 (hora de Argentina):

1. Elige 1 hashtag de Instagram y 2 búsquedas de TikTok, rotando entre muchos
   rubros, todas apuntadas a Buenos Aires (sin gas, electricidad ni salud).
2. Se queda solo con posts de Buenos Aires: en TikTok, videos subidos desde
   Argentina; en los dos, que el texto o el lugar hablen de CABA/GBA o traigan
   un teléfono 11. Baja ~6 comentarios por video/post.
3. Primer filtro sin IA: saca links, emojis sueltos, dueños de los posts,
   cuentas de Tratto y a quien ya se sugirió en los últimos 60 días
   (tabla `public.radar_redes`).
4. **Filtro con IA** (gpt-4o-mini, credencial `Tratto · OpenAI`): por cada
   comentario decide si la persona es de Argentina (voseo, lunfardo, lugares;
   descarta señales de México, Chile, Perú, España, etc.) y si quiere contratar
   (3 = pide precio/contacto/turno, 2 = pregunta si cubren su zona o cuenta que
   tiene el problema). Quedan solo Argentina/probable con intención 2 o 3. Si la
   IA falla, no manda ninguna.
5. Manda a trattoapp1@gmail.com hasta 50 cuentas por red, con link al perfil,
   el comentario, el motivo y el post. **Se siguen a mano desde el celular**:
   el workflow no sigue a nadie ni entra a las cuentas.

Prueba del 2026-10-07 (mudanzas y maquillaje en CABA): 46 comentarios
revisados, 18 cuentas de TikTok, casi todas pidiendo precio o información.
Instagram en el plan gratis casi no trae posts de Buenos Aires (un hashtag por
día y ~10 posts): ese día, 0.

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
