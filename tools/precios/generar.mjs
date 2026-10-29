// Páginas de precios por rubro (idea del 28/10/2026, tomada de Clickie): una
// por rubro con los trabajos y sus precios de referencia, y en cada trabajo un
// botón "Pedir" que abre el pedido ya escrito (docs/LINKS-DE-PEDIDO.md) en la
// zona que elija la persona.
//
// Los precios son del AMBA en general, no de cada zona: por eso es una página
// por rubro y la zona va en el botón, en vez de una página por barrio con los
// mismos números (Google lo toma como contenido repetido).
//
//   node tools/precios/generar.mjs
//
// Lee tools/precios/datos.json (copia de public.precios_referencia) y escribe
// precios/<rubro>/index.html, el índice precios/index.html y el sitemap. No
// toca las páginas hechas a mano (pintura y clases de inglés).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const { filas, exportado } = JSON.parse(readFileSync(path.join(raiz, 'tools/precios/datos.json'), 'utf8'));
const css = readFileSync(path.join(raiz, 'precios/pintura/index.html'), 'utf8').match(/<style>[\s\S]*?<\/style>/)[0];
const A_MANO = { Pintura: 'pintura' };
const ZONAS = ['CABA', 'GBA Norte', 'GBA Oeste', 'GBA Sur', 'Buenos Aires (interior)'];
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const slug = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const pesos = n => '$' + Math.round(n).toLocaleString('es-AR');
const mes = iso => MESES[Number(iso.slice(5, 7)) - 1] + ' ' + iso.slice(0, 4);
const minus = s => s.charAt(0).toLowerCase() + s.slice(1);
const utm = (campania, contenido) => `utm_source=google&utm_medium=organico&utm_campaign=${campania}&utm_content=${contenido}`;
const linkPedir = (rubro, servicio, campania) =>
  '/?' + new URLSearchParams({ pedir: servicio, rubro }).toString() + '&' + utm(campania, 'pedir-fila');

const porRubro = new Map();
for (const [rubro, servicio, unidad, min, max, relevado, fuente] of filas) {
  if (!porRubro.has(rubro)) porRubro.set(rubro, []);
  porRubro.get(rubro).push({ servicio, unidad, min, max, relevado, fuente });
}

function cabeza({ titulo, descripcion, url, ld }) {
  return `<!doctype html>
<html lang="es-AR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${esc(titulo)}</title>
<meta name="description" content="${esc(descripcion)}">
<link rel="canonical" href="${url}">
<meta name="theme-color" content="#0C2620">
<meta name="format-detection" content="telephone=no">
<meta property="og:type" content="website">
<meta property="og:locale" content="es_AR">
<meta property="og:site_name" content="Tratto">
<meta property="og:title" content="${esc(titulo.replace(' | Tratto', ''))}">
<meta property="og:description" content="${esc(descripcion)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="https://www.trattoapp.com.ar/og-image.png?v=2">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<!-- Vercel Web Analytics: se manda la URL sin parámetros, salvo los utm_ -->
<script>
  window.va = function () { (window.vaq = window.vaq || []).push(arguments); };
  window.va('beforeSend', function (event) {
    var url = new URL(event.url);
    var utm = new URLSearchParams();
    url.searchParams.forEach(function (v, k) { if (k.indexOf('utm_') === 0) utm.set(k, v); });
    url.search = utm.toString();
    url.hash = '';
    event.url = url.toString();
    return event;
  });
</script>
<script defer src="/_vercel/insights/script.js"></script>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@500;600&family=IBM+Plex+Sans+Condensed:wght@600;700&family=IBM+Plex+Sans:wght@400;600&display=swap" rel="stylesheet">
<!-- Generada por tools/precios/generar.mjs con tools/precios/datos.json (precios_referencia).
     No editar a mano: cambiar los datos o el generador y volver a correrlo. -->
${ld.map(x => `<script type="application/ld+json">\n${JSON.stringify(x, null, 2)}\n</script>`).join('\n')}
${css}
<style>
  .zona-elegir{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:18px 0 6px}
  .zona-elegir label{font-weight:600;font-size:14px}
  .zona-elegir select{font:inherit;font-size:15px;padding:9px 12px;border-radius:8px;border:1px solid #CFC9BA;background:#FCFBF8}
  td.pedir-fila a{display:inline-block;font-weight:600;font-size:14px;white-space:nowrap;padding:7px 14px;border-radius:99px;
    background:#1E5D49;color:#fff;text-decoration:none}
  @media (max-width:640px){
    .precios .dato{grid-column:1/-1;grid-row:3;text-align:left}
    .precios .fuente{grid-column:1/-1;grid-row:4;white-space:normal;margin-top:0}
    .precios .fuente::after{display:none}
    .precios td.pedir-fila{grid-column:1/-1;grid-row:5;margin-top:8px}
  }
  .rubros{columns:2;column-gap:28px;padding-left:18px}
  .rubros li{margin:0 0 8px;break-inside:avoid}
  @media (max-width:560px){.rubros{columns:1}}
</style>
</head>`;
}

