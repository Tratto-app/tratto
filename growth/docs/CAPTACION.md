# Captación 24/7 (CRM de Tratto, en producción)

Desde el 7/10/2026 el Growth OS está instalado en **producción**
(`qglsonbcsncgekzbfafk`) como el CRM de Tratto. Junta en una sola base a toda la
gente que llega, guarda **por qué medio llegó** y le escribe sola por mail,
solo si dio permiso.

Panel: **https://www.trattoapp.com.ar/crm/** — se entra con la cuenta de la app
(dueño y admin del workspace "Tratto"). Una cuenta que no es miembro ve "Esta
cuenta no tiene acceso" y la base no le devuelve nada (RLS).

## Cómo entra la gente (sin cargar nada a mano)

Triggers en la base de la app (migración `supabase/migrations/20261007150000_crm_produccion.sql`).
Todos están envueltos en un manejo de errores: si el CRM falla, la app sigue igual.

| Entrada (`entrada`) | Cuándo | Datos que guarda |
|---|---|---|
| `calculadora` | Alguien usa `/calculadora/` y deja el mail | Servicio, zona, precio que le pasaron, rango, veredicto |
| `registro_app` | Se crea una cuenta en la app | Cliente o proveedor, permiso de publicidad |
| `pedido_web` | Un invitado deja un pedido sin cuenta | El pedido |
| `manual` | Se carga desde el panel | Lo que se cargue |

Además, el primer pedido o servicio publicado cuenta como **activación**
(`first_action`), y cada inicio de sesión como `session_start`.

Se excluyen las cuentas demo (`privado.es_demo`) y las pruebas de la
calculadora (`origen = 'prueba'`). Las cuentas `trattoapp1+…` quedan con la
etiqueta `interno` y sin contacto.

## De dónde vino (origen = primer contacto)

- La web guarda la última visita de campaña (`utm_*`, `gid` de un link
  trackeado, o el dominio desde el que llegó) en `localStorage`
  (`tratto_origen`, 30 días) y la manda al registrarse.
- La calculadora manda sus UTM o, si no hay, `ref:<dominio>`.
- `crm_fuente()` lo traduce a un medio: instagram, tiktok, facebook, google,
  whatsapp, email, referral, influencers, ia, meta_ads, google_ads, organic…
  Sin datos queda como "Directo / sin campaña".
- Si la persona vuelve por otro medio, **no se pisa** el origen: se guarda el
  primero. En el panel se ve en la ficha ("Cómo llegó") y se filtra en Prospects.

## Permiso (Ley 25.326, art. 27)

Solo se le escribe a quien tiene `consent = opt_in`, que sale únicamente de:
- la casilla de novedades de la calculadora, o
- el permiso de publicidad de la app (`user_metadata.publicidad_permiso`).

Si alguien apaga el permiso en la app, pasa a `opt_out`. Si se da de baja desde
un mail, también se apaga el permiso en la app (`crm_apagar_publicidad`). El
envío real por mail está bloqueado en el código para quien no tenga `opt_in`.

## Las automatizaciones (activas)

Migración `supabase/migrations/20261007160000_crm_automatizaciones.sql`:

1. **Calculadora → primer pedido**: mail con su comparación al instante; a los
   3 días, si no se registró, otro mail con los rubros.
2. **Cliente registrado → primer pedido**: a los 2 días, si no hizo ningún
   pedido, un mail para hacer el primero.
3. **Proveedor registrado → publicar servicio**: a los 2 días, si no publicó,
   un mail para publicar.

Cada mail lleva un link trackeado (`growth-go`): el click queda registrado y la
persona pasa a "Hizo click". Los textos se editan en el panel (Automations).

## Envío

- Brevo por SMTP (`smtp-relay.brevo.com:465`), remitente
  `Tratto <info@trattoapp.com.ar>`. Las credenciales están en la base
  (`config_app`), no en el código.
- Tope propio: **150 mails por día** (el plan gratis de Brevo da 300 y se
  comparten con los mails de la app).
- HTML con el estilo de Tratto (`_shared/email-html.ts`) + versión en texto.
- Baja: link al pie → `https://www.trattoapp.com.ar/baja/` (pide confirmar,
  así un antivirus que abre links no da de baja a nadie) y baja de un click
  desde Gmail/Outlook (`List-Unsubscribe-Post`).

## Operación (SQL Editor de Supabase)

```sql
select crm_envios(false);              -- pausar todos los envíos
select crm_envios(true);               -- reanudarlos
select crm_reintentar('<id del run>'); -- reintentar una automatización trabada
```

El cron (`pg_cron`, job `growth-automations`) corre cada 5 minutos.

## Lo que todavía no hace

- WhatsApp e Instagram: el código está, pero necesitan la verificación de
  negocio de Meta (número aprobado / app revisada).
- La IA está en modo por reglas (no hay `OPENAI_API_KEY` en los secrets).
- `growth-event` y `growth-signup` no están desplegadas en producción: la
  captura se hace con los triggers de la base, que no las necesitan.
- Anuncios de captación de Meta (Lead Ads), referidos y páginas por rubro × zona:
  próximas etapas.
