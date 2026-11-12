# Las cuatro micro apps de nicho

Son la misma base de Cobranza sin vueltas con otro nombre, otras palabras y un
par de comportamientos propios. Corren **enteras en el celular del que las
compra**: no hay servidor, ni cuentas, ni instalación tuya. Los datos quedan en
ese celular.

| App | Para quién | Archivo para vender | Demo | Precio único |
|---|---|---|---|---|
| Cuotas al día | Academias, escuelas de danza y fútbol, profes | `dist/cuotas-al-dia.html` | `dist/cuotas-al-dia-demo.html` | $ 29.000 |
| Control al día | Odontólogos | `dist/control-al-dia.html` | `dist/control-al-dia-demo.html` | $ 59.000 |
| Libreta | Almacenes y kioscos | `dist/libreta.html` | `dist/libreta-demo.html` | $ 19.000 |
| Combi al día | Transporte escolar | `dist/combi-al-dia.html` | `dist/combi-al-dia-demo.html` | $ 29.000 |

## Qué hace cada una

**Cuotas al día.** Cada alumno con su cuota mensual, su clase y, si es chico,
el nombre del alumno aparte del adulto al que se le escribe. La cuota del mes
siguiente se crea sola. Cada mañana muestra a quién recordarle (3 días antes,
el día, y a los 3 y 7 días de atraso) con el mensaje listo: "Hola Laura, hoy
vence tu pago de $ 28.000 por la cuota de marzo de Sofi."

**Combi al día.** Igual que Cuotas al día, con familias agrupadas por colegio y
turno, y los chicos que viajan en el mensaje.

**Libreta.** Una cuenta por cliente. Se anota cada fiado en dos toques, suma
sola y muestra el total. Desde el día de cobro propone recordarle el saldo a
cada uno, una vez por semana y hasta tres veces por mes. Acepta entregas a
cuenta.

**Control al día.** Cada paciente con la fecha de su último control y cada
cuántos meses vuelve. Cuando le toca, aparece en la lista con el mensaje listo;
si no responde, insiste a los 14 días y hasta tres veces. Con "Vino hoy" el
control vuelve a contar. También lleva las cuotas de ortodoncia o implantes. No
guarda historia clínica: solo nombre, celular y fechas.

Las cuatro comparten: avisos con un toque desde el WhatsApp del dueño, de lunes
a sábado de 9 a 20 y nunca más de uno por día a la misma persona; entregas a
cuenta; carga de una lista pegada o de un Excel; logo, color y nombre del
negocio; y los datos para transferir al final de cada mensaje de cobro.

## Cómo se venden: la tienda

Las apps se venden solas. No hay que recibir transferencias ni mandar links a
mano. Todo lo que hay que publicar está en `dist/tienda/`:

| Dirección | Qué es |
|---|---|
| `/` | El catálogo con las cuatro apps |
| `/cuotas-al-dia/` (y las otras tres) | La página de venta, con la demo viva adentro de un celular |
| `/cuotas-al-dia/app.html` | La app. Sin licencia no abre: ofrece comprar o activar |
| `/gracias.html` | A donde vuelve el comprador después de pagar |

**El recorrido del comprador**

1. Entra a la página de venta, prueba la demo y toca **Comprar**.
2. Paga en Mercado Pago, con tarjeta o con la plata de su cuenta. La plata entra a tu Mercado Pago.
3. Mercado Pago lo devuelve a la tienda, que confirma el pago y le abre la app.
4. Le queda un link para volver a entrar o para abrirla en otro celular.

Si cierra la ventana antes de volver, entra a `/gracias.html`, pone el número
de operación y el mail con el que pagó, y recupera su compra solo.

**Lo que necesita para andar**

La tienda es un sitio estático con tres funciones chicas (`api/comprar`,
`api/activar` y `api/verificar`), listo para Vercel. Necesita dos claves, que se
cargan en la configuración del sitio y nunca van al repo:

- `MP_ACCESS_TOKEN`: la credencial de producción de tu aplicación de Mercado Pago.
- `LICENCIA_SECRETO`: una frase larga cualquiera. Con ella se firman las licencias.

No usa base de datos: la licencia es el número de pago firmado. Por eso una
licencia no se puede inventar, y si devolvés una compra desde Mercado Pago, esa
licencia deja de activar celulares nuevos.

**La dirección no se puede cambiar después.** Los datos de cada comprador
quedan atados a esa dirección en su celular. Elegí bien el nombre antes de
vender la primera.

**Antes de publicar**, completá en `tienda/pagina.mjs` el nombre de la tienda
(hoy dice "Apps al día") y un contacto de ayuda. Las páginas prometen devolver
la plata dentro de los 10 días: si no querés ofrecerlo, sacalo de ahí.

Para probar todo sin cobrar nada: `node tools/tienda-local.mjs` levanta la
tienda con un Mercado Pago simulado.

Los archivos sueltos de `dist/` (`cuotas-al-dia.html` y los demás) son las
mismas apps sin candado, por si alguna vez querés entregar una a mano.

## Qué decirle al comprador

- Los datos están **solo en su celular**. Nadie más los ve, ni vos.
- Tiene que **agregar la app a la pantalla de inicio**. En iPhone, Safari puede
  borrar los datos de una página que no se usa por una semana si no está
  agregada ahí.
- Tiene que **guardar una copia** cada tanto (Ajustes → Copia de seguridad). La
  app se lo recuerda si pasan 14 días. Con esa copia recupera todo si cambia de
  celular.
- Si borra los datos del navegador o desinstala el navegador sin copia, los
  pierde.

## Lo que hay que saber antes de vender

- **El link de la compra se puede compartir.** Quien lo recibe puede activar la
  app sin pagar. A estos precios importa poco, pero va a pasar.
- **El código está en un repo público.** Cualquiera puede bajarse las apps
  desde GitHub. Si las vas a vender, conviene pasarlas a un repo privado.
- **No cobran con link de pago ni mandan mensajes solos.** Eso es la versión
  instalada de Cobranza sin vueltas ($ 150.000). Sirve como paso siguiente
  para el que quiera más.
- **Sin soporte incluido.** Con muchos compradores a precio bajo, conviene
  ayudar por mail o con un video corto de cómo usarla.

## Qué está probado

- 72 pruebas automáticas: las reglas de cada app (saldo de la libreta, entregas
  a cuenta, "le toca volver", guardado en el celular) y los candados de la
  venta (nadie activa con un pago ajeno, una devolución corta la licencia).
- Una compra de punta a punta con navegador y Mercado Pago simulado
  (`node tools/probar-tienda.mjs`).
- Un recorrido con navegador de celular por las cuatro apps y sus demos
  (`node tools/probar-nichos.mjs`): carga, avisos, entregas, copia de
  seguridad, recuperación y que los datos sigan ahí al recargar.

No está probado con Mercado Pago real, en celulares reales (iPhone y Android)
ni con compradores de verdad. Conviene que uses cada una vos una semana antes de venderla.

## Para sumar otro rubro

Los rubros están en `src/rubros.js`. Uno nuevo son unas 15 líneas: nombre,
color, palabras y si avisa por cuota, por saldo o por "le toca volver". El de
Control al día sirve casi igual para veterinarias (vacunas), talleres (service)
y peluquerías (hace 6 semanas que no viene): cambian los textos.
