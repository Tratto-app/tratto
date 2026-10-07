import json, uuid
SB = "https://qglsonbcsncgekzbfafk.supabase.co"
SUPA = {"supabaseApi": {"id": "xVc2ROmkhPTCf2XK", "name": "Tratto · Supabase (service role)"}}
APIFY_CRED = None  # se completa al crear la credencial de Apify

def nodo(nombre, tipo, ver, params, x, extra=None):
    n = {"parameters": params, "id": str(uuid.uuid5(uuid.NAMESPACE_URL, "radar/" + nombre)), "name": nombre,
         "type": tipo, "typeVersion": ver, "position": [x, 0]}
    if extra: n.update(extra)
    return n

def apify(nombre, actor, cuerpo, x, tope):
    return nodo(nombre, "n8n-nodes-base.httpRequest", 4.2, {
        "method": "POST",
        "url": f"https://api.apify.com/v2/acts/{actor}/run-sync-get-dataset-items?timeout=280&maxTotalChargeUsd={tope}",
        "authentication": "genericCredentialType", "genericAuthType": "httpHeaderAuth",
        "sendBody": True, "specifyBody": "json", "jsonBody": cuerpo,
        "options": {"timeout": 300000}}, x,
        {"alwaysOutputData": True, "onError": "continueRegularOutput",
         **({"credentials": {"httpHeaderAuth": APIFY_CRED}} if APIFY_CRED else {})})

BUSQUEDAS = r"""
// Plan gratis de Apify (USD 5/mes): 2 hashtags y 2 búsquedas por día, 100
// comentarios por red y un tope de gasto en cada llamada (~USD 0,15 por día).
// Qué buscar hoy: rota por día entre muchos rubros (Tratto no es solo oficios
// del hogar). Instagram por hashtag, TikTok por búsqueda. Sin gas, electricidad
// ni salud: son matriculados y Tratto no los acepta.
const IG = ['reformasargentina','remodelacioncaba','pinturadeinteriores','plomeriabuenosaires','mudanzascaba',
  'fletesbuenosaires','limpiezadecasas','clasesparticulares','clasesdeingles','profesorparticular',
  'fotografoargentina','eventosbuenosaires','cateringbuenosaires','peluqueriacanina','paseadordeperros',
  'entrenadorpersonal','contadorpublico','monotributo','tramitesargentina','disenograficoargentina',
  'jardineriaencasa','mecanicaautomotriz','djparafiestas','emprendedoresargentinos'];
const TT = ['cuanto cobra un pintor argentina','presupuesto reforma departamento caba','mudanza caba precio',
  'clases particulares precio argentina','cuanto cobra un contador monotributo','peluqueria canina a domicilio',
  'entrenador personal precio argentina','dj para cumpleaños precio','fotografo para eventos precio argentina',
  'limpieza de casa por hora precio','plomero urgente caba','gestor tramites argentina',
  'jardinero precio argentina','mecanico a domicilio buenos aires','diseño de logo precio argentina',
  'catering para eventos precio'];
const dia = Math.floor(Date.now() / 86400000);
const tomar = (lista, n) => Array.from({ length: n }, (_, i) => lista[(dia * n + i) % lista.length]);
return [{ json: { hashtags: tomar(IG, 2), busquedas: tomar(TT, 2) } }];
"""

ELEGIR_POSTS = r"""
// Los posts con más comentarios: ahí está la gente que pregunta.
const red = '%RED%';
const posts = $input.all().map(i => i.json).filter(p => p && !p.error);
const url = p => red === 'ig' ? (p.url || (p.shortCode ? `https://www.instagram.com/p/${p.shortCode}/` : null)) : (p.webVideoUrl || p.url);
const coms = p => Number(red === 'ig' ? p.commentsCount : p.commentCount) || 0;
const duenio = p => red === 'ig' ? p.ownerUsername : (p.authorMeta && p.authorMeta.name);
const elegidos = posts.filter(p => url(p) && coms(p) >= 3).sort((a, b) => coms(b) - coms(a)).slice(0, 6);
return [{ json: { urls: elegidos.map(url), duenios: elegidos.map(duenio).filter(Boolean) } }];
"""

