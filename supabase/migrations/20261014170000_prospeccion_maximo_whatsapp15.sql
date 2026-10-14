-- Máximo de mails y 15 números de WhatsApp por día (fundador, 14/10/2026:
-- "hagamos máximo de mails y 15 números por día de wsp").
-- WhatsApp manual: hasta 35 créditos de Firecrawl por día (unos 2,4 por número,
-- primero lo que se lee gratis): 63 ya gastados + 35 x 26 días = 973.
-- Mails: la meta vuelve a ser lo que alcancen los créditos (hasta 300), con el
-- freno de 70 mientras los rebotes de 7 días estén en 3 % o más.
-- Ya aplicada en producción.

update public.growth_mkt_ajustes
   set valor = valor || jsonb_build_object(
         'reserva_otros_usos', 1373,
         'reserva_desglose', jsonb_build_object('otros_usos_preexistentes', 400, 'whatsapp_manual', 973),
         'whatsapp_tope_diario', 35,
         'whatsapp_meta_diaria', 15,
         'nota_reserva', 'Decisión del fundador 14/10/2026: 15 números de WhatsApp por día con hasta 35 créditos diarios (63 ya gastados + 35 x 26 días = 973), primero lo gratis. El resto va a los mails.'),
       updated_at = now()
 where clave = 'firecrawl';

update public.growth_mkt_ajustes
   set valor = valor || jsonb_build_object(
         'meta_maxima', 300,
         'nota', 'Máximo de mails (fundador 14/10/2026): la meta es lo que alcanzan los créditos del día, hasta 300. Si rebotes de 7 días >= 3 % o bajas >= 5 %, baja a 70. El costo por mail usa los informes desde cpm_desde.'),
       updated_at = now()
 where clave = 'prospeccion';
