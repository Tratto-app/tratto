// Lector mínimo de planillas .xlsx, sin librerías. Un .xlsx es un ZIP con
// archivos XML adentro: se lee el índice del ZIP, se descomprime la primera
// hoja y la tabla de textos, y se devuelven las filas como texto.
// Corre en el navegador (el archivo no sale del celular del dueño).

async function inflar(bytes) {
  const flujo = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(flujo).arrayBuffer());
}

async function archivosDelZip(buffer) {
  const b = new Uint8Array(buffer);
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
  let fin = -1;
  for (let i = b.length - 22; i >= Math.max(0, b.length - 66000); i--) {
    if (v.getUint32(i, true) === 0x06054b50) { fin = i; break; }
  }
  if (fin < 0) throw new Error('El archivo no es una planilla .xlsx.');
  const cantidad = v.getUint16(fin + 10, true);
  let pos = v.getUint32(fin + 16, true);
  const texto = new TextDecoder();
  const archivos = new Map();
  for (let n = 0; n < cantidad && pos + 46 <= b.length; n++) {
    if (v.getUint32(pos, true) !== 0x02014b50) break;
    const metodo = v.getUint16(pos + 10, true);
    const comprimido = v.getUint32(pos + 20, true);
    const largoNombre = v.getUint16(pos + 28, true);
    const largoExtra = v.getUint16(pos + 30, true);
    const largoComentario = v.getUint16(pos + 32, true);
    const local = v.getUint32(pos + 42, true);
    const nombre = texto.decode(b.subarray(pos + 46, pos + 46 + largoNombre));
    archivos.set(nombre, { metodo, comprimido, local });
    pos += 46 + largoNombre + largoExtra + largoComentario;
  }
  return {
    nombres: [...archivos.keys()],
    async leer(nombre) {
      const a = archivos.get(nombre);
      if (!a) return null;
      const inicio = a.local + 30 + v.getUint16(a.local + 26, true) + v.getUint16(a.local + 28, true);
      const datos = b.subarray(inicio, inicio + a.comprimido);
      if (a.metodo === 0) return texto.decode(datos);
      if (a.metodo === 8) return texto.decode(await inflar(datos));
      throw new Error('La planilla usa una compresión que no se puede leer.');
    },
  };
}

const ENTIDADES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
function desescapar(t) {
  return t.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (_, e) => {
    if (e[0] === '#') return String.fromCodePoint(e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10));
    return ENTIDADES[e.toLowerCase()];
  });
}
const textosDe = (xml) => [...xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((m) => desescapar(m[1])).join('');

function columna(ref) {
  let n = 0;
  for (const c of ref.replace(/\d/g, '')) n = n * 26 + (c.charCodeAt(0) - 64);
  return n - 1;
}

export async function leerXlsx(buffer) {
  const zip = await archivosDelZip(buffer);
  const hoja = zip.nombres.filter((n) => /^xl\/worksheets\/[^/]+\.xml$/.test(n)).sort()[0];
  if (!hoja) throw new Error('La planilla no tiene hojas.');
  const compartidos = [];
  const sst = await zip.leer('xl/sharedStrings.xml');
  if (sst) for (const m of sst.matchAll(/<si>([\s\S]*?)<\/si>|<si\/>/g)) compartidos.push(m[1] ? textosDe(m[1]) : '');
  const xml = await zip.leer(hoja);
  const filas = [];
  for (const f of xml.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)) {
    const fila = [];
    for (const c of f[1].matchAll(/<c\s([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const ref = (c[1].match(/\br="([A-Z]+\d+)"/) || [])[1];
      const tipo = (c[1].match(/\bt="([^"]+)"/) || [])[1];
      const interior = c[2] || '';
      let valor = (interior.match(/<v>([\s\S]*?)<\/v>/) || [])[1] ?? '';
      if (tipo === 's') valor = compartidos[Number(valor)] ?? '';
      else if (tipo === 'inlineStr') valor = textosDe(interior);
      else {
        valor = desescapar(valor);
        if (/^-?\d+(\.\d+)?E[+-]?\d+$/i.test(valor)) valor = String(Number(valor));
      }
      fila[ref ? columna(ref) : fila.length] = valor;
    }
    filas.push(Array.from(fila, (x) => String(x ?? '').trim()));
  }
  return filas.filter((f) => f.some((c) => c !== ''));
}