const pie = `<footer class="pie ancho">
  <p>Precios de referencia, no son precios fijos: quien hace el trabajo arma su presupuesto. Cada fila dice de cuándo es el dato y de dónde sale.</p>
  <p><a href="/privacidad.html">Privacidad</a> · <a href="/terminos.html">Términos</a> · <a href="/arrepentimiento.html">Botón de arrepentimiento</a></p>
</footer>`;

// La zona elegida se suma a los botones "Pedir" (y se recuerda en el teléfono).
const scriptZona = `<script>
  (function () {
    var sel = document.getElementById('zona');
    function aplicar() {
      var z = sel.value;
      try { if (z) localStorage.setItem('tratto_zona_precios', z); } catch (e) {}
      document.querySelectorAll('a[data-pedir]').forEach(function (a) {
        var u = new URL(a.getAttribute('href'), location.origin);
        if (z) u.searchParams.set('zona', z); else u.searchParams.delete('zona');
        a.setAttribute('href', u.pathname + u.search);
      });
    }
    try { var g = localStorage.getItem('tratto_zona_precios'); if (g) sel.value = g; } catch (e) {}
    sel.addEventListener('change', aplicar);
    aplicar();
  })();
</script>`;

function paginaRubro(rubro, items) {
  const s = slug(rubro), url = `https://www.trattoapp.com.ar/precios/${s}/`, campania = 'precios-' + s;
  const nombre = minus(rubro);
  const titulo = `Precios de ${nombre} en el AMBA | Tratto`;
  const ejemplos = items.slice(0, 3).map(i => minus(i.servicio)).join(', ');
  const descripcion = `Cuánto sale ${nombre} en CABA y el Gran Buenos Aires: ${ejemplos}. Rangos de referencia con fecha y fuente, y pedí presupuestos gratis en tu zona.`;
  const viejo = items.some(i => i.relevado < exportado.slice(0, 7) + '-01' && (new Date(exportado) - new Date(i.relevado)) > 75 * 864e5);
  const fuentes = [...new Set(items.map(i => i.fuente))];
  const ld = [
    { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: items.slice(0, 4).map(i => ({
      '@type': 'Question', name: `¿Cuánto sale ${minus(i.servicio)}?`,
      acceptedAnswer: { '@type': 'Answer', text: `Como referencia en el AMBA, entre ${pesos(i.min)} y ${pesos(i.max)} ${i.unidad} (${i.fuente}, ${mes(i.relevado)}). El precio final lo arma quien hace el trabajo, según tu caso.` },
    })) },
    { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Inicio', item: 'https://www.trattoapp.com.ar/' },
      { '@type': 'ListItem', position: 2, name: 'Precios', item: 'https://www.trattoapp.com.ar/precios/' },
      { '@type': 'ListItem', position: 3, name: rubro, item: url },
    ] },
  ];
  const filasHTML = items.map(i => `    <tr><th scope="row" class="trabajo">${esc(i.servicio)}</th><td class="rango">${pesos(i.min)} a ${pesos(i.max)}</td><td class="unidad">${esc(i.unidad)}</td><td class="dato"><span class="sello"><time datetime="${i.relevado.slice(0, 7)}">${mes(i.relevado)}</time></span></td><td class="fuente">${esc(i.fuente)}</td><td class="pedir-fila"><a data-pedir href="${esc(linkPedir(rubro, i.servicio, campania))}">Pedir</a></td></tr>`).join('\n');
  return `${cabeza({ titulo, descripcion, url, ld })}
<body>
<header class="tope ancho"><a href="/?${esc(utm(campania, 'cabecera'))}"><img src="/icon-192.png" alt="" width="30" height="30"><b>Tratto</b></a></header>

<section class="hero ancho">
  <nav class="migas" aria-label="Estás en">
    <ol><li><a href="/?${esc(utm(campania, 'migas'))}">Inicio</a></li><li><a href="/precios/">Precios</a></li><li aria-current="page">${esc(rubro)}</li></ol>
  </nav>
  <p class="ceja">Precios de referencia · AMBA</p>
  <h1>¿Cuánto sale ${esc(nombre)}?<span class="bajo">Precios de referencia en el AMBA</span></h1>
  <p class="sub">Son los rangos que usa la calculadora de Tratto, cada uno con su fecha y su fuente. Sirven para saber si un presupuesto está en un número razonable. El precio final lo arma quien hace el trabajo, según tu caso.</p>
  <div class="botones">
    <a class="boton laton" href="/calculadora/?${esc(utm(campania, 'boton-calculadora'))}">¿Ya te pasaron un precio? Fijate si está en rango</a>
    <a class="boton borde" href="/?${esc(new URLSearchParams({ rubro }).toString() + '&' + utm(campania, 'boton-pedir'))}" data-pedir>Pedir presupuestos gratis</a>
  </div>
</section>

<main class="hoja">
  <div class="hoja-in ancho">

    <section aria-labelledby="t-precios">
      <h2 id="t-precios">Precios de referencia</h2>
      <div class="zona-elegir">
        <label for="zona">¿Dónde lo necesitás?</label>
        <select id="zona"><option value="">Elegí tu zona</option>${ZONAS.map(z => `<option>${esc(z)}</option>`).join('')}</select>
      </div>
<table class="precios">
  <caption class="sr">Precios de referencia de ${esc(nombre)} en el AMBA, con fecha y fuente</caption>
  <thead><tr><th scope="col">Trabajo</th><th scope="col">Rango</th><th scope="col">Unidad</th><th scope="col">Dato de</th><th scope="col">Fuente</th><th scope="col"><span class="sr">Pedir</span></th></tr></thead>
  <tbody>
${filasHTML}
  </tbody>
</table>
      <div class="nota">
        ${viejo ? '<p>Los datos de hace unos meses pueden haber quedado atrás: si te pasan un número algo más alto, no quiere decir que te estén cobrando de más.</p>' : ''}
        <p>Tocá «Pedir» en el trabajo que necesitás: se abre el pedido ya escrito para que lo revises y lo publiques. Lo ven quienes trabajan en tu zona y te mandan presupuestos.</p>
        <p>La calculadora parte de estos mismos datos y les suma un ajuste mensual estimado por inflación desde la fecha de cada uno, así que ahí puede que veas números algo más altos.</p>
      </div>
    </section>

    <section aria-labelledby="t-preguntar">
      <h2 id="t-preguntar">Qué preguntar antes de contratar</h2>
      <div class="preguntar">
        <ol>
          <li><span>¿Qué incluye el precio y qué queda afuera? (materiales, traslado, visita)</span></li>
          <li><span>¿Cobrás por hora, por unidad o por trabajo cerrado?</span></li>
          <li><span>¿Cuándo podés empezar y cuánto tarda?</span></li>
          <li><span>¿Cómo se paga: todo al final o con una seña?</span></li>
          <li><span>¿Me lo pasás por escrito, con todo lo que incluye?</span></li>
        </ol>
      </div>
    </section>

    <section class="pedir" aria-labelledby="t-pedir">
      <h2 id="t-pedir">Cómo pedirlo en Tratto</h2>
      <div class="firma" aria-hidden="true"><span class="hilo"></span><span class="sello">Gratis para quien pide</span></div>
      <p>Contás qué necesitás o le sacás una foto. Lo ven quienes trabajan en ${esc(nombre)} en tu zona y te mandan presupuestos. Los comparás, ves las calificaciones de otros clientes y arreglan por el chat de la app, sin pasar tu número.</p>
      <a class="boton laton" href="/?${esc(new URLSearchParams({ rubro }).toString() + '&' + utm(campania, 'boton-pedir'))}" data-pedir>Pedir presupuestos gratis</a>
    </section>

    <section aria-labelledby="t-faq">
      <h2 id="t-faq">Preguntas frecuentes</h2>
      <div class="faq">
${items.slice(0, 4).map(i => `      <div class="q"><h3>¿Cuánto sale ${esc(minus(i.servicio))}?</h3><p>Como referencia en el AMBA, entre ${pesos(i.min)} y ${pesos(i.max)} ${esc(i.unidad)} (${esc(i.fuente)}, ${mes(i.relevado)}). El precio final lo arma quien hace el trabajo, según tu caso.</p></div>`).join('\n')}
      <div class="q"><h3>¿Cómo sé si me están cobrando de más?</h3><p>Cargá el precio en <a href="/calculadora/?${esc(utm(campania, 'faq'))}">la calculadora de Tratto</a>. Lo compara con el rango de referencia y te dice si es caro, un precio justo o un buen precio. Es gratis.</p></div>
      </div>
    </section>

  </div>
</main>

<section class="franja" aria-label="Más servicios en Tratto">
  <div class="ancho">
    <p class="grande">Tratto tiene más de 40 rubros.</p>
    <p>Mirá <a href="/precios/" style="color:inherit">los precios de todos los rubros</a> o probá la calculadora con el presupuesto que te pasaron.</p>
    <a class="boton laton" href="/calculadora/?${esc(utm(campania, 'cierre'))}">Ver la calculadora</a>
  </div>
</section>

${pie.replace('Cada fila dice de cuándo es el dato y de dónde sale.', 'Fuentes: ' + esc(fuentes.join('; ')) + '.')}
${scriptZona}
</body>
</html>
`;
}

