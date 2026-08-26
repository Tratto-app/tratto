/**
 * Servicios del salón.
 *
 * REGLA: sólo se publican servicios con evidencia — mencionados en la ficha
 * de Google / directorios, o visibles en las fotos que envió el salón.
 * `evidence` documenta de dónde sale cada uno para que sea auditable.
 * Para agregar un servicio nuevo alcanza con sumarlo a este archivo.
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
        slug: 'coloracion',
        name: 'Coloración',
        summary: 'Color parejo, raíz cubierta, tono elegido con vos.',
        detail:
          'Coloración completa o retoque de raíz. Antes de mezclar miramos el pelo: base natural, canas, restos de color anterior y qué tan poroso está. Esa lectura define la fórmula y el tiempo de exposición.',
        evidence: 'Especialidad citada en la ficha de Google y en reseñas de clientas.',
      },
      {
        slug: 'mechas',
        name: 'Mechas y claritos',
        summary: 'Papel por papel, aclarado controlado.',
        detail:
          'Trabajo con papel para aclarar mechón por mechón y controlar hasta dónde llega cada uno. Sirve para iluminar sin cambiar el largo ni comprometer todo el pelo.',
        evidence: 'Técnica visible en las fotos del salón (aplicación con papel y pincel).',
      },
      {
        slug: 'balayage',
        name: 'Balayage y barrido',
        summary: 'Luz donde el sol la dejaría.',
        detail:
          'Aclarado a mano alzada, sin línea de raíz marcada. Crece prolijo, así que estirás mucho más el tiempo entre visitas.',
        evidence: 'Técnica de color declarada por el salón. Confirmar alcance exacto.',
      },
      {
        slug: 'cobrizos-y-rojos',
        name: 'Cobrizos y rojos',
        summary: 'Los tonos más difíciles de sostener.',
        detail:
          'Cobres, rojizos y cálidos intensos. Son los tonos que más rápido se van, así que la conversación sobre cómo mantenerlos en casa es parte del servicio.',
        evidence: 'Trabajos en cobre publicados por el salón en Instagram.',
      },
    ],
  },
  {
    slug: 'corte',
    name: 'Corte',
    intro: 'Cortes que caen solos. Pensados para el pelo que tenés y para el tiempo que le dedicás.',
    services: [
      {
        slug: 'corte-mujer',
        name: 'Corte',
        summary: 'Lavado, corte y terminación.',
        detail:
          'Antes de cortar preguntamos cómo te peinás un martes cualquiera. Un corte lindo que no podés reproducir en casa no sirve.',
        evidence: 'Especialidad citada en la ficha de Google y en reseñas de clientas.',
      },
      {
        slug: 'capas-y-movimiento',
        name: 'Capas y movimiento',
        summary: 'Para sacar volumen o para darlo.',
        detail:
          'Capas largas, desmechado y trabajo de puntas para que el pelo tenga caída y movimiento en lugar de un bloque parejo.',
        evidence: 'Resultados con capas visibles en las fotos del salón.',
      },
      {
        slug: 'flequillo',
        name: 'Flequillo',
        summary: 'Cortina, recto o desmechado.',
        detail: 'Definimos la forma según tu frente, tu remolino y cuánto querés pelearte con él.',
        evidence: 'Servicio habitual de corte. Confirmar con el salón.',
      },
    ],
  },
  {
    slug: 'tratamientos',
    name: 'Tratamientos',
    intro: 'Cuando el pelo pide otra cosa antes que color.',
    services: [
      {
        slug: 'hidratacion',
        name: 'Hidratación y reconstrucción',
        summary: 'Devolverle cuerpo al pelo castigado.',
        detail:
          'Para pelo poroso, quebradizo o con historial de decoloración. A veces es el paso previo obligado antes de tocar el color.',
        evidence: 'Servicio habitual del rubro. Confirmar productos con el salón.',
      },
      {
        slug: 'alisado',
        name: 'Alisado y control del frizz',
        summary: 'Menos frizz, más brillo, forma que dura.',
        detail:
          'Tratamiento para domar el frizz y sellar la cutícula. El objetivo no es un pelo plano: es que se peine solo y brille.',
        evidence: 'Transformación de este tipo documentada en las fotos del salón.',
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
        detail: 'Lavado y secado con cepillo, terminado según cómo quieras que caiga.',
        evidence: 'Resultados de brushing visibles en las fotos del salón.',
      },
      {
        slug: 'ondas',
        name: 'Ondas y rulos',
        summary: 'Definición y volumen para un evento.',
        detail: 'Ondas amplias o rulo marcado, armados para que aguanten toda la noche.',
        evidence: 'Peinados con ondas y rulos publicados por el salón.',
      },
    ],
  },
];

/** Todos los servicios en plano, para schema.org y para buscar por slug. */
export const allServices: Service[] = serviceCategories.flatMap((c) => c.services);

/** Los que abren la home: uno por categoría, el más representativo. */
export const featuredServiceSlugs = ['coloracion', 'balayage', 'corte-mujer', 'alisado'] as const;
