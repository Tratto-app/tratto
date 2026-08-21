/* ══════════════════════════════════════════════════════════════════════════
   PELO'S DESIGN — ARCHIVO EDITABLE
   ══════════════════════════════════════════════════════════════════════════

   Este es el ÚNICO archivo que hace falta tocar para mantener el sitio al día.
   Se abre con cualquier editor de texto (Bloc de notas, TextEdit, VS Code).

   Reglas de oro, tres:
     1. Cambiá solo lo que está entre comillas "así" o los números.
     2. No borres las comas del final de cada línea.
     3. Guardá y recargá el navegador con Ctrl+F5 (Cmd+Shift+R en Mac).

   Si algo se rompe, deshacé el último cambio (Ctrl+Z) y volvé a guardar.

   Índice de este archivo:
     1) NEGOCIO ....... nombre, dirección, teléfono, redes
     2) HORARIOS ...... para el cartel de "abierto ahora"
     3) RESEÑAS ....... las reseñas reales de Google que se muestran
     4) SERVICIOS ..... los precios de la página precios.html
     5) NOTAS ......... las aclaraciones al pie de la lista de precios
     6) GALERIA ....... las fotos de trabajos
     7) FAQ ........... las preguntas frecuentes
   ══════════════════════════════════════════════════════════════════════════ */


/* ─────────────────────────────────────────────────────────────────────────
   1) NEGOCIO
   ─────────────────────────────────────────────────────────────────────────
   OJO con el teléfono: tiene que ser EXACTAMENTE el mismo acá, en Google y
   en Instagram. Una diferencia de formato le cuesta posiciones al negocio.

   whatsapp .......... solo números, con 54 9 adelante y sin espacios
   whatsappVisible ... cómo se lee en pantalla
   ───────────────────────────────────────────────────────────────────────── */

const NEGOCIO = {
  nombre:          "Pelo's Design",
  rubro:           "Peluquería de diseño",
  barrio:          "Caballito",
  calle:           "Yerbal 880",
  codigoPostal:    "C1408",
  ciudad:          "Ciudad Autónoma de Buenos Aires",
  direccionCorta:  "Yerbal 880, Caballito",
  direccionLarga:  "Yerbal 880, C1408, Caballito, CABA",

  whatsapp:        "5491167941212",     // ⚠ PENDIENTE DE CONFIRMAR — ver README
  whatsappVisible: "11 6794-1212",

  instagram:       "pelosdesign",
  fichaGoogle:     "https://maps.app.goo.gl/bU6EvPzkiTfMdYFy8",

  // Estos dos números salen de la ficha de Google. Actualizalos cuando cambien.
  puntaje:         "5,0",
  cantidadReseñas: 176,

  // Para el mapa y para Google
  lat:  -34.61985,
  lng:  -58.4428638,

  // Vigencia que se muestra arriba de la lista de precios
  vigencia: "Agosto a octubre de 2026",

  // Dirección del sitio publicado. Cambiala cuando tengan dominio propio.
  sitio: "https://pelosdesign.vercel.app"
};


/* ─────────────────────────────────────────────────────────────────────────
   2) HORARIOS
   ─────────────────────────────────────────────────────────────────────────
   El sitio calcula solo si está abierto o cerrado en este momento, y si está
   cerrado dice cuándo vuelve a abrir.

   Formato: abre y cierra en 24 horas, "10:00" y "17:30".
   Si un día está cerrado, dejá   abre: null, cierra: null
   ───────────────────────────────────────────────────────────────────────── */

const HORARIOS = [
  { dia: "Domingo",   abre: null,    cierra: null    },
  { dia: "Lunes",     abre: null,    cierra: null    },
  { dia: "Martes",    abre: "10:00", cierra: "17:30" },
  { dia: "Miércoles", abre: "10:00", cierra: "17:30" },
  { dia: "Jueves",    abre: null,    cierra: null    },
  { dia: "Viernes",   abre: "10:00", cierra: "17:30" },
  { dia: "Sábado",    abre: "10:00", cierra: "16:00" }
];


