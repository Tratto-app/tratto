# App de Android (Play Store)

Es una **Trusted Web Activity**: la misma app web de `www.trattoapp.com.ar`
abierta a pantalla completa desde un paquete Android. Cada cambio en la web
llega solo a la app; solo hay que subir una versión nueva a Play si cambia algo
del paquete (ícono, nombre, colores, permisos).

- Paquete: `ar.com.trattoapp` (no se puede cambiar una vez publicado).
- La versión está en `twa-manifest.json` (`appVersionName` y `appVersionCode`;
  hoy 1.0.1, versionCode 2). Cada subida a Play necesita un versionCode mayor.
- targetSdk 36, minSdk 23. Notificaciones habilitadas (se delegan a la web).

## La clave de firma

**No está en el repo, y no se puede perder.** Es la *clave de subida*: la
tiene el dueño (archivo `tratto-upload.keystore` + contraseña). Con Play App
Signing, si se pierde se puede pedir un reseteo a Google, pero lleva días.

`.well-known/assetlinks.json` tiene que listar la huella SHA-256 de esta clave
**y** la de la clave de firma de Play (Play Console → Configuración → Integridad
de la app). Sin eso la app muestra la barra del navegador arriba.

## Armar una versión nueva (Codemagic)

1. Subir `appVersionName` y `appVersionCode` en `twa-manifest.json` y anotar
   los cambios en `NOTAS-VERSIONES.md`.
2. Codemagic → la app → **Start new build** → workflow *Tratto Android →
   paquete para Play*. En unos minutos deja `tratto-<versión>.aab` firmado
   para descargar.
3. Play Console → Prueba cerrada (o Producción) → Crear versión → subir el
   `.aab` y pegar la nota de `NOTAS-VERSIONES.md`.

La clave de subida vive solo en Codemagic (Team settings → Code signing
identities → Android keystores, nombre `tratto_upload`, alias `tratto`).

## Volver a generar a mano

```bash
npm i @bubblewrap/core@1.25.0
node generar.js                       # ajustar rutas del keystore adentro
cd proyecto && ./gradlew bundleRelease assembleRelease
jarsigner -keystore tratto-upload.keystore app/build/outputs/bundle/release/app-release.aab tratto
```
