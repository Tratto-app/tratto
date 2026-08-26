/**
 * Servicios del salón.
 *
 * REGLA: sólo se publican servicios con evidencia. Desde que el salón pasó su
 * lista de precios oficial, esa lista es la fuente: los nombres de acá son los
 * mismos que figuran ahí, para que no haya un servicio en la web que después
 * no aparezca en el precio. `evidence` documenta el origen de cada uno.
 *
 * Los PRECIOS no viven acá: están en /public/precios.pdf, documento oficial
 * del salón. No se duplican en el HTML para que nunca queden desactualizados.
 */

export interface Service {
  slug: string;
  name: string;
  /** Frase corta para tarjetas y listados. */
  summary: string;
  /** Texto largo, redactado para responder dudas reales (útil para GEO). */
  detail: string;
  /** Qué respalda que el salón ofrece esto. */
  evidence: string;
}

export interface ServiceCategory {
  slug: string;
  name: string;
  intro: string;
  services: Service[];
}

export const serviceCategories: ServiceCategory[] = [
  {
    slug: 'color',
    name: 'Color',
    intro:
      'Es lo que mejor hacemos. Cada fórmula se piensa sobre tu pelo, no sobre una carta de colores.',
    services: [
      {
        slug: 'color',
        name: 'Color',
        summary: 'Color parejo, raíz cubierta, tono elegido con vos.',
        detail:
          'Coloración completa o retoque de raíz. Antes de mezclar miramos el pelo: base natural, canas, restos de color anterior y qué tan poroso está. Esa lectura define la fórmula y el tiempo de exposición.',
        evidence: 'Figura en la lista de precios oficial del salón.',
      },
      {
        slug: 'color-rojos',
        name: 'Color rojos',
        summary: 'Los tonos más difíciles de sostener.',
        detail:
          'Rojizos, cobres y cálidos intensos. Son los que más rápido se van, así que la conversación sobre cómo mantenerlos en casa es parte del servicio.',
        evidence: 'Figura en la lista de precios oficial del salón.',
      },
      {
        slug: 'tono-sobre-tono',
        name: 'Tono sobre tono',
        summary: 'Refrescar el color sin aclarar.',
        detail:
          'Devuelve intensidad y brillo al color que ya tenés, sin levantar la base. Buena opción entre coloración y coloración.',
        evidence: 'Figura en la lista de precios oficial del salón.',
      },
      {
        slug: 'iluminacion',
        name: 'Iluminación',
        summary: 'Luz repartida donde el pelo la pide.',
        detail:
          'Aclarado por zonas para darle movimiento y profundidad. Se puede hacer solo o combinado con color en la misma visita.',
        evidence: 'Figura en la lista de precios oficial, sola y combinada con color.',
      },
      {
        slug: 'balayage',
        name: 'Balayage',
        summary: 'Luz donde el sol la dejaría.',
        detail:
          'Aclarado a mano alzada, sin línea de raíz marcada. Crece prolijo, así que estirás mucho más el tiempo entre visitas.',
        evidence: 'Figura en la lista de precios oficial del salón.',
      },
      {
        slug: 'claros-y-oscuros',
        name: 'Claros y oscuros',
        summary: 'Contraste trabajado en la misma cabeza.',
        detail:
          'Juego de luces y sombras para dar volumen visual. También hacemos sólo oscuros cuando lo que buscás es profundidad.',
        evidence: 'Figuran en la lista de precios oficial como servicios separados.',
      },
      {
        slug: 'decoloracion',
        name: 'Decoloración',
        summary: 'Levantar la base para llegar a un tono claro.',
        detail:
          'El paso previo cuando el destino es varios tonos más claro. Evaluamos primero cuánto aguanta tu pelo: a veces conviene hacerlo en más de una sesión.',
        evidence: 'Figura en la lista de precios oficial del salón.',
      },
      {
        slug: 'limpieza-de-color',
        name: 'Limpieza de color',
        summary: 'Sacar lo que quedó de coloraciones anteriores.',
        detail:
          'Retira acumulación de color para poder trabajar sobre una base más pareja. Suele ser el primer paso de un cambio grande.',
        evidence: 'Figura en la lista de precios oficial del salón.',
      },
      {
        slug: 'pigmentacion',
        name: 'Pigmentación',
        summary: 'Devolverle pigmento al pelo trabajado.',
        detail:
          'Repone color en pelo muy decolorado o apagado, para que el tono final agarre parejo.',
        evidence: 'Figura en la lista de precios oficial del salón.',
      },
    ],
  },
  {
    slug: 'corte',
    name: 'Corte',
    intro: 'Cortes que caen solos. Pensados para el pelo que tenés y para el tiempo que le dedicás.',
    services: [
      {
        slug: 'corte',
        name: 'Corte',
        summary: 'Lavado, corte y terminación.',
        detail:
          'Antes de cortar preguntamos cómo te peinás un martes cualquiera. Un corte lindo que no podés reproducir en casa no sirve. Vale lo mismo en cualquier largo.',
        evidence: 'Figura en la lista de precios oficial, con el mismo valor en los cuatro largos.',
      },
    ],
  },
  {
    slug: 'tratamientos',
    name: 'Tratamientos',
    intro: 'Cuando el pelo pide otra cosa antes que color.',
    services: [
      {
        slug: 'nutricion',
        name: 'Nutrición',
        summary: 'Devolverle cuerpo al pelo castigado.',
        detail:
          'La hacemos después del color, para sellar y que el tono dure, o sola con lavado. Para pelo poroso o quebradizo suele ser el paso previo obligado antes de tocar el color.',
        evidence: 'Figura en la lista de precios oficial: nutrición post color y nutrición + lavado.',
      },
      {
        slug: 'shock-de-keratina',
        name: 'Shock de keratina',
        summary: 'Reconstrucción para pelo muy trabajado.',
        detail:
          'Repone keratina en fibras dañadas por decoloración o calor. Devuelve resistencia y brillo sin cambiarte la forma del pelo.',
        evidence: 'Figura en la lista de precios oficial del salón.',
      },
      {
        slug: 'alisado-sin-formol',
        name: 'Alisado sin formol',
        summary: 'Menos frizz, más brillo, forma que dura.',
        detail:
          'Trabajamos sin formol. El objetivo no es un pelo plano: es que se peine solo y brille. Cuánto te dura depende de tu tipo de pelo, y te lo decimos antes.',
        evidence: 'Figura en la lista de precios oficial del salón.',
      },
      {
        slug: 'permanente',
        name: 'Permanente',
        summary: 'Rulo o cuerpo que se queda.',
        detail:
          'Para darle textura estable al pelo lacio. Se define el tamaño del rulo según el largo y el estado de tu pelo.',
        evidence: 'Figura en la lista de precios oficial del salón.',
      },
    ],
  },
  {
    slug: 'peinados',
    name: 'Peinados',
    intro: 'Para el día que querés salir del salón lista.',
    services: [
      {
        slug: 'brushing',
        name: 'Brushing',
        summary: 'Liso con cuerpo o con puntas hacia adentro.',
        detail:
          'Lavado y secado con cepillo, terminado según cómo quieras que caiga. También lo hacemos con planchita, para un liso más marcado.',
        evidence: 'Figura en la lista de precios oficial: brushing, con planchita y con movimiento.',
      },
      {
        slug: 'brushing-con-movimiento',
        name: 'Brushing con movimiento',
        summary: 'Ondas amplias, con cuerpo.',
        detail: 'Secado trabajado para que el pelo tenga onda y volumen, no sólo liso.',
        evidence: 'Figura en la lista de precios oficial del salón.',
      },
      {
        slug: 'modelado',
        name: 'Modelado',
        summary: 'Dar forma sin lavar de nuevo.',
        detail: 'Retoque de forma y terminación, para cuando venís con el pelo ya limpio.',
        evidence: 'Figura en la lista de precios oficial del salón.',
      },
    ],
  },
];

/** Todos los servicios en plano, para schema.org y para buscar por slug. */
export const allServices: Service[] = serviceCategories.flatMap((c) => c.services);

/** Los que abren la home: uno por categoría, el más representativo. */
export const featuredServiceSlugs = ['color', 'balayage', 'corte', 'alisado-sin-formol'] as const;
