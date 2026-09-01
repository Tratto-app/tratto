/* ============================================================
   LAPELUQUERIE — datos y contenido
   ------------------------------------------------------------
   Único archivo que hay que tocar para cambiar textos o datos.
   Lo que está entre [corchetes] todavía no está confirmado.

   ⚠️ PENDIENTE: duraciones y precios por servicio.
   Confirmados: dirección, WhatsApp, teléfono, horarios, reseñas.
   ============================================================ */

export const NEGOCIO = {
  nombre: 'Lapeluquerie',
  descripcion: 'Peluquería en Pilar: color, cortes y cuidado del pelo.',

  zona:   'Pilar',
  ciudad: 'Pilar, Buenos Aires',
  direccion: {
    calle:     'Luis Bataglia 572',
    localidad: 'Pilar',
    provincia: 'Buenos Aires',
    pais:      'AR'
  },
  maps: 'https://maps.app.goo.gl/LmB59sVP56N6NK4K8?g_st=ic',

  /* Sólo dígitos, formato internacional. */
  whatsapp: '5492304356392',
  telefonoVisible: '+54 9 2304 35-6392',
  instagramUsuario: 'lapeluquerie',
  instagram: 'https://www.instagram.com/lapeluquerie',

  horarios: [
    { dias: 'Martes',    texto: '09:00 – 18:00', schema: ['Tu'], abre: '09:00', cierra: '18:00' },
    { dias: 'Miércoles', texto: '09:00 – 18:00', schema: ['We'], abre: '09:00', cierra: '18:00' },
    { dias: 'Jueves',    texto: '12:00 – 18:00', schema: ['Th'], abre: '12:00', cierra: '18:00' },
    { dias: 'Viernes',   texto: '09:00 – 18:00', schema: ['Fr'], abre: '09:00', cierra: '18:00' },
    { dias: 'Sábado',    texto: '09:00 – 18:00', schema: ['Sa'], abre: '09:00', cierra: '18:00' },
    { dias: 'Domingo y lunes', texto: 'Cerrado', schema: [],     abre: '',      cierra: '' }
  ],

  dominio: 'https://[DOMINIO]'
};

/* ============================================================
   SERVICIOS
   Sin fotos a propósito: sólo hay cinco fotos reales del salón y
   repetirlas una por servicio hacía que la página pareciera rellenada.
   Las fotos viven en GALERIA, una sola vez cada una.

   duracion y precio en null: no están confirmados. Cuando los tengas,
   escribilos como texto ('2 h', 'Desde $00.000') y aparecen solos.
   ============================================================ */
export const SERVICIOS = [
  {
    id: 'color',
    nombre: 'Color y raíz',
    texto: 'Cobertura de canas o cambio de tono, con el color elegido entre las dos. Si venís seguido, vamos retocando solo la raíz para no castigar el largo.',
    tags: ['Canas', 'Retoque de raíz'],
    duracion: null, precio: null,
  },
  {
    id: 'mechitas',
    nombre: 'Mechitas e iluminación',
    texto: 'Un poco de luz alrededor de la cara y en el largo, sin cambiar tu color de base. Es lo que más piden las que quieren un cambio pero sin animarse a tanto.',
    tags: ['Babylights', 'Reflejos'],
    duracion: null, precio: null,
  },
  {
    id: 'balayage',
    nombre: 'Balayage',
    texto: 'Aclarado pintado a mano, más claro en las puntas y suave en la raíz. Crece prolijo, así que podés dejar pasar varios meses entre visita y visita.',
    tags: ['Crece prolijo', 'Sin línea de raíz'],
    duracion: null, precio: null,
  },
  {
    id: 'rubios',
    nombre: 'Rubios y matizado',
    texto: 'Si querés un rubio sin tonos anaranjados, vemos hasta dónde podemos llegar hoy cuidando tu pelo, y lo matizamos hasta el tono que te gusta.',
    tags: ['Rubio frío', 'Matizado'],
    duracion: null, precio: null,
  },
  {
    id: 'correccion',
    nombre: 'Arreglos de color',
    texto: 'Un color que quedó desparejo, mechas viejas o un tono que no era el que pediste. Se puede arreglar: primero miramos qué tiene el pelo y después vemos si sale en una vez o en dos.',
    tags: ['Sacar el naranja', 'Emparejar'],
    duracion: null, precio: null,
  },
  {
    id: 'corte',
    nombre: 'Corte y brushing',
    texto: 'Antes de cortar te pregunto cuánto tiempo le dedicás al pelo a la mañana. De ahí salen el largo y las capas, para que después lo puedas peinar sola.',
    tags: ['Corte', 'Brushing'],
    duracion: null, precio: null,
  },
  {
    id: 'tratamiento',
    nombre: 'Hidratación',
    texto: 'Se hace en el mismo turno, después del color, para que el largo quede suave y más fácil de peinar. Va bien sobre todo si venís de decoloraciones.',
    tags: ['Después del color', 'Suavidad'],
    duracion: null, precio: null,
  },
  {
    id: 'eventos',
    nombre: 'Peinados y eventos',
    texto: 'Recogidos, semirecogidos y ondas para casamientos, fiestas o el civil. Si es algo importante, conviene una prueba antes para llegar tranquilas al día.',
    tags: ['Casamientos', 'Con prueba previa'],
    duracion: null, precio: null,
  }
];