function paginaIndice(rubros) {
  const url = 'https://www.trattoapp.com.ar/precios/';
  const titulo = 'Precios de servicios en el AMBA: 46 rubros | Tratto';
  const descripcion = 'Cuánto sale un plomero, un flete, un DJ, clases de inglés o una limpieza en CABA y el Gran Buenos Aires: precios de referencia con fecha y fuente.';
  const lista = rubros.map(r => {
    const href = r === 'Pintura' ? '/precios/pintura/' : `/precios/${slug(r)}/`;
    return `          <li><a href="${href}">${esc(r)}</a></li>`;
  }).join('\n');
  return `${cabeza({ titulo, descripcion, url, ld: [] })}
<body>
<header class="tope ancho"><a href="/?${esc(utm('precios-indice', 'cabecera'))}"><img src="/icon-192.png" alt="" width="30" height="30"><b>Tratto</b></a></header>
<section class="hero ancho">
  <p class="ceja">Precios de referencia · AMBA</p>
  <h1>¿Cuánto sale cada servicio?<span class="bajo">46 rubros, con fecha y fuente</span></h1>
  <p class="sub">Elegí el rubro y mirá los rangos de referencia de cada trabajo. Desde cada uno podés pedir presupuestos gratis en tu zona.</p>
  <div class="botones"><a class="boton laton" href="/calculadora/?${esc(utm('precios-indice', 'boton-calculadora'))}">¿Ya te pasaron un precio? Fijate si está en rango</a></div>
</section>
<main class="hoja">
  <div class="hoja-in ancho">
    <section aria-labelledby="t-rubros">
      <h2 id="t-rubros">Rubros</h2>
      <ul class="rubros">
${lista}
          <li><a href="/precios/clases-de-ingles/">Clases de inglés (guía aparte)</a></li>
      </ul>
      <p style="margin-top:18px">¿Sos periodista? <a href="/precios/indice/">Acá está el índice del mes</a>, con todos los rubros en una tabla, cómo citarlo y la planilla para bajar.</p>
    </section>
  </div>
</main>
${pie}
</body>
</html>
`;
}

