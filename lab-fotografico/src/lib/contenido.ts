// Lee src/data/contenido.yaml, revisa que esté completo y bien escrito,
// y le agrega lo que el sitio necesita (links de WhatsApp, fotos listas).
// Si algo está mal, la publicación se frena con un mensaje en español
// que dice qué línea o qué dato revisar. Así el sitio online nunca se rompe.

import type { ImageMetadata } from 'astro';
import { z } from 'astro/zod';
import { parse, YAMLParseError } from 'yaml';
import textoYaml from '../data/contenido.yaml?raw';

// Todas las fotos de src/assets/fotos, indexadas por su ruta dentro de esa carpeta.
const archivosDeFotos = import.meta.glob<ImageMetadata>(
  '../assets/fotos/**/*.{jpg,jpeg,png,webp,avif,JPG,JPEG,PNG,WEBP}',
  { eager: true, import: 'default' },
);
const fotos = new Map<string, ImageMetadata>();
for (const [ruta, imagen] of Object.entries(archivosDeFotos)) {
  fotos.set(ruta.replace('../assets/fotos/', ''), imagen);
}

const texto = z.string().trim().min(1, 'no puede quedar vacío');
const opcional = z.string().trim().default('');
const precio = z.union([z.string(), z.number()]).transform((v) => String(v).trim()).default('');

const item = z.object({
  nombre: texto,
  descripcion: texto,
  detalle: opcional,
  etiqueta: opcional,
  opciones: z.array(texto).default([]),
  nota: opcional,
  precio,
  precio_texto: opcional,
  cifra: opcional,
  ancla: opcional,
  ancla_texto: opcional,
  foto: opcional,
  foto_descripcion: texto,
  oculto: z.boolean().default(false),
});

