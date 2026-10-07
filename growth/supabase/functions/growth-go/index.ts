// growth-go: redirección de links trackeados.
//   GET /functions/v1/growth-go/<slug>?r=<ref del prospecto>
// Registra el click (dispositivo, destino, prospecto si viene "r") y redirige
// a Google Play, App Store o la web según el dispositivo. Es público (los
// links se comparten), por eso no recibe ningún dato sensible: solo el slug
// y un código corto de prospecto, y redirige únicamente a las URLs guardadas
// en App Settings o en el link (nunca a una URL que venga en la petición).
import { buildRedirectUrl, detectDevice, type ClickData } from '../_shared/engine-core.ts';
import { admin } from '../_shared/http.ts';

// Los previsualizadores de links (WhatsApp, Facebook, Telegram, Slack...) piden
// la URL al pegarla en un chat: eso no es un click de una persona.
const BOTS = /bot|crawler|spider|facebookexternalhit|whatsapp|telegram|slack|discord|preview|embedly|linkedin|skype/i;

Deno.serve(async (req) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') return new Response('Método no permitido', { status: 405 });
  const url = new URL(req.url);
  const parts = url.pathname.split('/').filter(Boolean);
  const slug = (parts[parts.length - 1] || '').toLowerCase();
  if (!/^[a-z0-9-]{3,48}$/.test(slug) || slug === 'growth-go') {
    return new Response('Link inválido', { status: 404 });
  }
  const ua = req.headers.get('user-agent') || '';
  if (BOTS.test(ua) || req.method === 'HEAD') {
    // Robots (vista previa de un chat, revisión de anuncios de Meta, Googlebot)
    // y HEAD: se los manda al destino real para que vean la página, pero no
    // cuentan como click.
    const destino = await destinoSinRegistrar(slug);
    if (!destino) return new Response('Link inexistente', { status: 404 });
    return new Response(null, { status: 302, headers: { Location: destino, 'Cache-Control': 'no-store' } });
  }
  const ref = url.searchParams.get('r');
  const { data, error } = await admin().rpc('growth_record_click', {
    p_slug: slug,
    p_ref: ref && /^[a-z0-9]{6,16}$/.test(ref) ? ref : null,
    p_device: detectDevice(ua),
    p_ua: ua.slice(0, 300),
    p_referrer: (req.headers.get('referer') || '').slice(0, 300) || null,
  });
  if (error) {
    console.error('growth_record_click', error.message);
    return new Response('No se pudo abrir el link', { status: 500 });
  }
  if (!data) return new Response('Link inexistente', { status: 404 });
  const target = buildRedirectUrl(data as ClickData);
  if (!target) return new Response('Este link todavía no tiene destino configurado.', { status: 404 });
  return new Response(null, {
    status: 302,
    headers: { Location: target, 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' },
  });
});

// Destino del link sin UTM ni registro de click (solo para robots).
async function destinoSinRegistrar(slug: string): Promise<string | null> {
  const db = admin();
  const { data: l } = await db.from('growth_tracking_links').select('workspace_id,destination,custom_url,archived').eq('slug', slug).maybeSingle();
  if (!l || l.archived) return null;
  const https = (u?: string | null) => (u && /^https:\/\//i.test(u) ? u : null);
  if (l.destination === 'custom' && https(l.custom_url)) return l.custom_url;
  const { data: a } = await db.from('growth_app_settings').select('website,play_store_url,app_store_url').eq('workspace_id', l.workspace_id).maybeSingle();
  if (l.destination === 'play' && https(a?.play_store_url)) return a!.play_store_url;
  if (l.destination === 'appstore' && https(a?.app_store_url)) return a!.app_store_url;
  return https(a?.website) || https(a?.play_store_url) || https(a?.app_store_url);
}
