// Camino de un toque al link. Ni Instagram ni TikTok dejan tocar un link
// escrito en el texto de una publicación (regla de las dos redes), así que
// cada texto tiene que llevar a la gente a un link que sí se toca:
// - Instagram: la mención a la cuenta (se toca y abre el perfil) y el nombre
//   del link del perfil ("tocá @trattoapp_ y entrá al link «…»").
// - TikTok: "link del perfil" solo si TikTok ya lo habilitó; si no, nunca
//   prometerlo. Tampoco mencionar la cuenta de Instagram: en TikTok esa
//   mención abre otra cuenta.
// La configuración vive en config/marca.json → links.

const PERFIL = /\blink (en|de|del) (la |tu |nuestro |el )?(bio|perfil)\b|\blink del perfil\b|\bperfil\b.{0,40}\blink\b/i;

const escapar = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const menciona = (texto, usuario) => new RegExp(`(^|[^\\w.])${escapar(usuario)}(?![\\w.])`, 'i').test(texto);

// Devuelve la lista de problemas (vacía si el texto está bien para esa red).
export function revisarCaminoAlLink(texto, red, links) {
  const t = String(texto || '');
  if (!t.trim() || !links) return [];
  const ig = links.instagram, tt = links.tiktok;
  const problemas = [];
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