/* ============================================================
   TRABAJOS — las cinco fotos reales del salón, una sola vez cada una
   ============================================================ */
export const GALERIA = [
  { id: 'g1', img: 'despues-1', servicio: 'balayage',
    titulo: 'Balayage beige',
    texto: 'Aclarado pintado a mano y matizado en frío. La raíz queda suave para que el crecimiento no marque una línea.' },
  { id: 'g2', img: 'bronde', servicio: 'rubios',
    titulo: 'Rubio con mechitas finas',
    texto: 'Mechitas cerca de la cara y aclarado hacia las puntas, en un beige neutro.' },
  { id: 'g3', img: 'caoba', servicio: 'color',
    titulo: 'Caoba con reflejos',
    texto: 'Un caoba armado con más de un reflejo, para que el color se mueva con la luz y no quede plano.' },
  { id: 'g4', img: 'despues-2', servicio: 'correccion',
    titulo: 'De cobre a castaño ceniza',
    texto: 'Arreglo de un cobre muy fuerte: se neutralizó y quedó un castaño iluminado con reflejos fríos.' },
  { id: 'g5', img: 'castano', servicio: 'mechitas',
    titulo: 'Castaño con caramelo',
    texto: 'Iluminación suave sobre el color natural: da luz sin obligarte a volver todos los meses.' }
];

export const TRANSFORMACIONES = [
  { id: 't1', titulo: 'Rubio desparejo → balayage', detalle: 'Una sesión',
    servicio: 'balayage', antes: 'antes-1', despues: 'despues-1',
    altA: 'Antes: rubio cálido desparejo con la raíz marcada',
    altD: 'Después: balayage beige con la raíz difuminada' },
  { id: 't2', titulo: 'Cobre → castaño ceniza', detalle: 'Arreglo de color',
    servicio: 'correccion', antes: 'antes-2', despues: 'despues-2',
    altA: 'Antes: cobre muy intenso en todo el largo',
    altD: 'Después: castaño ceniza con reflejos fríos' }
];

/* ============================================================
   CÓMO TRABAJAMOS
   ============================================================ */
export const PASOS = [
  { t: 'Charlamos', d: 'Antes de tocar nada nos sentamos a ver qué querés y qué te hiciste antes. Traé fotos si tenés: ayudan un montón a entendernos.' },
  { t: 'Miramos tu pelo', d: 'Vemos cómo está el largo y qué color tiene hoy. De ahí sale qué se puede hacer y si conviene en una vez o en dos.' },
  { t: 'Te digo lo que pienso', d: 'Si algo no le va a quedar bien a tu pelo, te lo digo antes de empezar y buscamos otra opción juntas. Preferimos eso a que te vayas disconforme.' },
  { t: 'Hacemos el color', d: 'Es la parte más larga del turno. Podés traerte algo para leer o charlamos, como prefieras.' },
  { t: 'Peinado y consejos', d: 'Terminamos con el brushing y te cuento cómo lo hago, qué productos usar y cada cuánto conviene volver.' },
  { t: 'Vos y yo somos un equipo', d: 'El color se cuida también en casa. Cualquier duda que te surja después, escribime por WhatsApp: seguimos en contacto.', cierre: true }
];

export const MOTIVOS = [
  { ico: 'charla', t: 'Te escuchamos primero',
    d: 'Nadie se sienta en la silla sin que antes hablemos de lo que querés. Preguntá todo lo que necesites, sin apuro.' },
  { ico: 'reloj', t: 'Un turno por vez',
    d: 'Trabajamos con turno para poder dedicarle el tiempo que cada pelo necesita, sin que estés esperando.' },
  { ico: 'corazon', t: 'Te decimos la verdad',
    d: 'Si lo que pediste no le va a quedar bien a tu pelo, te lo decimos y buscamos algo que sí te guste y puedas mantener.' }
];