const esquema = z.object({
  negocio: z.object({
    nombre: texto,
    logo: opcional,
    rubro: texto,
    ciudad: texto,
    descripcion: texto,
    whatsapp: z.union([z.string(), z.number()])
      .transform((v) => String(v).replace(/\D/g, ''))
      .refine((v) => v.length >= 10, 'tiene que tener el número completo, ej: 5492213999289'),
    whatsapp_visible: texto,
    email: opcional,
    instagram: opcional,
    facebook: opcional,
    tienda_online: opcional,
    catalogo_whatsapp: opcional,
    direccion: opcional,
    horarios: opcional,
    horarios_google: z.array(z.string()).default([]),
    anios: z.number().int().positive().optional(),
  }),
  mensajes_whatsapp: z.object({
    general: texto,
    servicio: texto,
    revisar_foto: texto,
    carnet: texto,
    fotolibro: texto,
    penbox: texto,
  }),
  inicio: z.object({
    etiqueta: texto,
    titulo: texto,
    titulo_destacado: opcional,
    bajada: texto,
    boton_principal: texto,
    boton_secundario: texto,
    foto: texto,
    foto_descripcion: texto,
    garantias: z.array(texto).default([]),
  }),
  mas_pedido_titulo: texto,
  mas_pedido_bajada: opcional,
  mas_pedido: z.array(item).default([]),
  servicios_titulo: texto,
  servicios_bajada: opcional,
  servicios: z.array(item).min(1, 'tiene que haber al menos un servicio'),
  carnet: z.object({
    etiqueta: texto,
    titulo: texto,
    texto: texto,
    horario: opcional,
    precios: z.array(z.object({ nombre: texto, precio })).default([]),
    incluye: z.array(texto).default([]),
    garantia: opcional,
    foto: texto,
    foto_descripcion: texto,
  }),
  fotolibros: z.object({
    etiqueta: texto,
    titulo: texto,
    texto: texto,
    medidas: z.array(texto).default([]),
    datos: z.array(z.object({ titulo: texto, texto: texto })).default([]),
    boton: texto,
    foto: texto,
    foto_descripcion: texto,
    penbox_titulo: opcional,
    penbox_subtitulo: opcional,
    penbox_texto: opcional,
    penbox_detalles: z.array(texto).default([]),
    penbox_fotos: z.array(z.object({ foto: texto, descripcion: texto })).default([]),
    penbox_boton: opcional,
  }),
  pantalla_vs_papel: z.object({
    etiqueta: texto,
    titulo: texto,
    bajada: texto,
    comparador: z.array(z.object({
      pestana: texto,
      izquierda: texto,
      derecha: texto,
      foto_izquierda: texto,
      foto_derecha: texto,
      efecto_pantalla: z.boolean().default(false),
      nota: texto,
    })).min(1),
    foto_descripcion: texto,
    bloques: z.array(z.object({
      icono: z.enum(['pixeles', 'compresion', 'pantalla', 'apps'], {
        message: 'el ícono tiene que ser pixeles, compresion, pantalla o apps',
      }),
      titulo: texto,
      texto: texto,
      dato: opcional,
    })),
    cierre_titulo: texto,
    cierre_texto: texto,
    cierre_boton: texto,
  }),
  calculadora: z.object({
    etiqueta: texto,
    titulo: texto,
    bajada: texto,
    ejemplo_ancho: z.number().int().positive(),
    ejemplo_alto: z.number().int().positive(),
    tamanos: z.array(z.string().regex(/^\d+(?:[.,]\d+)?x\d+(?:[.,]\d+)?$/, 'cada tamaño va como 10x15 (ancho x alto en cm)')).min(1),
    nota: opcional,
  }),
  galeria_titulo: texto,
  galeria_bajada: opcional,
  galeria_categorias: z.array(texto).min(1),
  galeria: z.array(z.object({
    foto: texto,
    categoria: texto,
    descripcion: texto,
    oculto: z.boolean().default(false),
  })),
  nosotros: z.object({
    etiqueta: texto,
    titulo: texto,
    texto: z.array(texto).default([]),
    mision_titulo: texto,
    mision: texto,
    frase: opcional,
    equipos_titulo: opcional,
    equipos_bajada: opcional,
    equipos: z.array(z.object({ nombre: texto, tipo: texto, texto: texto, foto: opcional, video: opcional })).default([]),
  }),
  proceso: z.object({
    etiqueta: texto,
    titulo: texto,
    pasos: z.array(z.object({ titulo: texto, texto: texto })).min(1),
  }),
  como_enviar: z.object({
    etiqueta: texto,
    titulo: texto,
    bajada: opcional,
    consejos: z.array(z.object({ titulo: texto, texto: texto })),
    metodos: z.array(z.object({ titulo: texto, pasos: z.array(texto).min(1) })),
    carpetas_titulo: opcional,
    carpetas_bajada: opcional,
    carpetas: z.array(z.object({ medida: texto, subcarpetas: z.array(texto) })).default([]),
    carpetas_importante: z.array(texto).default([]),
  }),
  preguntas_titulo: texto,
  preguntas: z.array(z.object({ pregunta: texto, respuesta: texto })),
  contacto: z.object({
    titulo: texto,
    texto: texto,
    boton: texto,
    mapa: opcional,
  }),
}).superRefine((d, ctx) => {
  d.galeria.forEach((g, i) => {
    if (!d.galeria_categorias.includes(g.categoria)) {
      ctx.addIssue({
        code: 'custom',
        path: ['galeria', i, 'categoria'],
        message: `"${g.categoria}" no está en galeria_categorias (${d.galeria_categorias.join(', ')})`,
      });
    }
  });
});

function leerYaml(): unknown {
  try {
    return parse(textoYaml);
  } catch (error) {
    if (error instanceof YAMLParseError) {
      const linea = error.linePos?.[0]?.line;
      throw new Error(
        `\n\n✖ contenido.yaml está mal escrito${linea ? ` cerca de la línea ${linea}` : ''}.\n` +
        '  Revisá la sangría (los espacios del principio) y que los textos con dos puntos estén entre comillas.\n' +
        `  Detalle técnico: ${error.message}\n`,
      );
    }
    throw error;
  }
}

function validar() {
  const resultado = esquema.safeParse(leerYaml());
  if (!resultado.success) {
    const problemas = resultado.error.issues
      .map((p) => `  • ${p.path.join(' → ') || 'archivo'}: ${p.message}`)
      .join('\n');
    throw new Error(`\n\n✖ Hay datos para revisar en contenido.yaml:\n${problemas}\n`);
  }
  return resultado.data;
}

const datos = validar();

