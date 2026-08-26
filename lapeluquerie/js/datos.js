/* ============================================================
   LAPELUQUERIE — datos del negocio y contenido del sitio
   ------------------------------------------------------------
   ÚNICO archivo que hay que tocar para poner el sitio en línea.
   Todo lo que está entre [corchetes] es un placeholder: son los
   datos que todavía no están confirmados. Reemplazalos por los
   reales antes de publicar y borrá los corchetes.

   ⚠️ PENDIENTE DE CONFIRMAR (ver README.md):
      · calle y número (la ciudad ya está cargada)
      · duraciones y precios por servicio
      · nombres y fotos del equipo
      · reseñas reales de Google

   Ya confirmados: WhatsApp, teléfono y horarios de atención.
   ============================================================ */

export const NEGOCIO = {
  nombre: 'Lapeluquerie',
  nombreLargo: 'Lapeluquerie · Studio Art',
  descripcion: 'Estudio de color especializado en balayage, rubios y corrección de color.',

  /* --- Ubicación --------------------------------------------------- */
  zona:   'Pilar',
  ciudad: 'Pilar, Buenos Aires',
  direccion: {
    calle:     'Luis Bataglia 572',
    localidad: 'Pilar',
    provincia: 'Buenos Aires',
    pais:      'AR'
  },
  maps: 'https://maps.app.goo.gl/LmB59sVP56N6NK4K8?g_st=ic',

  /* --- Contacto ----------------------------------------------------
     whatsapp: sólo dígitos, formato internacional, sin + ni espacios.
     Si se vacía, todos los CTA caen al mensaje directo de Instagram. */
  whatsapp: '5492304356392',
  telefonoVisible: '+54 9 2304 35-6392',
  /* El mail del perfil (marianadiaz901@gmail.com) queda fuera del sitio
     a pedido: publicarlo en una web lo expone a spam automático.
     Si algún día se quiere mostrar, alcanza con cargarlo acá. */
  email: '',
  instagramUsuario: 'lapeluquerie',
  instagram: 'https://www.instagram.com/lapeluquerie',

  /* --- Horarios ----------------------------------------------------
     Formato schema.org en `abre`/`cierra` (HH:MM, 24 h) para el JSON-LD. */
  horarios: [
    { dias: 'Martes, miércoles y viernes', texto: '09:00 – 18:00', schema: ['Tu','We','Fr'], abre: '09:00', cierra: '18:00' },
    { dias: 'Jueves',                      texto: '12:00 – 18:00', schema: ['Th'],           abre: '12:00', cierra: '18:00' },
    { dias: 'Sábados',                     texto: '09:00 – 18:00', schema: ['Sa'],           abre: '09:00', cierra: '18:00' },
    { dias: 'Domingos y lunes',            texto: 'Cerrado',       schema: [],               abre: '',      cierra: '' }
  ],

  /* --- Motor de reservas -------------------------------------------
     Hoy: WhatsApp. Para migrar a Fresha / Calendly / agenda propia,
     cambiá `proveedor` a 'url' y pegá el link en `url`. El resto del
     sitio no se toca: todos los CTA pasan por reservar() en app.js. */
  reservas: {
    proveedor: 'whatsapp',   // 'whatsapp' | 'url'
    url: ''                  // usado sólo si proveedor === 'url'
  },

  /* --- SEO ---------------------------------------------------------- */
  dominio: 'https://[DOMINIO]',

  /* Poné en true recién cuando cargues reseñas reales de Google:
     recién ahí se emite el structured data de valoraciones. */
  resenasReales: true
};

/* ============================================================
   SERVICIOS
   duracion y precio quedan en null a propósito: no están
   confirmados. Cuando los tengas, escribilos como texto
   ('2 a 3 h', 'Desde $00.000') y aparecen solos en la ficha.
   ============================================================ */
