/**
 * config.js — ÚNICA FUENTE DE DATOS DEL NEGOCIO
 * ---------------------------------------------------------------------------
 * Acá vive todo lo que cambia cuando cambia el salón: contacto, dirección,
 * horarios, precios, reseñas y equipo. El texto editorial del sitio está en el
 * HTML (para que lo lean los buscadores sin ejecutar JavaScript); este archivo
 * completa los datos y activa lo que hoy está pendiente.
 *
 * Los campos vacíos ('') o en null están PENDIENTES de confirmar. Mientras lo
 * estén, el sitio muestra un estado honesto en vez de un dato inventado o un
 * link roto. Nunca los completes a ojo.
 *
 * Para ver de un vistazo qué falta, abrí el sitio con ?revisar=1 al final.
 */

export const CONFIG = {
  marca: {
    nombre: 'La Peluquerie',
    nombreCompleto: 'La Peluquerie · Studio Art',
    dominio: 'https://lapeluquerie.com.ar',   // PENDIENTE: dominio definitivo
  },

  /* whatsapp: código de país + área + número, solo dígitos, sin + ni espacios.
     Buenos Aires 11 5555-4444 → '5491155554444'
     Córdoba 351 555-4444      → '5493515554444'                              */
  contacto: {
    whatsapp: '',            // PENDIENTE
    whatsappVisible: '',     // PENDIENTE — cómo se muestra en pantalla
    telefono: '',            // PENDIENTE
    email: '',               // PENDIENTE
    instagram: 'lapeluquerie',
    instagramUrl: 'https://www.instagram.com/lapeluquerie',
  },

  local: {
    calle: '',       // PENDIENTE — 'Av. Santa Fe 3200'
    piso: '',        // PENDIENTE — 'Piso 2, depto B'
    zona: '',        // PENDIENTE — 'Palermo'. Es la palabra que la gente busca.
    ciudad: '',      // PENDIENTE — 'Ciudad Autónoma de Buenos Aires'
    provincia: '',   // PENDIENTE
    cp: '',          // PENDIENTE
    pais: 'AR',
    mapsUrl: '',     // PENDIENTE — link para abrir en Google Maps
    mapsEmbed: '',   // PENDIENTE — src del iframe de Google Maps
    lat: '',         // PENDIENTE
    lng: '',         // PENDIENTE
    comoLlegar: '',  // PENDIENTE — 'A dos cuadras de la estación X'
  },

  /* Horarios de referencia: HAY QUE CONFIRMARLOS. Mientras
     horariosConfirmados sea false, el sitio no los publica. */
  horariosConfirmados: false,
  horarios: [
    { dia: 'Lunes',     iso: 'Mo', cerrado: true,  abre: '',      cierra: '' },
    { dia: 'Martes',    iso: 'Tu', cerrado: false, abre: '09:00', cierra: '19:00' },
    { dia: 'Miércoles', iso: 'We', cerrado: false, abre: '09:00', cierra: '19:00' },
    { dia: 'Jueves',    iso: 'Th', cerrado: false, abre: '09:00', cierra: '20:00' },
    { dia: 'Viernes',   iso: 'Fr', cerrado: false, abre: '09:00', cierra: '20:00' },
    { dia: 'Sábado',    iso: 'Sa', cerrado: false, abre: '09:00', cierra: '18:00' },
    { dia: 'Domingo',   iso: 'Su', cerrado: true,  abre: '',      cierra: '' },
  ],

  /* proveedor decide por dónde entra la reserva. Para migrar a una agenda
     online, cambiá `proveedor` y completá `url`: no hay que tocar ninguna otra
     parte del sitio. Ver booking.js. */
  reservas: {
    proveedor: 'whatsapp',   // 'whatsapp' | 'calendly' | 'fresha' | 'externo'
    url: '',
  },

  /* Con mostrarPrecios en false, las fichas dicen "Se cierra en la consulta".
     Al pasarlo a true se publican los valores de `lista` (en pesos). */
  precios: {
    mostrarPrecios: false,   // PENDIENTE
    actualizado: '',         // PENDIENTE — 'Marzo 2026'
    lista: { color: null, balayage: null, mechas: null, corte: null,
             tratamiento: null, peinado: null, novias: null },
  },

  /* NO se inventan reseñas. Con verificadas:false la sección deriva a la
     fuente real. Para activarla: pegá las reseñas reales, el promedio y el
     total que figuran en Google, y pasá verificadas a true. */
  reviews: {
    verificadas: false,   // PENDIENTE
    promedio: null,       // PENDIENTE — 4.9
    total: null,          // PENDIENTE — 187
    googleUrl: '',        // PENDIENTE
    lista: [],            // [{ nombre, fecha:'2026-02-14', puntaje:5, servicio, texto }]
  },

  /* Se publica solo cuando confirmado pasa a true. Hasta entonces la ficha se
     muestra como plantilla, no como una persona real. */
  equipo: [
    { id: 'p1', confirmado: false, nombre: '', experiencia: '', bio: '', instagram: '' },
    { id: 'p2', confirmado: false, nombre: '', experiencia: '', bio: '', instagram: '' },
    { id: 'p3', confirmado: false, nombre: '', experiencia: '', bio: '', instagram: '' },
  ],

  marcas: '',        // PENDIENTE — marcas de producto que usa el salón
  formasDePago: '',  // PENDIENTE — 'Efectivo, transferencia, débito y crédito'
};

/** Catálogo mínimo: lo usan el buscador, el formulario y los mensajes de
 *  WhatsApp. La descripción larga de cada servicio vive en el HTML. */
