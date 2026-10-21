// Rotación de formatos, música, gancho y largo de los videos (pedido del
// fundador del 21/10/2026: "que no sean todos iguales, para probar qué se pega
// y qué no"). Dado el historial de una red, decide cómo tiene que ser el
// próximo video y por qué. Es determinístico: con el mismo historial devuelve
// lo mismo, así dos agentes no eligen distinto.
//
// Reglas (catálogo en conocimiento/variedad.json):
// - Nunca repite lo de los últimos videos de esa red (no_repetir_ultimos).
// - Explorar: gana el menos probado en esa red; empate, el que hace más que no
//   sale; después, el sugerido para el formato elegido; después, el orden del
//   catálogo.
// - Aprovechar: cuando todas las opciones tienen muestras_minimas videos con la
//   métrica cargada, reparto_aprovechar de cada 10 videos van a la de mejor
//   mediana y el resto sigue explorando.
import { conocimiento } from './conocimiento.mjs';
import { ErrorEntrada } from './errores.mjs';

const REDES = ['tiktok', 'instagram', 'facebook', 'linkedin', 'x'];

function mediana(xs) {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b), m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function categoriaDuracion(seg, opciones) {
  for (const [id, o] of Object.entries(opciones)) if (seg >= o.segundos[0] && seg <= o.segundos[1]) return id;
  return seg < 15 ? 'corto' : 'largo';
}

function validarEntrada(e) {
  if (!e || typeof e !== 'object') throw new ErrorEntrada('La entrada tiene que ser un objeto: { red, historial }');
  if (!REDES.includes(e.red)) throw new ErrorEntrada(`"red" tiene que ser una de: ${REDES.join(', ')}`);
  if (e.historial !== undefined && !Array.isArray(e.historial)) throw new ErrorEntrada('"historial" tiene que ser una lista');
  for (const [i, h] of (e.historial || []).entries()) {
    if (!h || typeof h !== 'object') throw new ErrorEntrada(`historial[${i}] no es un objeto`);
    if (typeof h.fecha !== 'string' || Number.isNaN(Date.parse(h.fecha))) throw new ErrorEntrada(`historial[${i}].fecha falta o no es una fecha`);
  }
}

// Elige una opción de una dimensión para la red, con el historial de esa red
// ordenado del más nuevo al más viejo.
function elegirDimension(nombre, dim, hist, ajustes, sugeridas = []) {
  const ids = Object.keys(dim.opciones).filter((id) => dim.opciones[id].automatico !== false || ajustes.incluir.includes(id));
  const usados = hist.map((h) => h[nombre]).filter(Boolean);
  const recientes = new Set(usados.slice(0, dim.no_repetir_ultimos || 0));
  let candidatos = ids.filter((id) => !recientes.has(id));
  if (!candidatos.length) candidatos = ids;

  const tabla = ids.map((id) => {
    const suyos = hist.filter((h) => h[nombre] === id);
    const medidos = suyos.map((h) => h[ajustes.metrica]).filter((v) => typeof v === 'number' && Number.isFinite(v));
    const ultimo = usados.indexOf(id);
    return { id, videos: suyos.length, medidos: medidos.length, mediana: mediana(medidos), hace: ultimo === -1 ? null : ultimo };
  });
  const fila = (id) => tabla.find((f) => f.id === id);
  const orden = (a, b) => {
    const fa = fila(a), fb = fila(b);
    if (fa.videos !== fb.videos) return fa.videos - fb.videos;
    const ha = fa.hace ?? Infinity, hb = fb.hace ?? Infinity;
    if (ha !== hb) return hb - ha;
    const sa = sugeridas.includes(a) ? 0 : 1, sb = sugeridas.includes(b) ? 0 : 1;
    if (sa !== sb) return sa - sb;
    return ids.indexOf(a) - ids.indexOf(b);
  };

  const listos = tabla.every((f) => f.medidos >= ajustes.muestras_minimas);
  const turno = hist.length % 10 < Math.round(ajustes.reparto_aprovechar * 10);
  if (listos && turno) {
    const mejores = [...candidatos].sort((a, b) => (fila(b).mediana - fila(a).mediana) || orden(a, b));
    const id = mejores[0];
    return { id, fase: 'aprovechar', motivo: `rinde mejor en esta red (mediana de ${ajustes.metrica}: ${fila(id).mediana})`, tabla };
  }
  const id = [...candidatos].sort(orden)[0], f = fila(id);
  const motivo = f.videos === 0 ? 'todavía no se probó en esta red'
    : `es el menos probado que no salió en los últimos (${f.videos} video${f.videos === 1 ? '' : 's'}${f.hace !== null ? `, el último hace ${f.hace + 1}` : ''})`;
  return { id, fase: 'explorar', motivo, tabla };
}

