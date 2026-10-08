// Verificación de una pieza contra los límites de la plataforma
// (conocimiento/formatos.json) y las reglas de la marca (config/marca.json).
// Límite superado = error (la plataforma no lo permite). Guía superada =
// advertencia (se puede, pero suele rendir peor).
import { conocimiento } from './conocimiento.mjs';
import { ErrorEntrada } from './errores.mjs';
import { revisarIA } from './humanizador.mjs';
import { revisarCaminoAlLink } from './links.mjs';
import { contarPalabras, limpiar, normalizar, oraciones, tieneCTA } from './texto.mjs';

const MAX_TEXTO = 20000;

function revisarMarca(textos, marca, adv) {
  const todo = ' ' + normalizar(textos.join(' \n ')) + ' ';
  for (const p of marca?.palabras_no || []) {
    const n = normalizar(p);
    if (n && todo.includes(` ${n} `)) adv.push(`Usa "${p}", que la marca evita.`);
  }
  for (const a of marca?.alertas || []) {
    const hallada = (a.palabras || []).find((p) => todo.includes(` ${normalizar(p)} `));
    if (hallada) adv.push(`"${hallada}": ${a.motivo}`);
  }
  const sesgo = marca?.sesgo_oficios;
  if (sesgo) {
    const hallados = [...new Set((sesgo.palabras || []).filter((p) => todo.includes(` ${normalizar(p)} `)).map((p) => normalizar(p).replace(/(es|s)$/, '')))];
    const salvo = (sesgo.salvo || []).some((p) => todo.includes(` ${normalizar(p)} `));
    if (hallados.length >= (sesgo.minimo || 2) && !salvo) adv.push(`Oficios del hogar (${hallados.join(', ')}): ${sesgo.motivo}`);
  }
  if (/\$\s?\d/.test(textos.join(' '))) adv.push('Menciona precios: verificá que salgan de la tabla de referencia del tasador o de un relevamiento con fecha.');
}

// Humanizador automático: todo texto que va a salir publicado se mide acá,
// sin que nadie lo pida. Lo que hay que corregir sí o sí (remates armados,
// "no es solo X, es Y", tuteo, frases de sinceridad, cierres de relleno o un
// párrafo con 3 marcas) y un texto que "suena a IA" son errores: la pieza no
// pasa hasta corregirlo. "Mixto" es advertencia. El formato (emojis,
// hashtags, rayas) se mira solo en textos largos, no en placas sueltas.
function revisarHumano(textos, errores, adv, medidas) {
  let peor = 0;
  const may = (t) => t.charAt(0).toUpperCase() + t.slice(1);
  for (const { nombre, valor, formato } of textos) {
    if (!valor) continue;
    const r = revisarIA(valor);
    peor = Math.max(peor, r.porcentaje);
    if (r.corregir.length) errores.push(`Suena a IA en ${nombre}: ${r.corregir.join(' · ')}. Corregilo con el humanizador.`);
    else if (r.veredicto === 'suena a IA') errores.push(`${may(nombre)} suena a IA (${r.porcentaje}%): pasalo por el humanizador.`);
    else if (r.veredicto === 'mixto') adv.push(`${may(nombre)} suena a IA un ${r.porcentaje}%: pasalo por el humanizador.`);
    if (formato) for (const f of r.formato) adv.push(`${may(nombre)}: ${f}`);
  }
  medidas.suena_a_ia = peor;
}

// En un guion, los tiempos entre corchetes y la raya que separa el tramo de
// lo que se dice son estructura, no texto: no cuentan para el humanizador.
const soloLoDicho = (guion) => guion.replace(/\[[^\]\n]*\]/g, ' ').replace(/^\s*[^\n—]{0,30}—\s*/gm, '');