ELEGIR = r"""
// Elige 25 cuentas por red entre la gente que comentó. Puntúa la intención de
// pedir un servicio (pregunta precio, busca, dice la zona), que hable como en
// Argentina y que el comentario diga algo. Saca spam, links, las cuentas
// dueñas de los posts, las nuestras y las ya sugeridas en los últimos 60 días.
const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const INTENCION = ['cuanto', 'precio', 'presupuesto', 'cobra', 'cobran', 'sale ', 'necesito', 'busco', 'buscando',
  'recomiend', 'alguien que', 'donde', 'zona', 'caba', 'capital', 'gba', 'provincia', 'conurbano',
  'me pasas', 'contacto', 'numero', 'whatsapp', 'info', 'hacen', 'trabajan', 'a domicilio', 'turno'];
const ARGENTINA = ['che ', 'laburo', 'posta', 'vos ', 'sos ', 'tenes', 'podes', 'queres', 'sabes', 'buenos aires',
  'argentina', 'mendoza', 'cordoba', 'rosario', 'la plata', 'mar del plata', 'tucuman'];
const NUESTRAS = ['trattoapp', 'trattoapp_'];
const ya = new Set($('Ya sugeridos').all().map(i => i.json).filter(x => x && x.usuario).map(x => x.red + ':' + norm(x.usuario)));

function puntuar(texto) {
  const t = ' ' + norm(texto) + ' ';
  if (/https?:|www\.|\.com/.test(t)) return -99;
  const letras = (t.match(/[a-z]/g) || []).length;
  if (letras < 4) return -99;
  let p = 0;
  p += Math.min(9, INTENCION.filter(k => t.includes(k)).length * 3);
  if (ARGENTINA.some(k => t.includes(k))) p += 2;
  if (t.includes('?')) p += 1;
  if (letras > 20) p += 1;
  return p;
}

function elegir(red, nodo, nodoPosts) {
  const duenios = new Set(((($(nodoPosts).first() || {}).json || {}).duenios || []).map(norm));
  const items = $(nodo).all().map(i => i.json).filter(x => x && !x.error);
  const porUsuario = new Map();
  for (const it of items) {
    const usuario = red === 'instagram'
      ? (it.owner && it.owner.username) || it.ownerUsername || it.username || (it.user && it.user.username) || (it.author && it.author.username)
      : (it.user && (it.user.uniqueId || it.user.username)) || (it.author && it.author.uniqueId) || it.uniqueId || it.username || (it.authorMeta && it.authorMeta.name);
    const texto = it.text || it.comment || it.content || '';
    const post = it.postUrl || it.videoWebUrl || it.videoUrl || it.url || it.inputUrl || '';
    if (!usuario) continue;
    const u = norm(usuario);
    if (NUESTRAS.includes(u) || duenios.has(u) || ya.has(red + ':' + u)) continue;
    const puntaje = puntuar(texto);
    if (puntaje < 0) continue;
    const previo = porUsuario.get(u);
    if (!previo || puntaje > previo.puntaje) porUsuario.set(u, { red, usuario, comentario: String(texto).slice(0, 220), post_url: post, puntaje });
  }
  return [...porUsuario.values()].sort((a, b) => b.puntaje - a.puntaje).slice(0, 25);
}

const ig = elegir('instagram', 'IG: comentarios', 'IG: elegir reels');
const tt = elegir('tiktok', 'TT: comentarios', 'TT: elegir videos');
return [{ json: { filas: [...ig, ...tt], ig, tt } }];
"""

MAIL = r"""
const { ig, tt } = $('Elegir 25 por red').first().json;
const b = $('Busquedas del dia').first().json;
const esc = s => String(s || '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const link = (red, u) => red === 'instagram' ? `https://www.instagram.com/${encodeURIComponent(u)}/` : `https://www.tiktok.com/@${encodeURIComponent(u)}`;
const tabla = (titulo, lista) => `<h2 style="font-family:Arial;color:#1E5D49">${titulo} (${lista.length})</h2>` +
  (lista.length ? '<table cellpadding="6" style="border-collapse:collapse;font-family:Arial;font-size:14px">' + lista.map((x, i) =>
    `<tr style="border-bottom:1px solid #eee"><td>${i + 1}</td><td><a href="${link(x.red, x.usuario)}"><b>@${esc(x.usuario)}</b></a></td>` +
    `<td style="color:#555">“${esc(x.comentario)}”${x.post_url ? ` · <a href="${esc(x.post_url)}">post</a>` : ''}</td></tr>`).join('') + '</table>'
  : '<p style="font-family:Arial">Hoy no encontré cuentas nuevas acá.</p>');
const html = `<div style="max-width:760px">
<p style="font-family:Arial">Hola! Estas son las cuentas de hoy para seguir <b>a mano</b>, de a poco y desde el celular.
Salen de gente que comentó publicaciones de: ${esc(b.hashtags.map(h => '#' + h).join(', '))} (Instagram) y ${esc(b.busquedas.join(' · '))} (TikTok).
Arriba están las que más intención muestran de pedir un servicio.</p>
${tabla('Instagram', ig)}${tabla('TikTok', tt)}
<p style="font-family:Arial;color:#888;font-size:12px">Radar de Tratto. Seguí sin apuro (no todas de corrido) y, si podés, dejá un comentario útil en su post: suma más que el follow solo.</p></div>`;
return [{ json: { asunto: `Radar: ${ig.length} de Instagram y ${tt.length} de TikTok para seguir hoy`, html } }];
"""

