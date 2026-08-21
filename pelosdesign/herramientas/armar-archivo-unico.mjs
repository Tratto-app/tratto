#!/usr/bin/env node
/**
 * ARMAR ARCHIVO ÚNICO
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Arma dos archivos HTML que funcionan solos: con el diseño, las tipografías,
 * las fotos y TODO EL CONTENIDO YA ESCRITO ADENTRO. Se abren con doble click
 * desde cualquier carpeta y se pueden mandar por mail o por WhatsApp.
 *
 * POR QUÉ NO ALCANZA CON COPIAR index.html
 *     El sitio arma la lista de precios, las reseñas, los horarios y los links
 *     de WhatsApp con JavaScript, en el momento en que se abre. Eso anda bien
 *     en cualquier navegador, pero los visores de archivos del celular (el de
 *     WhatsApp, el de documentos de Android, Vista Rápida en iPhone) NO
 *     ejecutan JavaScript: se ve el diseño pero la lista sale vacía y los
 *     botones no llevan a ningún lado.
 *
 *     Por eso este script deja todo escrito de antemano y resuelve las
 *     interacciones con CSS: el selector de largo de pelo y el menú funcionan
 *     sin una línea de JavaScript.
 *
 * CUÁNDO USARLO
 *     Cada vez que cargues precios, reseñas o fotos en js/datos.js y quieras
 *     volver a mandarle el sitio a alguien. Los archivos que arma son una foto
 *     del momento: no se actualizan solos.
 *
 * CÓMO USARLO
 *     Abrí una terminal en la carpeta del proyecto y escribí:
 *
 *         node herramientas/armar-archivo-unico.mjs
 *
 *     Los dos archivos quedan en la carpeta  para-enviar/
 *
 * QUÉ NECESITA
 *     Node.js, que se baja de nodejs.org. Nada más.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SALIDA = path.join(RAIZ, "para-enviar");

const NOMBRES = {
  "index.html": "pelos-design.html",
  "precios.html": "pelos-design-lista-de-precios.html",
};

const LARGOS = [
  { nombre: "Corto",       nota: "Hasta la mandíbula"  },
  { nombre: "Mediano",     nota: "Hasta los hombros"   },
  { nombre: "Largo",       nota: "Hasta el pecho"      },
  { nombre: "Extra largo", nota: "Más abajo del pecho" },
];

const SECCIONES = [
  { id: "top",       nombre: "Inicio"      },
  { id: "servicios", nombre: "Servicios"   },
  { id: "resenas",   nombre: "Reseñas"     },
  { id: "precios",   nombre: "Precios"     },
  { id: "trabajos",  nombre: "Trabajos"    },
  { id: "equipo",    nombre: "Equipo"      },
  { id: "llegar",    nombre: "Cómo llegar" },
  { id: "preguntas", nombre: "Preguntas"   },
];

const TIPOS_IMAGEN = {
  ".webp": "image/webp", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
  ".png": "image/png", ".gif": "image/gif", ".avif": "image/avif",
  ".svg": "image/svg+xml",
};

const leer = (...p) => fs.readFileSync(path.join(RAIZ, ...p), "utf8");
const b64  = (...p) => fs.readFileSync(path.join(RAIZ, ...p)).toString("base64");
const kb   = n => (n / 1024).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ".") + " KB";

/* Cargamos datos.js y comun.js tal cual están, para que lo que se escribe acá
   salga exactamente igual que lo que muestra el sitio. */
const datos = new Function(
  leer("js", "datos.js") + "\n" + leer("js", "comun.js") + "\n" +
  "return {NEGOCIO,HORARIOS,RESEÑAS,SERVICIOS,NOTAS,GALERIA,FAQ," +
  "TONOS,DIAS_ES,DIAS_EN,esc,waLink,urlInstagram,hora,resumenHorarios," +
  "bloquesDeHorario,estrellasSVG};"
)();

const { NEGOCIO, HORARIOS, RESEÑAS, SERVICIOS, NOTAS, GALERIA, FAQ,
        TONOS, DIAS_EN, esc, waLink, urlInstagram, hora, resumenHorarios,
        bloquesDeHorario, estrellasSVG } = datos;

