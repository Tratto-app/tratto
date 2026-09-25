/**
 * Sitio público de la barbería.
 *
 * Existe por dos razones concretas, además de ser útil por sí mismo:
 *
 *  - Meta pide un sitio web del negocio para verificarlo.
 *  - Para publicar la app hace falta una URL de política de privacidad, y sin
 *    la app publicada el bot no recibe mensajes.
 *
 * Se genera desde `config/negocio.json`, asi que cambiar un precio en el panel
 * lo cambia también acá. No hay contenido duplicado en ningún lado.
 */
import type { ConfigNegocio } from '../config/negocio.js';
import { serviciosActivos } from '../config/negocio.js';
import { describirHorarios } from '../booking/disponibilidad.js';
import { formatearPrecio, normalizarTelefono, telefonoParecePlausible } from '../shared/texto.js';
import { logoSvg } from './logo.js';

/** Escapa todo lo que sale de la configuración: nada llega crudo al HTML. */
function esc(texto: string): string {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Un valor sin completar no se muestra: mejor vacío que "PLACEHOLDER - ...". */
function cargado(valor: string | undefined | null): string {
  if (!valor || valor.includes('PLACEHOLDER')) return '';
  return valor.trim();
}

function enlaceSeguro(url: string): string {
  const limpio = cargado(url);
  return /^https?:\/\//i.test(limpio) ? limpio : '';
}

function armar(titulo: string, descripcion: string, cuerpo: string, extra = ''): string {
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(titulo)}</title>
<meta name="description" content="${esc(descripcion)}">
<meta name="theme-color" content="#14110f">
<link rel="icon" href="/favicon.svg">
<link rel="preload" href="/fuentes/cinzel.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/sitio.css">
${extra}</head>
<body>
${cuerpo}
</body>
</html>`;
}

/** "Panamá 7442, Martín Coronado" → "Martín Coronado". Para el arco de abajo del logo. */
function localidad(direccion: string): string {
  const partes = direccion.split(',').map((p) => p.trim()).filter(Boolean);
  return partes.length > 1 ? partes[partes.length - 1]! : '';
}

const ICONOS = {
  whatsapp:
    '<svg class="icono" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.1l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.3-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6a2.7 2.7 0 0 0 1.8-1.3 2.2 2.2 0 0 0 .1-1.3c0-.1-.2-.2-.5-.3Z"/></svg>',
  reloj:
    '<svg class="icono" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M12 7v5l3.2 2" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
  billete:
    '<svg class="icono" viewBox="0 0 24 24" aria-hidden="true"><rect x="2.5" y="6" width="19" height="12" rx="2" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="12" cy="12" r="2.6" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>',
  pin:
    '<svg class="icono" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11Z" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="12" cy="10" r="2.3" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>',
};

export function paginaInicio(cfg: ConfigNegocio, opciones: { urlBase?: string } = {}): string {
  const n = cfg.negocio;
  const nombre = cargado(n.nombre) || 'Barbería';
  const direccion = cargado(n.direccion);
  const comoLlegar = cargado(n.como_llegar);
  const telefono = cargado(n.telefono);
  const instagram = cargado(n.instagram);
  const maps = enlaceSeguro(n.maps);
  const barrio = localidad(direccion);
  const pagos = n.medios_de_pago.filter((m) => cargado(m));

  const whatsapp = normalizarTelefono(telefono, { codigoPais: n.codigo_pais });
  const linkWhatsApp = telefonoParecePlausible(whatsapp)
    ? `https://wa.me/${whatsapp}?text=${encodeURIComponent('¡Hola! Quiero sacar un turno')}`
    : '';
  const botonTurno = (clase: string, texto = 'Sacar turno por WhatsApp') =>
    linkWhatsApp ? `<a class="${clase}" href="${esc(linkWhatsApp)}" target="_blank" rel="noopener">${ICONOS.whatsapp}<span>${texto}</span></a>` : '';

  const logo = logoSvg({ arriba: nombre, abajo: barrio || 'Barbería', titulo: `Logo de ${nombre}`, clase: 'logo' });

  const servicios = serviciosActivos(cfg)
    .map(
      (s) => `      <li class="servicio">
        <h3>${esc(s.nombre)}</h3>
        ${s.descripcion ? `<p>${esc(s.descripcion)}</p>` : ''}
        <span class="precio">${esc(formatearPrecio(s.precio, n.moneda))}</span>
      </li>`,
    )
    .join('\n');

  const horarios = describirHorarios(cfg)
    .split('\n')
    .map((linea) => {
      const corte = linea.indexOf(': ');
      const dias = corte > 0 ? linea.slice(0, corte) : linea;
      const horas = corte > 0 ? linea.slice(corte + 2) : '';
      const cerrado = /cerrado/i.test(horas);
      return `      <li${cerrado ? ' class="cerrado"' : ''}><span>${esc(dias[0]!.toUpperCase() + dias.slice(1))}</span><span>${esc(horas.replace(/ y /g, ' · '))}</span></li>`;
    })
    .join('\n');

  const destacados = [
    `<li>${ICONOS.reloj}<div><b>Turnos al instante</b><span>Reservá, cambiá o cancelá por WhatsApp, a cualquier hora.</span></div></li>`,
    pagos.length
      ? `<li>${ICONOS.billete}<div><b>${esc(pagos.map((p, i) => (i === 0 ? p[0]!.toUpperCase() + p.slice(1) : p)).join(' o '))}</b><span>Medios de pago aceptados.</span></div></li>`
      : '',
    direccion
      ? `<li>${ICONOS.pin}<div><b>${esc(barrio || direccion)}</b><span>${esc(direccion)}</span></div></li>`
      : '',
  ]
    .filter(Boolean)
    .join('\n      ');

  const ubicacion = direccion
    ? `<section class="bloque ubicacion">
      <h2>Dónde estamos</h2>
      <p class="direccion">${maps ? `<a href="${esc(maps)}" target="_blank" rel="noopener">${esc(direccion)}</a>` : esc(direccion)}</p>
      ${comoLlegar ? `<p class="tenue">${esc(comoLlegar)}</p>` : ''}
      ${maps ? `<a class="boton-secundario" href="${esc(maps)}" target="_blank" rel="noopener">${ICONOS.pin}<span>Cómo llegar</span></a>` : ''}
      ${telefono || instagram ? `<ul class="contacto">${telefono ? `<li>WhatsApp: ${esc(telefono)}</li>` : ''}${instagram ? `<li>Instagram: ${esc(instagram)}</li>` : ''}</ul>` : ''}
    </section>`
    : '';

  const cuerpo = `<header class="portada">
  <div class="portada-contenido">
    ${logo}
    <h1>${esc(nombre)}</h1>
    <p class="bajada">Cortes de pelo y barba${barrio ? ` en ${esc(barrio)}` : ''}</p>
    <div class="acciones">
      ${botonTurno('boton-turno')}
      ${maps ? `<a class="boton-secundario" href="${esc(maps)}" target="_blank" rel="noopener">${ICONOS.pin}<span>Cómo llegar</span></a>` : ''}
    </div>
  </div>
</header>

<main class="sitio">
  ${destacados ? `<ul class="destacados">
      ${destacados}
  </ul>` : ''}

  <section class="bloque">
    <h2>Servicios</h2>
    <ul class="servicios">
${servicios}
    </ul>
    ${serviciosActivos(cfg).some((s) => s.precio <= 0) ? '<p class="tenue">Los precios marcados «a confirmar» los confirmamos por WhatsApp.</p>' : ''}
  </section>

  <div class="dos-columnas">
    <section class="bloque">
      <h2>Horarios</h2>
      <ul class="horarios">
${horarios}
      </ul>
    </section>
    ${ubicacion}
  </div>

  <section class="bloque pasos">
    <h2>Cómo sacar turno</h2>
    <ol>
      <li><b>Escribinos por WhatsApp.</b> Te atiende nuestro asistente, sin esperas.</li>
      <li><b>Elegí servicio, día y horario.</b> Solo te ofrece horarios que están libres de verdad.</li>
      <li><b>Listo.</b> Te llega la confirmación con todos los datos y un recordatorio el día anterior.</li>
    </ol>
    ${cfg.reglas.politica_cancelacion ? `<p class="tenue">${esc(cfg.reglas.politica_cancelacion)}</p>` : ''}
  </section>

  ${linkWhatsApp ? `<section class="llamado">
    <p>¿Te toca el corte?</p>
    ${botonTurno('boton-turno')}
  </section>` : ''}
</main>

<footer class="pie">
  ${logoSvg({ arriba: nombre, abajo: barrio || 'Barbería', titulo: nombre, clase: 'logo-pie' })}
  <p>${esc(nombre)}${direccion ? ` · ${esc(direccion)}` : ''}</p>
  <p><a href="/privacidad">Política de privacidad</a></p>
</footer>

${botonTurno('whatsapp-flotante', 'Turnos')}`;

  const descripcion = `${nombre}${direccion ? ` — ${direccion}` : ''}. Cortes de pelo y barba. Turnos por WhatsApp.`;
  const base = (opciones.urlBase ?? '').replace(/\/+$/, '');
  const social = base
    ? `<meta property="og:type" content="website">
<meta property="og:title" content="${esc(nombre)}">
<meta property="og:description" content="${esc(descripcion)}">
<meta property="og:image" content="${esc(`${base}/logo.png`)}">
<meta property="og:url" content="${esc(`${base}/`)}">
`
    : '';
  return armar(nombre, descripcion, cuerpo, social);
}