// Hashtags automáticos: un caption de TikTok o Instagram lleva de 3 a 5.
function revisarHashtags(caption, adv) {
  if (!caption) return;
  const n = (caption.match(/#[\p{L}\p{N}_]+/gu) || []).length;
  if (n < 3) adv.push(`El texto tiene ${n} hashtag(s): sumá de 3 a 5 elegidos por tamaño (contenido-hashtags).`);
}

// Camino de un toque al link (si se indica la red): sin él la pieza no pasa.
function revisarLink(caption, entrada, marca, errores) {
  if (entrada.red === undefined) return;
  if (!['instagram', 'tiktok'].includes(entrada.red)) throw new ErrorEntrada('"red" tiene que ser instagram o tiktok');
  for (const p of revisarCaminoAlLink(caption, entrada.red, marca?.links)) errores.push(p);
}

function texto(v, campo, req = true) {
  if (v === undefined || v === null) {
    if (req) throw new ErrorEntrada(`Falta "${campo}"`);
    return undefined;
  }
  if (typeof v !== 'string') throw new ErrorEntrada(`"${campo}" tiene que ser texto`);
  if (v.length > MAX_TEXTO) throw new ErrorEntrada(`"${campo}" es demasiado largo (${v.length} caracteres)`);
  return limpiar(v, MAX_TEXTO);
}

function listaTextos(v, campo) {
  if (!Array.isArray(v)) throw new ErrorEntrada(`"${campo}" tiene que ser una lista de textos`);
  if (v.length > 100) throw new ErrorEntrada(`"${campo}" tiene demasiados elementos`);
  return v.map((x, i) => texto(x, `${campo}[${i}]`));
}

export function verificarPieza(entrada, marca) {
  if (!entrada || typeof entrada !== 'object' || Array.isArray(entrada)) throw new ErrorEntrada('La entrada tiene que ser un objeto JSON');
  const F = conocimiento('formatos');
  const formato = entrada.formato;
  const def = F.formatos[formato];
  if (!def) throw new ErrorEntrada(`Formato desconocido: "${formato}". Opciones: ${Object.keys(F.formatos).join(', ')}`);
  const { limites: L, guias: G } = def;
  const errores = [], advertencias = [], medidas = {};
  const textos = [];

  if (formato === 'reel') {
    const guion = texto(entrada.guion, 'guion');
    const hook = texto(entrada.hook, 'hook', false) ?? oraciones(guion)[0] ?? '';
    textos.push(guion, hook);
    const dur = entrada.duracion_seg;
    if (dur !== undefined && (typeof dur !== 'number' || !(dur > 0))) throw new ErrorEntrada('"duracion_seg" tiene que ser un número mayor que 0');
    medidas.palabras = contarPalabras(guion);
    medidas.duracion_seg = dur ?? Math.round(medidas.palabras / F.palabras_por_segundo);
    medidas.duracion_estimada = dur === undefined;
    medidas.hook_palabras = contarPalabras(hook);
    if (medidas.duracion_seg > L.duracion_max_seg) errores.push(`Dura ${medidas.duracion_seg} s; el máximo es ${L.duracion_max_seg} s.`);
    const [dmin, dmax] = G.duracion_recomendada_seg;
    if (medidas.duracion_seg < dmin || medidas.duracion_seg > dmax) advertencias.push(`Duración ${medidas.duracion_estimada ? 'estimada ' : ''}${medidas.duracion_seg} s; lo recomendado es ${dmin}–${dmax} s.`);
    if (medidas.hook_palabras > G.hook_max_palabras) advertencias.push(`Hook de ${medidas.hook_palabras} palabras (guía: ${G.hook_max_palabras}).`);
    const largas = oraciones(guion).filter((o) => contarPalabras(o) > G.oracion_max_palabras);
    if (largas.length) advertencias.push(`${largas.length} oración(es) de más de ${G.oracion_max_palabras} palabras: "${largas[0].slice(0, 80)}…"`);
    if (!tieneCTA(guion)) advertencias.push('No se detecta un pedido de acción (guardá, compartilo, comentá, pedí…).');
    const caption = texto(entrada.texto, 'texto', false);
    if (caption) textos.push(caption);
    revisarHashtags(caption, advertencias);
    revisarLink(caption, entrada, marca, errores);
    revisarHumano([{ nombre: 'el guion', valor: soloLoDicho(guion) }, { nombre: 'el texto', valor: caption, formato: true }], errores, advertencias, medidas);
  }

  if (formato === 'carrusel') {
    const slides = listaTextos(entrada.slides, 'slides');
    const caption = texto(entrada.texto, 'texto', false);
    textos.push(...slides, caption || '');
    medidas.slides = slides.length;
    medidas.palabras_por_slide = slides.map(contarPalabras);
    if (slides.length < L.slides_min || slides.length > L.slides_max) errores.push(`Tiene ${slides.length} slides; Instagram permite de ${L.slides_min} a ${L.slides_max}.`);
    const [smin, smax] = G.slides_recomendados;
    if (slides.length < smin || slides.length > smax) advertencias.push(`${slides.length} slides; lo recomendado es ${smin}–${smax}.`);
    if (slides.length && medidas.palabras_por_slide[0] > G.primer_slide_max_palabras) advertencias.push(`El primer slide tiene ${medidas.palabras_por_slide[0]} palabras (guía: ${G.primer_slide_max_palabras}). Es el hook: tiene que leerse de un vistazo.`);
    medidas.palabras_por_slide.forEach((n, i) => { if (i > 0 && n > G.slide_max_palabras) advertencias.push(`Slide ${i + 1}: ${n} palabras (guía: ${G.slide_max_palabras}).`); });
    if (slides.length && !tieneCTA(slides[slides.length - 1]) && !tieneCTA(caption || '')) advertencias.push('Ni el último slide ni el texto piden una acción.');
    const lim = F.formatos.publicacion.limites.texto_max_caracteres;
    if (caption && caption.length > lim) errores.push(`El texto tiene ${caption.length} caracteres; el máximo es ${lim}.`);
    revisarHashtags(caption, advertencias);
    revisarLink(caption, entrada, marca, errores);
    revisarHumano([...slides.map((v, i) => ({ nombre: `el slide ${i + 1}`, valor: v })), { nombre: 'el texto', valor: caption, formato: true }], errores, advertencias, medidas);
  }

  if (formato === 'historia') {
    const pantallas = listaTextos(entrada.pantallas, 'pantallas');
    textos.push(...pantallas);
    medidas.pantallas = pantallas.length;
    medidas.palabras_por_pantalla = pantallas.map(contarPalabras);
    if (!pantallas.length) errores.push('La secuencia no tiene pantallas.');
    const [hmin, hmax] = G.secuencia_recomendada;
    if (pantallas.length && (pantallas.length < hmin || pantallas.length > hmax)) advertencias.push(`${pantallas.length} pantallas; una secuencia rinde mejor con ${hmin}–${hmax}.`);
    medidas.palabras_por_pantalla.forEach((n, i) => { if (n > G.texto_max_palabras) advertencias.push(`Pantalla ${i + 1}: ${n} palabras (guía: ${G.texto_max_palabras}); en historias se lee en 2–3 segundos.`); });
    if (pantallas.length && !pantallas.some(tieneCTA) && !entrada.sticker) advertencias.push('Ninguna pantalla pide una respuesta o acción (encuesta, pregunta, link, DM).');
    revisarHumano(pantallas.map((v, i) => ({ nombre: `la pantalla ${i + 1}`, valor: v })), errores, advertencias, medidas);
    if (pantallas.length && !entrada.link) advertencias.push('Sin "link": una historia de Instagram es donde el link sí se toca. Sumá el sticker de link (link con nombre ig-historia-…).');
  }

  if (formato === 'publicacion') {
    const t = texto(entrada.texto, 'texto');
    textos.push(t);
    medidas.caracteres = t.length;
    medidas.primera_linea_palabras = contarPalabras(t.split('\n')[0]);
    if (t.length > L.texto_max_caracteres) errores.push(`Tiene ${t.length} caracteres; el máximo es ${L.texto_max_caracteres}.`);
    if (medidas.primera_linea_palabras > G.primera_linea_max_palabras) advertencias.push(`La primera línea tiene ${medidas.primera_linea_palabras} palabras (guía: ${G.primera_linea_max_palabras}); es lo único que se ve antes del "más".`);
    revisarHashtags(t, advertencias);
    revisarLink(t, entrada, marca, errores);
    revisarHumano([{ nombre: 'el texto', valor: t, formato: true }], errores, advertencias, medidas);
  }

  if (formato === 'perfil') {
    const nombre = texto(entrada.nombre, 'nombre', false);
    const usuario = texto(entrada.usuario, 'usuario', false);
    const bio = texto(entrada.bio, 'bio', false);
    const destacadas = entrada.destacadas === undefined ? undefined : listaTextos(entrada.destacadas, 'destacadas');
    if (!nombre && !usuario && !bio && !destacadas) throw new ErrorEntrada('Pasá al menos uno de: nombre, usuario, bio, destacadas');
    textos.push(nombre || '', bio || '', ...(destacadas || []));
    if (bio !== undefined) {
      medidas.bio_caracteres = [...bio].length;
      if (medidas.bio_caracteres > L.bio_max_caracteres) errores.push(`La bio tiene ${medidas.bio_caracteres} caracteres; el máximo es ${L.bio_max_caracteres}.`);
      if (!tieneCTA(bio)) advertencias.push('La bio no dice qué hacer (por ejemplo "Pedí gratis 👇").');
    }
    if (usuario !== undefined) {
      if (usuario.replace(/^@/, '').length > L.usuario_max_caracteres) errores.push(`El usuario supera ${L.usuario_max_caracteres} caracteres.`);
      if (!/^@?[a-z0-9._]+$/i.test(usuario)) errores.push('El usuario solo admite letras, números, punto y guion bajo.');
    }
    if (nombre !== undefined && [...nombre].length > G.nombre_max_caracteres) advertencias.push(`El nombre tiene ${[...nombre].length} caracteres (guía: ${G.nombre_max_caracteres}).`);
    if (destacadas) {
      const [dmin, dmax] = G.destacadas_recomendadas;
      if (destacadas.length < dmin || destacadas.length > dmax) advertencias.push(`${destacadas.length} destacadas; lo recomendado es ${dmin}–${dmax}.`);
      destacadas.forEach((d) => { if ([...d].length > G.destacadas_titulo_max_caracteres) advertencias.push(`Destacada "${d}": más de ${G.destacadas_titulo_max_caracteres} caracteres, se corta.`); });
    }
    revisarHumano([{ nombre: 'la bio', valor: bio }], errores, advertencias, medidas);
  }

  revisarMarca(textos, marca, advertencias);
  return { formato, ok: errores.length === 0, errores, advertencias, medidas };
}

export function verificacionMarkdown(r) {
  const l = [`Verificación de ${r.formato}: ${r.ok ? 'sin errores' : `${r.errores.length} error(es)`}${r.advertencias.length ? ` · ${r.advertencias.length} advertencia(s)` : ''}`];
  l.push(`Medidas: ${JSON.stringify(r.medidas)}`);
  for (const e of r.errores) l.push(`✗ ${e}`);
  for (const a of r.advertencias) l.push(`⚠ ${a}`);
  return l.join('\n');
}
