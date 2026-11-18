// Lee src/data/contenido.yaml, revisa que esté completo y bien escrito,
// y le agrega lo que la web necesita (links de WhatsApp, fotos listas, precios).
// Si algo está mal, la publicación se frena con un mensaje en español
// que dice qué línea o qué dato revisar. Así la web online nunca se rompe.

import type { ImageMetadata } from 'astro';
import { z } from 'astro/zod';
import { parse, YAMLParseError } from 'yaml';
import textoYaml from '../data/contenido.yaml?raw';
import { leerHorarios } from './horario';

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
// "si" / "no" (o true / false) → verdadero o falso
const siNo = z
  .union([z.boolean(), z.string()])
  .transform((v, ctx) => {
    if (typeof v === 'boolean') return v;
    const t = v.trim().toLowerCase();
    if (['si', 'sí', 'true'].includes(t)) return true;
    if (['no', 'false', ''].includes(t)) return false;
    ctx.addIssue({ code: 'custom', message: `tiene que decir si o no (dice "${v}")` });
    return z.NEVER;
  });
const numeroOTexto = z
  .union([z.string(), z.number(), z.null()])
  .transform((v) => (v === null ? '' : String(v).trim()))
  .default('');

const producto = z.object({
  nombre: texto,
  descripcion: opcional,
  medida: opcional,
  precio: numeroOTexto,
  pdf: numeroOTexto,
  foto: opcional,
  foto_descripcion: opcional,
  etiquetas: z.array(texto).default([]),
  oculto: siNo.default(false),
});

const esquema = z.object({
  negocio: z.object({
    nombre: texto,
    bajada: texto,
    lema: texto,
    direccion: texto,
    barrio: texto,
    partido: opcional,
    provincia: texto,
    whatsapp: z.union([z.string(), z.number()])
      .transform((v) => String(v).replace(/\D/g, ''))
      .refine((v) => v.length >= 10, 'tiene que tener el número completo, ej: 5491138209852'),
    whatsapp_visible: texto,
    mensaje_whatsapp: texto,
    instagram: z.string().trim().transform((v) => v.replace(/^@/, '')).default(''),
    menu_pdf: opcional,
    resena_google: opcional,
  }),
  horarios: z.object({
    lunes: texto, martes: texto, miercoles: texto, jueves: texto,
    viernes: texto, sabado: texto, domingo: texto,
    cerrado_los_dias: z
      .array(z.union([z.string(), z.date()]).transform((v) => (v instanceof Date ? v.toISOString().slice(0, 10) : v.trim())))
      .default([])
      .refine((l) => l.every((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)), 'cada día va como año-mes-día, ej: "2026-12-25"'),
  }),
  inicio: z.object({
    titulo: texto,
    titulo_destacado: opcional,
    subtitulo: texto,
    bajada: texto,
    boton_principal: texto,
    boton_secundario: texto,
    sticker: opcional,
    foto: texto,
    foto_descripcion: texto,
    foto_chica: opcional,
    foto_chica_descripcion: opcional,
  }),
  obsesion: z.object({
    mostrar: siNo.default(true),
    etiqueta: texto,
    frase: opcional,
    titulo: texto,
    texto: opcional,
    nombre: texto,
    descripcion: texto,
    precio: numeroOTexto,
    precio_menu_pdf: numeroOTexto,
    foto: texto,
    foto_descripcion: texto,
    boton: texto,
    categoria_en_la_carta: opcional,
  }),
  carta: z.object({
    frase: opcional,
    titulo: texto,
    bajada: opcional,
    mostrar_precios_del_pdf: siNo.default(false),
    temperatura: opcional,
    boton_pdf: texto,
    categorias: z.array(z.object({
      nombre: texto,
      bajada: opcional,
      grupos: z.array(z.object({
        titulo: texto,
        descripcion: opcional,
        productos: z.array(producto).min(1, 'cada grupo tiene que tener al menos un producto'),
      })).min(1, 'cada categoría tiene que tener al menos un grupo'),
    })).min(1, 'tiene que haber al menos una categoría'),
  }),
}).superRefine((d, ctx) => {
  const nombres = d.carta.categorias.map((c) => c.nombre);
  if (d.obsesion.categoria_en_la_carta && !nombres.includes(d.obsesion.categoria_en_la_carta)) {
    ctx.addIssue({
      code: 'custom',
      path: ['obsesion', 'categoria_en_la_carta'],
      message: `"${d.obsesion.categoria_en_la_carta}" no es una categoría de la carta (${nombres.join(', ')})`,
    });
  }
});

