# Trabajo protegido e identidad comprobada

Decidido por el fundador el 28/10/2026. Este documento explica cómo funciona,
qué falta para lanzarlo y qué hace soporte con cada caso.

## La regla

- El cliente puede proteger un presupuesto aceptado pagándole a Tratto una
  cuota del **5 % del presupuesto, mínimo $1.500**, una sola vez.
- Si quien hace el trabajo no lo termina, el cliente reclama desde el
  presupuesto y elige:
  - **Seguir:** en 48 horas hábiles (lunes a viernes, sin descontar feriados)
    Tratto le pasa otra persona de su zona con identidad comprobada que le
    mande presupuesto para terminarlo. Si no se consigue a tiempo, se le
    devuelve la cuota.
  - **No seguir:** se le devuelve la cuota.
- **Tratto no paga el trabajo, ni la diferencia de precio, ni materiales ni
  daños.** Lo único que devuelve es la cuota.
- No se llama "seguro" en ningún lado: vender seguros es solo para aseguradoras
  autorizadas por la Superintendencia de Seguros (Ley 20.091). Es un
  compromiso comercial de Tratto (punto 4.5 de los términos del cliente).
- Solo se ofrece si quien hace el trabajo tiene **identidad comprobada** y
  **Mercado Pago conectado** (el trabajo se tiene que poder pagar por la app).
- Quien abandona un trabajo protegido pierde el distintivo de identidad.

## Identidad comprobada

Quien ofrece servicios manda desde Panel o Cuenta → Identidad: su nombre como
figura en el DNI, foto del DNI de frente y de dorso, y una selfie
sosteniéndolo. Te llega un mail ("Identidad para revisar") y aparece en el
CRM → **Confianza**. Ahí mirás las tres fotos y apretás Aprobar o No aprobar
(con el motivo, que la persona ve).

- Las fotos están en el bucket privado `identidad`: solo las leen los
  miembros owner/admin del CRM, con enlaces que vencen a los 10 minutos.
- Se borran apenas decidís (la base llama a la función `trabajo-protegido`,
  acción `limpiar`) y, si algo quedó, en la limpieza de cada noche (06:40 UTC,
  tarea `trabajo-protegido-noche`). También se borran las subidas que nunca se
  mandaron.
- No hay reconocimiento facial automático ni consulta de antecedentes: lo
  decide una persona.
- Queda solo `public.distintivos` (user_id, tipo `identidad`, desde).

## Cómo está armado

| Pieza | Dónde |
|---|---|
| Tablas, reglas y permisos | `supabase/migrations/20261028200000_trabajo_protegido.sql` y `20261028201000_trabajo_protegido_interruptor.sql` |
| Cobro de la cuota, devoluciones y limpieza de fotos | función `trabajo-protegido` (`tools/supabase-functions/trabajo-protegido/`, pruebas en `handler.test.mjs`) |
| Pantallas de la app | `index.html`: presupuesto aceptado (oferta, pago, sello, reclamo), Panel/Cuenta → Identidad, distintivo en el perfil, preguntas frecuentes |
| Panel de soporte | CRM → Confianza (`growth/web/src/pages/Confianza.tsx`) |
| Pruebas de la app | `tools/confianza/trabajo-protegido.browser.test.mjs` |
| Textos legales | `terminos-cliente.html` 4.5 y 6.3, `terminos-proveedor.html` 8.3 y 8.4, `privacidad.html` 2.5, `confianza.html` 6 |

- La cuota se calcula en la base (`privado.cuota_proteccion`), nunca en el
  navegador. El cobro va con `binary_mode` (aprobado o rechazado, sin
  pendientes) y clave de idempotencia por presupuesto y tarjeta.
- Si Mercado Pago cobra pero la base no puede registrar la protección (o ya
  estaba protegido), la función devuelve el pago en el acto.
- Cuando el cliente paga el trabajo como terminado, la protección pasa sola a
  `cumplida`.

## Para lanzarlo (en este orden)

1. **Cuenta de Mercado Pago de Tratto en la función.** En Mercado Pago
   Developers → Tus integraciones → la aplicación de Tratto → Credenciales de
   producción, copiar el *Access Token* y la *Public Key*. En Supabase →
   Edge Functions → Secrets, cargar `MP_TRATTO_ACCESS_TOKEN` y
   `MP_TRATTO_PUBLIC_KEY`. Nunca pegarlos en el chat ni en el repo. Sin esto,
   la función responde "todavía no está disponible" y no cobra nada.
2. Que un abogado lea el punto 4.5 de los términos del cliente
   (recomendado: es un compromiso de plata con consumidores, Ley 24.240).
3. Fusionar la rama.
4. Prender el interruptor:
   `update privado.config set valor='si' where clave='trabajo_protegido_activo';`
   Hasta entonces la app no ofrece proteger nada (la identidad sí se puede
   mandar y revisar desde ya).
5. Pedirles a quienes ofrecen servicios que comprueben su identidad: sin
   ninguno comprobado, nadie puede proteger un trabajo.

## Qué hace soporte con un reclamo

Llega el mail "Reclamo de Trabajo protegido" y el caso aparece primero en CRM
→ Confianza, con el plazo.

- **Quiere seguir:** buscar a alguien con identidad comprobada del mismo rubro
  y zona (Usuarios del CRM, `trabajo listo`) y pedirle que le escriba por la
  app. Cuando le mandó presupuesto: **Conseguimos a otra persona**. Si se vence
  el plazo sin nadie: **Devolver la cuota**.
- **No quiere seguir:** **Devolver la cuota**. La devolución sale sola por
  Mercado Pago desde la cuenta de Tratto (y la reintenta cada noche si falla).
- **Volvió quien lo hacía y el cliente está de acuerdo:** **Sigue el mismo**
  (la protección vuelve a quedar activa y no pierde el distintivo).

Conseguir reemplazo o devolver la cuota de un caso reclamado le saca el
distintivo a quien abandonó. Cada decisión queda escrita en el reclamo del
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
