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
        {"alwaysOutputData": True, "onError": "continueRegularOutput", "executeOnce": True,
         **({"credentials": {"httpHeaderAuth": APIFY_CRED}} if APIFY_CRED else {})})

BUSQUEDAS = r"""
// Qué buscar hoy, rotando por día. Todo apunta a Buenos Aires y a muchos rubros
// (Tratto no es solo oficios; sin gas, electricidad ni salud: son matriculados).
// TikTok: búsquedas como las que haría alguien de CABA/GBA; después se quedan
// solo los videos subidos desde Argentina que hablan de Buenos Aires.
// Instagram: el plan gratis acepta un hashtag por día y trae ~10 posts; se
// quedan solo los de proveedores de Buenos Aires (teléfono 11, CABA, zonas).
const IG = ['mudanzascaba', 'fletescaba', 'pintorcaba', 'fletes', 'mudanzas', 'clasesdeingles', 'peluqueriacanina',
  'manicura', 'paseadordeperros', 'reformas', 'jardineria', 'catering', 'fotografiadeeventos', 'personaltrainer',
  'cerrajeria', 'clasesparticulares'];
const TT = ['pintor caba', 'plomero zona oeste', 'mudanzas zona sur', 'fletes zona norte', 'clases particulares caba',
  'profesora de ingles caba', 'peluqueria canina a domicilio caba', 'paseador de perros palermo', 'personal trainer caba',
  'fotografo de eventos buenos aires', 'catering para eventos buenos aires', 'dj para fiestas buenos aires',
  'limpieza de casas caba', 'jardinero zona norte', 'mecanico a domicilio caba', 'manicura a domicilio caba',
  'contador monotributo caba', 'gestor del automotor caba', 'cerrajero caba', 'reformas de departamentos caba',
  'maquilladora a domicilio caba', 'mudanza de oficina caba'];
const dia = Math.floor(Date.now() / 86400000);
const tomar = (lista, n) => Array.from({ length: n }, (_, i) => lista[(dia * n + i) % lista.length]);
return [{ json: { hashtags: tomar(IG, 1), busquedas: tomar(TT, 2) } }];
"""

