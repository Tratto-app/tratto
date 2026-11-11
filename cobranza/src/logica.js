// Reglas puras de Cobranza sin vueltas: fechas, horario de envío, qué aviso le
// toca a cada deuda, los textos y la lectura de listas pegadas. No toca la base
// ni la red, así que corre igual en Cloudflare, en el navegador (demo) y en las
// pruebas.

export const ETAPAS = ['previo', 'dia', 'vencido', 'ultimo'];
export const NOMBRE_ETAPA = {
  previo: 'Aviso previo',
  dia: 'Día del vencimiento',
  vencido: 'Pago vencido',
  ultimo: 'Último aviso',
};
export const PLANTILLA = {
  previo: 'recordatorio_previo',
  dia: 'recordatorio_dia',
  vencido: 'recordatorio_vencido',
  ultimo: 'recordatorio_ultimo',
};
export const PIE_PLANTILLA = 'Para no recibir más avisos, respondé BAJA.';
export const BOTON_PLANTILLA = 'Pagar ahora';

// Texto de cada plantilla tal como se carga en Meta. El link va en el botón.
// En "tu pago de {{a}} por {{b}}" va primero el monto y después el concepto
// ("tu pago de $ 15.000 por la cuota de marzo"): así el concepto puede empezar
// con "el", "la" o un número sin que la frase quede mal.
export const CUERPO_PLANTILLA = {
  previo: 'Hola {{1}}, te recordamos que el {{2}} vence tu pago de {{3}} por {{4}}. Lo podés pagar con el botón de acá abajo.',
  dia: 'Hola {{1}}, hoy vence tu pago de {{2}} por {{3}}. Te dejamos el botón para pagarlo.',
  vencido: 'Hola {{1}}, nos figura pendiente el pago de {{2}} por {{3}}, que venció el {{4}}. Si ya lo pagaste, avisanos y lo corregimos. Si no, lo podés pagar con el botón de abajo.',
  ultimo: 'Hola {{1}}, seguimos con pendiente el pago de {{2}} por {{3}}. Si necesitás arreglarlo de otra forma, respondé este mensaje y lo vemos.',
};
export const EJEMPLO_PLANTILLA = {
  previo: ['Juan', '10 de marzo', '$ 15.000', 'la cuota de marzo'],
  dia: ['Juan', '$ 15.000', 'la cuota de marzo'],
  vencido: ['Juan', '$ 15.000', 'la cuota de marzo', '10 de marzo'],
  ultimo: ['Juan', '$ 15.000', 'la cuota de marzo'],
};

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const dos = (n) => String(n).padStart(2, '0');

