/**
 * Logo de la barbería: emblema circular con tijeras cruzadas.
 *
 * Se arma como SVG en línea (no como imagen suelta) para que el texto use la
 * tipografía de la página y el nombre salga de la configuración. Sin estilos
 * en línea: la CSP del servidor los bloquea; los colores van como atributos.
 */

const ORO = '#d4a64a';
const CARBON = '#14110f';

function esc(texto: string): string {
  return texto.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Media tijera: ojo abajo, hoja hacia arriba cruzando el eje. La otra mitad es su espejo. */
const MEDIA_TIJERA = `
    <circle cx="103" cy="155" r="10.5" fill="none" stroke="${ORO}" stroke-width="4"/>
    <path d="M110.5 147.5 L119 130" fill="none" stroke="${ORO}" stroke-width="4.5" stroke-linecap="round"/>
    <path d="M115.2 125.2 L124.8 128.8 Q132 104 139 66 Q127 96 115.2 125.2 Z" fill="${ORO}"/>`;

export interface OpcionesLogo {
  /** Texto del arco de arriba, por ejemplo el nombre del local. */
  arriba: string;
  /** Texto del arco de abajo, por ejemplo el barrio. */
  abajo: string;
  /** Con fondo carbón (para foto de perfil o favicon) o transparente (para la página). */
  conFondo?: boolean;
  /** Etiqueta accesible. */
  titulo?: string;
  clase?: string;
}

export function logoSvg(o: OpcionesLogo): string {
  const arriba = esc(o.arriba.toUpperCase());
  const abajo = esc(o.abajo.toUpperCase());
  // Letras más chicas si el nombre es largo, para que no se salga del arco.
  const tamArriba = arriba.length > 18 ? 15 : arriba.length > 14 ? 17.5 : 19.5;
  const id = `l${Math.abs(hash(arriba + abajo)).toString(36)}`;
  return `<svg class="${esc(o.clase ?? 'logo')}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240" role="img" aria-label="${esc(o.titulo ?? o.arriba)}">
  <defs>
    <path id="${id}-a" d="M 34 120 A 86 86 0 0 1 206 120"/>
    <path id="${id}-b" d="M 23 120 A 97 97 0 0 0 217 120"/>
  </defs>
  ${o.conFondo ? `<circle cx="120" cy="120" r="120" fill="${CARBON}"/>` : ''}
  <circle cx="120" cy="120" r="113" fill="none" stroke="${ORO}" stroke-width="2.5"/>
  <circle cx="120" cy="120" r="106" fill="none" stroke="${ORO}" stroke-width="0.9"/>
  <circle cx="120" cy="120" r="66" fill="none" stroke="${ORO}" stroke-width="0.9"/>
  <text font-family="Cinzel, 'Times New Roman', serif" font-weight="700" font-size="${tamArriba}" letter-spacing="2.5" fill="${ORO}" text-anchor="middle">
    <textPath href="#${id}-a" startOffset="50%">${arriba}</textPath>
  </text>
  <text font-family="Cinzel, 'Times New Roman', serif" font-weight="700" font-size="11" letter-spacing="3.2" fill="${ORO}" text-anchor="middle">
    <textPath href="#${id}-b" startOffset="50%">${abajo}</textPath>
  </text>
  <path d="M27 120 l5 -5 l5 5 l-5 5 Z M203 120 l5 -5 l5 5 l-5 5 Z" fill="${ORO}"/>
  <g>${MEDIA_TIJERA}
  </g>
  <g transform="translate(240 0) scale(-1 1)">${MEDIA_TIJERA}
  </g>
  <circle cx="120" cy="127" r="3.6" fill="${o.conFondo ? CARBON : 'none'}" stroke="${ORO}" stroke-width="2"/>
</svg>`;
}

/** Solo para que dos logos en la misma página no compartan ids. */
function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}