// Índice para prensa: todos los rubros en una página, con cómo citarlo y la
// planilla para bajar. Se rehace cada mes con los datos del mes.
function paginaIndicePrensa(rubros) {
  const url = 'https://www.trattoapp.com.ar/precios/indice/';
  const mesTxt = mes(exportado), mesCap = mesTxt.charAt(0).toUpperCase() + mesTxt.slice(1);
  const csv = `precios-servicios-amba-${exportado.slice(0, 7)}.csv`;
  const titulo = `Precios de servicios en el AMBA · ${mesTxt} | Tratto`;
  const descripcion = `Cuánto se paga en ${mesTxt} por 135 trabajos de 46 rubros en CABA y el Gran Buenos Aires, con fecha y fuente de cada dato. Se puede citar.`;
  const recientes = filas.filter(f => (new Date(exportado) - new Date(f[5])) <= 92 * 864e5).length;
  const tabla = rubros.map(r => porRubro.get(r).map((i, k) => `    <tr>${k === 0 ? `<th scope="rowgroup" rowspan="${porRubro.get(r).length}" class="rubro">${esc(r)}</th>` : ''}<td class="trabajo">${esc(i.servicio)}</td><td class="rango">${pesos(i.min)} a ${pesos(i.max)}</td><td class="unidad">${esc(i.unidad)}</td><td class="dato">${mes(i.relevado)}</td><td class="fuente">${esc(i.fuente)}</td></tr>`).join('\n')).join('\n');
  return `${cabeza({ titulo, descripcion, url, ld: [{ '@context': 'https://schema.org', '@type': 'Dataset', name: `Precios de servicios en el AMBA, ${mesTxt}`,
    description: descripcion, url, creator: { '@type': 'Organization', name: 'Tratto', url: 'https://www.trattoapp.com.ar/' },
    temporalCoverage: exportado.slice(0, 7), spatialCoverage: 'Área Metropolitana de Buenos Aires, Argentina',
    distribution: [{ '@type': 'DataDownload', encodingFormat: 'text/csv', contentUrl: url + csv }] }] })}
<body>
<header class="tope ancho"><a href="/?${esc(utm('precios-indice-prensa', 'cabecera'))}"><img src="/icon-192.png" alt="" width="30" height="30"><b>Tratto</b></a></header>
<section class="hero ancho">
  <nav class="migas" aria-label="Estás en">
    <ol><li><a href="/">Inicio</a></li><li><a href="/precios/">Precios</a></li><li aria-current="page">Índice ${esc(mesTxt)}</li></ol>
  </nav>
  <p class="ceja">Para prensa · ${esc(mesCap)}</p>
  <h1>¿Cuánto se paga por un servicio en ${esc(mesTxt)}?<span class="bajo">${filas.length} trabajos de ${rubros.length} rubros en el AMBA</span></h1>
  <p class="sub">Tratto junta todos los meses los precios de referencia que usa su calculadora: de un plomero a un DJ, de clases de inglés a una mudanza. Cada dato dice de cuándo es y de dónde sale. Lo pueden usar y citar.</p>
  <div class="botones"><a class="boton laton" href="${csv}" download>Bajar la planilla (CSV)</a></div>
</section>
<main class="hoja">
  <div class="hoja-in ancho">
    <section aria-labelledby="t-citar">
      <h2 id="t-citar">Cómo citarlo</h2>
      <div class="nota">
        <p>«Precios de servicios en el AMBA, ${esc(mesTxt)}. Relevamiento de Tratto (trattoapp.com.ar/precios/indice/)».</p>
        <p>Para consultas o datos de un rubro: <a href="mailto:trattoapp1@gmail.com">trattoapp1@gmail.com</a>.</p>
      </div>
    </section>
    <section aria-labelledby="t-como">
      <h2 id="t-como">Cómo se arma</h2>
      <ul class="factores">
        <li><strong>De dónde salen los datos.</strong>De precios publicados por plataformas de servicios, colegios y cámaras de cada oficio, y de avisos de quienes trabajan en cada rubro. La fuente está en cada fila.</li>
        <li><strong>De cuándo es cada dato.</strong>Cada fila dice el mes en que se relevó. Este mes, ${recientes} de los ${filas.length} datos son de los últimos tres meses.</li>
        <li><strong>Algunas son estimaciones.</strong>En ${filas.filter(f => /^Estimado/.test(f[6])).length} trabajos sin un precio publicado confiable, el rango lo estimamos a partir de rubros parecidos; la fuente lo dice («Estimado: …»).</li>
        <li><strong>Sin ajustes.</strong>Los números van como se publicaron, sin actualizar por inflación. La calculadora de Tratto sí les suma un ajuste mensual estimado.</li>
        <li><strong>Qué no es.</strong>No son precios fijos ni de Tratto: cada persona que hace el trabajo arma su presupuesto.</li>
      </ul>
    </section>
    <section aria-labelledby="t-tabla">
      <h2 id="t-tabla">Los precios</h2>
<table class="precios indice">
  <caption class="sr">Precios de referencia de servicios en el AMBA, ${esc(mesTxt)}</caption>
  <thead><tr><th scope="col">Rubro</th><th scope="col">Trabajo</th><th scope="col">Rango</th><th scope="col">Unidad</th><th scope="col">Dato de</th><th scope="col">Fuente</th></tr></thead>
  <tbody>
${tabla}
  </tbody>
</table>
    </section>
  </div>
</main>
${pie}
<style>
  .precios.indice .rubro{font-weight:600;vertical-align:top}
  @media (max-width:640px){
    .precios.indice tr{grid-template-columns:minmax(0,1fr) auto}
    .precios.indice .rubro{display:none}
    .precios.indice .dato{grid-column:1/-1;grid-row:3;text-align:left;font:500 .74rem/1.2 var(--f-mono);color:var(--gris)}
    .precios.indice .fuente{grid-column:1/-1;grid-row:4;white-space:normal;margin-top:0}
    .precios.indice .fuente::after{display:none}
  }
</style>
</body>
</html>
`;
}
function csvIndice(rubros) {
  const c = v => /[",\n;]/.test(String(v)) ? '"' + String(v).replace(/"/g, '""') + '"' : String(v);
  const lineas = [['rubro', 'trabajo', 'precio_min', 'precio_max', 'unidad', 'dato_de', 'fuente'].join(',')];
  for (const r of rubros) for (const i of porRubro.get(r)) lineas.push([r, i.servicio, i.min, i.max, i.unidad, i.relevado.slice(0, 7), i.fuente].map(c).join(','));
  return lineas.join('\n') + '\n';
}

const rubros = [...porRubro.keys()].sort((a, b) => a.localeCompare(b, 'es'));
const hechas = [];
for (const r of rubros) {
  if (A_MANO[r]) continue;
  const dir = path.join(raiz, 'precios', slug(r));
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, 'index.html'), paginaRubro(r, porRubro.get(r)));
  hechas.push(slug(r));
}
writeFileSync(path.join(raiz, 'precios', 'index.html'), paginaIndice(rubros));
mkdirSync(path.join(raiz, 'precios', 'indice'), { recursive: true });
writeFileSync(path.join(raiz, 'precios', 'indice', 'index.html'), paginaIndicePrensa(rubros));
writeFileSync(path.join(raiz, 'precios', 'indice', `precios-servicios-amba-${exportado.slice(0, 7)}.csv`), csvIndice(rubros));
hechas.push('indice');

// Sitemap: se agregan (o actualizan) las páginas generadas y el índice.
const sm = path.join(raiz, 'sitemap.xml');
let mapa = readFileSync(sm, 'utf8');
for (const s of ['', ...hechas]) {
  const loc = `https://www.trattoapp.com.ar/precios/${s ? s + '/' : ''}`;
  const linea = `  <url><loc>${loc}</loc><lastmod>${exportado}</lastmod><changefreq>monthly</changefreq><priority>0.6</priority></url>`;
  const re = new RegExp(`  <url><loc>${loc.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')}</loc>.*?</url>`);
  mapa = re.test(mapa) ? mapa.replace(re, linea) : mapa.replace('</urlset>', linea + '\n</urlset>');
}
writeFileSync(sm, mapa);
console.log(`Listo: ${hechas.length} páginas de rubro, el índice y el sitemap.`);