export const SERVICIOS = [
  {
    id: 'balayage',
    nombre: 'Balayage',
    resumen: 'Aclarado a mano alzada, sin línea de raíz y con crecimiento prolijo.',
    texto: 'Pintamos mechón por mechón siguiendo el movimiento de tu pelo, así el aclarado acompaña el corte en vez de pelearse con él. Es la técnica que mejor funciona si querés volver cada tres o cuatro meses y no cada tres semanas.',
    etiquetas: ['A mano alzada', 'Crecimiento prolijo', 'Bajo mantenimiento'],
    duracion: null,
    precio: null,
    img: 'despues-1',
    alt: 'Balayage en tono beige sobre base castaña, ondas largas'
  },
  {
    id: 'correccion',
    nombre: 'Corrección de color',
    resumen: 'Sacar el naranja, emparejar bandas, arreglar un color que no salió.',
    texto: 'Es el trabajo que más hacemos: pelos con capas de color viejo, decoloraciones desparejas o un cobre que nadie pidió. Se resuelve por etapas, con una lectura previa del historial del pelo. A veces sale en una sesión y a veces en dos: te lo decimos antes de empezar, no en el medio.',
    etiquetas: ['Diagnóstico previo', 'Por etapas', 'Neutralización'],
    duracion: null,
    precio: null,
    img: 'despues-2',
    alt: 'Corrección de un cobre intenso a un castaño ceniza iluminado'
  },
  {
    id: 'rubios',
    nombre: 'Rubios y babylights',
    resumen: 'Rubios fríos, beige o ceniza, construidos sin quemar el largo.',
    texto: 'Mechas finas cerca de la raíz para dar luz sin marcar el crecimiento, y matizado hasta el tono exacto. Trabajamos el rubio como una escala: hasta dónde llega hoy tu pelo sin comprometerse, y qué pasos faltan para llegar al tono que querés.',
    etiquetas: ['Babylights', 'Matizado', 'Rubio frío'],
    duracion: null,
    precio: null,
    img: 'bronde',
    alt: 'Rubio bronde con babylights y ondas amplias'
  },
  {
    id: 'color',
    nombre: 'Color de fantasía cálida',
    resumen: 'Caobas, chocolates y rojizos con profundidad y brillo real.',
    texto: 'Los tonos cálidos se ven planos cuando se aplican de una sola pasada. Los armamos con dos o tres reflejos distintos para que el color se mueva con la luz, y sellamos el largo para que el brillo dure más que la primera semana.',
    etiquetas: ['Caoba', 'Chocolate', 'Rojizos'],
    duracion: null,
    precio: null,
    img: 'caoba',
    alt: 'Color caoba profundo con reflejos rojizos sobre pelo ondulado'
  },
  {
    id: 'iluminacion',
    nombre: 'Iluminación y reflejos',
    resumen: 'Un poco de luz sobre tu color, sin cambiar de base.',
    texto: 'Para cuando no querés cambiar de color, solo que se note que está cuidado. Reflejos suaves alrededor de la cara y en el largo, pensados para que el castaño no se apague y el corte se vea con más movimiento.',
    etiquetas: ['Reflejos', 'Contorno de cara', 'Sutil'],
    duracion: null,
    precio: null,
    img: 'castano',
    alt: 'Castaño con reflejos caramelo y puntas onduladas'
  },
  {
    id: 'corte',
    nombre: 'Corte y styling',
    resumen: 'Corte pensado para tu textura y brushing que podés repetir en casa.',
    texto: 'Antes de cortar preguntamos algo incómodo: cuánto tiempo le dedicás realmente al pelo a la mañana. De ahí salen las capas, el largo y la forma. El brushing final se explica mientras se hace, para que lo puedas repetir sola.',
    etiquetas: ['Corte', 'Brushing', 'Ondas'],
    duracion: null,
    precio: null,
    img: 'castano',
    alt: 'Brushing con ondas suaves sobre castaño iluminado'
  },
  {
    id: 'tratamiento',
    nombre: 'Tratamientos',
    resumen: 'Acondicionamiento profundo después de una técnica química.',
    texto: 'Se hace en el mismo turno, después del color, para devolverle suavidad y manejabilidad al largo. Es un tratamiento cosmético de acondicionamiento: mejora cómo se siente y cómo se peina el pelo, y ayuda a que el color se vea parejo.',
    etiquetas: ['Post técnica', 'Acondicionamiento', 'Brillo'],
    duracion: null,
    precio: null,
    img: 'bronde',
    alt: 'Largo de pelo acondicionado con brillo uniforme'
  },
  {
    id: 'eventos',
    nombre: 'Peinados y eventos',
    resumen: 'Recogidos, semirecogidos y ondas para fiestas y casamientos.',
    texto: 'Se reserva con fecha y horario cerrados, porque el día del evento no hay margen. Si es un casamiento, conviene una prueba previa para definir el peinado con tiempo y sin apuro.',
    etiquetas: ['Eventos', 'Novias', 'Con prueba previa'],
    duracion: null,
    precio: null,
    img: 'caoba',
    alt: 'Peinado con ondas amplias y brillo para evento'
  }
];

