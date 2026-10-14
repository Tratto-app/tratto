// Análisis de video de Tratto: estima cuánto engancha un video a partir de
// señales que se pueden medir (movimiento, cortes, color, contraste, texto en
// pantalla, sonido y voz). No es un modelo del cerebro: el dibujo del CRM ubica
// cada señal en la zona que se asocia con ese tipo de estímulo. Es la versión
// propia y gratis de lo que muestra el Virality Predictor de Higgsfield.
// Corre igual en el navegador (CRM, /crm/cerebro) y en Node
// (tools/contenido/cerebro.mjs, para los agentes): no usa nada del DOM.

export type Zona = 'visual' | 'atencion' | 'auditiva' | 'foco' | 'lenguaje' | 'memoria';

export interface Entrada {
  ancho: number;
  alto: number;
  fps: number;
  cuadros: (Uint8ClampedArray | Uint8Array)[]; // RGBA, ancho × alto, desde el segundo 0
  cola?: (Uint8ClampedArray | Uint8Array)[]; // los últimos 2 s, si el video dura más de lo analizado
  audio: Float32Array | null; // mono
  muestreo: number; // Hz del audio
  duracion: number; // segundos del archivo completo
}

export interface Resultado {
  herramienta: string;
  version: number;
  fecha: string;
  segundos: string;
  duracion: number;
  viral: number;
  gancho: number;
  retencion: number;
  regiones: Record<Zona, number>;
  pico_gancho: number;
  linea: number[];
  zonas_por_segundo: Record<Zona, number>[];
  senales: {
    cortes_por_segundo: number;
    movimiento: number;
    color: number;
    contraste: number;
    texto: number;
    sonido: number;
    voz: number;
    segundos_quietos: number[];
    cierre_con_marca: boolean | null;
    sonido_desde: number | null;
  };
  consejos: string[];
  estado: 'hecho';
}

export const SEGUNDOS_ANALIZADOS = 30;
const VENTANA = 15; // como el simulador del video: lo que importa pasa en los primeros 15 s

const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const media = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0);
const redondo = (x: number) => Math.round(clamp(x, 0, 100));

// ── Imagen ──
interface SenalCuadro { luma: Float32Array; mapa: Uint8Array; contraste: number; color: number; bordes: number }

function senalCuadro(rgba: Uint8ClampedArray | Uint8Array, w: number, h: number): SenalCuadro {
  const n = w * h;
  const luma = new Float32Array(n);
  let sy = 0, sy2 = 0, srg = 0, srg2 = 0, syb = 0, syb2 = 0;
  for (let i = 0; i < n; i++) {
    const r = rgba[i * 4], g = rgba[i * 4 + 1], b = rgba[i * 4 + 2];
    const y = 0.299 * r + 0.587 * g + 0.114 * b;
    luma[i] = y; sy += y; sy2 += y * y;
    const rg = r - g, yb = 0.5 * (r + g) - b;
    srg += rg; srg2 += rg * rg; syb += yb; syb2 += yb * yb;
  }
  const my = sy / n, mrg = srg / n, myb = syb / n;
  const dy = Math.sqrt(Math.max(sy2 / n - my * my, 0));
  const drg = Math.sqrt(Math.max(srg2 / n - mrg * mrg, 0)), dyb = Math.sqrt(Math.max(syb2 / n - myb * myb, 0));
  // Colorido de Hasler y Süsstrunk. Mapa de bordes: píxeles con cambio fuerte
  // (letras, contornos); sirve para ver texto y para notar cuándo cambia lo
  // que hay en pantalla aunque el fondo siga igual (piezas animadas).
  const color = Math.sqrt(drg * drg + dyb * dyb) + 0.3 * Math.sqrt(mrg * mrg + myb * myb);
  const mapa = new Uint8Array(n);
  let fuertes = 0;
  for (let y = 0; y < h - 1; y++) {
    for (let x = 0; x < w - 1; x++) {
      const i = y * w + x;
      if (Math.abs(luma[i + 1] - luma[i]) + Math.abs(luma[i + w] - luma[i]) > 40) { mapa[i] = 1; fuertes++; }
    }
  }
  return { luma, mapa, contraste: dy, color, bordes: fuertes / ((w - 1) * (h - 1)) };
}