const pesos = n => "$ " + n.toLocaleString("es-AR");
const valorDe = (item, i) =>
  Object.prototype.hasOwnProperty.call(item, "fijo") ? item.fijo
  : (item.precios ? item.precios[i] : null);


/* ══════════ Piezas de contenido ══════════ */

const escalaMobile = () => TONOS
  .map(t => `<span style="--tono:${t}" data-visto="1"></span>`).join("");

const escalaRail = () => SECCIONES.map((s, i) => `
      <a class="escala-item" href="#${s.id}" data-seccion="${s.id}" style="--tono:${TONOS[i]}">
        <span class="escala-nivel numero">0${i + 1}</span>
        <span class="escala-muestra" aria-hidden="true"></span>
        <span class="escala-nombre">${esc(s.nombre)}</span>
      </a>`).join("");

const panelLista = () => SECCIONES.slice(1).map((s, i) => `
      <li><a href="#${s.id}">
        <span class="m" style="--tono:${TONOS[i + 1]}" aria-hidden="true"></span>
        <span class="n numero">0${i + 2}</span>
        <span class="t">${esc(s.nombre)}</span>
      </a></li>`).join("") + `
      <li><a href="${NOMBRES["precios.html"]}">
        <span class="m" style="--tono:var(--violeta)" aria-hidden="true"></span>
        <span class="n numero">→</span>
        <span class="t">Lista de precios</span>
      </a></li>`;

const pieEscala = () => TONOS.map(t => `<span style="--tono:${t}"></span>`).join("");

function recorte(r){
  return r.recortada ? r.texto.replace(/[\s.]+$/, "") + "…" : r.texto;
}

function muroResenas(){
  const cargadas = RESEÑAS.filter(r => r.texto && r.autor);
  if (!cargadas.length){
    return `
        <div class="sin-datos">
          <p class="condensada">Las reseñas están en Google</p>
          <p>Todavía no elegimos cuáles mostrar acá. Mientras tanto podés leer las
             ${NEGOCIO.cantidadReseñas} completas, con nombre y fecha, en la ficha del salón.</p>
          <a class="boton boton-2" href="${NEGOCIO.fichaGoogle}" target="_blank" rel="noopener">Leer las reseñas en Google</a>
        </div>`;
  }
  return cargadas.map(r => `
        <article class="resena">
          <div class="resena-tapa">
            <span class="estrellas" aria-label="${r.estrellas} de 5 estrellas">${estrellasSVG(r.estrellas)}</span>
            ${r.tema ? `<span class="resena-tema">${esc(r.tema)}</span>` : ""}
          </div>
          <blockquote>${esc(recorte(r))}</blockquote>
          <p class="resena-autor">
            <b>${esc(r.autor)}</b>
            <span>${r.recortada ? "Reseña recortada · " : ""}en Google</span>
          </p>
        </article>`).join("");
}

function galeria(){
  const cargadas = GALERIA.filter(g => g.archivo);
  if (!cargadas.length){
    return `
        <div class="sin-datos">
          <p class="condensada">Los trabajos están en Instagram</p>
          <p>Todavía no subimos fotos a esta galería. En la cuenta del salón hay
             material nuevo casi todas las semanas.</p>
          <a class="boton boton-2" href="${urlInstagram()}" target="_blank" rel="noopener">Ver los trabajos en Instagram</a>
        </div>`;
  }
  const faltantes = [];
  const html = cargadas.map(g => {
    const ruta = path.join(RAIZ, "img", g.archivo);
    const tipo = TIPOS_IMAGEN[path.extname(g.archivo).toLowerCase()];
    let src = "img/" + g.archivo;
    if (!fs.existsSync(ruta) || !tipo) faltantes.push(g.archivo);
    else src = `data:${tipo};base64,${b64("img", g.archivo)}`;
    return `
        <figure class="trabajo">
          <img src="${src}" alt="${esc(g.alt || "")}" width="800" height="1000" decoding="async">
          ${g.etiqueta ? `<figcaption class="trabajo-etiqueta">${esc(g.etiqueta)}</figcaption>` : ""}
        </figure>`;
  }).join("");
  galeria.faltantes = faltantes;
  return html;
}