def supa(nombre, metodo, url, x, cuerpo=None, prefer=None):
    p = {"method": metodo, "url": url, "authentication": "predefinedCredentialType", "nodeCredentialType": "supabaseApi", "options": {}}
    if prefer: p.update({"sendHeaders": True, "headerParameters": {"parameters": [{"name": "Prefer", "value": prefer}]}})
    if cuerpo: p.update({"sendBody": True, "specifyBody": "json", "jsonBody": cuerpo})
    return nodo(nombre, "n8n-nodes-base.httpRequest", 4.2, p, x, {"credentials": SUPA, "alwaysOutputData": True, "onError": "continueRegularOutput"})

def code(nombre, js, x):
    return nodo(nombre, "n8n-nodes-base.code", 2, {"jsCode": js.strip()}, x)

def armar(apify_cred=None):
    global APIFY_CRED; APIFY_CRED = apify_cred
    N = [
        nodo("Todos los dias 8:30", "n8n-nodes-base.scheduleTrigger", 1.2,
             {"rule": {"interval": [{"field": "cronExpression", "expression": "30 8 * * *"}]}}, 0),
        code("Busquedas del dia", BUSQUEDAS, 220),
        apify("IG: reels por hashtag", "apify~instagram-hashtag-scraper",
              "={{ JSON.stringify({ hashtags: $json.hashtags, resultsType: 'reels', resultsLimit: 6 }) }}", 440, 0.04),
        code("IG: elegir reels", ELEGIR_POSTS.replace('%RED%', 'ig'), 660),
        apify("IG: comentarios", "apidojo~instagram-comments-scraper",
              "={{ JSON.stringify({ startUrls: $json.urls, maxItems: 100 }) }}", 880, 0.06),
        apify("TT: videos por busqueda", "clockworks~tiktok-scraper",
              "={{ JSON.stringify({ searchQueries: $('Busquedas del dia').first().json.busquedas, searchSection: '/video', resultsPerPage: 4, shouldDownloadVideos: false, shouldDownloadCovers: false, shouldDownloadAvatars: false }) }}", 1100, 0.04),
        code("TT: elegir videos", ELEGIR_POSTS.replace('%RED%', 'tt'), 1320),
        apify("TT: comentarios", "apidojo~tiktok-comments-scraper",
              "={{ JSON.stringify({ startUrls: $json.urls, maxItems: 100, includeReplies: false }) }}", 1540, 0.04),
        supa("Ya sugeridos", "GET", f"{SB}/rest/v1/radar_redes?select=red,usuario&limit=50000", 1760),
        code("Elegir 25 por red", ELEGIR, 1980),
        supa("Guardar sugeridos", "POST", f"{SB}/rest/v1/radar_redes", 2200,
             cuerpo="={{ JSON.stringify($json.filas.map(f => ({ red: f.red, usuario: f.usuario, comentario: f.comentario, post_url: f.post_url, puntaje: f.puntaje }))) }}",
             prefer="resolution=ignore-duplicates,return=minimal"),
        supa("Borrar mas de 60 dias", "DELETE",
             f"={SB}/rest/v1/radar_redes?creado_en=lt.{{{{ new Date(Date.now() - 60*86400000).toISOString() }}}}", 2420, prefer="return=minimal"),
        code("Armar mail", MAIL, 2640),
        nodo("Mandar mail", "n8n-nodes-base.emailSend", 2.1,
             {"fromEmail": "Tratto radar <info@trattoapp.com.ar>", "toEmail": "trattoapp1@gmail.com",
              "subject": "={{ $json.asunto }}", "emailFormat": "html", "html": "={{ $json.html }}",
              "options": {"appendAttribution": False}}, 2860,
             {"credentials": {"smtp": {"id": "NLd0bxspbVGiMdMH", "name": "Brevo SMTP (alertas)"}}}),
    ]
    C = {}
    for a, b in zip(N, N[1:]):
        C[a["name"]] = {"main": [[{"node": b["name"], "type": "main", "index": 0}]]}
    return {"name": "RADAR - 25 cuentas por red para seguir a mano", "nodes": N, "connections": C,
            "settings": {"executionOrder": "v1", "timezone": "America/Argentina/Buenos_Aires", "errorWorkflow": "LcYeloX0BIWbs3vN"}}