function diferencia(a: Float32Array, b: Float32Array) {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += Math.abs(a[i] - b[i]);
  return s / a.length / 255;
}

// Cuánto cambió el dibujo de la pantalla (proporción de bordes que aparecen o
// desaparecen). Detecta cortes y también texto nuevo en piezas animadas.
function cambioBordes(a: Uint8Array, b: Uint8Array) {
  let union = 0, distintos = 0;
  for (let i = 0; i < a.length; i++) {
    if (a[i] | b[i]) union++;
    if (a[i] !== b[i]) distintos++;
  }
  return { razon: union ? distintos / union : 0, union: union / a.length };
}

// Movimiento entre dos cuadros (0 a 1): lo que se movió la imagen o lo que
// cambió el dibujo (texto que entra, un objeto nuevo).
function novedad(a: SenalCuadro, b: SenalCuadro) {
  const d = diferencia(a.luma, b.luma), c = cambioBordes(a.mapa, b.mapa);
  return { d, c, v: Math.max(clamp(d / 0.04), c.union >= 0.005 ? clamp((c.razon - 0.15) / 0.6) : 0) };
}

// ── Sonido ──
// Pasa banda de la voz (aprox. 300–3400 Hz), filtro biquad del recetario de RBJ.
function pasaBanda(x: Float32Array, sr: number, f0 = 1000, q = 0.55) {
  const w0 = (2 * Math.PI * f0) / sr, al = Math.sin(w0) / (2 * q), c = Math.cos(w0);
  const a0 = 1 + al, b0 = al / a0, b2 = -al / a0, a1 = (-2 * c) / a0, a2 = (1 - al) / a0;
  const y = new Float32Array(x.length);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) {
    const v = b0 * x[i] + b2 * x2 - a1 * y1 - a2 * y2;
    y[i] = v; x2 = x1; x1 = x[i]; y2 = y1; y1 = v;
  }
  return y;
}

function rmsPorBloque(x: Float32Array, bloque: number) {
  const out: number[] = [];
  for (let i = 0; i + bloque <= x.length; i += bloque) {
    let s = 0;
    for (let k = i; k < i + bloque; k++) s += x[k] * x[k];
    out.push(Math.sqrt(s / bloque));
  }
  return out;
}

// Voz por segundo: energía en la banda de la voz y modulación silábica (3–7 Hz)
// de la envolvente, que la música pareja no tiene.
function sonidoPorSegundo(audio: Float32Array, sr: number, segundos: number) {
  const banda = pasaBanda(audio, sr);
  const paso = Math.max(1, Math.round(sr / 100)); // envolvente a 100 Hz
  const envT = rmsPorBloque(audio, paso), envB = rmsPorBloque(banda, paso);
  const nivel: number[] = [], voz: number[] = [];
  for (let s = 0; s < segundos; s++) {
    const t = envT.slice(s * 100, s * 100 + 100), b = envB.slice(s * 100, s * 100 + 100);
    if (t.length < 50) { nivel.push(0); voz.push(0); continue; }
    const rms = Math.sqrt(media(t.map((v) => v * v)));
    nivel.push(rms);
    const ratio = Math.sqrt(media(b.map((v) => v * v))) / (rms || 1);
    const m = media(b);
    const e = b.map((v) => v - m);
    let total = 0, silabas = 0;
    for (let k = 1; k <= 20; k++) {
      let re = 0, im = 0;
      for (let i = 0; i < e.length; i++) { const a = (2 * Math.PI * k * i) / e.length; re += e[i] * Math.cos(a); im -= e[i] * Math.sin(a); }
      const p = re * re + im * im;
      total += p;
      if (k >= 3 && k <= 7) silabas += p;
    }
    const mod = total ? silabas / total : 0;
    const variacion = m ? Math.sqrt(media(e.map((v) => v * v))) / m : 0;
    voz.push(rms < 0.01 ? 0 : clamp((ratio - 0.3) / 0.35) * clamp((mod - 0.2) / 0.35) * clamp((variacion - 0.25) / 0.35));
  }
  return { nivel, voz };
}

