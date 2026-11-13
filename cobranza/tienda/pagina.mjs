// Arma las páginas de la tienda: el catálogo, la página de venta de cada app
// y la de "gracias", que al volver de Mercado Pago confirma el pago y abre la app.
import { ICONOS } from '../web/app.js';

// Nombre de la tienda y contacto de ayuda: cambiarlos acá antes de publicar.
export const TIENDA = { nombre: 'Apps al día', contacto: 'ommelenicki@gmail.com' };

const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pesos = (n) => `$\u00a0${Number(n).toLocaleString('es-AR')}`;   // con espacio que no corta: "$" y el número van juntos
const logo = (rubro) => `<span class="logo" aria-hidden="true"><svg viewBox="0 0 24 24">${ICONOS[`r-${rubro.id}`]}</svg></span>`;
// Blanco o casi negro, el que se lea mejor sobre el color de la app.
function sobre(color) {
  const n = parseInt(color.slice(1), 16);
  const [r, g, b] = [n >> 16, (n >> 8) & 255, n & 255].map((v) => { const x = v / 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.42 ? '#12151c' : '#ffffff';
}
function documento({ titulo, descripcion, css, cuerpo, color = '#1f5fbf', fragmento = false }) {
  // Sin <html> ni <head>: para publicar la página como vista previa compartible.
  if (fragmento) return `<title>${esc(titulo.split(':')[0])}</title>\n<meta name="claude:viewport-fit-sides" content="cover">\n<style>${css}:root{--marca:${color};--sobre-marca:${sobre(color)}}</style>\n${cuerpo}\n`;
  return `<!doctype html>
<html lang="es-AR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(titulo)}</title>
<meta name="description" content="${esc(descripcion)}">
<meta name="theme-color" content="${color}">
<meta property="og:title" content="${esc(titulo)}">
<meta property="og:description" content="${esc(descripcion)}">
<style>${css}:root{--marca:${color};--sobre-marca:${sobre(color)}}</style>
</head>
<body>
${cuerpo}
</body>
</html>
`;
}
const pie = () => `<footer><div class="ancho"><span>${esc(TIENDA.nombre)} · Apps simples para negocios chicos de Argentina</span>${TIENDA.contacto ? `<span>Ayuda: ${esc(TIENDA.contacto)}</span>` : ''}</div></footer>`;

export function paginaApp(rubro, css, fragmento = false) {
  const v = rubro.venta;
  const nombre = rubro.titulo || rubro.nombre;
  const comprar = `/api/comprar?app=${rubro.id}`;
  const preguntas = [
    ['¿Cómo la recibo?', 'Pagás con Mercado Pago y la app se abre en el momento. Te queda un link para volver a entrar o para abrirla en otro celular.'],
    ['¿Hay que pagar todos los meses?', 'No. Se paga una sola vez.'],
    ['¿Los mensajes salen solos?', 'No. La app arma el mensaje y vos lo mandás desde tu WhatsApp con un toque. Sale de tu número y no te cuesta nada.'],
    ['¿Dónde quedan mis datos?', 'En tu celular. No los ve nadie más. La app te recuerda guardar una copia para no perderlos si cambiás de celular.'],
    ['¿Anda en iPhone y en Android?', 'Sí. Se abre en el navegador y se deja como ícono en la pantalla de inicio. No hay que bajar nada.'],
    ['¿Y si necesito ayuda?', `Escribinos a ${TIENDA.contacto} y te damos una mano.`],
  ];
  const cuerpo = `<header class="barra"><div class="ancho">
  <a class="marca" href="/">${logo(rubro)}<span>${esc(nombre)}</span></a>
  <a class="btn pri chico" href="${comprar}">Comprar · ${pesos(rubro.precio)}</a>
</div></header>
<main>
<section class="hero"><div class="ancho">
  <div class="hero-texto">
    <p class="eti">${esc(v.para)}</p>
    <h1>${esc(v.titular)}</h1>
    <p class="bajada">${esc(v.bajada)}</p>
    <div class="cta"><a class="btn pri grande" href="${comprar}">Comprar por ${pesos(rubro.precio)}</a><a class="enlace" href="#demo">Probar la demo</a></div>
    <ul class="sellos"><li>Pago único</li><li>Sin cuota mensual</li><li>Se abre al instante</li></ul>
  </div>
  <div id="demo">
    <div class="telefono"><iframe src="demo.html" title="Demo de ${esc(nombre)}" loading="lazy"></iframe></div>
    <p class="telefono-pie">Es la app de verdad con datos de ejemplo. Tocá lo que quieras.</p>
  </div>
</div></section>
<section class="bloque"><div class="ancho">
  <h2>Lo que hoy hacés con un cuaderno y WhatsApp, en un solo lugar</h2>
  <div class="puntos">${v.puntos.map(([t, d]) => `<div><div class="marca-punto"></div><h3>${esc(t)}</h3><p>${esc(d)}</p></div>`).join('')}</div>
</div></section>
<section class="bloque"><div class="ancho">
  <h2>La tenés andando en cinco minutos</h2>
  <ol class="pasos">
    <li><strong>Pagás con Mercado Pago</strong><span>Con tarjeta o con la plata de tu cuenta.</span></li>
    <li><strong>La app se abre al instante</strong><span>Sin esperar a que nadie te mande nada.</span></li>
    <li><strong>Cargás tus ${esc(v.quienes)}</strong><span>A mano o pegando la lista que ya tenés.</span></li>
  </ol>
</div></section>
<section class="bloque"><div class="ancho">
  <h2>Preguntas</h2>
  <div class="preguntas">${preguntas.map(([p, r]) => `<details><summary>${esc(p)}</summary><p>${esc(r)}</p></details>`).join('')}</div>
</div></section>
<section class="cierre"><div class="ancho">
  <h2>${esc(nombre)}, por ${pesos(rubro.precio)} una sola vez</h2>
  <p>Sin cuota mensual. La pagás hoy y queda en tu celular.</p>
  <a class="btn grande" href="${comprar}">Comprar ahora</a>
</div></section>
</main>
${pie()}`;
  return documento({ titulo: `${nombre}: ${v.titular}`, descripcion: v.bajada, css, cuerpo, color: rubro.color, fragmento });
}

export function paginaInicio(rubros, css) {
  const cuerpo = `<header class="barra"><div class="ancho"><a class="marca" href="/"><span>${esc(TIENDA.nombre)}</span></a></div></header>
<main>
<section class="bloque"><div class="ancho">
  <div style="display:grid;gap:14px"><p class="eti">Pago único · Sin cuota mensual</p>
  <h1 style="font-size:clamp(2.2rem,6vw,3.6rem);font-weight:800">Apps simples para cobrar y no perder clientes</h1>
  <p class="bajada" style="font-size:1.12rem;color:var(--tenue);max-width:36em">Cada una resuelve una sola cosa, se usa desde el celular y manda los avisos desde tu propio WhatsApp.</p></div>
  <div class="catalogo">${rubros.map((r) => `<a class="ficha" style="--marca:${r.color};--sobre-marca:${sobre(r.color)}" href="/${r.archivo}/">
    ${logo(r)}<div><p class="tenue" style="font-size:.88rem;font-weight:700">${esc(r.venta.para)}</p><h2>${esc(r.titulo || r.nombre)}</h2></div>
    <p class="tenue">${esc(r.venta.titular)}.</p><div style="display:flex;justify-content:space-between;align-items:center;gap:12px"><span class="precio">${pesos(r.precio)}</span><span class="ir">Ver la app →</span></div></a>`).join('')}</div>
</div></section>
</main>
${pie()}`;
  return documento({ titulo: `${TIENDA.nombre}: apps simples para negocios chicos`, descripcion: 'Apps de pago único para cobrar cuotas, llevar el fiado y que tus clientes vuelvan.', css, cuerpo });
}

// Página a la que vuelve el comprador desde Mercado Pago. Confirma el pago,
// guarda la licencia en ese celular y le deja el link para otros dispositivos.
export function paginaGracias(rubros, css) {
  const apps = Object.fromEntries(rubros.map((r) => [r.id, { nombre: r.titulo || r.nombre, archivo: r.archivo, color: r.color, sobre: sobre(r.color) }]));
  const cuerpo = `<main class="aviso" id="caja" aria-live="polite"><h1>Confirmando tu pago…</h1><p class="tenue">Un segundo.</p></main>
<script>
(() => {
  const APPS = ${JSON.stringify(apps)};
  const q = new URLSearchParams(location.search);
  const id = q.get('app'), app = APPS[id];
  const caja = document.getElementById('caja');
  const el = (etiqueta, props = {}, ...hijos) => { const e = Object.assign(document.createElement(etiqueta), props); e.append(...hijos); return e; };
  if (app) { document.documentElement.style.setProperty('--marca', app.color); document.documentElement.style.setProperty('--sobre-marca', app.sobre); }
  function recuperar(mensaje) {
    const numero = el('input', { id: 'rec-pago', inputMode: 'numeric', placeholder: 'Por ejemplo 1234567890' });
    const mail = el('input', { id: 'rec-mail', type: 'email', placeholder: 'El mail de tu cuenta de Mercado Pago' });
    const form = el('form', { className: 'caja' }, el('label', {}, 'Número de operación de Mercado Pago', numero), el('label', {}, 'Mail con el que pagaste', mail),
      el('button', { className: 'btn pri', type: 'submit', textContent: 'Buscar mi compra' }));
    form.addEventListener('submit', (ev) => { ev.preventDefault(); activar('pago=' + encodeURIComponent(numero.value.replace(/\\D/g, '')) + '&mail=' + encodeURIComponent(mail.value.trim())); });
    caja.replaceChildren(el('h1', { textContent: mensaje.titulo }), el('p', { className: 'tenue', textContent: mensaje.texto }), form);
  }
  async function activar(datos) {
    caja.replaceChildren(el('h1', { textContent: 'Confirmando tu pago…' }), el('p', { className: 'tenue', textContent: 'Un segundo.' }));
    let r;
    try { r = await (await fetch('/api/activar?app=' + encodeURIComponent(id) + '&' + datos)).json(); }
    catch { return recuperar({ titulo: 'No hay conexión', texto: 'Probá de nuevo con los datos de tu compra.' }); }
    if (r.ok) {
      try { localStorage.setItem('microapp:' + id + ':licencia', r.licencia); } catch {}
      const link = location.origin + r.abrir + '?licencia=' + r.licencia;
      const campo = el('input', { id: 'link', value: link, readOnly: true });
      campo.addEventListener('focus', () => campo.select());
      const copiar = el('button', { className: 'btn sec', type: 'button', textContent: 'Copiar el link' });
      copiar.addEventListener('click', async () => { try { await navigator.clipboard.writeText(link); copiar.textContent = 'Copiado'; } catch { campo.focus(); } });
      caja.replaceChildren(el('p', { className: 'eti', textContent: 'Pago confirmado' }), el('h1', { textContent: '¡Listo! ' + app.nombre + ' ya es tuya' }),
        el('a', { className: 'btn pri grande', href: r.abrir, textContent: 'Abrir mi app' }),
        el('div', { className: 'caja' }, el('strong', { textContent: 'Guardá este link' }),
          el('p', { className: 'tenue', textContent: 'Sirve para volver a entrar y para abrir la app en otro celular. Mandátelo por WhatsApp para no perderlo.' }), campo, copiar));
      return;
    }
    if (r.motivo === 'pendiente') return recuperar({ titulo: 'Tu pago todavía se está procesando', texto: 'Cuando Mercado Pago lo apruebe, volvé a esta página o buscá tu compra acá abajo.' });
    recuperar({ titulo: 'No encontramos ese pago', texto: 'Si pagaste, buscá tu compra con el número de operación que te mandó Mercado Pago.' });
  }
  if (!app) return void caja.replaceChildren(el('h1', { textContent: 'Falta saber qué app compraste' }), el('a', { className: 'btn pri', href: '/', textContent: 'Ver las apps' }));
  const pago = q.get('payment_id') || q.get('collection_id') || '';
  if (/^\\d+$/.test(pago)) activar('pago=' + pago + '&ref=' + encodeURIComponent(q.get('external_reference') || ''));
  else recuperar({ titulo: '¿Ya compraste ' + app.nombre + '?', texto: 'Buscá tu compra con el número de operación que te mandó Mercado Pago.' });
})();
</script>`;
  return documento({ titulo: `Tu compra · ${TIENDA.nombre}`, descripcion: 'Confirmación de tu compra.', css, cuerpo });
}