function leerYaml(): unknown {
  try {
    return parse(textoYaml);
  } catch (error) {
    if (error instanceof YAMLParseError) {
      const linea = error.linePos?.[0]?.line;
      throw new Error(
        `\n\n✖ contenido.yaml está mal escrito${linea ? ` cerca de la línea ${linea}` : ''}.\n` +
        '  Revisá la sangría (los espacios del principio) y que los textos con dos puntos o con ¿ estén entre comillas.\n' +
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

// "9500" → "$ 9.500"; un texto se muestra tal cual; vacío → null (a completar)
export function formatoPrecio(valor: string): string | null {
  const v = valor.trim();
  if (!v) return null;
  const solo = v.replace(/[$\s.]/g, '').replace(',', '.');
  if (/^\d+(\.\d+)?$/.test(solo)) {
    return '$ ' + Number(solo).toLocaleString('es-AR', { maximumFractionDigits: 2 });
  }
  return v;
}

function precioVisible(precio: string, pdf: string): string | null {
  return formatoPrecio(precio) ?? (datos.carta.mostrar_precios_del_pdf ? formatoPrecio(pdf) : null);
}

// Para los links internos de la carta: "Bebidas frías" → "bebidas-frias"
export function aId(t: string): string {
  return t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export function linkWhatsApp(mensaje: string): string {
  return `https://wa.me/${datos.negocio.whatsapp}?text=${encodeURIComponent(mensaje)}`;
}

const n = datos.negocio;
const direccionCompleta = `${n.direccion}, ${n.barrio}, ${n.provincia}`;
export const negocio = {
  ...n,
  direccionCompleta,
  whatsappLink: linkWhatsApp(n.mensaje_whatsapp),
  instagramLink: n.instagram ? `https://www.instagram.com/${n.instagram}/` : '',
  comoLlegar: `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${n.nombre}, ${direccionCompleta}`)}`,
  mapa: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${n.nombre}, ${direccionCompleta}`)}`,
};

export const horarios = leerHorarios(datos.horarios);

export const inicio = {
  ...datos.inicio,
  imagen: foto(datos.inicio.foto, 'portada'),
  imagenChica: datos.inicio.foto_chica ? foto(datos.inicio.foto_chica, 'portada, foto chica') : null,
};

const o = datos.obsesion;
export const obsesion = {
  ...o,
  imagen: foto(o.foto, 'obsesión del mes'),
  precioTexto: precioVisible(o.precio, o.precio_menu_pdf),
  ancla: o.categoria_en_la_carta ? `carta-${aId(o.categoria_en_la_carta)}` : 'carta',
};

export const carta = {
  ...datos.carta,
  categorias: datos.carta.categorias.map((c) => ({
    ...c,
    id: `carta-${aId(c.nombre)}`,
    grupos: c.grupos
      .map((g) => ({
        ...g,
        productos: g.productos
          .filter((p) => !p.oculto)
          .map((p) => ({
            ...p,
            imagen: p.foto ? foto(p.foto, `carta: ${p.nombre}`) : null,
            precioTexto: precioVisible(p.precio, p.pdf),
          })),
      }))
      .filter((g) => g.productos.length > 0),
  })),
};
