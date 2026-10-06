// Errores del motor de contenido.
// ErrorEntrada: el problema está en lo que se le pasó (JSON, flags, valores).
// La CLI lo muestra tal cual y sale con código 2. Cualquier otro error es un
// fallo interno y sale con código 1.

export class ErrorEntrada extends Error {
  constructor(mensaje, detalles = []) {
    super(mensaje);
    this.name = 'ErrorEntrada';
    this.detalles = detalles;
  }
}

export function exigir(condicion, mensaje, detalles) {
  if (!condicion) throw new ErrorEntrada(mensaje, detalles);
}