export const SERVICIOS = {
  color:       { nombre: 'Color',                     duracion: '1 h 30 – 2 h 30' },
  balayage:    { nombre: 'Balayage',                  duracion: '2 h 30 – 4 h' },
  mechas:      { nombre: 'Mechas y decoloración',     duracion: '2 h 30 – 4 h' },
  corte:       { nombre: 'Corte',                     duracion: '45 min – 1 h 15' },
  tratamiento: { nombre: 'Tratamiento de reparación', duracion: '45 min – 1 h 30' },
  peinado:     { nombre: 'Brushing y peinado',        duracion: '40 min – 1 h 30' },
  novias:      { nombre: 'Novias y eventos',          duracion: 'Prueba 1 h + día del evento' },
};

/** Etiquetas legibles de las respuestas del buscador. */
export const RESPUESTAS = {
  objetivo: {
    'cambiar-color': 'Quiero cambiar de color',
    'mantener':      'Quiero mantener mi color',
    'aclarar':       'Quiero aclararme el pelo',
    'recuperar':     'Quiero recuperar el pelo',
    'forma':         'Quiero cambiar la forma o el largo',
    'evento':        'Tengo un evento',
  },
  estado: {
    'virgen':     'Pelo sin química',
    'con-color':  'Con color o tintura',
    'decolorado': 'Decolorado o con mechas',
    'alisado':    'Con alisado o keratina',
  },
  tiempo: {
    'corto': 'Hasta 1 h 30',
    'medio': 'Hasta 3 h',
    'largo': 'Sin límite de tiempo',
  },
  frecuencia: {
    'frecuente': 'Puedo volver cada 4–6 semanas',
    'espaciado': 'Puedo volver cada 3 meses',
    'minimo':    'Quiero volver lo menos posible',
  },
};

/**
 * Reglas del buscador de servicio.
 * Devuelve entre uno y tres servicios ordenados por prioridad. Es una guía
 * comercial, no un diagnóstico: la recomendación final la da la colorista.
 *
 * @param {{objetivo:string, estado:string, tiempo:string, frecuencia:string}} r
 * @returns {{ids:string[], porque:string}}
 */
export function recomendar(r) {
  const ids = [];
  const sumar = (...xs) => xs.forEach((x) => { if (x && !ids.includes(x)) ids.push(x); });
  let porque = '';

  switch (r.objetivo) {
    case 'evento':
      sumar('peinado');
      if (r.tiempo !== 'corto') sumar('novias');
      porque = 'Para un evento lo importante es que el peinado aguante toda la noche. Si además es un casamiento, conviene una prueba previa para dejar el look definido antes del día.';
      break;

    case 'forma':
      sumar('corte');
      if (r.estado === 'decolorado' || r.estado === 'alisado') sumar('tratamiento');
      else sumar('peinado');
      porque = r.estado === 'decolorado' || r.estado === 'alisado'
        ? 'Antes de definir la forma conviene ver cómo está la fibra: sobre pelo con química previa, un tratamiento en el mismo turno hace que el corte caiga mucho mejor.'
        : 'El corte se define mirando densidad y caída. Sumamos el brushing para que salgas viendo cómo queda la forma terminada.';
      break;

    case 'recuperar':
      sumar('tratamiento', 'corte');
      porque = 'Primero recuperamos la fibra y recién después pensamos en color. Sacar las puntas que ya no vuelven suele mejorar más el aspecto que cualquier producto.';
      break;

    case 'mantener':
      sumar('color');
      if (r.frecuencia === 'espaciado' || r.frecuencia === 'minimo') sumar('balayage');
      if (r.estado === 'decolorado') sumar('tratamiento');
      porque = (r.frecuencia === 'espaciado' || r.frecuencia === 'minimo')
        ? 'Para sostener el color viniendo poco, el retoque de raíz es lo básico; pasar a balayage te deja crecer sin línea marcada y estirar los turnos.'
        : 'Viniendo cada 4 a 6 semanas, el retoque de raíz alcanza para que el color se vea siempre parejo.';
      break;

    case 'aclarar':
      if (r.frecuencia === 'frecuente' && r.tiempo !== 'corto') sumar('mechas', 'balayage');
      else sumar('balayage', 'mechas');
      if (r.estado === 'decolorado' || r.estado === 'alisado') sumar('tratamiento');
      porque = (r.frecuencia === 'espaciado' || r.frecuencia === 'minimo')
        ? 'Si querés volver poco al salón, el balayage es el camino: al no arrancar desde la raíz, crece sin dejar línea.'
        : 'Las mechas con papel dan el rubio más parejo y controlado; el balayage suma luz con un crecimiento más prolijo.';
      if (r.estado === 'decolorado') {
        porque += ' Como ya tenés decoloración encima, sumamos tratamiento para llegar al tono sin castigar la fibra.';
      }
      break;

    case 'cambiar-color':
    default:
      sumar('color');
      if (r.estado === 'virgen' || r.estado === 'con-color') sumar('balayage');
      if (r.estado === 'decolorado' || r.estado === 'alisado') sumar('tratamiento');
      porque = r.estado === 'alisado'
        ? 'Sobre pelo con alisado o keratina hay que ir con cuidado: revisamos la fibra antes de aplicar color y, si hace falta, hacemos tratamiento primero.'
        : 'Un cambio de color se define mirando qué hay abajo. Con eso definimos si entra en un turno o conviene partirlo en dos.';
      break;
  }

  if (r.tiempo === 'corto' && (ids.includes('balayage') || ids.includes('mechas'))) {
    porque += ' Tené en cuenta que estos servicios llevan varias horas: si hoy no tenés ese tiempo, coordinamos el turno para otro día.';
  }

  return { ids: ids.slice(0, 3), porque };
}
