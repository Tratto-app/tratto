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

const item = z.object({
  nombre: texto,
  descripcion: texto,
  detalle: opcional,
  precio: z.union([z.string(), z.number()]).transform((v) => String(v).trim()).default(''),
  foto: texto,
  foto_descripcion: texto,
  oculto: z.boolean().default(false),
});

const esquema = z.object({
  negocio: z.object({
    nombre: texto,
    ciudad: texto,
    descripcion: texto,
    whatsapp: z.union([z.string(), z.number()])
      .transform((v) => String(v).replace(/\D/g, ''))
      .refine((v) => v.length >= 10, 'tiene que tener el número completo, ej: 5492213999289'),
    whatsapp_visible: texto,
    instagram: opcional,
    facebook: opcional,
    tienda_online: opcional,
    catalogo_whatsapp: opcional,
    direccion: opcional,
    horarios: opcional,
  }),
  mensajes_whatsapp: z.object({
    general: texto,
    servicio: texto,
    revisar_foto: texto,
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
  promos_titulo: texto,
  promos_bajada: opcional,
  promos: z.array(item).default([]),
  servicios_titulo: texto,
  servicios_bajada: opcional,
  servicios: z.array(item).min(1, 'tiene que haber al menos un servicio'),
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
  contacto: z.object({
    titulo: texto,
    texto: texto,
    boton: texto,
  }),
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
      imagen: foto(s.foto, `${seccion}: ${s.nombre}`),
      whatsapp: linkWhatsApp(mensajeServicio(s.nombre)),
    }));
}

export const negocio = {
  ...datos.negocio,
  whatsappGeneral: linkWhatsApp(datos.mensajes_whatsapp.general),
  whatsappRevisar: linkWhatsApp(datos.mensajes_whatsapp.revisar_foto),
  // Si no hay tienda online todavía, el botón lleva al catálogo de WhatsApp.
  tienda: datos.negocio.tienda_online || datos.negocio.catalogo_whatsapp || linkWhatsApp(datos.mensajes_whatsapp.general),
};

export const inicio = { ...datos.inicio, imagen: foto(datos.inicio.foto, 'portada') };

export const promos = {
  titulo: datos.promos_titulo,
  bajada: datos.promos_bajada,
  lista: conFoto(datos.promos, 'promos'),
};

export const servicios = {
  titulo: datos.servicios_titulo,
  bajada: datos.servicios_bajada,
  lista: conFoto(datos.servicios, 'servicios'),
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

export const contacto = datos.contacto;