export function elegirVariedad(entrada) {
  validarEntrada(entrada);
  const cat = conocimiento('variedad');
  const ajustes = {
    metrica: cat.metrica, muestras_minimas: cat.muestras_minimas, reparto_aprovechar: cat.reparto_aprovechar,
    incluir: [entrada.con_voz ? 'voz' : null].filter(Boolean),
  };
  const opDur = cat.dimensiones.duracion.opciones;
  const hist = (entrada.historial || [])
    .filter((h) => (h.red || entrada.red) === entrada.red)
    .map((h) => ({ ...h, duracion: h.duracion || (typeof h.duracion_seg === 'number' ? categoriaDuracion(h.duracion_seg, opDur) : undefined) }))
    .sort((a, b) => Date.parse(b.fecha) - Date.parse(a.fecha));

  const D = cat.dimensiones;
  const formato = elegirDimension('formato', D.formato, hist, ajustes);
  const sugeridas = D.formato.opciones[formato.id].musica_sugerida || [];
  const musica = elegirDimension('musica', D.musica, hist, ajustes, sugeridas);
  const gancho = elegirDimension('gancho', D.gancho, hist, ajustes);
  const duracion = elegirDimension('duracion', D.duracion, hist, ajustes);
  const nombre = (dim, id) => D[dim].opciones[id].nombre || id;
  return {
    red: entrada.red,
    videos_en_historial: hist.length,
    formato: { id: formato.id, nombre: nombre('formato', formato.id), como: D.formato.opciones[formato.id].como, fase: formato.fase, motivo: formato.motivo },
    musica: { id: musica.id, nombre: nombre('musica', musica.id), fase: musica.fase, motivo: musica.motivo },
    gancho: { id: gancho.id, fase: gancho.fase, motivo: gancho.motivo },
    duracion: { id: duracion.id, nombre: nombre('duracion', duracion.id), segundos: D.duracion.opciones[duracion.id].segundos, fase: duracion.fase, motivo: duracion.motivo },
    comando: `python3 tools/piezas-redes/reels/hacer-video.py <video>.html --musica ${musica.id}`,
    datos_video: { formato: formato.id, musica: musica.id, gancho: gancho.id, duracion: duracion.id },
    tablas: { formato: formato.tabla, musica: musica.tabla },
  };
}

export function variedadMarkdown(r) {
  const fila = (f) => `  ${f.id.padEnd(9)} ${String(f.videos).padStart(3)} videos · ${f.medidos} medidos · mediana ${f.mediana ?? '-'}`;
  return [
    `Próximo video para ${r.red} (${r.videos_en_historial} en el historial):`,
    `- Formato: ${r.formato.id} (${r.formato.nombre}) · ${r.formato.fase}: ${r.formato.motivo}`,
    `  Cómo: ${r.formato.como}`,
    `- Música: ${r.musica.id} (${r.musica.nombre}) · ${r.musica.fase}: ${r.musica.motivo}`,
    `- Gancho: ${r.gancho.id} · ${r.gancho.fase}: ${r.gancho.motivo}`,
    `- Largo: ${r.duracion.nombre} · ${r.duracion.fase}: ${r.duracion.motivo}`,
    '', `Render: ${r.comando}`,
    `Guardá en datos.video del item: ${JSON.stringify(r.datos_video)}`,
    '', 'Formatos en esta red:', ...r.tablas.formato.map(fila),
    '', 'Músicas en esta red:', ...r.tablas.musica.map(fila),
  ].join('\n');
}