ELEGIR_POSTS = r"""
// Elige los posts donde más rinde cada comentario que se paga: los que hablan
// de precio o de pedir un servicio, y con una cantidad de comentarios normal
// (los virales se llenan de chistes y emojis). Lee varios nombres de campo
// porque cada herramienta de Apify los llama distinto.
const red = '%RED%';
const fuente = red === 'tt' ? [...$('TT: videos por busqueda').all(), ...$('TT: videos por busqueda 2').all()] : $input.all();
const posts = fuente.map(i => i.json).filter(p => p && !p.error);
const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const codigo = p => p.shortCode || p.shortcode || p.short_code || p.code;
const url = p => red === 'ig'
  ? (p.url || p.postUrl || p.link || (codigo(p) ? `https://www.instagram.com/p/${codigo(p)}/` : null))
  : (p.webVideoUrl || p.url || p.postUrl || p.link || p.videoUrl ||
     (p.aweme_info && p.aweme_info.aweme_id && p.aweme_info.author ? `https://www.tiktok.com/@${p.aweme_info.author.unique_id}/video/${p.aweme_info.aweme_id}` : null));
const coms = p => Number(p.commentsCount ?? p.commentCount ?? p.comments_count ?? p.comment_count ?? (p.aweme_info && p.aweme_info.statistics && p.aweme_info.statistics.comment_count) ?? (p.stats && (p.stats.commentCount ?? p.stats.comments)) ?? (typeof p.comments === 'number' ? p.comments : 0)) || 0;
const texto = p => norm((p.caption && (p.caption.text || p.caption)) || p.description || p.title || p.text || p.desc || (p.aweme_info && p.aweme_info.desc) || '');
const duenio = p => (p.owner && p.owner.username) || p.ownerUsername || p.owner_username || (p.aweme_info && p.aweme_info.author && p.aweme_info.author.unique_id) || (p.user && (p.user.username || p.user.uniqueId)) ||
  (p.channel && (p.channel.username || p.channel.uniqueId)) || (p.author && (p.author.uniqueId || p.author.username)) || (p.authorMeta && p.authorMeta.name);
const CLAVES = ['precio', 'cuanto', 'presupuesto', 'cobra', 'sale', 'servicio', 'turno', 'consulta', 'zona', 'caba', 'argentina', 'buenos aires'];
const valor = p => {
  const c = coms(p);
  if (c < 3) return -1;
  const enRango = c <= 400 ? Math.log(c + 1) : Math.log(400) - 1;   // los virales rinden menos
  return enRango + 2 * CLAVES.filter(k => texto(p).includes(k)).length;
};
// Solo Buenos Aires: en TikTok, video subido desde Argentina; en los dos, que el
// texto o el lugar hablen de CABA/GBA o traigan un teléfono 11.
const BA = /caba|capital federal|buenos aires|bs ?as|zona (norte|sur|oeste)|\bgba\b|conurbano|palermo|belgrano|caballito|flores|almagro|recoleta|nu[nñ]ez|devoto|villa |san isidro|vicente lopez|olivos|tigre|pilar|quilmes|lan[uú]s|avellaneda|lomas|banfield|adrogu[eé]|mor[oó]n|haedo|ramos mej[ií]a|castelar|ituzaing[oó]|merlo|moreno|san justo|la matanza|tres de febrero|caseros|san mart[ií]n|\b11[ -]?\d{4}|\+?54 ?9? ?11/;
const lugar = p => norm(JSON.stringify((p.aweme_info && p.aweme_info.poi_data) || p.location || ''));
const deBA = p => {
  if (red === 'tt' && p.aweme_info && p.aweme_info.region && p.aweme_info.region !== 'AR') return false;
  return BA.test(texto(p)) || BA.test(lugar(p)) || (red === 'tt' && p.aweme_info && p.aweme_info.region === 'AR');
};
const elegidos = posts.filter(p => url(p) && valor(p) >= 0 && deBA(p)).sort((a, b) => valor(b) - valor(a)).slice(0, red === 'ig' ? 6 : 10);
return [{ json: { urls: elegidos.map(url), duenios: elegidos.map(duenio).filter(Boolean) } }];
"""

ELEGIR = r"""
// Primer filtro, sin IA: saca links, emojis sueltos, las cuentas dueñas de los
// posts, las de Tratto y las ya sugeridas en los últimos 60 días. Arma la lista
// de candidatos (hasta 160) con el texto del post como contexto para la IA.
const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const NUESTRAS = ['trattoapp', 'trattoapp_'];
const ya = new Set($('Ya sugeridos').all().map(i => i.json).filter(x => x && x.usuario).map(x => x.red + ':' + norm(x.usuario)));
const contexto = {};
function postsDe(nodo, red) {
  for (const i of $(nodo).all()) {
    const p = i.json || {}, a = p.aweme_info || {};
    const u = red === 'tiktok' && a.aweme_id && a.author ? `https://www.tiktok.com/@${a.author.unique_id}/video/${a.aweme_id}` : (p.url || '');
    const t = (p.caption && (p.caption.text || p.caption)) || a.desc || p.description || '';
    if (u) contexto[u] = String(t).slice(0, 160);
  }
}
postsDe('IG: reels por hashtag', 'instagram'); postsDe('TT: videos por busqueda', 'tiktok'); postsDe('TT: videos por busqueda 2', 'tiktok');

function candidatos(red, nodo, nodoPosts) {
  const duenios = new Set(((($(nodoPosts).first() || {}).json || {}).duenios || []).map(norm));
  const vistos = new Set(), out = [];
  for (const it of $(nodo).all().map(i => i.json).filter(x => x && !x.error)) {
    if (it.content_type === 'caption') continue;
    const usuario = red === 'instagram'
      ? it.username || (it.owner && it.owner.username) || it.ownerUsername || (it.user && it.user.username)
      : it.uniqueId || (it.user && (it.user.uniqueId || it.user.username)) || (it.author && it.author.uniqueId) || it.username;
    const texto = String(it.text || it.message || it.comment || it.content || '').trim();
    const post = it.postUrl || it.videoWebUrl || it.input_url || it.submittedVideoUrl || it.inputSource || it.url || '';
    const u = norm(usuario);
    if (!usuario || vistos.has(u) || NUESTRAS.includes(u) || duenios.has(u) || ya.has(red + ':' + u)) continue;
    if (/https?:|www\.|\.com/.test(texto) || (norm(texto).match(/[a-z]/g) || []).length < 6) continue;
    vistos.add(u);
    out.push({ red, usuario, nombre: it.full_name || (it.user && it.user.full_name) || '', comentario: texto.slice(0, 220), post_url: post, post_texto: contexto[post] || '' });
  }
  return out.slice(0, 80);
}
const lista = [...candidatos('instagram', 'IG: comentarios', 'IG: elegir reels'), ...candidatos('tiktok', 'TT: comentarios', 'TT: elegir videos')];
return [{ json: { candidatos: lista.map((c, i) => ({ i, ...c })) } }];
"""

