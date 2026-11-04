# validar-cuit

Confirma con ARCA que el nombre y el CUIL o CUIT de quien ofrece servicios van
juntos. Reemplaza a la foto del DNI en el registro (fundador, 04/11/2026). Usa
el padrón de ARCA `ws_sr_padron_a13`, que es gratis.

## Cómo funciona

- **Registro (index.html).** Quien ofrece servicios elige "Por mi cuenta" o
  "Con una empresa" y escribe el nombre (o la razón social) y el número. La app
  llama a `consultar` mientras escribe y solo deja crear la cuenta si coincide.
  Si ARCA no responde, deja seguir y la base lo revisa después.
- **Recién creada la cuenta.** La app llama a `confirmar`. Si coincide, se pone
  el distintivo `cuit` y la ficha muestra "CUIL verificado" (o "CUIT
  verificado" si es una empresa).
- **Cada hora.** El cron `validar-cuit-revisar` llama a `revisar`, que chequea a
  quienes ofrecen servicios y todavía no tienen estado: las cuentas viejas, las
  que no pasaron por `confirmar` y las pendientes.
- **Panel.** A quien no coincidió (o no tiene CUIT) se le muestra "Confirmá tu
  CUIL" con una hoja para corregirlo. El nombre que ven los clientes no cambia.
- **Qué se guarda y qué no.** Nunca se devuelve ni se guarda el nombre que tiene
  ARCA. Se guarda el resultado, la fecha y una huella (hash) del nombre escrito.
  Límites: 12 consultas por hora por conexión y 5 nombres distintos por hora
  para un mismo número.

Sin certificado cargado, todo responde "pendiente" en silencio y el registro
funciona como antes: solo se controla el dígito verificador.

## Certificado

1. **Pedido.** La clave y el pedido se generaron adentro de la función el
   04/11/2026, con `select privado.validar_cuit_llamar('{"accion":"generar_pedido","cuit":"20472548639"}')`.
   La clave quedó en Vault (`arca_clave_privada`). El pedido está en
   `privado.arca.pedido_pem` y es público.
2. **Certificado en ARCA.** El titular, con clave fiscal, entra a
   "Administración de Certificados Digitales", crea el alias `tratto-padron`
   subiendo el pedido y descarga el certificado (.crt). Después, en
   "Administrador de Relaciones de Clave Fiscal", asocia el servicio
   `ws_sr_padron_a13` a ese alias (computador fiscal).
3. **Cargar el certificado.** El certificado es público, así que se puede pegar
   en una consulta:
   `update privado.arca set certificado_pem = '<el .crt>' , updated_at = now() where id = 1;`
4. **Probar.** Corré
   `select privado.validar_cuit_llamar('{"accion":"probar","cuit":"20472548639"}')`
   y leé la respuesta en `net._http_response`. Tiene que decir `estado: ok`,
   sin nombres.
5. **Arrancar la revisión.** El cron revisa las cuentas que ya estaban, de a 20
   por hora.

Para generar un pedido nuevo cuando ya hay un certificado, se pasa
`"forzar": true`. Eso invalida el certificado anterior.

## Pruebas

```sh
node --test tools/supabase-functions/validar-cuit/handler.test.mjs   # la función
node --test tools/confianza/cuit.browser.test.mjs                    # la pantalla
```

La prueba del certificado usa `node-forge`. Si no está instalado, se saltea; se
puede apuntar a él con `TRATTO_FORGE_MODULE`.

Desplegar con `verify_jwt=false`, como trabajo-protegido.
