/**
 * Genera /public/precios.pdf.
 *
 * Los datos salen de la MISMA fuente que la web: la planilla de Google del
 * salón si está configurada (PRICES_SHEET_URL), o la copia local de
 * src/data/prices.ts si no. Así el PDF y la página nunca se contradicen.
 *
 * Un servicio sin importe confirmado se imprime como "Consultar". No se
 * estiman precios ni se completan por analogía.
 *
 * Se escribe el PDF a mano —sin dependencias— usando las fuentes base
 * Times, que todos los lectores traen incorporadas.
 *
 * Uso: npm run precios
 */
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

/** Fecha de vigencia que se imprime al pie. Null = "Consultar vigencia". */
const VALID_FROM = process.env.PRICES_VALID_FROM?.trim() || null;

const INK = '0.141 0.110 0.090';
const COPPER = '0.659 0.278 0.122';
const GREY = '0.420 0.357 0.314';

const PAGE = { width: 595.28, height: 841.89 };
const MARGIN = 56;

/** Escapa los caracteres que el formato PDF reserva. */
function esc(text) {
  return text.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

/** Convierte a Latin-1, que es lo que espera WinAnsiEncoding. */
function toLatin1(buffer) {
  return Buffer.from(buffer, 'latin1');
}

/** Una página con su lista de operadores de dibujo. */
class Page {
  constructor() {
    this.ops = [];
    this.y = PAGE.height - MARGIN;
  }

  get content() {
    return this.ops.join('\n');
  }
}

/**
 * Documento paginado.
 *
 * Antes de escribir cada bloque se consulta si entra en lo que queda de
 * página; si no, se abre una nueva. Así el PDF sigue siendo correcto cuando
 * el salón agregue servicios a la lista.
 */
class Doc {
  constructor() {
    this.pages = [new Page()];
  }

  get page() {
    return this.pages[this.pages.length - 1];
  }

  /** Abre una página nueva si no quedan `needed` puntos hasta el margen. */
  ensure(needed) {
    if (this.page.y - needed < MARGIN + 40) {
      this.pages.push(new Page());
    }
    return this;
  }

  text(content, { font = 'F1', size = 11, color = INK, x = MARGIN, dy = 0 } = {}) {
    const page = this.page;
    page.y -= dy;
    page.ops.push(
      `BT /${font} ${size} Tf ${color} rg 1 0 0 1 ${x.toFixed(2)} ${page.y.toFixed(2)} Tm (${esc(content)}) Tj ET`,
    );
    return this;
  }

  /** Texto alineado al margen derecho, en la misma línea de base actual. */
  textRight(content, { font = 'F1', size = 11, color = INK } = {}) {
    const page = this.page;
    const width = content.length * size * 0.5;
    const x = PAGE.width - MARGIN - width;
    page.ops.push(
      `BT /${font} ${size} Tf ${color} rg 1 0 0 1 ${x.toFixed(2)} ${page.y.toFixed(2)} Tm (${esc(content)}) Tj ET`,
    );
    return this;
  }

  rule({ color = '0.890 0.843 0.788', dy = 0, width = PAGE.width - MARGIN * 2 } = {}) {
    const page = this.page;
    page.y -= dy;
    page.ops.push(
      `${color} RG 0.6 w ${MARGIN} ${page.y.toFixed(2)} m ${(MARGIN + width).toFixed(2)} ${page.y.toFixed(2)} l S`,
    );
    return this;
  }

  space(amount) {
    this.page.y -= amount;
    return this;
  }
}

function buildDocument(priceList, business) {
  const page = new Doc();

  // Cabecera
  page.text("Pelo's Design", { font: 'F2', size: 26, dy: 8 });
  page.text('Lista de precios', { font: 'F3', size: 20, color: COPPER, dy: 30 });
  page.space(20);
  page.rule();
  page.space(18);
  page.text(
    `${business.address.street}, ${business.address.locality}, ${business.address.city}`,
    { size: 9.5, color: GREY },
  );
  page.text(business.links.instagramHandle, { size: 9.5, color: GREY, dy: 14 });

  const anyPrice = priceList.groups.some((g) => g.items.some((i) => i.price));

  if (!anyPrice) {
    page.space(26);
    page.text('LISTA EN PREPARACIÓN', { font: 'F2', size: 9, color: COPPER });
    page.text('Los importes los carga el salón desde su planilla. Consultanos', {
      size: 9.5,
      color: GREY,
      dy: 15,
    });
    page.text('por el valor de cualquier servicio.', { size: 9.5, color: GREY, dy: 13 });
  }

  for (const group of priceList.groups) {
    // La cabecera de categoría no debe quedar huérfana al pie de una página.
    page.ensure(110);
    page.space(28);
    page.text(group.title.toUpperCase(), { font: 'F2', size: 10, color: COPPER });
    page.space(12);
    page.rule();
    page.space(20);

    for (const item of group.items) {
      page.ensure(item.note ? 46 : 30);
      page.text(item.name, { size: 11.5 });
      page.textRight(item.price ?? 'Consultar', {
        size: 11.5,
        color: item.price ? INK : '0.612 0.545 0.486',
      });
      page.space(item.note ? 14 : 22);
      if (item.note) {
        page.text(item.note, { font: 'F3', size: 9, color: GREY });
        page.space(18);
      }
    }
  }

  // Pie
  page.ensure(90);
  page.space(14);
  page.rule();
  page.space(18);
  page.text(
    VALID_FROM ? `Precios vigentes desde ${VALID_FROM}.` : 'Consultá la vigencia al reservar.',
    { size: 9, color: GREY },
  );
  page.text(
    'En color, el largo y la densidad del pelo pueden modificar el valor final.',
    { size: 9, color: GREY, dy: 13 },
  );
  page.text('Te lo decimos siempre antes de empezar.', { size: 9, color: GREY, dy: 12 });

  return page.pages;
}

/** Ensambla los objetos del PDF y calcula la tabla de referencias cruzadas. */
function serialise(pages) {
  const FIRST_PAGE_OBJ = 3;
  const pageObjIds = pages.map((_, index) => FIRST_PAGE_OBJ + index * 2);
  const fontBase = FIRST_PAGE_OBJ + pages.length * 2;

  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    `<< /Type /Pages /Kids [${pageObjIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pages.length} >>`,
  ];

  for (const [index, page] of pages.entries()) {
    const contentId = pageObjIds[index] + 1;
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE.width} ${PAGE.height}] ` +
        `/Resources << /Font << /F1 ${fontBase} 0 R /F2 ${fontBase + 1} 0 R /F3 ${fontBase + 2} 0 R >> >> ` +
        `/Contents ${contentId} 0 R >>`,
    );
    objects.push(
      `<< /Length ${Buffer.byteLength(page.content, 'latin1')} >>\nstream\n${page.content}\nendstream`,
    );
  }

  objects.push(
    '<< /Type /Font /Subtype /Type1 /BaseFont /Times-Roman /Encoding /WinAnsiEncoding >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Times-Bold /Encoding /WinAnsiEncoding >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Times-Italic /Encoding /WinAnsiEncoding >>',
    `<< /Title (Pelo's Design - Lista de precios) /Author (Pelo's Design) ` +
      '/Subject (Lista de precios de servicios de peluqueria) /Creator (pelos-design) >>',
  );

  let pdf = '%PDF-1.4\n';
  const offsets = [];

  objects.forEach((body, index) => {
    offsets.push(Buffer.byteLength(pdf, 'latin1'));
    pdf += `${index + 1} 0 obj\n${body}\nendobj\n`;
  });

  const xrefOffset = Buffer.byteLength(pdf, 'latin1');
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) {
    pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
  }
  pdf +=
    `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R /Info ${objects.length} 0 R >>\n` +
    `startxref\n${xrefOffset}\n%%EOF\n`;

  return toLatin1(pdf);
}

/** Trae la lista desde la planilla si está configurada; si no, la copia local. */
async function loadPriceList(localPriceList) {
  const configured = process.env.PRICES_SHEET_URL?.trim();
  if (!configured) return localPriceList;

  const sheetUrl = pathToFileURL(path.join(process.cwd(), 'src/lib/prices/sheet.ts')).href;
  try {
    // El módulo del sitio importa 'server-only', que fuera de Next no resuelve.
    // Se reutilizan sólo las funciones puras de parseo.
    const source = await import(sheetUrl).catch(() => null);
    if (!source) return localPriceList;

    const csvUrl = source.toCsvUrl(configured);
    if (!csvUrl) return localPriceList;

    const response = await fetch(csvUrl, { signal: AbortSignal.timeout(10000) });
    if (!response.ok) {
      console.warn(`· la planilla respondió ${response.status}; se usa la copia local`);
      return localPriceList;
    }

    const groups = source.rowsToGroups(source.parseCsv(await response.text()));
    if (groups.length === 0) return localPriceList;
    return { groups, validFrom: VALID_FROM, source: 'sheet' };
  } catch (error) {
    console.warn('· no se pudo leer la planilla; se usa la copia local:', error.message);
    return localPriceList;
  }
}

async function run() {
  // Los datos se leen de la misma fuente que usa el sitio, transpilando el TS
  // a la carrera con el type-stripping nativo de Node.
  const pricesUrl = pathToFileURL(path.join(process.cwd(), 'src/data/prices.ts')).href;
  const businessUrl = pathToFileURL(path.join(process.cwd(), 'src/data/business.ts')).href;
  const { localPriceList } = await import(pricesUrl);
  const { business } = await import(businessUrl);

  const priceList = await loadPriceList(localPriceList);
  console.log(`· fuente: ${priceList.source === 'sheet' ? 'planilla de Google' : 'copia local'}`);

  const pdf = serialise(buildDocument(priceList, business));
  const target = path.join(process.cwd(), 'public', 'precios.pdf');
  await writeFile(target, pdf);
  console.log(`✓ precios.pdf  ${(pdf.length / 1024).toFixed(1)} kB`);
}

run().catch((error) => {
  console.error('No se pudo generar la lista de precios:', error);
  process.exit(1);
});