INSTRUCCION_IA = """Revisás comentarios de Instagram y TikTok para Tratto, una app de Buenos Aires (Argentina) donde la gente pide un servicio y recibe presupuestos de proveedores de su zona: arreglos y reformas, mudanzas y fletes, limpieza, clases, eventos, mascotas, belleza, entrenamiento, trámites, contadores, diseño, autos y más.

Para cada comentario decidí:
- "argentina": "si" si habla claramente como en Argentina (voseo: vos, tenés, querés, podés, sabés; che, laburo, posta, re, mangos, lucas, guita) o nombra lugares de Argentina (CABA, zona norte/sur/oeste, barrios o partidos del GBA, provincias argentinas). "probable" si es neutro pero el post es de Buenos Aires y nada indica otro país. "no" si hay señales de otro país (México: wey, güey, chido, neta, ahorita, órale; Chile: cachai, po, weón, bacán, fome; Perú/Venezuela/Colombia: pana, chévere, causa, parce; España: vale, tío, vosotros) o nombra lugares o monedas de otro país.
- "intencion": la pregunta es si esta persona podría CONTRATAR un servicio pronto.
  3 = lo pide o lo necesita: pide precio o presupuesto para ella, contacto, WhatsApp, turno, "¿me pasás info?", "necesito uno", "¿cuánto me sale…?", "¿vienen a mi casa?".
  2 = está evaluando contratar: pregunta si trabajan en su zona o barrio, si tienen disponibilidad, si hacen tal trabajo, cómo contratarlos, o cuenta que tiene ese problema en su casa ("se me rompió…", "tengo humedad…").
  1 = curiosidad o comentario sin intención de contratar: preguntas técnicas de cómo se hace ("¿qué material usaste?", "¿cómo sacaste…?"), opiniones sobre precios ajenos, anécdotas.
  0 = nada que ver: chistes, elogios, emojis, discusiones, spam; quien quiere aprender el oficio o pregunta cuánto se gana; otro proveedor o empresa ofreciendo lo suyo; preguntas sobre otra profesión.
Ante la duda entre dos valores, elegí el más bajo.

Respondé SOLO con JSON: {"resultados":[{"i":0,"argentina":"si|probable|no","intencion":0,"motivo":"en 6 palabras o menos"}]}"""