export const CONSEJOS = [
  { t: 'Lavalo con agua tibia', d: 'El agua muy caliente abre el pelo y el color se va más rápido. Tibia o fresca lo cuida bastante más.' },
  { t: 'Shampoo sin sal', d: 'Ayuda a que el color aguante entre visita y visita. No hace falta que sea caro: mirá que diga sin sal.' },
  { t: 'Protector de calor', d: 'Si usás planchita o secador seguido, ponete algo antes. Es el paso que más se saltea y el que más se nota.' },
  { t: 'Rubios: matizador cada tanto', d: 'Un shampoo violeta una vez por semana alcanza para que no se te vaya al dorado. Más seguido no es mejor.' },
  { t: 'Las puntas cada 2 o 3 meses', d: 'Cortarlas de a poco hace que el largo se vea mucho mejor, aunque estés dejándote crecer el pelo.' },
  { t: 'Cualquier duda, escribime', d: 'Si algo no te sale como en el salón o no sabés qué producto comprar, mandame un mensaje.' }
];

/* ============================================================
   RESEÑAS reales del perfil de Google
   ============================================================ */
export const RESENAS = [
  { autor: 'Daniela Salas', fecha: 'hace 9 meses', estrellas: 5,
    texto: 'Siempre la mejor atención y precios súper justos! Recomendadísima.' },
  { autor: 'María Celia Pailhe', fecha: 'hace 1 año', estrellas: 5,
    texto: 'Excelente atención!! July me hizo color como a mí me gusta y Mariana un corte bárbaro. Quedé superconforme! Volveré!' },
  { autor: 'Julieta Gomez', fecha: 'hace 7 meses', estrellas: 5,
    texto: 'Soy de Mendoza y necesitaba una peluquería para ir a un casamiento! Tengo unos rulos indomables y Flor fue una genia, mucha paciencia. Me quedó hermoso el pelo. Un diez.' }
];

/* ============================================================
   PREGUNTAS FRECUENTES (también alimentan el schema FAQPage)
   ============================================================ */
export const FAQ = [
  { q: '¿Cómo pido un turno?',
    a: 'Por WhatsApp, desde cualquier botón de este sitio. El mensaje ya viene escrito según lo que estabas mirando, así no tenés que explicar todo de cero. Te contestamos con los días y horarios que tenemos libres.' },
  { q: '¿Dónde están?',
    a: 'En Luis Bataglia 572, Pilar, provincia de Buenos Aires. Desde la sección de ubicación podés abrir el mapa y llegar directo.' },
  { q: '¿Qué días atienden?',
    a: 'Martes, miércoles y viernes de 09:00 a 18:00; jueves de 12:00 a 18:00; sábados de 09:00 a 18:00. Domingos y lunes cerrado. Siempre con turno.' },
  { q: '¿Cuánto sale un color?',
    a: 'Depende del largo de tu pelo y de cómo esté hoy: no es lo mismo un retoque de raíz que un primer aclarado. Mandanos una foto por WhatsApp con luz de día y te pasamos el valor antes de que vengas.' },
  { q: 'Tengo el pelo teñido y quiero ser rubia, ¿se puede de una?',
    a: 'A veces sí y a veces no, depende de qué tenga tu pelo de antes. Cuando hay color oscuro acumulado o decoloraciones viejas, lo más cuidadoso es hacerlo en dos veces. Lo vemos juntas antes de empezar y te decimos qué esperar.' },
  { q: '¿Puedo llevar una foto de lo que quiero?',
    a: 'Sí, y ayuda muchísimo. Traé también alguna de algo que no te gustaría. Con las dos cosas es mucho más fácil entender qué buscás, y te decimos con sinceridad qué tan cerca puede llegar tu pelo.' },
  { q: '¿Atienden pelo con canas?',
    a: 'Sí. Se puede cubrir del todo o disimularlas con reflejos, que es una opción para volver menos seguido. En la charla vemos qué te conviene según cada cuánto puedas venir.' },
  { q: '¿Hay que señar el turno?',
    a: 'Escribinos por WhatsApp y te contamos cómo lo manejamos según el servicio. Lo importante es avisar si no vas a poder venir, así le podemos dar el lugar a otra persona.' }
];

