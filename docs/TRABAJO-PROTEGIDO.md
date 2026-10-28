# Trabajo protegido

Decidido por el fundador el 28/10/2026. Ese mismo día pidió fusionarlo **sin la
verificación de identidad**: se ofrece con cualquiera que tenga Mercado Pago
conectado. Este documento explica cómo funciona,
qué falta para lanzarlo y qué hace soporte con cada caso.

## La regla

- El cliente puede proteger un presupuesto aceptado pagándole a Tratto una
  cuota del **5 % del presupuesto, mínimo $1.500**, una sola vez.
- Si quien hace el trabajo no lo termina, el cliente reclama desde el
  presupuesto y elige:
  - **Seguir:** en 48 horas hábiles (lunes a viernes, sin descontar feriados)
    Tratto le pasa otra persona de su zona que le mande presupuesto para terminarlo. Si no se consigue a tiempo, se le
    devuelve la cuota.
  - **No seguir:** se le devuelve la cuota.
- **Tratto no paga el trabajo, ni la diferencia de precio, ni materiales ni
  daños.** Lo único que devuelve es la cuota.
- No se llama "seguro" en ningún lado: vender seguros es solo para aseguradoras
  autorizadas por la Superintendencia de Seguros (Ley 20.091). Es un
  compromiso comercial de Tratto (punto 4.5 de los términos del cliente).
- Solo se ofrece si quien hace el trabajo tiene **Mercado Pago conectado** (el
  trabajo se tiene que poder pagar por la app).
- Si quien lo hacía lo abandona, el reclamo queda registrado (punto 14 de sus
  términos).

## Identidad comprobada (apagada)

Se armó y el fundador decidió no usarla por ahora. Quedan en la base, sin
uso: `public.distintivos`, `privado.identidad_solicitudes`, el bucket privado
`identidad` y las funciones `identidad_*`, a las que la app ya no puede llamar
(migración `20261028210000_trabajo_protegido_sin_identidad.sql`). Para
volver a usarla hay que devolverles el permiso, sumar de nuevo la tarjeta de
la app y la sección del CRM (están en el historial de git, commit d5d9fdd) y
los textos legales.

## Cómo está armado

| Pieza | Dónde |
|---|---|
| Tablas, reglas y permisos | `supabase/migrations/20261028200000_trabajo_protegido.sql`, `20261028201000_trabajo_protegido_interruptor.sql` y `20261028210000_trabajo_protegido_sin_identidad.sql` |
| Cobro de la cuota, devoluciones y revisión de la cuenta | función `trabajo-protegido` (`tools/supabase-functions/trabajo-protegido/`, pruebas en `handler.test.mjs`) |
| Pantallas de la app | `index.html`: presupuesto aceptado (oferta, pago, sello, reclamo) y preguntas frecuentes |
| Panel de soporte | CRM → Trabajo protegido (`growth/web/src/pages/Confianza.tsx`) |
| Pruebas de la app | `tools/confianza/trabajo-protegido.browser.test.mjs` |
| Textos legales | `terminos-cliente.html` 4.5, `terminos-proveedor.html` 8.3, `privacidad.html` 2.5, `confianza.html` 6 |

- La cuota se calcula en la base (`privado.cuota_proteccion`), nunca en el
  navegador. El cobro va con `binary_mode` (aprobado o rechazado, sin
  pendientes) y clave de idempotencia por presupuesto y tarjeta.
- Si Mercado Pago cobra pero la base no puede registrar la protección (o ya
  estaba protegido), la función devuelve el pago en el acto.
- Cuando el cliente paga el trabajo como terminado, la protección pasa sola a
  `cumplida`.

## Cómo se lanzó

1. Cuenta de Mercado Pago de Tratto en la función: `MP_TRATTO_ACCESS_TOKEN` y
   `MP_TRATTO_PUBLIC_KEY` en Supabase → Edge Functions → Secrets (aplicación
   2631534334320257, la misma con la que cobran quienes ofrecen servicios).
   Se comprueba sin ver las claves con
   `select privado.trabajo_protegido_llamar('revisar');` y la respuesta en
   `net._http_response` (`access_token`, `responde`, `public_key`, `app`).
2. Fusión a main (28/10/2026).
3. Interruptor: `update privado.config set valor='si' where clave='trabajo_protegido_activo';`
   (con `'no'` la app deja de ofrecerlo sin tocar lo ya pagado).

## Qué hace soporte con un reclamo

Llega el mail "Reclamo de Trabajo protegido" y el caso aparece primero en CRM
→ Trabajo protegido, con el plazo.

- **Quiere seguir:** buscar a alguien del mismo rubro y zona (Usuarios del CRM, `trabajo listo`) y pedirle que le escriba por la
  app. Cuando le mandó presupuesto: **Conseguimos a otra persona**. Si se vence
  el plazo sin nadie: **Devolver la cuota**.
- **No quiere seguir:** **Devolver la cuota**. La devolución sale sola por
  Mercado Pago desde la cuenta de Tratto (y la reintenta cada noche si falla).
- **Volvió quien lo hacía y el cliente está de acuerdo:** **Sigue el mismo**
  (la protección vuelve a quedar activa).

Cada decisión queda escrita en el reclamo del
chat, a la vista del cliente.

## Adelanto por la app (segunda etapa, todavía no está)

El fundador pidió adelanto (seña) solo para los rubros que lo necesitan. La
lista ya está en `public.rubros_adelanto` (23 de los 46 rubros):

- **Hasta 40 % para materiales:** plomería, albañilería, pintura, carpintería,
  herrería, techos, durlock, pisos, vidrios y aberturas, aire acondicionado,
  jardinería y piletas, tapicería, decoración.
- **Hasta 40 % para repuestos:** service de electrodomésticos, mecánica, chapa
  y pintura, reparación y soporte técnico.
- **Hasta 40 % para tasas del trámite:** gestoría.
- **Hasta 40 % para insumos:** catering y pastelería.
- **Hasta 30 % para reservar la fecha:** fletes y mudanzas, fotografía y video,
  música y sonido (DJ), animación y organización de eventos.
- **Sin adelanto:** limpieza, cerrajería, arreglos generales, gomería, lavado
  de autos, contabilidad, asistente administrativo, diseño, programación,
  marketing, estética, personal trainer, masajes, cuidado de adultos mayores,
  clases (todas), mascotas, costura, mandados y "Otro". O se hacen en una
  visita sin comprar nada antes, o el adelanto solo agregaría riesgo de que no
  se termine.