/* ============================================================
   GALERÍA — sólo trabajos reales del salón
   ============================================================ */
export const CATEGORIAS = [
  { id: 'todos',           nombre: 'Todos' },
  { id: 'balayage',        nombre: 'Balayage' },
  { id: 'rubios',          nombre: 'Rubios' },
  { id: 'color',           nombre: 'Color' },
  { id: 'transformaciones', nombre: 'Transformaciones' }
];

export const GALERIA = [
  {
    id: 'g1', img: 'despues-1',
    titulo: 'Balayage beige sobre base castaña',
    servicio: 'balayage',
    texto: 'Aclarado a mano alzada con matizado frío. La raíz queda natural para que el crecimiento no marque una línea.',
    cats: ['balayage', 'rubios', 'transformaciones']
  },
  {
    id: 'g2', img: 'bronde',
    titulo: 'Bronde con babylights',
    servicio: 'rubios',
    texto: 'Mechas finas cerca de la cara y aclarado progresivo hacia las puntas, en tono beige neutro.',
    cats: ['balayage', 'rubios']
  },
  {
    id: 'g3', img: 'caoba',
    titulo: 'Caoba profundo con reflejos',
    servicio: 'color',
    texto: 'Tres reflejos distintos dentro del mismo caoba para que el color tenga movimiento y no se vea plano.',
    cats: ['color']
  },
  {
    id: 'g4', img: 'despues-2',
    titulo: 'De cobre a castaño ceniza',
    servicio: 'correccion',
    texto: 'Corrección de un cobre saturado: neutralizado y reconstruido como castaño iluminado con reflejos fríos.',
    cats: ['color', 'transformaciones', 'rubios']
  },
  {
    id: 'g5', img: 'castano',
    titulo: 'Castaño con reflejos caramelo',
    servicio: 'iluminacion',
    texto: 'Iluminación suave sobre la base natural: da luz al castaño sin cambiar de color ni exigir mantenimiento frecuente.',
    cats: ['color', 'balayage']
  }
];

/* ============================================================
   ANTES / DESPUÉS — pares reales del mismo trabajo
   ============================================================ */
export const TRANSFORMACIONES = [
  {
    id: 't1',
    titulo: 'Rubio desparejo → balayage beige',
    detalle: 'Una sesión',
    servicio: 'balayage',
    antes: 'antes-1', despues: 'despues-1',
    altA: 'Antes: rubio cálido desparejo con raíz marcada',
    altD: 'Después: balayage beige con raíz difuminada'
  },
  {
    id: 't2',
    titulo: 'Cobre saturado → castaño ceniza',
    detalle: 'Corrección de color',
    servicio: 'correccion',
    antes: 'antes-2', despues: 'despues-2',
    altA: 'Antes: cobre intenso en todo el largo',
    altD: 'Después: castaño ceniza con reflejos fríos'
  }
];

/* ============================================================
   DIAGNÓSTICO EXPRESS — recomienda servicios según respuestas
   Cada opción suma puntos a uno o más servicios (por id).
   ============================================================ */