/* ─────────────────────────────────────────────────────────────────────────
   3) RESEÑAS DE GOOGLE
   ─────────────────────────────────────────────────────────────────────────
   ⚠ IMPORTANTE, LEER ANTES DE TOCAR ESTO:

   Estas reseñas tienen que ser REALES y estar COPIADAS TAL CUAL de la ficha
   de Google. No se inventan, no se mejoran, no se les cambia el sentido.
   Es una cuestión legal y también de confianza: la gente cruza lo que dice
   el sitio con lo que dice Google.

   Cómo cargarlas, paso a paso:
     1. Entrá a la ficha: https://maps.app.goo.gl/bU6EvPzkiTfMdYFy8
     2. Tocá donde dice "176 reseñas".
     3. Elegí las que mejor cuenten cómo trabajan. Cuatro a seis alcanzan.
     4. Copiá el texto y el nombre del autor tal como aparecen.
     5. Pegalos abajo, reemplazando cada  texto: null

   Si recortaste una reseña larga, poné  recortada: true  y el sitio lo va a
   marcar con puntos suspensivos y una aclaración. Nunca la recortes de forma
   que cambie lo que la persona quiso decir.

   Mientras haya reseñas sin cargar, el sitio muestra un cartel amarillo de
   aviso. Cuando estén todas, el cartel desaparece solo.

   estrellas ... el puntaje de esa reseña (casi siempre 5)
   tema ........ una etiqueta corta tuya para agrupar. Ej: "Color", "Rulos"
   ───────────────────────────────────────────────────────────────────────── */

const RESEÑAS = [
  { autor: null, texto: null, estrellas: 5, tema: "Corte",  recortada: false },
  { autor: null, texto: null, estrellas: 5, tema: "Color",  recortada: false },
  { autor: null, texto: null, estrellas: 5, tema: "Rulos",  recortada: false },
  { autor: null, texto: null, estrellas: 5, tema: "Trato",  recortada: false },
  { autor: null, texto: null, estrellas: 5, tema: "Precio", recortada: false },
  { autor: null, texto: null, estrellas: 5, tema: "Color",  recortada: false }
];


/* ─────────────────────────────────────────────────────────────────────────
   4) SERVICIOS Y PRECIOS
   ─────────────────────────────────────────────────────────────────────────
   ⟦ ESTE ES EL BLOQUE DE LOS PRECIOS ⟧

   Cómo cargar un precio:
     [corto, mediano, largo, extraLargo]   ← cuatro números, sin $ ni puntos
     Ejemplo:  precios: [18000, 22000, 26000, 30000]

   Si el servicio vale lo mismo para todos los largos:
     fijo: 15000

   Si todavía no sabés el precio, dejá  null  y va a mostrar "a consultar".
   Si un servicio no lo ofrecen, borrá la línea entera.

   Para agregar un servicio nuevo, copiá una línea entera y cambiale el
   nombre. Para agregar un grupo nuevo, copiá desde  { grupo:  hasta  ] },
   ───────────────────────────────────────────────────────────────────────── */

const SERVICIOS = [
  {
    grupo: "Cortes y peinados",
    items: [
      { nombre: "Corte",                     detalle: "Incluye lavado y secado",        precios: [null, null, null, null] },
      { nombre: "Corte + brushing",          detalle: "",                               precios: [null, null, null, null] },
      { nombre: "Brushing",                  detalle: "",                               precios: [null, null, null, null] },
      { nombre: "Peinado",                   detalle: "Eventos, recogidos",             precios: [null, null, null, null] },
      { nombre: "Corte de caballero",        detalle: "",                               fijo: null },
      { nombre: "Flequillo",                 detalle: "",                               fijo: null }
    ]
  },
  {
    grupo: "Color",
    items: [
      { nombre: "Retoque de raíz",           detalle: "Hasta 3 cm",                     precios: [null, null, null, null] },
      { nombre: "Color completo",            detalle: "",                               precios: [null, null, null, null] },
      { nombre: "Balayage",                  detalle: "Incluye matizado",               precios: [null, null, null, null] },
      { nombre: "Mechas / babylights",       detalle: "",                               precios: [null, null, null, null] },
      { nombre: "Iluminación",               detalle: "",                               precios: [null, null, null, null] },
      { nombre: "Matizado",                  detalle: "",                               precios: [null, null, null, null] },
      { nombre: "Decoloración",              detalle: "Se cotiza en consulta previa",   precios: [null, null, null, null] }
    ]
  },
  {
    grupo: "Tratamientos",
    items: [
      { nombre: "Nutrición profunda",        detalle: "",                               precios: [null, null, null, null] },
      { nombre: "Hidratación",               detalle: "",                               precios: [null, null, null, null] },
      { nombre: "Botox capilar",             detalle: "",                               precios: [null, null, null, null] },
      { nombre: "Alisado / keratina",        detalle: "",                               precios: [null, null, null, null] },
      { nombre: "Definición de rizos",       detalle: "Pelo ondulado y rulo",           precios: [null, null, null, null] },
      { nombre: "Tratamiento de brillo",     detalle: "",                               precios: [null, null, null, null] }
    ]
  }
];


