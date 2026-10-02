# Cumplimiento y reglas de contacto

Pensado para Argentina (Ley 25.326 de Protección de Datos Personales y Disposición 4/2009 de la AAIP sobre publicidad) y las políticas de cada plataforma.

## Lo que el sistema hace solo

- **No contactar** a quien tiene `do_not_contact` o `consent = opt_out`: el mensaje queda guardado como *Bloqueado* y no se envía. Las automatizaciones se cancelan.
- **Baja automática**: si una respuesta contiene "baja", "stop", "no me escriban", etc., se marca opt-out y no contacto.
- **WhatsApp y SMS reales solo con opt-in** (`consent = opt_in`).
- **Email**: se agrega una línea para darse de baja si el texto no la tiene.
- **Tope diario** de envíos reales por workspace (`GROWTH_DAILY_SEND_LIMIT`, 200 por defecto).
- **Sin scraping**: no hay ninguna función que junte datos de redes. La importación CSV pide confirmar una base legal y registra el origen (`consent_source`).
- **Supresión**: un prospecto se puede eliminar con toda su historia (botón Eliminar).
- **Mínimo de datos**: los clicks no guardan IP; el User-Agent se recorta. La IA recibe el perfil sin notas internas.
- **Aislamiento**: RLS por workspace; las funciones con service role validan membresía antes de actuar.

## Lo que depende de vos

- Registrar la base de datos ante la AAIP si corresponde y publicar la política de privacidad del uso para marketing.
- Usar solo plantillas de WhatsApp aprobadas por Meta para el primer contacto.
- No comprar bases de datos ni cargar contactos sin consentimiento.
- Las cuentas de Instagram/TikTok pueden ser restringidas por mensajes masivos aunque sean manuales: mantener volúmenes bajos y mensajes personalizados.
