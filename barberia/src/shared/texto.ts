/** Normalizacion y saneamiento de texto que entra desde afuera (WhatsApp, panel). */

const LIMITE_MENSAJE = 2000;

export function normalizar(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Limpia texto entrante: saca caracteres de control, recorta y limita el largo.
 * No intenta "detectar prompt injection": el modelo no tiene permisos propios,
 * toda accion pasa por las funciones del backend, que validan aparte.
 */
export function sanearMensaje(s: string, limite = LIMITE_MENSAJE): string {
  return s
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .trim()
    .slice(0, limite);
}

/** Nombre de cliente: letras, espacios y algunos signos. Nada de URLs ni markup. */
export function sanearNombre(s: string): string {
  const limpio = s
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/https?:\/\/\S+/gi, ' ')
    .replace(/[^\p{L}\p{M}\s'’.\-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 60);
  return limpio
    .split(' ')
    .map((p) => (p.length > 1 ? p[0]!.toUpperCase() + p.slice(1) : p.toUpperCase()))
    .join(' ');
}

export function nombreParecePlausible(s: string): boolean {
  const limpio = sanearNombre(s);
  return limpio.length >= 2 && limpio.length <= 60 && /\p{L}/u.test(limpio);
}

/**
 * Normaliza un numero al formato que usa WhatsApp (E.164 sin el "+").
 *
 * La WhatsApp Cloud API entrega el `wa_id` ya normalizado; esto existe para los
 * numeros que el barbero carga a mano en el panel, donde aparece de todo:
 * "11 2233-4455", "011 15 2233 4455", "+54 9 11 2233 4455".
 */
export function normalizarTelefono(tel: string, opciones: { codigoPais?: string } = {}): string {
  const codigoPais = (opciones.codigoPais ?? '54').replace(/\D/g, '') || '54';
  let n = tel.replace(/\D/g, '').replace(/^00/, '');
  if (!n) return '';

  if (codigoPais === '54') {
    // Argentina: los moviles necesitan el 9 despues del 54.
    if (n.startsWith('54')) {
      if (!n.startsWith('549')) n = `549${n.slice(2)}`;
      return n;
    }
    if (n.startsWith('0')) n = n.slice(1); // 011... -> 11...
    // El "15" del formato local va despues de la caracteristica y no existe en E.164.
    n = n.replace(/^(\d{2,4})15(\d{6,8})$/, '$1$2');
    return `549${n}`;
  }

  if (n.startsWith(codigoPais)) return n;
  if (n.startsWith('0')) n = n.slice(1);
  return `${codigoPais}${n}`;
}

/** Un numero de WhatsApp valido tiene entre 10 y 15 digitos (E.164). */
export function telefonoParecePlausible(tel: string): boolean {
  return /^\d{10,15}$/.test(tel);
}

export function recortar(s: string, max: number): string {
  if (s.length <= max) return s;
  const corte = s.slice(0, max);
  const ultimoEspacio = corte.lastIndexOf(' ');
  return `${(ultimoEspacio > max * 0.6 ? corte.slice(0, ultimoEspacio) : corte).trimEnd()}…`;
}

export function formatearPrecio(precio: number, moneda = 'ARS'): string {
  if (precio <= 0) return 'a confirmar';
  const simbolo = moneda === 'ARS' ? '$' : `${moneda} `;
  return `${simbolo}${precio.toLocaleString('es-AR')}`;
}

export function formatearDuracion(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}