FINAL = r"""
// Se queda solo con quien la IA marcó de Argentina (o probable) y con ganas
// concretas de contratar algo (intención 2 o 3). Si la IA falla, no manda
// nada antes que mandar cualquiera. Hasta 50 por red, primero los más claros.
const cands = $('Candidatos').first().json.candidatos || [];
let res = [];
try { res = JSON.parse($input.first().json.choices[0].message.content).resultados || []; } catch (e) { res = []; }
const porI = new Map(res.map(r => [Number(r.i), r]));
const puntaje = r => Number(r.intencion) * 10 + (r.argentina === 'si' ? 3 : 0);
const buenos = cands.map(c => ({ c, r: porI.get(c.i) }))
  .filter(x => x.r && ['si', 'probable'].includes(x.r.argentina) && Number(x.r.intencion) >= 2)   // 2 = evaluando contratar, 3 = lo pide
  .map(x => ({ red: x.c.red, usuario: x.c.usuario, comentario: x.c.comentario, post_url: x.c.post_url, puntaje: puntaje(x.r), motivo: String(x.r.motivo || '').slice(0, 60) }))
  .sort((a, b) => b.puntaje - a.puntaje);
const ig = buenos.filter(x => x.red === 'instagram').slice(0, 50);
const tt = buenos.filter(x => x.red === 'tiktok').slice(0, 50);
return [{ json: { filas: [...ig, ...tt], ig, tt, revisados: cands.length, ia_ok: res.length > 0 } }];
"""

MAIL = r"""
const { ig, tt, revisados, ia_ok } = $('Elegir 50 por red').first().json;
const b = $('Busquedas del dia').first().json;
const esc = s => String(s || '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const link = (red, u) => red === 'instagram' ? `https://www.instagram.com/${encodeURIComponent(u)}/` : `https://www.tiktok.com/@${encodeURIComponent(u)}`;
const tabla = (titulo, lista) => `<h2 style="font-family:Arial;color:#1E5D49">${titulo} (${lista.length})</h2>` +
  (lista.length ? '<table cellpadding="6" style="border-collapse:collapse;font-family:Arial;font-size:14px">' + lista.map((x, i) =>
    `<tr style="border-bottom:1px solid #eee"><td>${i + 1}</td><td><a href="${link(x.red, x.usuario)}"><b>@${esc(x.usuario)}</b></a></td>` +
    `<td style="color:#555">“${esc(x.comentario)}”${x.motivo ? ` <span style="color:#1E5D49">(${esc(x.motivo)})</span>` : ''}${x.post_url ? ` · <a href="${esc(x.post_url)}">post</a>` : ''}</td></tr>`).join('') + '</table>'
  : '<p style="font-family:Arial">Hoy no encontré cuentas nuevas acá.</p>');
const html = `<div style="max-width:760px">
<p style="font-family:Arial">Hola! Estas son las cuentas de hoy para seguir <b>a mano</b>, de a poco y desde el celular.
Salen de gente que comentó publicaciones de: ${esc(b.hashtags.map(h => '#' + h).join(', '))} (Instagram) y ${esc(b.busquedas.join(' · '))} (TikTok).
Revisé ${revisados} comentarios y quedaron solo los de gente de Argentina que muestra ganas de contratar algo (pregunta precio, contacto o si cubren su zona); arriba, los más claros.${ia_ok ? '' : ' <b>Hoy falló el filtro con IA, así que no mandé ninguna.</b>'}</p>
${tabla('Instagram', ig)}${tabla('TikTok', tt)}
<p style="font-family:Arial;color:#888;font-size:12px">Radar de Tratto. Seguí sin apuro (no todas de corrido) y, si podés, dejá un comentario útil en su post: suma más que el follow solo.</p></div>`;
return [{ json: { asunto: `Radar: ${ig.length} de Instagram y ${tt.length} de TikTok para seguir hoy`, html } }];
"""

def supa(nombre, metodo, url, x, cuerpo=None, prefer=None):
    p = {"method": metodo, "url": url, "authentication": "predefinedCredentialType", "nodeCredentialType": "supabaseApi", "options": {}}
    if prefer: p.update({"sendHeaders": True, "headerParameters": {"parameters": [{"name": "Prefer", "value": prefer}]}})
    if cuerpo: p.update({"sendBody": True, "specifyBody": "json", "jsonBody": cuerpo})
    return nodo(nombre, "n8n-nodes-base.httpRequest", 4.2, p, x, {"credentials": SUPA, "alwaysOutputData": True, "onError": "continueRegularOutput", "executeOnce": True})

