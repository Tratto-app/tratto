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
  // "maria de los angeles" → "Maria de los Angeles": las partículas van en minúscula.
  const particulas = new Set(['de', 'del', 'la', 'las', 'los', 'y', 'da', 'di', 'van', 'von']);
  return limpio
    .split(' ')
    .map((p, i) =>
      i > 0 && particulas.has(p.toLowerCase())
        ? p.toLowerCase()
        : p.length > 1
          ? p[0]!.toUpperCase() + p.slice(1)
          : p.toUpperCase(),
    )
    .join(' ');
}

export function nombreParecePlausible(s: string): boolean {
  return extraerNombre(s) !== '';
}

/**
 * Palabras que llegan cuando se pide el nombre pero que no son un nombre:
 * "sí", "dale", "hola", "gracias". Sin este filtro quedaban turnos a nombre de
 * "Sí" o "Dale" en la agenda del barbero.
 */
const NO_SON_NOMBRES = new Set(
  (
    'si no dale ok oka okey okay listo bueno buenas buenos hola holis chau gracias genial perfecto joya ' +
    'confirmo confirmar confirmado claro obvio de una va vale sale mañana hoy turno corte barba nada ' +
    'ninguno nadie yo el ella nombre mi me soy perdon disculpa que como cuando donde quiero reservar ' +
    'cancelar cambiar precio precios menu hablar persona barbero hora dia tarde noche jaja jeje'
  )
    .split(' ')
    .map((p) => normalizar(p)),
);

/**
 * Saca el nombre de lo que escribió el cliente cuando se lo pedimos: "soy
 * Santi", "me llamo Juan Pérez", "a nombre de Lucas", "Santi". Devuelve '' si
 * no parece un nombre (una respuesta suelta, una frase larga, un número).
 */
export function extraerNombre(texto: string): string {
  let t = texto
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/https?:\/\/\S+/gi, ' ')
    .trim();
  // "sí, soy Santi" / "dale, me llamo Juan": primero la muletilla, después el prefijo.
  t = t.replace(/^(s[ií]|dale|ok|okey|listo|bueno|perfecto|genial|joya|claro|de una)(?=[\s,.!]|$)[\s,.!]*/i, '');
  t = t.replace(
    /^(hola[\s,!.]*)?(yo\s+)?(ya te dije|te dije|soy|me llamo|mi nombre es|mi nombre|a nombre de|ponelo a nombre de|anotalo a nombre de|anotame como|es para|para)\s+/i,
    '',
  );
  t = t.replace(/[\s,.!¡¿?]+$/g, '');
  const limpio = sanearNombre(t);
  if (limpio.length < 2 || !/\p{L}{2}/u.test(limpio)) return '';
  const palabras = limpio.split(' ');
  if (palabras.length > 5) return '';
  if (palabras.every((p) => NO_SON_NOMBRES.has(normalizar(p)))) return '';
  if (NO_SON_NOMBRES.has(normalizar(palabras[0]!)) && palabras.length <= 2) return '';
  return limpio;
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

/**
 * Teléfono para que lo lea una persona: "+54 9 11 3333-4444". Los de otras
 * características o países van con "+" y los dígitos, sin inventar cortes.
 */
export function telefonoLegible(tel: string): string {
  const d = tel.replace(/\D/g, '');
  if (!d) return '';
  const caba = /^54911(\d{4})(\d{4})$/.exec(d);
  if (caba) return `+54 9 11 ${caba[1]}-${caba[2]}`;
  if (/^549\d{10}$/.test(d)) return `+54 9 ${d.slice(3)}`;
  return `+${d}`;
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

/** Símbolo y formato por moneda. Se agregan más a medida que hagan falta. */
const MONEDAS: Record<string, { simbolo: string; decimales: boolean }> = {
  ARS: { simbolo: '$', decimales: false },
  USD: { simbolo: 'US$', decimales: true },
  PAB: { simbolo: 'B/. ', decimales: true },
  UYU: { simbolo: '$U ', decimales: false },
  CLP: { simbolo: '$', decimales: false },
  MXN: { simbolo: '$', decimales: false },
  COP: { simbolo: '$', decimales: false },
  PEN: { simbolo: 'S/ ', decimales: true },
  EUR: { simbolo: '€', decimales: true },
};

/**
 * Precio listo para mostrarle al cliente.
 *
 * Un precio en 0 no es "gratis": es "todavía no lo cargaron". El bot lo dice
 * asi en vez de inventar un número.
 */
export function formatearPrecio(precio: number, moneda = 'ARS'): string {
  if (precio <= 0) return 'a confirmar';
  const formato = MONEDAS[moneda] ?? { simbolo: `${moneda} `, decimales: true };
  // Solo se muestran centavos si el precio los tiene: "US$ 12,50" pero "US$ 15".
  const conCentavos = formato.decimales && precio % 1 !== 0;
  return `${formato.simbolo}${precio.toLocaleString('es-AR', {
    minimumFractionDigits: conCentavos ? 2 : 0,
    maximumFractionDigits: conCentavos ? 2 : 0,
  })}`;
}

export function formatearDuracion(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}