// ── Fechas (Argentina: UTC-3 fijo, sin horario de verano) ──────────────────
export function ahoraAR(fecha = new Date()) {
  const l = new Date(fecha.getTime() - 3 * 3600e3);
  return { fecha: l.toISOString().slice(0, 10), hora: l.getUTCHours(), minuto: l.getUTCMinutes(), diaSemana: l.getUTCDay() };
}
export function sumarDias(fecha, n) {
  const d = new Date(fecha + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
export function diasEntre(desde, hasta) {
  return Math.round((Date.parse(hasta + 'T00:00:00Z') - Date.parse(desde + 'T00:00:00Z')) / 864e5);
}
export function fechaValida(f) {
  return typeof f === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(f) && !Number.isNaN(Date.parse(f + 'T00:00:00Z'))
    && new Date(f + 'T00:00:00Z').toISOString().slice(0, 10) === f;
}
export function fechaLarga(f) {
  return `${Number(f.slice(8))} de ${MESES[Number(f.slice(5, 7)) - 1]}`;
}
export function fechaCorta(f) {
  return `${f.slice(8)}/${f.slice(5, 7)}/${f.slice(0, 4)}`;
}
export function inicioMes(fecha) { return fecha.slice(0, 7) + '-01'; }
export function inicioMesSiguiente(fecha) {
  let [a, m] = fecha.split('-').map(Number);
  m += 1; if (m > 12) { m = 1; a += 1; }
  return `${a}-${dos(m)}-01`;
}

// Los avisos salen de lunes a sábado, de 9 a 20.
export function horario(ar) {
  if (ar.diaSemana === 0) return { abierto: false, motivo: 'Los domingos no salen avisos. Siguen mañana a las 9.' };
  if (ar.hora < 9) return { abierto: false, motivo: 'Los avisos salen de 9 a 20. Todavía es temprano.' };
  if (ar.hora >= 20) return { abierto: false, motivo: 'Los avisos salen de 9 a 20. Siguen mañana.' };
  return { abierto: true, motivo: '' };
}

// ── Qué aviso le toca a una deuda ──────────────────────────────────────────
// previo: 3 días antes · dia: el día · vencido: desde 3 días después ·
// ultimo: desde 7 días después y al menos 4 días después del "vencido".
// Después del último no sale nada más.
export function etapaQueToca(deuda, hoy) {
  if (deuda.estado !== 'pendiente') return null;
  const d = diasEntre(deuda.vence, hoy);
  if (d < -3) return null;
  if (d < 0) return deuda.av_previo ? null : 'previo';
  if (d < 3) return deuda.av_dia ? null : 'dia';
  if (!deuda.av_vencido) return 'vencido';
  if (!deuda.av_ultimo && d >= 7 && diasEntre(deuda.av_vencido, hoy) >= 4) return 'ultimo';
  return null;
}

export function telefonoValido(t) { return /^549\d{10}$/.test(t || ''); }
export function puedeRecibir(c) {
  return !!c && !!c.acepta && !c.pausado && !c.baja && telefonoValido(c.telefono);
}
export function motivoNoRecibe(c) {
  if (!telefonoValido(c.telefono)) return 'No tiene un celular válido cargado.';
  if (c.baja) return 'Pidió no recibir más avisos.';
  if (!c.acepta) return 'Falta marcar que aceptó recibir recordatorios.';
  if (c.pausado) return 'Tiene los avisos en pausa.';
  return '';
}

// Lista de avisos de hoy: como máximo uno por cliente (el de la deuda más
// vieja) y nunca a quien ya recibió uno hoy.
export function avisosDelDia({ deudas, clientes, recibieronHoy, hoy }) {
  const porCliente = new Map();
  for (const deuda of deudas) {
    const cliente = clientes.get(deuda.cliente_id);
    if (!puedeRecibir(cliente) || recibieronHoy.has(cliente.id)) continue;
    const etapa = etapaQueToca(deuda, hoy);
    if (!etapa) continue;
    const previo = porCliente.get(cliente.id);
    if (!previo || deuda.vence < previo.deuda.vence || (deuda.vence === previo.deuda.vence && deuda.id < previo.deuda.id)) {
      porCliente.set(cliente.id, { deuda, cliente, etapa });
    }
  }
  return [...porCliente.values()].sort((a, b) => (a.deuda.vence < b.deuda.vence ? -1 : a.deuda.vence > b.deuda.vence ? 1 : a.deuda.id - b.deuda.id));
}

// ── Textos ─────────────────────────────────────────────────────────────────
export function formatearMonto(centavos) {
  const entero = Math.trunc(Math.abs(centavos) / 100);
  const resto = Math.abs(centavos) % 100;
  const miles = String(entero).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${centavos < 0 ? '-' : ''}$ ${miles}${resto ? ',' + dos(resto) : ''}`;
}
export function primerNombre(nombre) {
  const p = String(nombre || '').trim().split(/\s+/)[0] || '';
  return p ? p[0].toUpperCase() + p.slice(1) : '';
}
// WhatsApp no acepta saltos de línea ni muchos espacios seguidos en las variables.
export function limpiarVariable(t) {
  return String(t ?? '').replace(/[\n\r\t]+/g, ' ').replace(/ {2,}/g, ' ').trim().slice(0, 120);
}
export function variablesPlantilla(etapa, deuda, cliente) {
  const nombre = limpiarVariable(primerNombre(cliente.nombre));
  const concepto = limpiarVariable(deuda.concepto);
  const monto = formatearMonto(deuda.monto);
  const fecha = fechaLarga(deuda.vence);
  if (etapa === 'previo') return [nombre, fecha, monto, concepto];
  if (etapa === 'vencido') return [nombre, monto, concepto, fecha];
  return [nombre, monto, concepto];
}
// Mensaje completo para el modo un toque: el mismo texto, con el link escrito.
export function textoAviso(etapa, deuda, cliente, link) {
  const [nombre] = variablesPlantilla(etapa, deuda, cliente);
  const concepto = limpiarVariable(deuda.concepto);
  const monto = formatearMonto(deuda.monto);
  const fecha = fechaLarga(deuda.vence);
  if (etapa === 'previo') return `Hola ${nombre}, te recordamos que el ${fecha} vence tu pago de ${monto} por ${concepto}. Lo podés pagar acá: ${link}`;
  if (etapa === 'dia') return `Hola ${nombre}, hoy vence tu pago de ${monto} por ${concepto}. Te dejamos el link para pagarlo: ${link}`;
  if (etapa === 'vencido') return `Hola ${nombre}, nos figura pendiente el pago de ${monto} por ${concepto}, que venció el ${fecha}. Si ya lo pagaste, avisanos y lo corregimos. Si no, lo podés pagar acá: ${link}`;
  return `Hola ${nombre}, seguimos con pendiente el pago de ${monto} por ${concepto}. Si necesitás arreglarlo de otra forma, respondé este mensaje y lo vemos. El link de pago es ${link}`;
}

// Respuesta "BAJA" de un cliente (y sus variantes cortas). Conservador a
// propósito: "bajá el precio" no es un pedido de baja.
export function esBaja(texto) {
  const t = String(texto || '').toLowerCase().replace(/^[^a-záéíóúñ]+|[^a-záéíóúñ]+$/g, '').replace(/\s+/g, ' ');
  return /^(quiero )?((dar(me)? de )|(la ))?baja( por favor)?$/.test(t);
}

// ── Repetición (cuota semanal o mensual) ───────────────────────────────────
export function siguienteVencimiento(vence, repite, diaMes) {
  if (repite === 'semanal') return sumarDias(vence, 7);
  if (repite !== 'mensual') return null;
  let [a, m] = vence.split('-').map(Number);
  m += 1; if (m > 12) { m = 1; a += 1; }
  const ultimo = new Date(Date.UTC(a, m, 0)).getUTCDate();
  return `${a}-${dos(m)}-${dos(Math.min(diaMes || Number(vence.slice(8)), ultimo))}`;
}
// "Cuota marzo" pasa a "Cuota abril" cuando se genera la del mes siguiente.
export function conceptoSiguiente(concepto, vence, siguiente) {
  const viejo = MESES[Number(vence.slice(5, 7)) - 1];
  const nuevo = MESES[Number(siguiente.slice(5, 7)) - 1];
  return String(concepto).replace(new RegExp(viejo, 'i'), (hallado) => (
    hallado === hallado.toUpperCase() ? nuevo.toUpperCase() : hallado[0] === hallado[0].toUpperCase() ? nuevo[0].toUpperCase() + nuevo.slice(1) : nuevo
  ));
}

// ── Lectura de datos escritos por una persona ──────────────────────────────
// Devuelve el celular en el formato de WhatsApp para Argentina (549 + 10
// dígitos) o '' si no se puede armar. `area` es el código de área por defecto
// del negocio (por ejemplo 11) para los números escritos sin él.
export function normalizarTelefono(texto, area = '') {
  let n = String(texto ?? '').replace(/\D/g, '');
  const a = String(area ?? '').replace(/\D/g, '').replace(/^0/, '');
  if (!n) return '';
  if (n.startsWith('00')) n = n.slice(2);
  if (n.startsWith('54') && n.length >= 12) { n = n.slice(2); if (n.startsWith('9') && n.length === 11) n = n.slice(1); }
  if (n.startsWith('0')) n = n.slice(1);
  if (n.length === 12) {
    for (const pos of [2, 3, 4]) if (n.slice(pos, pos + 2) === '15') { n = n.slice(0, pos) + n.slice(pos + 2); break; }
  }
  if (a && n.startsWith('15') && n.length - 2 + a.length === 10) n = a + n.slice(2);
  else if (a && n.length + a.length === 10) n = a + n;
  return /^[1-9]\d{9}$/.test(n) ? '549' + n : '';
}
export function mostrarTelefono(t) {
  return telefonoValido(t) ? `+54 9 ${t.slice(3, 5)} ${t.slice(5, 9)}-${t.slice(9)}` : (t || '');
}

// "$ 15.000,50", "15000", "15.000", "15000.5" → centavos. null si no es un monto.
export function parsearMonto(texto) {
  if (typeof texto === 'number') return Number.isFinite(texto) && texto > 0 ? Math.round(texto * 100) : null;
  let t = String(texto ?? '').replace(/[^\d.,-]/g, '');
  if (!t || t.startsWith('-')) return null;
  const punto = t.lastIndexOf('.'), coma = t.lastIndexOf(',');
  if (punto >= 0 && coma >= 0) {
    const dec = Math.max(punto, coma);
    t = t.slice(0, dec).replace(/[.,]/g, '') + '.' + t.slice(dec + 1);
  } else if (punto >= 0 || coma >= 0) {
    const sep = punto >= 0 ? '.' : ',';
    const partes = t.split(sep);
    const esMiles = partes.length > 2 || (partes[1].length === 3 && partes[0].length <= 3 && partes[0] !== '0');
    t = esMiles ? partes.join('') : partes[0] + '.' + partes[1];
  }
  const n = Number(t);
  return Number.isFinite(n) && n > 0 && n < 1e10 ? Math.round(n * 100) : null;
}

// "10/3", "10/03/2026", "10-3-26", "2026-03-10" o el número de serie de Excel.
export function parsearFecha(texto, hoy) {
  const t = String(texto ?? '').trim();
  if (!t) return null;
  let m;
  if ((m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/))) return validar(m[1], m[2], m[3]);
  if ((m = t.match(/^(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2}|\d{4}))?$/))) {
    const anio = m[3] ? (m[3].length === 2 ? '20' + m[3] : m[3]) : (hoy || ahoraAR().fecha).slice(0, 4);
    return validar(anio, m[2], m[1]);
  }
  if (/^\d{5}(\.\d+)?$/.test(t)) {
    const serie = Math.floor(Number(t));
    if (serie > 30000 && serie < 80000) return sumarDias('1899-12-30', serie);
  }
  return null;
  function validar(a, mes, d) {
    const f = `${a}-${dos(mes)}-${dos(d)}`;
    return fechaValida(f) ? f : null;
  }
}

export function parsearRepite(texto) {
  const t = sinAcentos(texto);
  if (/seman/.test(t)) return 'semanal';
  if (/mes|mensual|cuota/.test(t)) return 'mensual';
  return 'unico';
}

function sinAcentos(t) {
  return String(t ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
}

// Parte un texto pegado (de Excel, de WhatsApp, de un CSV) en filas y columnas.
export function partirTexto(texto) {
  const crudo = String(texto ?? '').replace(/\r\n?/g, '\n').replace(/^﻿/, '');
  const sep = crudo.includes('\t') ? '\t' : crudo.includes(';') ? ';' : ',';
  const filas = [];
  let celda = '', fila = [], comillas = false;
  for (let i = 0; i < crudo.length; i++) {
    const c = crudo[i];
    if (comillas) {
      if (c === '"' && crudo[i + 1] === '"') { celda += '"'; i++; }
      else if (c === '"') comillas = false;
      else celda += c;
    } else if (c === '"' && celda === '') comillas = true;
    else if (c === sep) { fila.push(celda); celda = ''; }
    else if (c === '\n') { fila.push(celda); filas.push(fila); fila = []; celda = ''; }
    else celda += c;
  }
  fila.push(celda); filas.push(fila);
  return filas.map((f) => f.map((c) => String(c).trim())).filter((f) => f.some((c) => c !== ''));
}

const CAMPOS = [
  ['nombre', /nombre|cliente|alumn|pacient/],
  ['telefono', /tel|cel|whats|wsp|numero/],
  ['concepto', /concepto|detalle|descrip|motivo|trabajo/],
  ['monto', /monto|importe|debe|deuda|total|precio|\$/],
  ['vence', /venc|fecha|dia/],
  ['repite', /repite|frecuen|tipo/],
  ['mail', /mail|correo/],
];
const ORDEN_POR_DEFECTO = ['nombre', 'telefono', 'concepto', 'monto', 'vence', 'repite', 'mail'];

// Convierte las filas en deudas listas para revisar. Si la primera fila tiene
// títulos, los usa; si no, espera: nombre, celular, concepto, monto,
// vencimiento, repite, mail.
export function leerFilas(filas, { hoy, area = '' } = {}) {
  if (!filas.length) return [];
  let orden = ORDEN_POR_DEFECTO, desde = 0;
  const titulos = filas[0].map(sinAcentos);
  const hallados = titulos.map((t) => (CAMPOS.find(([, re]) => t && re.test(t) && !/\d{3}/.test(t)) || [])[0]);
  if (hallados.filter(Boolean).length >= 2 && hallados.includes('nombre')) { orden = hallados; desde = 1; }
  return filas.slice(desde).map((fila, i) => {
    const crudo = {};
    orden.forEach((campo, col) => { if (campo && crudo[campo] === undefined) crudo[campo] = fila[col] ?? ''; });
    const datos = {
      nombre: (crudo.nombre || '').slice(0, 80),
      telefono: normalizarTelefono(crudo.telefono, area),
      concepto: (crudo.concepto || '').slice(0, 120),
      monto: parsearMonto(crudo.monto),
      vence: parsearFecha(crudo.vence, hoy),
      repite: parsearRepite(crudo.repite),
      mail: /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(crudo.mail || '') ? crudo.mail : '',
    };
    const errores = [];
    if (!datos.nombre) errores.push('Falta el nombre');
    if (!datos.concepto) errores.push('Falta el concepto');
    if (!datos.monto) errores.push(`Monto que no se entiende: "${crudo.monto || ''}"`);
    if (!datos.vence) errores.push(`Fecha que no se entiende: "${crudo.vence || ''}"`);
    const avisos = [];
    if (crudo.telefono && !datos.telefono) avisos.push(`Celular que no se entiende: "${crudo.telefono}"`);
    if (!crudo.telefono) avisos.push('Sin celular: no va a recibir avisos');
    return { linea: desde + i + 1, datos, errores, avisos };
  });
}
