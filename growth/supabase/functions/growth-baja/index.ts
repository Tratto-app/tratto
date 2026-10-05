// growth-baja: baja de mensajes (link al pie de cada mail).
//   GET  /functions/v1/growth-baja?ws=<slug>&c=<email o teléfono>  → página de confirmación
//   POST (List-Unsubscribe-Post de un click)                        → baja directa
// Marca opt_out: la persona no vuelve a recibir nada y se cortan las
// automatizaciones. Cumple con la Ley 25.326 (derecho a no ser contactado).
import { admin } from '../_shared/http.ts';

function page(titulo: string, cuerpo: string, status = 200): Response {
  return new Response(
    `<!doctype html><html lang="es-AR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${titulo}</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0e1815;color:#e6eeea;font:16px/1.5 system-ui,sans-serif}
.c{max-width:420px;padding:28px;text-align:center}.s{width:40px;height:40px;border-radius:10px;background:#1e5d49;display:inline-grid;place-items:center;margin-bottom:14px}
h1{font-size:20px;margin:0 0 8px}p{color:#a9bbb3;margin:0}</style></head>
<body><div class="c"><div class="s"><svg width="22" height="22" viewBox="0 0 32 32"><path d="M6 17l6 6 14-14" stroke="#C9A227" stroke-width="3.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
<h1>${titulo}</h1><p>${cuerpo}</p></div></body></html>`,
    { status, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } },
  );
}

async function darDeBaja(slug: string, contacto: string): Promise<boolean> {
  if (!/^[a-z0-9-]{2,40}$/.test(slug) || !contacto) return false;
  const db = admin();
  const { data: ws } = await db.from('growth_workspaces').select('id').eq('slug', slug).maybeSingle();
  if (!ws) return false;
  const { data } = await db.rpc('growth_optout', { ws: ws.id, who: contacto });
  return (data ?? 0) >= 0; // aunque no matchee, confirmamos (no revelamos si estaba o no)
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const slug = (url.searchParams.get('ws') || '').toLowerCase();
  const contacto = url.searchParams.get('c') || '';
  if (req.method === 'POST') {
    const ok = await darDeBaja(slug, contacto);
    return new Response(ok ? 'ok' : 'error', { status: ok ? 200 : 400 });
  }
  if (req.method !== 'GET') return new Response('Método no permitido', { status: 405 });
  const ok = await darDeBaja(slug, contacto);
  return ok
    ? page('Listo, te diste de baja', 'No vas a recibir más mensajes nuestros. Gracias.')
    : page('No pudimos procesar la baja', 'Revisá el link o escribinos a soporte y lo resolvemos.', 400);
});
