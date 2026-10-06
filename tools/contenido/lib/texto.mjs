// Utilidades de texto en castellano: normalizar, contar palabras, comparar
// frases y limpiar lo que entra desde afuera.

const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u200B-\u200F\u202A-\u202E\u2066-\u2069]/g;

// Saca caracteres de control e invisibles (incluye los de dirección de texto,
// que se usan para esconder instrucciones) y recorta al largo máximo.
export function limpiar(valor, maximo = 5000) {
  if (valor === undefined || valor === null) return '';
  let t = String(valor).replace(/\r\n?/g, '\n').replace(CONTROL, '').trim();
  if (t.length > maximo) t = t.slice(0, maximo).trimEnd() + '…';
  return t;
}

export function normalizar(t) {
  return String(t ?? '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/(\d)[.,](?=\d)/g, '$1')
    .replace(/(\d+)\s*(mil|lucas|luquitas)\b/g, '$1000')
    .replace(/[^a-z0-9ñ\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function palabras(t) {
  const n = normalizar(t);
  return n ? n.split(' ') : [];
}

export function contarPalabras(t) {
  return palabras(t).length;
}

// Palabras que no aportan al comparar dos frases.
const VACIAS = new Set(('a al algo como con de del el en es esa ese eso esta este esto la las le les lo los mas me mi muy no o para pero por que se si sin su sus te tu tus un una uno unos y ya vos te')
  .split(' '));

function conjunto(t) {
  return new Set(palabras(t).filter((p) => !VACIAS.has(p)));
}

// Similitud de Jaccard sobre palabras con contenido (0 a 1).
export function similitud(a, b) {
  const A = conjunto(a), B = conjunto(b);
  if (!A.size && !B.size) return 1;
  if (!A.size || !B.size) return 0;
  let comun = 0;
  for (const p of A) if (B.has(p)) comun++;
  return comun / (A.size + B.size - comun);
}

export function segundosDeLectura(t, palabrasPorSegundo = 3) {
  return Math.round((contarPalabras(t) / palabrasPorSegundo) * 10) / 10;
}

// Verbos en imperativo rioplatense que suelen marcar un pedido de acción.
const VERBOS_CTA = ['guarda', 'guardalo', 'guardala', 'compartilo', 'compartila', 'comparti', 'manda', 'mandale', 'mandaselo',
  'etiqueta', 'etiquetalo', 'etiquetala', 'comenta', 'contame', 'escribi', 'escribime', 'escribinos', 'segui', 'seguinos',
  'pedi', 'entra', 'descarga', 'descargala', 'bajate', 'registrate', 'proba', 'anotate', 'tocá', 'dejame', 'responde', 'vota', 'elegi'];

export function tieneCTA(t) {
  const ps = new Set(palabras(t));
  return VERBOS_CTA.some((v) => ps.has(normalizar(v)));
}

export function oraciones(t) {
  return String(t ?? '').split(/(?<=[.!?¿¡…])\s+|\n+/).map((s) => s.trim()).filter(Boolean);
}
