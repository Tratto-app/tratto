import type { NextFunction, Request, Response } from 'express';
import { esErrorDeNegocio } from '../../shared/errores.js';
import { log } from '../../shared/log.js';
import { esProduccion } from '../../config/env.js';

/**
 * Manejador final de errores.
 * Hacia afuera solo sale un codigo y un mensaje seguro; el detalle queda en el log.
 */
export function manejadorDeErrores(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  if (res.headersSent) return;

  if (esErrorDeNegocio(err)) {
    res.status(err.httpStatus).json({ error: err.codigo, mensaje: err.mensajeCliente });
    return;
  }

  log.error(
    { err: err instanceof Error ? err.stack : String(err), ruta: req.path, metodo: req.method },
    'error no controlado',
  );
  res.status(500).json({
    error: 'error_interno',
    mensaje: 'Tuvimos un problema procesando el pedido. Probá de nuevo en un momento.',
    ...(esProduccion ? {} : { detalle: err instanceof Error ? err.message : String(err) }),
  });
}

export function noEncontrado(_req: Request, res: Response): void {
  res.status(404).json({ error: 'no_encontrado' });
}
