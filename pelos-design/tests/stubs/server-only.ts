/**
 * Stub de `server-only` para el entorno de tests.
 *
 * El paquete real lanza al importarse fuera de un Server Component, que es
 * exactamente la protección que queremos en producción: impide que la API key
 * de Google llegue al bundle del navegador. Esa garantía la aplica el build de
 * Next, no Vitest, así que acá se neutraliza para poder testear la lógica.
 *
 * Para que la protección no se pueda quitar sin que nadie se entere,
 * `tests/unit/places.test.ts` verifica que el import siga en el archivo fuente.
 */
export {};