function tablaHorarios(){
  return [1, 2, 3, 4, 5, 6, 0].map(i => {
    const d = HORARIOS[i];
    const abierto = Boolean(d.abre);
    return `
          <tr>
            <td>${esc(d.dia)}</td>
            <td class="${abierto ? "" : "cerrado"}">${abierto ? hora(d.abre) + " a " + hora(d.cierra) : "Cerrado"}</td>
          </tr>`;
  }).join("");
}

function faq(){
  return FAQ.filter(f => f.respuesta).map((f, i) => `
      <details${i === 0 ? " open" : ""}>
        <summary>${esc(f.pregunta)}</summary>
        <p>${esc(f.respuesta)}</p>
      </details>`).join("");
}

/* La lista de precios con los cuatro largos escritos. El selector se resuelve
   después con CSS: se muestra la columna del largo elegido. */
function listadoPrecios(){
  return SERVICIOS.map(g => `
      <section class="grupo">
        <div class="grupo-tapa">
          <h2>${esc(g.grupo)}</h2>
          <span class="grupo-cuenta numero">${g.items.length} servicios</span>
        </div>
        ${g.items.map(it => {
          const esFijo = Object.prototype.hasOwnProperty.call(it, "fijo");
          const detalle = [it.detalle, esFijo && it.fijo !== null ? "precio único" : ""]
            .filter(Boolean).join(" · ");
          const valores = LARGOS.map((_, i) => {
            const v = valorDe(it, i);
            return `<div class="valor${v === null ? " pendiente" : ""}" data-l="${i}">${v === null ? "a consultar" : pesos(v)}</div>`;
          }).join("");
          return `
        <div class="fila">
          <div class="nombre">
            <b>${esc(it.nombre)}</b>
            ${detalle ? `<em>${esc(detalle)}</em>` : ""}
          </div>
          ${valores}
        </div>`;
        }).join("")}
      </section>`).join("");
}

function matrizPrecios(){
  return SERVICIOS.map(g => `
      <table>
        <caption>${esc(g.grupo)}</caption>
        <thead>
          <tr><th scope="col">Servicio</th>${LARGOS.map(l => `<th scope="col">${l.nombre}</th>`).join("")}</tr>
        </thead>
        <tbody>
          ${g.items.map(it => `<tr>
            <th scope="row" style="font-weight:400">${esc(it.nombre)}</th>
            ${LARGOS.map((_, i) => {
              const v = valorDe(it, i);
              return `<td>${v === null ? "a consultar" : pesos(v)}</td>`;
            }).join("")}
          </tr>`).join("")}
        </tbody>
      </table>`).join("");
}

function selectorLargos(){
  return LARGOS.map((l, i) => `
        <label class="largo" for="largo-${i}" style="--tono:${TONOS[i * 2 + 1]}">
          <span class="marca-largo" aria-hidden="true"></span>
          <b>${l.nombre}</b>
          <small>${l.nota}</small>
        </label>`).join("");
}

function contarPendientes(){
  let total = 0;
  SERVICIOS.forEach(g => g.items.forEach(it => {
    if (Object.prototype.hasOwnProperty.call(it, "fijo")) { if (it.fijo === null) total++; }
    else LARGOS.forEach((_, i) => { if (valorDe(it, i) === null) total++; });
  }));
  return total;
}

function datosEstructurados(){
  return JSON.stringify({
    "@context": "https://schema.org",
    "@type": "HairSalon",
    name: NEGOCIO.nombre,
    description: "Peluquería de diseño en Caballito. Corte, color, balayage y tratamientos, con turno previo.",
    url: NEGOCIO.sitio,
    telephone: "+" + NEGOCIO.whatsapp,
    address: {
      "@type": "PostalAddress",
      streetAddress: NEGOCIO.calle, addressLocality: NEGOCIO.ciudad,
      postalCode: NEGOCIO.codigoPostal, addressRegion: "CABA", addressCountry: "AR",
    },
    geo: { "@type": "GeoCoordinates", latitude: NEGOCIO.lat, longitude: NEGOCIO.lng },
    openingHoursSpecification: bloquesDeHorario().map(b => ({
      "@type": "OpeningHoursSpecification",
      dayOfWeek: b.dias.map(i => DIAS_EN[i]), opens: b.abre, closes: b.cierra,
    })),
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: NEGOCIO.puntaje.replace(",", "."),
      reviewCount: NEGOCIO.cantidadReseñas, bestRating: 5, worstRating: 1,
    },
    sameAs: [NEGOCIO.fichaGoogle, urlInstagram()],
  });
}


