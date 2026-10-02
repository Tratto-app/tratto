# Captación de proveedores y clientes (preparado, en pausa hasta el lanzamiento)

El sistema **no le escribe a desconocidos**. Capta gente que se registra por su
cuenta (y así da su consentimiento). Todo está armado y probado, pero **con los
envíos en pausa**: no sale ningún mensaje hasta que lo actives, cuando la app
esté publicada en Play Store y App Store.

## Cómo entra la gente

Página de registro: `growth/landing/registro.html` (estática). Tiene dos
solapas: "Busco un servicio" (cliente) y "Ofrezco un servicio" (proveedor), con
rubro y zona (los mismos de la app). Al enviar llama a la Edge Function
`growth-signup`, que guarda a la persona con `consent = opt_in` y de dónde vino.
Hay una trampa anti-bots (campo oculto) y validación de email/teléfono.

Dónde poner el link (lo da Settings → Workspace, botón Copiar):
anuncios de Instagram/Facebook, link de la bio, cartel con QR, y para mandar a
tus propios contactos.

## El interruptor de lanzamiento

`growth_app_settings.sending_paused` (arranca en `true`). Mientras está en pausa:
- los registros entran y las automatizaciones se crean, pero **ningún paso de
  envío se ejecuta**: la secuencia queda "esperando" y reintenta sola;
- el envío manual desde el Inbox queda bloqueado con un aviso;
- el resto del panel funciona igual (ves los registrados, sus datos, el funnel).

Se activa desde **Settings → Workspace → Lanzamiento** (pide confirmación).
Probado: con pausa, 0 mensajes; al activar, las automatizaciones empiezan a
enviar (en staging, en modo simulado porque no hay credenciales).

## Las dos automatizaciones (en el workspace Tratto)

Creadas y activas, con los textos **en borrador** (`[COMPLETAR]`), para terminar
juntos cuando la app esté publicada:
- **Bienvenida a proveedores** — se dispara solo para `kind = provider`.
- **Bienvenida a clientes** — se dispara solo para `kind = customer`.

Cada una: mail de bienvenida → espera 3 días → si no instaló, recordatorio. Los
mensajes usan `{{first_name}}` y `{{contact_phone}}` (el teléfono se carga en
Settings → Workspace, no en el código).

## Baja

Cada mail lleva un link a `growth-baja`, que marca `opt_out`: la persona no
recibe nada más y se cortan sus automatizaciones (Ley 25.326).

## Lo que falta para encender (juntos, al lanzar)

1. Publicar la app en las tiendas y cargar las URLs (App → Store Links).
2. Escribir los mails definitivos (hoy están en borrador) y el teléfono de contacto.
3. Comprar un dominio de envío y cargar las credenciales de Brevo (secrets).
4. Publicar `registro.html` y armar los anuncios / el QR.
5. Activar el interruptor de lanzamiento.
