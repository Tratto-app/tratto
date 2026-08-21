/* ══════════════════════════════════════════════════════════════════════════
   COMÚN — lo que usan las dos páginas (index.html y precios.html)
   No hace falta tocar este archivo para mantener el sitio. Los datos que
   cambian están todos en js/datos.js
   ══════════════════════════════════════════════════════════════════════════ */

/* La escala de tonos del salón. Es la paleta y también el índice del sitio. */
const TONOS = ["#16110F","#2A1D18","#3F2C22","#5A3E2E","#7A553A","#9C744C","#BE9868","#DCC49B"];

const DIAS_ES = ["domingo","lunes","martes","miércoles","jueves","viernes","sábado"];
const DIAS_EN = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];

/* Escapa texto antes de meterlo en el HTML. Sirve para que una reseña con
   comillas o con < > no rompa la página. */
function esc(t){
  return String(t ?? "").replace(/[&<>"']/g, c =>
    ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
}

/* Link de WhatsApp con el mensaje ya escrito */
function waLink(mensaje){
  return "https://wa.me/" + NEGOCIO.whatsapp + "?text=" + encodeURIComponent(mensaje);
}

function urlInstagram(){ return "https://instagram.com/" + NEGOCIO.instagram; }

/* "10:00" → "10"   ·   "17:30" → "17.30" */
function hora(t){
  if (!t) return "";
  const [h, m] = t.split(":");
  return m === "00" ? String(Number(h)) : Number(h) + "." + m;
}

function aMinutos(t){
  const [h, m] = t.split(":");
  return Number(h) * 60 + Number(m);
}

/* Qué hora es en Buenos Aires, sin importar dónde esté quien mira el sitio */
function ahoraEnBuenosAires(){
  const partes = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Argentina/Buenos_Aires",
    weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false
  }).formatToParts(new Date());

  const p = Object.fromEntries(partes.map(x => [x.type, x.value]));
  const semana = { Sun:0, Mon:1, Tue:2, Wed:3, Thu:4, Fri:5, Sat:6 };
  let h = Number(p.hour);
  if (h === 24) h = 0;
  return { dia: semana[p.weekday], minutos: h * 60 + Number(p.minute) };
}

/* Devuelve si está abierto ahora y, si no, cuándo vuelve a abrir */
function estadoAhora(){
  const { dia, minutos } = ahoraEnBuenosAires();
  const hoy = HORARIOS[dia];

  if (hoy && hoy.abre && minutos >= aMinutos(hoy.abre) && minutos < aMinutos(hoy.cierra)){
    return { abierto: true, texto: "Abierto ahora · cerramos " + hora(hoy.cierra) };
  }

  if (hoy && hoy.abre && minutos < aMinutos(hoy.abre)){
    return { abierto: false, texto: "Cerrado · abrimos hoy a las " + hora(hoy.abre) };
  }

  for (let i = 1; i <= 7; i++){
    const d = HORARIOS[(dia + i) % 7];
    if (d && d.abre){
      const cuando = i === 1 ? "mañana" : "el " + DIAS_ES[(dia + i) % 7];
      return { abierto: false, texto: "Cerrado · abrimos " + cuando + " a las " + hora(d.abre) };
    }
  }
  return { abierto: false, texto: "Cerrado" };
}

/* Agrupa los días que comparten horario: sirve para el resumen y para Google */
function bloquesDeHorario(){
  const bloques = [];
  HORARIOS.forEach((d, i) => {
    if (!d.abre) return;
    const clave = d.abre + "-" + d.cierra;
    const ultimo = bloques.find(b => b.clave === clave);
    if (ultimo) ultimo.dias.push(i);
    else bloques.push({ clave, abre: d.abre, cierra: d.cierra, dias: [i] });
  });
  return bloques;
}

/* "Martes, miércoles y viernes de 10 a 17.30 · Sábados de 10 a 16" */
function resumenHorarios(){
  return bloquesDeHorario().map(b => {
    const nombres = b.dias.map(i => DIAS_ES[i]);
    let lista;
    if (nombres.length === 1) lista = nombres[0].charAt(0).toUpperCase() + nombres[0].slice(1) + "s";
    else lista = (nombres.slice(0, -1).join(", ") + " y " + nombres[nombres.length - 1])
                 .replace(/^./, c => c.toUpperCase());
    return lista + " de " + hora(b.abre) + " a " + hora(b.cierra);
  }).join(" · ");
}

function estrellasSVG(cantidad){
  const estrella = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="m12 2 2.9 6.26 6.85.72-5.1 4.6 1.44 6.72L12 16.9 5.91 20.3l1.44-6.72-5.1-4.6 6.85-.72Z"/></svg>';
  return estrella.repeat(cantidad);
}

/* Rellena todos los <span data-dato="..."> y los links marcados con
   data-wa, data-ficha y data-ig. Así los datos viven en un solo lugar. */
function aplicarDatos(){
  const valores = {
    ...NEGOCIO,
    resumenHorarios: resumenHorarios(),
    "cantidadReseñas": NEGOCIO.cantidadReseñas.toLocaleString("es-AR")
  };

  document.querySelectorAll("[data-dato]").forEach(el => {
    const v = valores[el.dataset.dato];
    if (v !== undefined && v !== null) el.textContent = v;
  });

  document.querySelectorAll("[data-wa]").forEach(el => {
    el.href = waLink(el.dataset.wa);
    el.target = "_blank";
    el.rel = "noopener";
  });

  document.querySelectorAll("[data-ficha]").forEach(el => {
    el.href = NEGOCIO.fichaGoogle;
    el.target = "_blank";
  });

  document.querySelectorAll("[data-ig]").forEach(el => {
    el.href = urlInstagram();
    el.target = "_blank";
  });
}

/* El cartel amarillo que solo ve el dueño del salón mientras falte cargar algo */
function aviso(contenedor, html){
  const caja = document.getElementById(contenedor);
  if (caja) caja.innerHTML = '<p class="aviso">' + html + "</p>";
}
