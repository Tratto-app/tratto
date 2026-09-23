/**
 * Interfaz neutral de proveedor de IA.
 *
 * El agente no sabe si atrás hay Claude o OpenAI: pide respuestas y ejecuta
 * herramientas. Cada proveedor traduce a su propia API y se guarda su historial
 * interno, que es donde los dos difieren de verdad.
 *
 * Cambiar de proveedor es cambiar una variable de entorno, no tocar código.
 */

/** Herramienta descrita sin atarse a ningún proveedor. */
export interface DefinicionHerramienta {
  nombre: string;
  descripcion: string;
  /** JSON Schema del objeto de entrada. */
  esquema: Record<string, unknown>;
}

export interface PedidoDeHerramienta {
  id: string;
  nombre: string;
  entrada: unknown;
}

export interface ResultadoDeHerramienta {
  id: string;
  contenido: string;
  esError: boolean;
}

export type MotivoDeCorte = 'texto' | 'herramientas' | 'rehuso' | 'limite';

export interface RespuestaModelo {
  texto: string;
  herramientas: PedidoDeHerramienta[];
  motivo: MotivoDeCorte;
  uso?: { entrada: number; salida: number; cacheLeido: number };
}

export interface TurnoPrevio {
  rol: 'cliente' | 'bot';
  texto: string;
}

export interface PedidoInicial {
  /** Parte fija del prompt; los proveedores que cachean la aprovechan. */
  sistemaEstable: string;
  /** Parte que cambia en cada conversación (fecha, cliente, sus turnos). */
  sistemaVolatil: string;
  historial: TurnoPrevio[];
  mensaje: string;
  herramientas: DefinicionHerramienta[];
}

/**
 * Una conversación en curso con el modelo. El agente la va pisando:
 * pide la respuesta, ejecuta lo que el modelo pida, devuelve los resultados y
 * vuelve a pedir, hasta que el modelo contesta con texto.
 */
export interface Conversacion {
  siguiente(): Promise<RespuestaModelo>;
  agregarResultados(resultados: ResultadoDeHerramienta[]): void;
}

export interface ProveedorIA {
  readonly nombre: 'claude' | 'openai';
  readonly modelo: string;
  iniciar(pedido: PedidoInicial): Conversacion;
}

export class ErrorProveedor extends Error {
  readonly motivo: 'sin_credencial' | 'timeout' | 'api' | 'rehuso';
  constructor(motivo: ErrorProveedor['motivo'], mensaje: string) {
    super(mensaje);
    this.name = 'ErrorProveedor';
    this.motivo = motivo;
  }
}