export const DIAGNOSTICO = [
  {
    id: 'estado',
    pregunta: '¿Cómo está tu pelo hoy?',
    opciones: [
      { txt: 'Natural, nunca me lo teñí',        puntos: { balayage: 3, rubios: 2, iluminacion: 2 } },
      { txt: 'Con color, pero parejo',           puntos: { balayage: 2, color: 2, iluminacion: 2 } },
      { txt: 'Con decoloración o mechas viejas', puntos: { correccion: 3, rubios: 2, tratamiento: 2 } },
      { txt: 'Con un color que no me gusta',     puntos: { correccion: 4, color: 1 } }
    ]
  },
  {
    id: 'objetivo',
    pregunta: '¿Qué querés que pase con tu color?',
    opciones: [
      { txt: 'Quiero aclararme',              puntos: { balayage: 3, rubios: 3 } },
      { txt: 'Quiero sacarme el naranja',     puntos: { correccion: 4, rubios: 1 } },
      { txt: 'Quiero un color más profundo',  puntos: { color: 4 } },
      { txt: 'Quiero mantener lo que tengo',  puntos: { iluminacion: 3, tratamiento: 2, corte: 1 } }
    ]
  },
  {
    id: 'mantenimiento',
    pregunta: '¿Cada cuánto podés volver al salón?',
    opciones: [
      { txt: 'Lo menos posible',            puntos: { balayage: 3, iluminacion: 2 } },
      { txt: 'Cada dos o tres meses',       puntos: { balayage: 2, rubios: 2, color: 1 } },
      { txt: 'Me gusta venir seguido',      puntos: { rubios: 2, color: 2, corte: 1 } }
    ]
  },
  {
    id: 'evento',
    pregunta: '¿Hay una fecha puntual en el medio?',
    opciones: [
      { txt: 'Sí, tengo un evento',    puntos: { eventos: 3, corte: 1 } },
      { txt: 'Un casamiento (soy la novia)', puntos: { eventos: 4, tratamiento: 1 } },
      { txt: 'No, es para mí nomás',   puntos: { corte: 1 } }
    ]
  }
];

/* ============================================================
   EQUIPO — ⚠️ placeholders: no publicar así
   Reemplazá nombre, rol, texto y foto (poné el nombre del
   archivo en `foto`, dentro de /assets, sin extensión).
   ============================================================ */
export const EQUIPO = [
  { nombre: '[NOMBRE]', rol: '[Especialidad]', anios: '[Años de experiencia]',
    texto: '[Dos o tres líneas contadas por ella: en qué se especializa y qué trabajo disfruta más.]',
    instagram: '', foto: null },
  { nombre: '[NOMBRE]', rol: '[Especialidad]', anios: '[Años de experiencia]',
    texto: '[Dos o tres líneas contadas por ella: en qué se especializa y qué trabajo disfruta más.]',
    instagram: '', foto: null },
  { nombre: '[NOMBRE]', rol: '[Especialidad]', anios: '[Años de experiencia]',
    texto: '[Dos o tres líneas contadas por ella: en qué se especializa y qué trabajo disfruta más.]',
    instagram: '', foto: null }
];

/* ============================================================
   RESEÑAS — ⚠️ placeholders
   Copiá las reseñas reales desde el perfil de Google del salón
   (NEGOCIO.maps) y poné NEGOCIO.resenasReales = true.
   ============================================================ */
export const RESENAS = {
  puntaje: 5,
  cantidad: null,
  items: [
    { autor: 'Daniela Salas', fecha: 'hace 9 meses', servicio: 'Google', estrellas: 5,
      texto: 'Siempre la mejor atención y precios súper justos! Recomendadísima.' },
    { autor: 'María Celia Pailhe', fecha: 'hace 1 año', servicio: 'Color y corte', estrellas: 5,
      texto: 'Excelente atención!! July me hizo color como a mí me gusta y Mariana un corte bárbaro. Quedé superconforme! Volveré!' },
    { autor: 'Julieta Gomez', fecha: 'hace 7 meses', servicio: 'Peinado de evento', estrellas: 5,
      texto: 'Soy de Mendoza y necesitaba una peluquería para ir a un casamiento! Tengo unos rulos indomables y Flor fue una genia, mucha paciencia. Me quedó hermoso el pelo. Un diez.' }
  ]
};

/* ============================================================
   FAQ — también alimenta el structured data FAQPage
   ============================================================ */