// ── Análisis ──
export function analizar(e: Entrada): Resultado {
  const fps = e.fps;
  const segundos = Math.max(1, Math.min(Math.ceil(e.cuadros.length / fps), SEGUNDOS_ANALIZADOS));
  const sen = e.cuadros.map((c) => senalCuadro(c, e.ancho, e.alto));
  const par = sen.map((s, i) => (i === 0 ? { d: 0, c: { razon: 0, union: 0 }, v: 0 } : novedad(s, sen[i - 1])));
  const dif = par.map((p) => p.d), nov = par.map((p) => p.v);
  // Cambios: un corte o algo nuevo en pantalla, separados por al menos 0,7 s.
  const cortes: boolean[] = [];
  let ultimo = -Infinity;
  const espera = Math.max(1, Math.round(fps * 0.7));
  for (let i = 0; i < sen.length; i++) {
    const hay = i > 0 && (dif[i] > 0.13 || (par[i].c.razon > 0.6 && par[i].c.union >= 0.005));
    cortes.push(hay && i - ultimo >= espera);
    if (cortes[i]) ultimo = i;
  }

  const porSeg = <T,>(f: (i: number) => T, s: number) => {
    const out: T[] = [];
    for (let i = s * fps; i < Math.min((s + 1) * fps, sen.length); i++) out.push(f(i));
    return out;
  };
  const mov: number[] = [], cor: number[] = [], bor: number[] = [], col: number[] = [], con: number[] = [];
  for (let s = 0; s < segundos; s++) {
    mov.push(media(porSeg((i) => nov[i], s)));
    cor.push(porSeg((i): number => (cortes[i] ? 1 : 0), s).reduce((a, b) => a + b, 0));
    bor.push(media(porSeg((i) => sen[i].bordes, s)));
    col.push(media(porSeg((i) => sen[i].color, s)));
    con.push(media(porSeg((i) => sen[i].contraste, s)));
  }
  const son = e.audio && e.audio.length ? sonidoPorSegundo(e.audio, e.muestreo, segundos) : { nivel: Array(segundos).fill(0), voz: Array(segundos).fill(0) };
  const conSonido = son.nivel.map((n) => n > 0.01);

  // Primer momento con sonido (en décimas), para ver si arranca de entrada.
  let sonidoDesde: number | null = null;
  if (e.audio && e.audio.length) {
    const d = rmsPorBloque(e.audio.subarray(0, Math.min(e.audio.length, e.muestreo * 3)), Math.round(e.muestreo / 10));
    const k = d.findIndex((v) => v > 0.01);
    sonidoDesde = k < 0 ? null : k / 10;
  }

  const H = Math.min(segundos, VENTANA);
  const ven = <T,>(xs: T[]) => xs.slice(0, H);
  const movN = (v: number) => clamp(v / 0.45);
  const texto = (v: number) => clamp((v - 0.015) / 0.09);

  // Atención estimada por segundo: qué pasa en pantalla y en el sonido.
  const linea = Array.from({ length: segundos }, (_, s) => redondo(100 * (
    0.32 * movN(mov[s]) + 0.22 * clamp(cor[s]) + 0.2 * son.voz[s] + 0.14 * texto(bor[s]) + 0.12 * (conSonido[s] ? 1 : 0)
  )));
  const quietos = linea.map((a, s) => (a < 22 && cor[s] === 0 && son.voz[s] < 0.3 ? s : -1)).filter((s) => s >= 0);
  const quietosVen = quietos.filter((s) => s < H);

  const cortesSeg = ven(cor).reduce((a, b) => a + b, 0) / H;
  const ritmo = cortesSeg <= 0 ? 0 : clamp(1 - Math.abs(Math.log2(cortesSeg / 0.8)) / 3);
  let maxQuieto = 0, racha = 0;
  for (let s = 0; s < H; s++) { racha = quietos.includes(s) ? racha + 1 : 0; maxQuieto = Math.max(maxQuieto, racha); }

  const colorN = clamp(media(ven(col)) / 80), contrasteN = clamp(media(ven(con)) / 70);
  const vozN = media(ven(son.voz)), textoN = media(ven(bor).map(texto));
  const sonidoN = media(ven(conSonido).map((x) => (x ? 1 : 0)));
  const nivelesDb = ven(son.nivel).filter((n) => n > 0.01).map((n) => 20 * Math.log10(n));
  const dinamica = nivelesDb.length > 1 ? clamp(Math.sqrt(media(nivelesDb.map((d) => (d - media(nivelesDb)) ** 2))) / 6) : 0;

  // Cierre con la marca: el último segundo y medio casi quieto y con algo
  // legible (placa final). Si el video dura más de lo analizado, se mira en
  // los cuadros del final que manda el extractor (cola).
  const completo = e.duracion <= SEGUNDOS_ANALIZADOS + 0.5;
  const fin = e.cola && e.cola.length >= 2 ? e.cola.map((c) => senalCuadro(c, e.ancho, e.alto)) : completo ? sen : null;
  let cierre: boolean | null = null;
  if (fin) {
    const ult = fin.slice(-Math.max(2, Math.round(fps * 1.5)));
    const movFin = media(ult.slice(1).map((f, i) => novedad(f, ult[i]).v));
    cierre = movFin < 0.15 && media(ult.map((f) => f.bordes)) > 0.01;
  }

  const g0 = 0, g3 = Math.min(3, segundos);
  const movInicio = media(mov.slice(g0, Math.min(2, segundos)).map(movN));
  const corteTemprano = cortes.slice(1, Math.round(fps * 1.5)).some(Boolean) ? 1 : 0;
  const sonidoTemprano = sonidoDesde !== null && sonidoDesde <= 0.3 ? 1 : 0;
  const mensajeTemprano = Math.max(media(son.voz.slice(0, 2)), media(bor.slice(0, 2).map(texto)));
  const visualInicio = clamp(media(col.slice(0, g3)) / 80) * 0.5 + clamp(media(con.slice(0, g3)) / 70) * 0.5;

  const regiones: Record<Zona, number> = {
    visual: redondo(100 * (0.45 * colorN + 0.3 * contrasteN + 0.25 * movN(media(ven(mov))))),
    atencion: redondo(100 * (0.45 * ritmo + 0.3 * movInicio + 0.25 * clamp(1 - maxQuieto / 4))),
    auditiva: redondo(100 * (e.audio ? 0.65 * sonidoN + 0.35 * dinamica : 0)),
    foco: redondo(100 * clamp((quietosVen.length / H) * 1.6 + (maxQuieto >= 3 ? 0.2 : 0))),
    lenguaje: redondo(100 * (0.65 * vozN + 0.35 * textoN)),
    memoria: redondo(100 * (0.4 * (cierre ? 1 : 0) + 0.3 * vozN + 0.3 * textoN)),
  };
  // Las mismas zonas segundo a segundo, para que el dibujo se mueva con el video.
  const zonasPorSegundo = Array.from({ length: segundos }, (_, s): Record<Zona, number> => {
    const db = son.nivel[s] > 0.001 ? 20 * Math.log10(son.nivel[s]) : -60;
    return {
      visual: redondo(100 * (0.45 * clamp(col[s] / 80) + 0.3 * clamp(con[s] / 70) + 0.25 * movN(mov[s]))),
      atencion: linea[s],
      auditiva: redondo(100 * clamp((db + 50) / 40)),
      foco: redondo(100 * clamp((35 - linea[s]) / 35)),
      lenguaje: redondo(100 * (0.65 * son.voz[s] + 0.35 * texto(bor[s]))),
      memoria: redondo(100 * (0.3 * son.voz[s] + 0.3 * texto(bor[s]) + (cierre && s >= segundos - 2 ? 0.4 : 0))),
    };
  });
  const gancho = redondo(100 * (0.3 * movInicio + 0.25 * corteTemprano + 0.2 * sonidoTemprano + 0.15 * clamp(mensajeTemprano * 1.5) + 0.1 * visualInicio));
  // Retención: quién sigue mirando segundo a segundo. En los primeros 3 s se
  // va mucha más gente si no pasa nada; después, menos.
  let sigue = 100;
  for (let s = 0; s < H; s++) sigue *= s < 3 ? 1 - (0.03 + (1 - linea[s] / 100) * 0.12) : 1 - (0.01 + (1 - linea[s] / 100) * 0.04);
  const retencion = redondo(sigue);
  const viral = redondo(0.35 * gancho + 0.3 * retencion + 0.15 * regiones.atencion + 0.1 * regiones.lenguaje + 0.1 * (100 - regiones.foco));
  const inicio = linea.slice(0, g3);
  const pico = inicio.indexOf(Math.max(...inicio));

  const consejos: string[] = [];
  if (gancho < 50) consejos.push('El arranque engancha poco: sumá movimiento o un corte antes del segundo 1,5 y decí la idea en los primeros 2 segundos.');
  if (sonidoDesde === null || sonidoDesde > 0.3) consejos.push('El sonido no arranca de entrada: que suene desde el primer cuadro.');
  if (vozN < 0.2) consejos.push('Casi no hay voz: probá una versión con voz en off y subtítulos palabra por palabra.');
  if (textoN < 0.25) consejos.push('Hay poco texto en pantalla: poné la idea principal escrita en los primeros 2 segundos.');
  if (quietosVen.length) consejos.push(`Hay ${quietosVen.length} segundo${quietosVen.length > 1 ? 's' : ''} quieto${quietosVen.length > 1 ? 's' : ''} en los primeros ${H} (${quietosVen.map((s) => `${s}-${s + 1} s`).join(', ')}): cortalos o sumales movimiento.`);
  if (cortesSeg < 0.3) consejos.push('Muy pocos cambios de plano: apuntá a uno cada 1 o 2 segundos.');
  if (cortesSeg > 2.5) consejos.push('Cambia demasiado rápido: dejá respirar cada plano al menos medio segundo.');
  if (cierre === false) consejos.push('Cerrá con la marca 1 o 2 segundos en pantalla, quieta y legible.');
  if (e.duracion > 30) consejos.push(`Dura ${Math.round(e.duracion)} segundos: lo importante tiene que pasar en los primeros 15.`);

  return {
    herramienta: 'Análisis de Tratto (señales del video)',
    version: 1,
    fecha: new Date().toISOString().slice(0, 10),
    segundos: `0-${segundos}`,
    duracion: Math.round(e.duracion * 10) / 10,
    viral, gancho, retencion, regiones,
    pico_gancho: Math.max(0, pico),
    linea,
    zonas_por_segundo: zonasPorSegundo,
    senales: {
      cortes_por_segundo: Math.round(cortesSeg * 100) / 100,
      movimiento: Math.round(media(ven(mov)) * 1000) / 1000,
      color: Math.round(media(ven(col))),
      contraste: Math.round(media(ven(con))),
      texto: Math.round(textoN * 100) / 100,
      sonido: Math.round(sonidoN * 100) / 100,
      voz: Math.round(vozN * 100) / 100,
      segundos_quietos: quietosVen,
      cierre_con_marca: cierre,
      sonido_desde: sonidoDesde,
    },
    consejos,
    estado: 'hecho',
  };
}