/* ─────────────────────────────────────────────────────────────────────────
   5) NOTAS AL PIE DE LA LISTA DE PRECIOS
   ───────────────────────────────────────────────────────────────────────── */

const NOTAS = [
  "Los precios pueden variar según la densidad del cabello y la cantidad de producto que se necesite.",
  "Los servicios de color se confirman en una consulta previa sin cargo.",
  "Atendemos con turno previo para dedicarle a cada persona el tiempo que necesita."
];


/* ─────────────────────────────────────────────────────────────────────────
   6) GALERÍA DE TRABAJOS
   ─────────────────────────────────────────────────────────────────────────
   Cómo cargar una foto:
     1. Guardá la foto dentro de la carpeta  img/
     2. Ponele un nombre sin espacios ni acentos. Ej:  balayage-cobre.webp
     3. Escribí ese nombre abajo, en  archivo:

   El  alt  es la descripción de la foto para quien no puede verla, y también
   la lee Google. Describí lo que se ve de verdad, en una frase.

   Poné solo fotos de trabajos hechos en el salón, con permiso de la persona.

   Mientras  archivo  esté en null, se muestra un recuadro vacío con la
   medida que tiene que tener la foto. Cuando estén todas, el aviso se va.
   ───────────────────────────────────────────────────────────────────────── */

const GALERIA = [
  { archivo: null, alt: null, etiqueta: "Balayage" },
  { archivo: null, alt: null, etiqueta: "Corte"    },
  { archivo: null, alt: null, etiqueta: "Color"    },
  { archivo: null, alt: null, etiqueta: "Rulos"    },
  { archivo: null, alt: null, etiqueta: "Mechas"   },
  { archivo: null, alt: null, etiqueta: "Peinado"  }
];


/* ─────────────────────────────────────────────────────────────────────────
   7) PREGUNTAS FRECUENTES
   ─────────────────────────────────────────────────────────────────────────
   Si una respuesta está en null, la pregunta no se muestra en el sitio.
   Escribí como hablás por teléfono: frases cortas y concretas.
   ───────────────────────────────────────────────────────────────────────── */

const FAQ = [
  {
    pregunta: "¿Atienden sin turno?",
    respuesta: "Trabajamos con turno. Es la forma de dedicarle a cada persona el tiempo que necesita, sin apurar a nadie. Escribinos por WhatsApp y lo arreglamos."
  },
  {
    pregunta: "¿Cuánto dura un balayage?",
    respuesta: "Depende del largo, del color que tengas hoy y del que quieras llegar. Antes de empezar hacemos una consulta sin cargo y ahí te decimos cuánto va a llevar y cuánto sale."
  },
  {
    pregunta: "¿Trabajan pelo rulo?",
    respuesta: "Sí. Hacemos corte en seco y definición de rizos para pelo ondulado y rulo. Está en la lista de precios, dentro de Tratamientos."
  },
  {
    pregunta: "¿Hacen corrección de color?",
    respuesta: "Sí, es de lo que más hacemos. Si venís de un color que no te gustó o de una decoloración pareja a medias, traé fotos y lo vemos en la consulta previa."
  },
  {
    pregunta: "¿Qué medios de pago aceptan?",
    respuesta: null   // ⚠ PENDIENTE — completar con efectivo / transferencia / tarjetas
  },
  {
    pregunta: "¿Atienden en inglés?",
    respuesta: "Sí, nos manejamos en inglés sin problema. Escribinos igual por WhatsApp."
  }
];
