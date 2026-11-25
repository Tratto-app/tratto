# DN Fragancias: página de muestra

Página propia para DN Fragancias (perfumes árabes y fragancias alternativas, por mayor y por menor, Trujui, Moreno).
Mantiene el flujo de Pency: elegir, armar el pedido y mandarlo por WhatsApp.

```
dnfragancias/
├── index.html                    la página entera (CSS y JS adentro). Arriba: CONFIG y PRODUCTOS
├── logo.jpg                      logo recortado (sin la marca de agua de Meta AI)
├── productos_dnfragancias.json   los 521 productos disponibles en Pency
├── tools/incrustar-productos.py  vuelve a meter el JSON en index.html si cambia el catálogo
└── tests/e2e.cjs                 81 chequeos de punta a punta (Playwright)
```

Muestra publicada en https://dn-fragancias.vercel.app (proyecto `dnfragancias` en Vercel, raíz `dnfragancias/`).
No se sirve desde el dominio de Tratto (está en `.vercelignore` de la raíz). Las pruebas, las herramientas,
el README y el JSON no se publican (`dnfragancias/.vercelignore`). Cuando el negocio la apruebe, sacar
el "Página de muestra." del pie.

## Cambiar datos

- Datos del negocio: objeto `CONFIG` al principio de `index.html` (WhatsApp, dirección, horarios, mínimos, pagos, envíos, aclaración legal).
- Mínimo mayorista: `MINIMO_MAYORISTA_UNIDADES`.
- Catálogo nuevo: reemplazar `productos_dnfragancias.json` y correr `python3 tools/incrustar-productos.py`.
- Nombres con marca, formatos, kits y categorías: bloque "REGLAS DEL CATÁLOGO" al principio del segundo `<script>`.
- Los datos para Google y WhatsApp del `<head>` (Open Graph y JSON-LD) se actualizan a mano: los leen sin ejecutar JavaScript.

## Probar

```bash
cd dnfragancias && python3 -m http.server 8137   # en una terminal
node tests/e2e.cjs                                # en otra
```

## Pendientes para pedirle a DN Fragancias

Buscar `[CONFIRMAR]` y `[COMPLETAR]` en `index.html`.

| Pendiente | Dónde |
|---|---|
| Mínimo de compra mayorista (hoy 5 unidades surtidas) | `MINIMO_MAYORISTA_UNIDADES` |
| Formas de pago (en Pency figuran link de pago, efectivo y transferencia) | `CONFIG.formasDePago` |
| Costo y demora de envío | `CONFIG.envios` |
| Si los body splash, el aceite capilar, la loción y el kit de regalo son originales | `CONFIG.marcasOriginalesConfirmadas` |
| Dominio propio (hoy dn-fragancias.vercel.app en canonical, Open Graph y JSON-LD) | `<head>` |
| Código postal: la captura dice B1664 y Google Maps, B1736 | `CONFIG.codigoPostal` y JSON-LD |
| Si los precios del catálogo son mayoristas y cuánto sale por menor | textos del carrito |
| Los más vendidos, para que "Más pedidos" use ventas reales | campo `pedidos` en el JSON |
