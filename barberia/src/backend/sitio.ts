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

function armar(titulo: string, descripcion: string, cuerpo: string): string {
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(titulo)}</title>
<meta name="description" content="${esc(descripcion)}">
<link rel="icon" href="/favicon.svg">
<link rel="stylesheet" href="/sitio.css">
</head>
<body>
${cuerpo}
</body>
</html>`;
}

export function paginaInicio(cfg: ConfigNegocio): string {
  const n = cfg.negocio;
  const nombre = cargado(n.nombre) || 'Barbería';
  const direccion = cargado(n.direccion);
  const comoLlegar = cargado(n.como_llegar);
  const telefono = cargado(n.telefono);
  const instagram = cargado(n.instagram);
  const maps = enlaceSeguro(n.maps);

  const whatsapp = normalizarTelefono(telefono, { codigoPais: n.codigo_pais });
  const linkWhatsApp = telefonoParecePlausible(whatsapp) ? `https://wa.me/${whatsapp}` : '';

  const servicios = serviciosActivos(cfg)
    .map(
      (s) => `      <li class="servicio">
        <div>
          <span class="servicio-nombre">${esc(s.nombre)}</span>
          ${s.descripcion ? `<span class="servicio-desc">${esc(s.descripcion)}</span>` : ''}
        </div>
        <div class="servicio-datos">
          <span class="precio">${esc(formatearPrecio(s.precio, n.moneda))}</span>
        </div>
      </li>`,
    )
    .join('\n');

  const horarios = describirHorarios(cfg)
    .split('\n')
    .map((linea) => `      <li>${esc(linea)}</li>`)
    .join('\n');

  const contacto = [
    direccion ? `<li>📍 ${maps ? `<a href="${esc(maps)}" target="_blank" rel="noopener">${esc(direccion)}</a>` : esc(direccion)}${comoLlegar ? ` <span class="tenue">(${esc(comoLlegar)})</span>` : ''}</li>` : '',
    telefono ? `<li>📱 ${esc(telefono)}</li>` : '',
    instagram ? `<li>📷 ${esc(instagram)}</li>` : '',
  ]
    .filter(Boolean)
    .join('\n      ');

  const cuerpo = `<main class="sitio">
  <header class="portada">
    <h1>${esc(nombre)}</h1>
    ${direccion ? `<p class="lugar">${esc(direccion)}</p>` : ''}
    ${linkWhatsApp ? `<a class="boton-turno" href="${esc(linkWhatsApp)}" target="_blank" rel="noopener">Sacar turno por WhatsApp</a>` : ''}
  </header>

  <section>
    <h2>Servicios</h2>
    <ul class="servicios">
${servicios}
    </ul>
    ${serviciosActivos(cfg).some((s) => s.precio <= 0) ? '<p class="tenue">Los precios marcados «a confirmar» los confirmamos por WhatsApp.</p>' : ''}
  </section>

  <section>
    <h2>Horarios</h2>
    <ul class="horarios">
${horarios}
    </ul>
  </section>

  ${contacto ? `<section>
    <h2>Dónde estamos</h2>
    <ul class="contacto">
      ${contacto}
    </ul>
  </section>` : ''}

  <section class="turnos-info">
    <h2>Cómo sacar turno</h2>
    <p>Escribinos por WhatsApp y te atiende nuestro asistente. Podés reservar, consultar, cambiar o cancelar tu turno a cualquier hora, sin esperar respuesta.</p>
    ${cfg.reglas.politica_cancelacion ? `<p class="tenue">${esc(cfg.reglas.politica_cancelacion)}</p>` : ''}
  </section>

  <footer>
    <p>${esc(nombre)}</p>
    <p><a href="/privacidad">Política de privacidad</a></p>
  </footer>
</main>`;

  return armar(nombre, `${nombre}${direccion ? ` — ${direccion}` : ''}. Turnos por WhatsApp.`, cuerpo);
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
    <p class="volver"><a href="/">← ${esc(nombre)}</a></p>
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