/* ══════════ CSS extra: las interacciones sin JavaScript ══════════ */

const cssSinJs = `
/* ══════════════════════════════════════════════════════════════════════════
   INTERACCIONES SIN JAVASCRIPT
   Este bloque lo agrega herramientas/armar-archivo-unico.mjs y existe solo en
   los archivos de para-enviar/. Los visores de archivos del celular no
   ejecutan JavaScript, así que el selector de largo y el menú se resuelven
   con radios y un checkbox escondidos.
   ══════════════════════════════════════════════════════════════════════════ */

.sel-largo,.sel-panel{position:absolute;width:1px;height:1px;opacity:0;pointer-events:none}

.fila .valor[data-l]{display:none}
${LARGOS.map((_, i) => `#largo-${i}:checked ~ .contenedor .valor[data-l="${i}"]`).join(",\n")}{display:block}

label.largo{display:block}

${LARGOS.map((_, i) => `#largo-${i}:checked ~ .contenedor .largo[for="largo-${i}"]`).join(",\n")}{
  background:var(--noche);border-color:var(--noche);color:var(--crema);
}
${LARGOS.map((_, i) => `#largo-${i}:checked ~ .contenedor .largo[for="largo-${i}"] small`).join(",\n")}{color:var(--crema-suave)}
${LARGOS.map((_, i) => `#largo-${i}:checked ~ .contenedor .largo[for="largo-${i}"] .marca-largo`).join(",\n")}{opacity:1}

${LARGOS.map((_, i) => `#largo-${i}:focus-visible ~ .contenedor .largo[for="largo-${i}"]`).join(",\n")}{
  outline:2px solid var(--accion);outline-offset:3px;
}