def code(nombre, js, x):
    return nodo(nombre, "n8n-nodes-base.code", 2, {"jsCode": js.strip()}, x)

def armar(apify_cred=None):
    global APIFY_CRED; APIFY_CRED = apify_cred
    N = [
        nodo("Todos los dias 8:30", "n8n-nodes-base.scheduleTrigger", 1.2,
             {"rule": {"interval": [{"field": "cronExpression", "expression": "30 8 * * *"}]}}, 0),
        code("Busquedas del dia", BUSQUEDAS, 220),
        apify("IG: reels por hashtag", "publicsignallabs~instagram-hashtag-scraper",
              "={{ JSON.stringify({ hashtags: $json.hashtags, resultsLimit: 25, getPosts: true, getReels: true }) }}", 440, 0.015),
        code("IG: elegir reels", ELEGIR_POSTS.replace('%RED%', 'ig'), 660),
        apify("IG: comentarios", "datadoping~instagram-comments-and-replies-scraper",
              "={{ JSON.stringify({ code_or_id_or_url: $json.urls, max_comments: 7, scrape_replies: false }) }}", 880, 0.07),
        apify("TT: videos por busqueda", "novi~tiktok-search-api",
              "={{ JSON.stringify({ keyword: $('Busquedas del dia').first().json.busquedas[0], limit: 20, region: 'AR' }) }}", 1100, 0.012),
        apify("TT: videos por busqueda 2", "novi~tiktok-search-api",
              "={{ JSON.stringify({ keyword: $('Busquedas del dia').first().json.busquedas[1], limit: 20, region: 'AR' }) }}", 1210, 0.012),
        code("TT: elegir videos", ELEGIR_POSTS.replace('%RED%', 'tt'), 1320),
        apify("TT: comentarios", "clockworks~tiktok-comments-scraper",
              "={{ JSON.stringify({ postURLs: $json.urls, commentsPerPost: 6 }) }}", 1540, 0.075),
        supa("Ya sugeridos", "GET", f"{SB}/rest/v1/radar_redes?select=red,usuario&limit=50000", 1760),
        code("Candidatos", ELEGIR, 1980),
        nodo("IA: Argentina e intencion", "n8n-nodes-base.httpRequest", 4.2, {
            "method": "POST", "url": "https://api.openai.com/v1/chat/completions",
            "authentication": "predefinedCredentialType", "nodeCredentialType": "openAiApi",
            "sendBody": True, "specifyBody": "json",
            "jsonBody": "={{ JSON.stringify({ model: 'gpt-4o-mini', temperature: 0, response_format: { type: 'json_object' }, max_tokens: 6000, messages: [ { role: 'system', content: " + json.dumps(INSTRUCCION_IA) + " }, { role: 'user', content: JSON.stringify($json.candidatos.map(c => ({ i: c.i, red: c.red, usuario: c.usuario, nombre: c.nombre, comentario: c.comentario, post: c.post_texto }))) } ] }) }}",
            "options": {"timeout": 120000}}, 2090,
            {"credentials": {"openAiApi": {"id": "UNySLvC0hCgEOrj9", "name": "Tratto · OpenAI"}},
             "alwaysOutputData": True, "onError": "continueRegularOutput", "executeOnce": True}),
        code("Elegir 50 por red", FINAL, 2200),
        supa("Guardar sugeridos", "POST", f"{SB}/rest/v1/radar_redes", 2310,
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
    return {"name": "RADAR - 50 cuentas por red para seguir a mano", "nodes": N, "connections": C,
            "settings": {"executionOrder": "v1", "timezone": "America/Argentina/Buenos_Aires", "errorWorkflow": "LcYeloX0BIWbs3vN"}}
