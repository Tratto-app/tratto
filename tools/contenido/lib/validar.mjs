// Validador de esquemas mínimo (sin dependencias). Devuelve la lista de
// errores en castellano con la ruta del campo, para que quien llama (una
// persona o una skill) sepa exactamente qué corregir.
//
// Esquema:
//   { tipo: 'objeto', campos: { x: {...} }, extra: false }
//   { tipo: 'texto', max: 200, min: 1 }      { tipo: 'entero', min: 0, max: 100 }
//   { tipo: 'numero', min: 0 }               { tipo: 'booleano' }
//   { tipo: 'enum', valores: ['a', 'b'] }    { tipo: 'fecha' }  (AAAA-MM-DD o ISO completo)
//   { tipo: 'lista', de: {...}, min: 0, max: 50 }
//   Cualquier campo admite requerido: true.

const FECHA = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})?)?$/;

function tipoDe(v) {
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'lista';
  return typeof v;
}

export function validar(valor, esquema, ruta = '') {
  const errores = [];
  const donde = ruta || '(raíz)';
  const t = esquema.tipo;

  if (t === 'objeto') {
    if (tipoDe(valor) !== 'object') return [`${donde}: tiene que ser un objeto, llegó ${tipoDe(valor)}`];
    for (const [campo, sub] of Object.entries(esquema.campos || {})) {
      const r = ruta ? `${ruta}.${campo}` : campo;
      if (valor[campo] === undefined || valor[campo] === null) {
        if (sub.requerido) errores.push(`${r}: falta (es obligatorio)`);
        continue;
      }
      errores.push(...validar(valor[campo], sub, r));
    }
    if (esquema.extra === false) {
      for (const campo of Object.keys(valor)) {
        if (!(campo in (esquema.campos || {}))) errores.push(`${ruta ? ruta + '.' : ''}${campo}: campo no reconocido`);
      }
    }
    return errores;
  }

  if (t === 'lista') {
    if (!Array.isArray(valor)) return [`${donde}: tiene que ser una lista, llegó ${tipoDe(valor)}`];
    if (esquema.min !== undefined && valor.length < esquema.min) errores.push(`${donde}: tiene que tener al menos ${esquema.min} elemento(s)`);
    if (esquema.max !== undefined && valor.length > esquema.max) errores.push(`${donde}: tiene ${valor.length} elementos, el máximo es ${esquema.max}`);
    if (esquema.de) valor.forEach((v, i) => errores.push(...validar(v, esquema.de, `${ruta}[${i}]`)));
    return errores;
  }

  if (t === 'texto') {
    if (typeof valor !== 'string') return [`${donde}: tiene que ser texto, llegó ${tipoDe(valor)}`];
    if (esquema.min !== undefined && valor.trim().length < esquema.min) errores.push(`${donde}: tiene que tener al menos ${esquema.min} caracteres`);
    if (esquema.max !== undefined && valor.length > esquema.max) errores.push(`${donde}: tiene ${valor.length} caracteres, el máximo es ${esquema.max}`);
    return errores;
  }

  if (t === 'entero' || t === 'numero') {
    if (typeof valor !== 'number' || !Number.isFinite(valor)) return [`${donde}: tiene que ser un número, llegó ${tipoDe(valor)}`];
    if (t === 'entero' && !Number.isInteger(valor)) errores.push(`${donde}: tiene que ser un número entero`);
    if (esquema.min !== undefined && valor < esquema.min) errores.push(`${donde}: no puede ser menor que ${esquema.min}`);
    if (esquema.max !== undefined && valor > esquema.max) errores.push(`${donde}: no puede ser mayor que ${esquema.max}`);
    return errores;
  }

  if (t === 'booleano') {
    return typeof valor === 'boolean' ? [] : [`${donde}: tiene que ser true o false`];
  }

  if (t === 'enum') {
    return esquema.valores.includes(valor) ? [] : [`${donde}: "${String(valor).slice(0, 40)}" no es válido; opciones: ${esquema.valores.join(', ')}`];
  }

  if (t === 'fecha') {
    if (typeof valor !== 'string' || !FECHA.test(valor) || Number.isNaN(Date.parse(valor))) return [`${donde}: tiene que ser una fecha AAAA-MM-DD`];
    return [];
  }

  throw new Error(`Esquema con tipo desconocido: ${t}`);
}