export const FAQ = [
  {
    q: '¿Cómo reservo un turno?',
    a: 'Por WhatsApp, desde cualquier botón de "Reservar turno" de este sitio. El mensaje ya viene escrito con el servicio que estabas mirando, así no tenés que explicar nada de cero. Te respondemos con los horarios disponibles.'
  },
  {
    q: '¿Dónde queda el salón?',
    a: 'En Bataglia 572, Pilar, provincia de Buenos Aires. Podés abrir la ubicación exacta en Google Maps desde la sección de contacto.'
  },
  {
    q: '¿Cuánto sale un balayage?',
    a: 'El valor depende del largo, del espesor y del punto de partida de tu pelo: no es lo mismo un primer aclarado que retocar uno existente. Escribinos por WhatsApp con una foto de tu pelo con luz natural y te pasamos el rango antes de reservar.'
  },
  {
    q: 'Tengo el pelo teñido y quiero ser rubia. ¿Se puede en una sola sesión?',
    a: 'A veces sí y a veces no, y depende del historial de tu pelo más que de las ganas. Cuando hay color oscuro acumulado o decoloraciones viejas, lo habitual es hacerlo por etapas para cuidar el largo. Lo definimos en el diagnóstico, antes de empezar, y te decimos cuántas sesiones estimamos.'
  },
  {
    q: '¿Hacen diagnóstico antes del servicio?',
    a: 'Sí, siempre. Miramos el estado del largo, el color que ya tenés y qué se hizo antes. Recién ahí decidimos la técnica. Si lo que pedís no es aconsejable para tu pelo, te lo decimos y te proponemos otra cosa.'
  },
  {
    q: '¿Cuánto dura un turno de color?',
    a: '[Completar con la duración real por tipo de servicio.] Cuando confirmamos el turno te decimos cuánto tiempo reservar, para que puedas organizarte.'
  },
  {
    q: '¿Qué días atienden?',
    a: 'Martes, miércoles y viernes de 09:00 a 18:00; jueves de 12:00 a 18:00; sábados de 09:00 a 18:00. Domingos y lunes cerrado. Siempre con turno reservado.'
  },
  {
    q: '¿Atienden pelo con canas?',
    a: 'Sí. Se puede trabajar cobertura total o integrarlas con reflejos, que es una opción de mantenimiento más espaciado. En la consulta vemos qué porcentaje de canas tenés y qué te conviene según cada cuánto quieras volver.'
  },
  {
    q: '¿Puedo llevar una foto de referencia?',
    a: 'Es lo mejor que podés hacer, y traé también alguna foto de un resultado que no te gustaría. Con las dos cosas es mucho más fácil llegar al tono que tenés en la cabeza. Igual te vamos a decir con honestidad qué tan cerca de esa foto puede llegar tu pelo hoy.'
  }
];

/* ============================================================
   PASOS DE LA EXPERIENCIA
   ============================================================ */
export const EXPERIENCIA = [
  { t: 'La consulta', d: 'Antes de tocar nada nos sentamos a mirar tu pelo: qué te hiciste antes, qué te gustó y qué no, y qué querés lograr. Diez minutos que evitan la mayoría de los arrepentimientos.' },
  { t: 'El diagnóstico', d: 'Leemos el estado real del largo y definimos la técnica, el tono y, si hace falta, cuántas sesiones lleva. Te lo decimos antes de empezar, con el rango de valores.' },
  { t: 'La técnica', d: 'Trabajo por secciones, a mano alzada cuando el resultado lo pide. Es la parte más larga del turno y la que define que el crecimiento salga prolijo.' },
  { t: 'El matizado', d: 'El tono final se ajusta después del lavado, con el pelo húmedo y a la luz del salón. Es el paso que decide si un rubio queda frío o se va al dorado.' },
  { t: 'El styling', d: 'Brushing y terminación, explicados mientras se hacen: qué producto, cuánto calor y en qué orden, para que lo puedas repetir en tu casa.' },
  { t: 'El después', d: 'Te decimos cada cuánto conviene volver y cómo lavarlo para que el color aguante. Si algo no se ve como esperabas, escribinos: se revisa.' }
];

export const PILARES = [
  { t: 'Primero el diagnóstico', d: 'Ningún color arranca sin leer el historial de tu pelo. Es la diferencia entre un resultado que se sostiene y uno que hay que corregir el mes que viene.' },
  { t: 'Rubios sin naranja', d: 'La mayor parte de nuestro trabajo son aclarados y correcciones. Neutralizar el fondo cálido no es un extra: es el trabajo.' },
  { t: 'Un color que se pueda mantener', d: 'Te decimos cada cuánto volver, qué se va a ver cuando crezca y con qué lavarlo. Si el mantenimiento no te cierra, cambiamos la propuesta.' }
];

export const TICKER = [
  'Balayage', 'Rubios fríos', 'Corrección de color', 'Babylights',
  'Caoba & chocolate', 'Iluminación', 'Brushing & ondas', 'Novias'
];