export function paginaPrivacidad(cfg: ConfigNegocio): string {
  const n = cfg.negocio;
  const nombre = cargado(n.nombre) || 'la barbería';
  const contacto = cargado(n.telefono);
  const dias = cfg.cierre_semanal.conservar_dias;
  const retencion =
    dias === 0
      ? 'Los turnos que ya pasaron se borran una vez por semana.'
      : `Los turnos que ya pasaron se borran a los ${dias} días.`;

  const cuerpo = `<main class="sitio texto">
  <header>
    <p class="volver"><a href="/">← Volver a ${esc(nombre)}</a></p>
    <h1>Política de privacidad</h1>
    <p class="tenue">Cómo tratamos los datos de quienes sacan turno por WhatsApp.</p>
  </header>

  <h2>Qué datos guardamos</h2>
  <ul>
    <li><b>Tu número de WhatsApp.</b> Es con lo que te identificamos y te respondemos.</li>
    <li><b>Tu nombre</b>, el que nos decís al reservar.</li>
    <li><b>Tus turnos:</b> fecha, hora, servicio y precio.</li>
    <li><b>Los mensajes recientes</b> de la conversación, para no volver a preguntarte lo que ya dijiste.</li>
  </ul>
  <p>No pedimos ni guardamos documento, dirección, correo ni datos de pago.</p>

  <h2>Para qué los usamos</h2>
  <ul>
    <li>Reservar, consultar, cambiar y cancelar tus turnos.</li>
    <li>Recordarte tu turno antes de que llegue.</li>
    <li>Reconocerte cuando volvés, para no pedirte el nombre de nuevo.</li>
  </ul>
  <p>No usamos tus datos para publicidad ni los vendemos a nadie.</p>

  <h2>Con quién los compartimos</h2>
  <p>Solo con los servicios que hacen funcionar el sistema:</p>
  <ul>
    <li><b>WhatsApp (Meta)</b>, por donde viajan los mensajes.</li>
    <li><b>Google Sheets</b>, donde ${esc(nombre)} lleva su agenda.</li>
    <li><b>El proveedor de inteligencia artificial</b> que interpreta los mensajes para poder responderte.</li>
  </ul>

  <h2>Cuánto tiempo los guardamos</h2>
  <p>${esc(retencion)} Tu nombre y tu número quedan guardados mientras seas cliente, para reconocerte cuando vuelvas.</p>

  <h2>Reseñas y descuentos</h2>
  <p>Si te pedimos una opinión en Google, la reseña es tuya y la dejás en Google con tu propia cuenta: nosotros no la vemos ni podemos verificarla. El descuento se carga cuando nos avisás que la dejaste.</p>

  <h2>Tus derechos</h2>
  <p>Podés pedirnos en cualquier momento que te digamos qué datos tuyos tenemos, que los corrijamos o que los borremos. Escribinos por WhatsApp${contacto ? ` al ${esc(contacto)}` : ''} y lo resolvemos.</p>

  <h2>Cambios</h2>
  <p>Si cambiamos algo de esta política, lo vas a ver publicado en esta misma página.</p>

  <footer>
    <p><a href="/">Volver a ${esc(nombre)}</a></p>
  </footer>
</main>`;

  return armar(`Política de privacidad — ${nombre}`, `Cómo ${nombre} trata los datos de sus clientes.`, cuerpo);
}
