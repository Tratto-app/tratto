# Pruebas de la guía de primeros pasos

Prueban la guía (cliente y quien ofrece servicios), el aviso "Te falta publicar
tu servicio" y la edición de servicios sobre el `index.html` real, con Supabase,
n8n y el permiso de notificaciones simulados: no crean cuentas ni publican nada
en producción.

```bash
python3 -m http.server 8765 --bind 127.0.0.1 &      # desde la raíz del repo
node tools/pruebas/guia-primeros-pasos/casos.js      # usa el Playwright instalado
```

Casos: proveedor nuevo que publica su primer servicio, proveedor sin servicios
que omite la guía, cerrar y retomar, notificaciones permitidas, rechazadas y no
disponibles (iPhone en Safari sin instalar), Mercado Pago conectado, pendiente y
con error, usuario que ya la completó, cuentas viejas, quedarse sin servicios y
tres tamaños de pantalla (320, 375 y escritorio). Las capturas quedan en
`$CAPTURAS` (por defecto, la carpeta temporal del sistema).
