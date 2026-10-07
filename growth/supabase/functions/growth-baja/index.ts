// growth-baja: baja de mensajes (link al pie de cada mail).
//   GET  /functions/v1/growth-baja?ws=<slug>&r=<código del prospecto>
//        → redirige a la página de confirmación del sitio (BAJA_PAGINA). Supabase
//          no sirve HTML desde sus funciones, y además así un antivirus que abre
//          los links del mail no da de baja a nadie.
//   POST /functions/v1/growth-baja?ws=<slug>&r=<código>   (también acepta &c=<email o teléfono>)
//        → baja. Lo usan el botón de la página y la baja de un click de los
//          clientes de correo (List-Unsubscribe-Post).
// Marca opt_out: la persona no vuelve a recibir nada y se cortan las
// automatizaciones. Si tiene cuenta en la app, también se apaga ahí el permiso
// de publicidad. Cumple con la Ley 25.326 (derecho a no ser contactado).
import { admin } from '../_shared/http.ts';

const BAJA_PAGINA = Deno.env.get('GROWTH_BAJA_URL') || 'https://www.trattoapp.com.ar/baja/';
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };

async function darDeBaja(slug: string, contacto: string, ref: string): Promise<boolean> {
  if (!/^[a-z0-9-]{2,40}$/.test(slug) || (!contacto && !/^[a-z0-9]{6,16}$/.test(ref))) return false;
  const db = admin();
  const { data: ws } = await db.from('growth_workspaces').select('id').eq('slug', slug).maybeSingle();
  if (!ws) return false;
  // Link de los mails: ?r=<código del prospecto> (no lleva el mail en la URL)
  if (!contacto) {
    const { data: p } = await db.from('growth_prospects').select('email,phone').eq('workspace_id', ws.id).eq('ref', ref).maybeSingle();
    contacto = p?.email || p?.phone || '';
    if (!contacto) return true; // no revelamos si el código existe
  }
  const { error } = await db.rpc('growth_optout', { ws: ws.id, who: contacto });
  if (error) return false;
  if (contacto.includes('@')) await db.rpc('crm_apagar_publicidad', { p_email: contacto });
  return true; // aunque no matchee, confirmamos (no revelamos si estaba o no)
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const slug = (url.searchParams.get('ws') || '').toLowerCase();
  const contacto = url.searchParams.get('c') || '';
  const ref = (url.searchParams.get('r') || '').toLowerCase();
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method === 'POST') {
    const ok = await darDeBaja(slug, contacto, ref);
    return new Response(ok ? 'ok' : 'error', { status: ok ? 200 : 400, headers: { ...CORS, 'cache-control': 'no-store' } });
  }
  if (req.method !== 'GET') return new Response('Método no permitido', { status: 405 });
  const destino = new URL(BAJA_PAGINA);
  if (slug) destino.searchParams.set('ws', slug);
  if (ref) destino.searchParams.set('r', ref);
  return new Response(null, { status: 302, headers: { Location: destino.toString(), 'cache-control': 'no-store' } });
});
