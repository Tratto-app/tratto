# Links que abren el pedido ya escrito

Un link a la app puede traer el pedido escrito. Quien lo toca entra (o crea
su cuenta) y le aparece "Nuevo pedido" con el texto, el rubro y la zona ya
cargados: revisa, completa lo que falte y publica.

## Formato

```
https://www.trattoapp.com.ar/?pedir=<texto>&rubro=<rubro>&zona=<zona>
```

| Parámetro | Qué es | Obligatorio |
|---|---|---|
| `pedir` | El pedido en palabras de cliente (hasta 500 letras) | Uno de los dos |
| `rubro` | Uno de los 46 rubros, escrito igual que en la app | Uno de los dos |
| `zona` | `CABA`, `GBA Norte`, `GBA Oeste`, `GBA Sur` u otra zona de la app | No |

- Los textos van codificados para URL (`encodeURIComponent`): los espacios
  quedan `%20`, la ñ `%C3%B1`.
- Se pueden sumar los parámetros de siempre (`utm_source`, `utm_campaign`,
  `o`, etc.). Siguen midiendo igual.
- Si no va `rubro`, la app intenta adivinarlo por palabras del texto
  (`PISTAS_RUBRO` en `index.html`). Solo lo elige si hay una sola coincidencia
  clara; si no, lo elige la persona.
- Un rubro mal escrito se ignora (no rompe nada) y una zona que no existe
  también.

## Ejemplos

```
https://www.trattoapp.com.ar/?pedir=Se%20me%20tap%C3%B3%20la%20pileta%20de%20la%20cocina&zona=CABA&utm_source=tiktok
https://www.trattoapp.com.ar/?rubro=Pintura&pedir=Pintar%20un%20monoambiente%20de%2030%20m2&zona=GBA%20Sur&utm_source=guia
https://www.trattoapp.com.ar/?rubro=Fletes%20y%20mudanzas&zona=GBA%20Oeste
```

## Qué pasa al tocarlo

1. El pedido se guarda en el teléfono por 7 días y se borra de la barra de
   direcciones.
2. Si no tiene sesión, la pantalla de ingreso le avisa: "Tu pedido «…» quedó
   guardado. Creá tu cuenta o iniciá sesión y lo publicás en un toque."
3. Al entrar como cliente se abre "Nuevo pedido" con todo cargado. Nada se
   publica solo: confirma con "Buscar quién lo haga".
4. Se usa una vez. Quien entra como quien ofrece servicios no lo ve.

## Dónde usarlo

- Guías y páginas de precios: el botón "Pedir" de cada trabajo.
- Videos y carruseles: el link del CTA, con el pedido del ejemplo del video.
- Anuncios: un link por anuncio, con el pedido que muestra el creativo.

La prueba está en `tools/confianza/ideas.browser.test.mjs`.
