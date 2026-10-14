// Camino de un toque al link. Ni Instagram ni TikTok dejan tocar un link
// escrito en el texto de una publicación (regla de las dos redes), así que
// cada texto tiene que llevar a la gente a un link que sí se toca:
// - Instagram: la mención a la cuenta (se toca y abre el perfil) y el nombre
//   del link del perfil ("tocá @trattoapp_ y entrá al link «…»").
// - TikTok: "link del perfil" solo si TikTok ya lo habilitó; si no, nunca
//   prometerlo. Tampoco mencionar la cuenta de Instagram: en TikTok esa
//   mención abre otra cuenta.
// - Tiendas: solo se nombra la tienda donde la app ya está publicada
//   (links.tiendas). Mientras falte una, tampoco "bajala en las tiendas".
// La configuración vive en config/marca.json → links.

const PERFIL = /\blink (en|de|del) (la |tu |nuestro |el )?(bio|perfil)\b|\blink del perfil\b|\bperfil\b.{0,40}\blink\b/i;

const TIENDAS = [
  { clave: 'google_play', nombre: 'Google Play', patron: /\bgoogle\s*play\b|\bplay\s*store\b/i, otro: 'en Android Tratto se usa desde la web' },
  { clave: 'app_store', nombre: 'la App Store', patron: /\bapp\s*store\b|\bappstore\b/i, otro: 'en iPhone Tratto se usa desde la web' },
];
const LAS_TIENDAS = /\b(descarg|baj|instal)\w*\b.{0,40}\btiendas\b|\btiendas de (apps|aplicaciones)\b/i;

function revisarTiendas(t, tiendas) {
  if (!tiendas) return [];
  const problemas = [];
  const faltan = TIENDAS.filter((x) => !tiendas[x.clave]?.publicada);
  for (const x of faltan) {
    if (x.patron.test(t)) problemas.push(`La app todavía no está en ${x.nombre}: no la nombres (${x.otro}).`);
  }
  if (faltan.length && LAS_TIENDAS.test(t)) {
    const hay = TIENDAS.filter((x) => tiendas[x.clave]?.publicada).map((x) => x.nombre);
    problemas.push(hay.length
      ? `No digas "las tiendas": la app solo está en ${hay.join(' y ')}. Nombrá esa tienda.`
      : 'La app todavía no está en las tiendas: no digas que se descarga.');
  }
  return problemas;
}

const escapar = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const menciona = (texto, usuario) => new RegExp(`(^|[^\\w.])${escapar(usuario)}(?![\\w.])`, 'i').test(texto);

// Devuelve la lista de problemas (vacía si el texto está bien para esa red).
export function revisarCaminoAlLink(texto, red, links) {
  const t = String(texto || '');
  if (!t.trim() || !links) return [];
  const ig = links.instagram, tt = links.tiktok;
  const problemas = revisarTiendas(t, links.tiendas);
  if (red === 'instagram' && ig) {
    if (!menciona(t, ig.usuario)) {
      const nombres = (ig.links_del_perfil || []).map((n) => `«${n}»`).join(', ');
      problemas.push(`En Instagram el link escrito no se puede tocar: sumá en la segunda línea "tocá ${ig.usuario} y entrá al link ${nombres || 'del perfil'}" (la mención sí se toca).`);
    }
  }
  if (red === 'tiktok' && tt) {
    if (ig && ig.usuario !== tt.usuario && menciona(t, ig.usuario)) problemas.push(`En TikTok no va ${ig.usuario}: esa mención abre otra cuenta de TikTok. Programá cada red por separado, con su texto.`);
    if (!tt.link_en_perfil && PERFIL.test(t)) problemas.push('TikTok todavía no tiene link en el perfil: no lo prometas. Dejá el link escrito y en pantalla hasta que TikTok lo habilite.');
    if (tt.link_en_perfil && !PERFIL.test(t)) problemas.push('En TikTok el link escrito no se puede tocar: decí "tocá el link de nuestro perfil".');
  }
  return problemas;
}
