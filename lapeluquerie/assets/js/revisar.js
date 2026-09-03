/**
 * revisar.js — panel de control de datos pendientes.
 *
 * No se carga nunca en una visita normal: solo entra si la URL trae ?revisar=1.
 * Sirve para que quien administra el sitio vea de un vistazo qué falta cargar
 * antes de publicar, sin tener que abrir config.js.
 */

import { CONFIG } from './config.js';

const vacio = (v) => v === '' || v === null || v === undefined;

export function iniciarRevision() {
  const { contacto, local, precios, reviews } = CONFIG;

  const chequeos = [
    ['WhatsApp del salón', !vacio(contacto.whatsapp), 'contacto.whatsapp'],
    ['Teléfono', !vacio(contacto.telefono), 'contacto.telefono'],
    ['Email', !vacio(contacto.email), 'contacto.email'],
    ['Dirección', !vacio(local.calle), 'local.calle'],
    ['Zona / barrio (clave para el SEO local)', !vacio(local.zona), 'local.zona'],
    ['Ciudad', !vacio(local.ciudad), 'local.ciudad'],
    ['Link de Google Maps', !vacio(local.mapsUrl), 'local.mapsUrl'],
    ['Mapa embebido', !vacio(local.mapsEmbed), 'local.mapsEmbed'],
    ['Horarios confirmados', CONFIG.horariosConfirmados === true, 'horariosConfirmados'],
    ['Lista de precios', precios.mostrarPrecios === true, 'precios.mostrarPrecios'],
    ['Reseñas verificadas', reviews.verificadas === true, 'reviews.verificadas'],
    ['Link al perfil de Google', !vacio(reviews.googleUrl), 'reviews.googleUrl'],
    ['Equipo cargado', CONFIG.equipo.some((p) => p.confirmado), 'equipo[].confirmado'],
    ['Marcas de producto', !vacio(CONFIG.marcas), 'marcas'],
    ['Formas de pago', !vacio(CONFIG.formasDePago), 'formasDePago'],
    ['Dominio definitivo', CONFIG.marca.dominio !== 'https://lapeluquerie.com.ar', 'marca.dominio'],
    ['Fotos reales (reemplazar las de assets/img)', false, 'assets/img/*.webp'],
  ];

  const faltan = chequeos.filter(([, ok]) => !ok);

  const caja = document.createElement('aside');
  caja.style.cssText = 'position:fixed;inset-block-end:0;inset-inline-start:0;z-index:200;max-inline-size:min(420px,100vw);max-block-size:70dvh;overflow:auto;background:#0B0B0C;color:#F4F1EB;padding:20px;font:13px/1.5 Archivo,system-ui,sans-serif;border-block-start:3px solid #C9A66B';

  const h = document.createElement('h2');
  h.style.cssText = 'font-size:13px;letter-spacing:.16em;text-transform:uppercase;color:#C9A66B;margin-block-end:12px';
  h.textContent = `Datos pendientes · ${faltan.length} de ${chequeos.length}`;

  const ul = document.createElement('ul');
  ul.style.cssText = 'display:grid;gap:7px';
  chequeos.forEach(([nombre, ok, clave]) => {
    const li = document.createElement('li');
    li.style.cssText = `display:flex;gap:9px;align-items:baseline;${ok ? 'opacity:.45' : ''}`;
    const marca = document.createElement('span');
    marca.style.cssText = `color:${ok ? '#7FBF9A' : '#C9A66B'};flex:none`;
    marca.textContent = ok ? '✓' : '○';
    const txt = document.createElement('span');
    txt.append(nombre);
    const code = document.createElement('code');
    code.style.cssText = 'display:block;opacity:.6;font-size:11px';
    code.textContent = clave;
    txt.append(code);
    li.append(marca, txt);
    ul.append(li);
  });

  const pista = document.createElement('p');
  pista.style.cssText = 'margin-block-start:14px;padding-block-start:12px;border-block-start:1px solid #2E2E32;opacity:.75;font-size:12px';
  pista.textContent = 'Todo se completa en assets/js/config.js. Las reseñas se publican pegando las reales de Google en reviews.lista y pasando reviews.verificadas a true.';

  const cerrar = document.createElement('button');
  cerrar.type = 'button';
  cerrar.textContent = 'Cerrar panel';
  cerrar.style.cssText = 'margin-block-start:16px;border:1px solid #2E2E32;color:inherit;padding:9px 14px;font:inherit;cursor:pointer';
  cerrar.addEventListener('click', () => caja.remove());

  caja.append(h, ul, pista, cerrar);
  document.body.append(caja);
}
