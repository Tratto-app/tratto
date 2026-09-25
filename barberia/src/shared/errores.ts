/**
 * Errores de dominio.
 *
 * `mensajeCliente` es lo unico que puede llegar a ver el cliente por WhatsApp:
 * nunca se filtran stack traces, nombres de tablas ni detalles internos.
 */
export class ErrorDeNegocio extends Error {
  readonly codigo: string;
  readonly mensajeCliente: string;
  readonly datos: Record<string, unknown>;
  readonly httpStatus: number;

  constructor(
    codigo: string,
    mensajeInterno: string,
    mensajeCliente: string,
    opciones: { datos?: Record<string, unknown>; httpStatus?: number } = {},
  ) {
    super(mensajeInterno);
    this.name = 'ErrorDeNegocio';
    this.codigo = codigo;
    this.mensajeCliente = mensajeCliente;
    this.datos = opciones.datos ?? {};
    this.httpStatus = opciones.httpStatus ?? 400;
  }
}

export const errores = {
  horarioOcupado: (detalle = '') =>
    new ErrorDeNegocio(
      'HORARIO_OCUPADO',
      `El horario ya esta tomado. ${detalle}`.trim(),
      'Justo se ocupó ese horario 😕 Te paso otras opciones.',
      { httpStatus: 409 },
    ),
  fueraDeHorario: (detalle = '') =>
    new ErrorDeNegocio('FUERA_DE_HORARIO', `Horario fuera de la jornada laboral. ${detalle}`.trim(), 'Ese horario queda fuera del horario de atención.'),
  diaCerrado: (motivo = '') =>
    new ErrorDeNegocio('DIA_CERRADO', `El dia esta cerrado. ${motivo}`.trim(), motivo ? `Ese día no abrimos (${motivo}).` : 'Ese día no abrimos.'),
  servicioInexistente: (id: string) =>
    new ErrorDeNegocio('SERVICIO_INEXISTENTE', `Servicio inexistente o inactivo: ${id}`, 'Ese servicio no lo estamos haciendo. ¿Te paso los que sí hacemos?'),
  turnoNoEncontrado: () =>
    new ErrorDeNegocio('TURNO_NO_ENCONTRADO', 'No existe el turno pedido', 'No encuentro ese turno. ¿Lo sacaste con este número?', { httpStatus: 404 }),
  anticipacionMinima: (minutos: number) =>
    new ErrorDeNegocio('ANTICIPACION_MINIMA', `Se necesita reservar con ${minutos} minutos de anticipacion`, 'Ese horario es demasiado sobre la hora. ¿Te muestro los próximos disponibles?'),
  demasiadoLejos: (dias: number) =>
    new ErrorDeNegocio('DEMASIADO_LEJOS', `Solo se reserva hasta ${dias} dias en el futuro`, `Por ahora estamos tomando turnos hasta ${dias} días para adelante.`),
  limiteTurnos: (max: number) =>
    new ErrorDeNegocio('LIMITE_TURNOS', `El cliente supera el maximo de ${max} turnos futuros`, `Ya tenés ${max} turno(s) reservado(s). Si querés, cancelamos alguno y sacamos otro 👍`),
  cancelacionTardia: (horas: number, accion: 'cancelar' | 'cambiar' = 'cancelar') =>
    new ErrorDeNegocio(
      'CANCELACION_TARDIA',
      `${accion === 'cancelar' ? 'Cancelacion' : 'Cambio'} dentro de las ${horas} horas previas`,
      `Falta muy poco para el turno y ya no lo puedo ${accion} por acá 🙏 Si querés, le aviso al barbero para que lo vea él.`,
    ),
  holdVencido: () =>
    new ErrorDeNegocio('HOLD_VENCIDO', 'La reserva temporal expiro', 'Se me venció la reserva del horario 😅 ¿Lo buscamos de nuevo?', { httpStatus: 409 }),
  datosInvalidos: (detalle: string, mensajeCliente = 'Me faltan datos para poder seguir.') =>
    new ErrorDeNegocio('DATOS_INVALIDOS', detalle, mensajeCliente, { httpStatus: 422 }),
  noDisponible: () =>
    new ErrorDeNegocio('SIN_DISPONIBILIDAD', 'No hay horarios disponibles', 'No me quedan horarios ahí. ¿Vemos otro día?'),
};

export function esErrorDeNegocio(e: unknown): e is ErrorDeNegocio {
  return e instanceof ErrorDeNegocio;
}

export function mensajeParaCliente(e: unknown, porDefecto: string): string {
  return esErrorDeNegocio(e) ? e.mensajeCliente : porDefecto;
}
