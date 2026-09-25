/**
 * Fila por clave: las tareas con la misma clave corren de a una, en el orden
 * en que llegaron; las de claves distintas corren en paralelo.
 *
 * Se usa por teléfono. Si un cliente manda dos mensajes seguidos ("hola" y
 * "quiero turno mañana"), WhatsApp los entrega en dos webhooks casi juntos.
 * Sin esto se procesaban a la vez: los dos leían el mismo estado de la charla,
 * el segundo pisaba lo que guardó el primero (se perdía el horario apartado o
 * parte del historial) y las respuestas podían llegar en desorden.
 *
 * Vive en memoria: alcanza porque el servicio corre en una sola instancia. La
 * agenda igual está protegida aparte por la transacción de la base.
 */
const colas = new Map<string, Promise<unknown>>();

export async function enFila<T>(clave: string, tarea: () => Promise<T>): Promise<T> {
  const anterior = colas.get(clave) ?? Promise.resolve();
  const actual = anterior.then(tarea, tarea);
  const cola = actual.catch(() => undefined);
  colas.set(clave, cola);
  try {
    return await actual;
  } finally {
    // Si nadie se encoló detrás, se libera la clave (no crece sin límite).
    if (colas.get(clave) === cola) colas.delete(clave);
  }
}