.sel-panel:checked ~ .panel{transform:none;visibility:visible}
.sel-panel:focus-visible ~ .barra .abrir-menu{outline:2px solid var(--accion);outline-offset:3px}
`;


/* ══════════ Armado ══════════ */

function inlineDeCss(){
  let css = leer("css", "estilo.css");
  for (const f of ["archivo-var-latin.woff2", "newsreader-var-latin.woff2"]){
    css = css.replace(`url("../fonts/${f}") format("woff2")`,
                      `url("data:font/woff2;base64,${b64("fonts", f)}") format("woff2")`);
  }
  if (!css.includes("data:font/woff2")) throw new Error("no pude incrustar las tipografías");
  return css + "\n" + cssSinJs;
}

function comun(html, css, favicon){
  html = html.replace(/<link rel="preload" href="fonts\/[^"]+"[^>]*>\n?/g, "");
  html = html.replace('<link rel="stylesheet" href="css/estilo.css">', "<style>\n" + css + "\n</style>");
  html = html.replace('<link rel="icon" href="img/favicon.svg" type="image/svg+xml">',
                      `<link rel="icon" href="${favicon}" type="image/svg+xml">`);
  html = html.replace(/<link rel="apple-touch-icon"[^>]*>\n?/g, "");
  html = html.replace(/\s*<script src="js\/[^"]+"><\/script>/g, "");

  /* Los links quedan resueltos: sin JavaScript nadie les pone el href.
     Ojo: algunos <a> traen data-wa y NINGÚN href (las tarjetas de servicio),
     así que hay que reescribir la etiqueta entera, no reemplazar un href="#". */
  html = html.replace(/<a\b([^>]*)>/g, (etiqueta, atributos) => {
    const wa = atributos.match(/data-wa="([^"]*)"/);
    let destino = null;
    if (wa)                                 destino = waLink(wa[1]);
    else if (/\bdata-ficha\b/.test(atributos))  destino = NEGOCIO.fichaGoogle;
    else if (/\bdata-ig\b/.test(atributos))     destino = urlInstagram();
    if (!destino) return etiqueta;
    const limpio = atributos.replace(/\s*href="[^"]*"/, "").replace(/\s*(target|rel)="[^"]*"/g, "");
    return `<a${limpio} href="${destino}" target="_blank" rel="noopener">`;
  });

  // Y los datos del negocio quedan escritos
  const valores = { ...NEGOCIO,
    resumenHorarios: resumenHorarios(),
    "cantidadReseñas": NEGOCIO.cantidadReseñas.toLocaleString("es-AR") };
  html = html.replace(/<(\w+)([^>]*?)data-dato="([^"]+)"([^>]*)><\/\1>/g,
    (m, tag, a, clave, c) => valores[clave] === undefined
      ? m : `<${tag}${a}${c}>${esc(valores[clave])}</${tag}>`);

  return html;
}

function armarHome(css, favicon){
  let h = leer("index.html");

  h = h.replace('<div class="escala-mobile" id="escalaMobile" aria-hidden="true"></div>',
                `<div class="escala-mobile" aria-hidden="true">${escalaMobile()}</div>`);
  h = h.replace('<nav class="escala" id="escala" data-fondo="oscuro" aria-label="Índice del sitio"></nav>',
                `<nav class="escala" data-fondo="oscuro" aria-label="Índice del sitio">${escalaRail()}</nav>`);
  h = h.replace('<ul class="panel-lista" id="panelLista"></ul>',
                `<ul class="panel-lista">${panelLista()}</ul>`);
  h = h.replace('<div class="muro" id="muroResenas"></div>',
                `<div class="muro">${muroResenas()}</div>`);
  h = h.replace('<div class="galeria" id="galeria"></div>',
                `<div class="galeria">${galeria()}</div>`);
  h = h.replace('<tbody id="tablaHorarios"></tbody>',
                `<tbody>${tablaHorarios()}</tbody>`);
  h = h.replace('<div class="faq" id="faq"></div>', `<div class="faq">${faq()}</div>`);
  h = h.replace('<p class="pie-escala" id="pieEscala" aria-hidden="true"></p>',
                `<p class="pie-escala" aria-hidden="true">${pieEscala()}</p>`);
  h = h.replace(/<span class="estrellas" id="estrellasHero"([^>]*)><\/span>/,
                `<span class="estrellas"$1>${estrellasSVG(5)}</span>`);
  h = h.replace(/<span class="estrellas" id="estrellasBadge"([^>]*)><\/span>/,
                `<span class="estrellas"$1>${estrellasSVG(5)}</span>`);

  // El cartel de "abierto ahora" depende del reloj: en un archivo congelado
  // mentiría, así que se saca y queda la tabla de horarios, que es un hecho.
  h = h.replace(/\s*<p class="estado" id="estado"[\s\S]*?<\/p>\n/, "\n");

  // El menú, con un checkbox en lugar de JavaScript
  /* La barra va con fondo fijo. En el sitio, el JavaScript se lo pone recién
     al scrollear; acá no hay JavaScript, y si queda transparente el texto
     crema se vuelve ilegible al pasar sobre las secciones de fondo claro. */
  h = h.replace('<header class="barra" id="barra">',
                '<input class="sel-panel" type="checkbox" id="abrir-panel" aria-label="Abrir el menú">\n<header class="barra" data-fijo="1">');
  h = h.replace(/<button class="abrir-menu" id="abrirMenu"[^>]*>Menú<\/button>/,
                '<label class="abrir-menu" for="abrir-panel">Menú</label>');
  h = h.replace('<div class="panel" id="panel" data-abierto="0">', '<div class="panel">');
  h = h.replace('<button class="abrir-menu" id="cerrarMenu">Cerrar</button>',
                '<label class="abrir-menu" for="abrir-panel">Cerrar</label>');

  // El mapa se abre en Google Maps: el iframe necesitaba JavaScript
  h = h.replace(/<button class="boton boton-2" id="verMapa"[^>]*>[^<]*<\/button>/,
    `<a class="boton boton-2" href="${NEGOCIO.fichaGoogle}" target="_blank" rel="noopener" style="margin-top:.5rem">Abrir el mapa</a>`);
  h = h.replace(/<a class="condensada enlace-mapa"[\s\S]*?<\/a>/, "");

  // El botón fijo de WhatsApp aparecía al scrollear; acá va siempre visible
  h = h.replace('<body>', '<body data-sticky="1">');
  h = h.replace('<div class="sticky" id="sticky" data-visible="0">', '<div class="sticky" data-visible="1">');

  h = h.replace('<script type="application/ld+json" id="ld-negocio"></script>',
                `<script type="application/ld+json">${datosEstructurados()}</script>`);
  h = h.replace(/<script type="application\/ld\+json" id="ld-faq"><\/script>\n?/, "");

  return comun(h, css, favicon);
}

function armarPrecios(css, favicon){
  let h = leer("precios.html");

  // Sin JavaScript no hace falta esconder el cuerpo mientras se arma la lista
  h = h.replace(/<!-- La lista de precios la arma el JavaScript[\s\S]*?<\/noscript>\n?/, "");
  h = h.replace(/\s*<span class="estado" id="estado"[\s\S]*?<\/span>\n/, "\n");

  h = h.replace('<main class="seccion claro" style="padding-top:var(--e5)">',
    '<main class="seccion claro" style="padding-top:var(--e5)">\n' +
    LARGOS.map((_, i) =>
      `  <input class="sel-largo" type="radio" name="largo" id="largo-${i}"${i === 1 ? " checked" : ""} aria-label="${LARGOS[i].nombre}">`
    ).join("\n"));

  h = h.replace('<div class="largos" id="largos" role="group" aria-label="Largo del cabello"></div>',
                `<div class="largos" role="group" aria-label="Largo del cabello">${selectorLargos()}</div>`);
  h = h.replace('<div class="listado" id="listado" tabindex="-1"></div>',
                `<div class="listado" tabindex="-1">${listadoPrecios()}</div>`);
  h = h.replace('<div class="matriz" id="matriz" aria-hidden="true"></div>',
                `<div class="matriz" aria-hidden="true">${matrizPrecios()}</div>`);
  h = h.replace('<ul class="notas" id="notas"></ul>',
                `<ul class="notas">${NOTAS.map(n => `<li>${esc(n)}</li>`).join("")}</ul>`);

  const pendientes = contarPendientes();
  h = h.replace('<div id="avisoPrecios"></div>', pendientes === 0 ? "" : `<p class="aviso">
      <b>Faltan cargar ${pendientes} precios.</b> Abrí el archivo <code>js/datos.js</code> con cualquier
      editor de texto, buscá el bloque <b>4) SERVICIOS Y PRECIOS</b> y reemplazá cada <code>null</code>
      por el número, sin signo peso y sin puntos. Después volvé a correr
      <code>node herramientas/armar-archivo-unico.mjs</code>.
    </p>`);

  // El botón de guardar en PDF llamaba a JavaScript; se usa el del navegador
  h = h.replace(/<button class="imprimir" id="imprimir"[^>]*>[^<]*<\/button>\n?/, "");

  return comun(h, css, favicon);
}


/* ══════════ Main ══════════ */

console.log("\nArmando los archivos únicos de Pelo's Design\n");

const css = inlineDeCss();
const favicon = "data:image/svg+xml;base64," + b64("img", "favicon.svg");

fs.mkdirSync(SALIDA, { recursive: true });

for (const [origen, destino] of Object.entries(NOMBRES)){
  let html = origen === "index.html" ? armarHome(css, favicon) : armarPrecios(css, favicon);
  for (const [a, b] of Object.entries(NOMBRES)) html = html.replaceAll(`href="${a}"`, `href="${b}"`);

  const ruta = path.join(SALIDA, destino);
  fs.writeFileSync(ruta, html, "utf8");
  console.log(`   ${destino.padEnd(38)} ${kb(fs.statSync(ruta).size).padStart(9)}`);

  const sueltos = [...html.matchAll(/(?:src|href)="(?!data:|http|#|mailto)([^"]+)"/g)].map(m => m[1]);
  const externos = [...new Set(sueltos)].filter(u => !Object.values(NOMBRES).includes(u));
  if (externos.length) console.log("      referencias que quedaron afuera:", externos.join(", "));
}

if (galeria.faltantes?.length){
  console.log("\nOjo: estas fotos están anotadas en datos.js pero no están en img/");
  galeria.faltantes.forEach(f => console.log("   ·", f));
}

console.log(`\nListo. Los dos archivos están en:  ${SALIDA}`);
console.log("Guardalos en la misma carpeta: el botón de la lista de precios salta");
console.log("de uno al otro.\n");