export function foto(ruta: string, donde: string): ImageMetadata {
  const limpia = ruta.replace(/^\/+/, '').replace(/^src\/assets\/fotos\//, '');
  const imagen = fotos.get(limpia);
  if (!imagen) {
    const parecidas = [...fotos.keys()].filter((k) => k.split('/').pop() === limpia.split('/').pop());
    throw new Error(
      `\n\n✖ No encuentro la foto "${ruta}" (${donde}).\n` +
      '  Tiene que estar dentro de src/assets/fotos/ y escribirse igual, con mayúsculas y extensión.\n' +
      (parecidas.length ? `  ¿Quisiste decir ${parecidas.join(' o ')}?\n` : ''),
    );
  }
  return imagen;
}

export function linkWhatsApp(mensaje: string): string {
  return `https://wa.me/${datos.negocio.whatsapp}?text=${encodeURIComponent(mensaje)}`;
}

export function mensajeServicio(nombre: string): string {
  return datos.mensajes_whatsapp.servicio.replaceAll('{servicio}', nombre);
}

function conFoto<T extends z.infer<typeof item>>(lista: T[], seccion: string) {
  return lista
    .filter((s) => !s.oculto)
    .map((s) => ({
      ...s,
      imagen: s.foto ? foto(s.foto, `${seccion}: ${s.nombre}`) : null,
      whatsapp: linkWhatsApp(mensajeServicio(s.nombre)),
    }));
}

const lugar = [datos.negocio.direccion, datos.negocio.ciudad, 'Buenos Aires, Argentina'].filter(Boolean).join(', ');
const consultaMapa = datos.contacto.mapa || lugar;
const mapaLink = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(consultaMapa)}`;

export const negocio = {
  ...datos.negocio,
  logoImagen: datos.negocio.logo ? foto(datos.negocio.logo, 'logo del negocio') : null,
  whatsappGeneral: linkWhatsApp(datos.mensajes_whatsapp.general),
  whatsappRevisar: linkWhatsApp(datos.mensajes_whatsapp.revisar_foto),
  whatsappCarnet: linkWhatsApp(datos.mensajes_whatsapp.carnet),
  mapaLink,
  // Si no hay tienda online todavía, el botón lleva al catálogo de WhatsApp.
  tienda: datos.negocio.tienda_online || datos.negocio.catalogo_whatsapp || linkWhatsApp(datos.mensajes_whatsapp.general),
};

export const inicio = { ...datos.inicio, imagen: foto(datos.inicio.foto, 'portada') };

export const masPedido = {
  titulo: datos.mas_pedido_titulo,
  bajada: datos.mas_pedido_bajada,
  lista: conFoto(datos.mas_pedido, 'lo más pedido'),
};

export const servicios = {
  titulo: datos.servicios_titulo,
  bajada: datos.servicios_bajada,
  lista: conFoto(datos.servicios, 'servicios'),
};

export const carnet = { ...datos.carnet, imagen: foto(datos.carnet.foto, 'fotos carnet') };

export const fotolibros = {
  ...datos.fotolibros,
  imagen: foto(datos.fotolibros.foto, 'fotolibros'),
  whatsapp: linkWhatsApp(datos.mensajes_whatsapp.fotolibro),
  whatsappPenbox: linkWhatsApp(datos.mensajes_whatsapp.penbox),
  penboxFotos: datos.fotolibros.penbox_fotos.map((f, i) => ({ ...f, imagen: foto(f.foto, `penbox, foto ${i + 1}`) })),
};

const pvp = datos.pantalla_vs_papel;
export const pantallaVsPapel = {
  ...pvp,
  comparador: pvp.comparador.map((c, i) => ({
    ...c,
    imagenIzquierda: foto(c.foto_izquierda, `comparador ${i + 1}, izquierda`),
    imagenDerecha: foto(c.foto_derecha, `comparador ${i + 1}, derecha`),
  })),
};

export const calculadora = {
  ...datos.calculadora,
  tamanos: datos.calculadora.tamanos.map((t) => {
    const [a, b] = t.split('x').map((n) => Number(n.replace(',', '.')));
    return { nombre: t.replace('x', '×'), corto: Math.min(a, b), largo: Math.max(a, b) };
  }),
};

export const galeria = {
  titulo: datos.galeria_titulo,
  bajada: datos.galeria_bajada,
  categorias: datos.galeria_categorias,
  lista: datos.galeria
    .filter((g) => !g.oculto)
    .map((g, i) => ({ ...g, imagen: foto(g.foto, `galería, foto ${i + 1}`) })),
};

export const nosotros = {
  ...datos.nosotros,
  equipos: datos.nosotros.equipos.map((e) => ({ ...e, imagen: e.foto ? foto(e.foto, `equipo ${e.nombre}`) : null })),
};

export const proceso = datos.proceso;
export const comoEnviar = datos.como_enviar;
export const preguntas = { titulo: datos.preguntas_titulo, lista: datos.preguntas };

export const contacto = {
  ...datos.contacto,
  mapaEmbed: `https://www.google.com/maps?q=${encodeURIComponent(consultaMapa)}&output=embed`,
  mapaLink,
  hayDireccion: Boolean(datos.negocio.direccion),
};
