// Edge Function: push-enviar (slug real: quick-service)
//
// Dos usos:
//  1) La llama el trigger notificar_evento_push (avisos de servicio: nuevo
//     presupuesto, aceptado, rechazado, trabajo terminado, pago cobrado).
//     Manda push Y mail siempre, sin link de baja: no es publicidad, es la
//     prestación (art. 27, Ley 25.326 no aplica).
//  2) La llama el envío programado de novedades (push cada 10-12 días, mail
//     cada 15). Ahí sí es publicidad: se chequea el permiso, y el mail lleva
//     un link de baja de un solo clic, sin pedir login (art. 27 exige uno).
//
// El body puede mandar "canal": 'push' | 'mail' | 'ambos' (default 'ambos').
// El trigger de avisos no lo manda, así que sigue yendo por los dos como
// siempre. Los envíos de novedades sí lo mandan, uno u otro, nunca los dos
// juntos — cada canal tiene su propio ritmo.
//
// Brevo tiene dos credenciales distintas y es fácil confundirlas, así que la
// función detecta sola cuál le dieron:
//   xkeysib-...   → API Key   → se manda por la API REST
//   xsmtpsib-...  → clave SMTP → se manda por el relay SMTP
//
// Push por dos canales, según el endpoint guardado en push_subscripciones:
//   https://...     → Web Push (navegadores y la app de Android, que es la web)
//   apns:<token>    → Apple Push Notification service (la app de iPhone)
// APNs necesita APNS_KEY_ID, APNS_TEAM_ID y APNS_P8 (la clave .p8 de Apple
// Developer → Keys). Mientras no estén, las suscripciones de iPhone se saltean
// sin borrarse, y el resto funciona igual.

import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const SUPABASE_URL          = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY      = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const PUSH_TRIGGER_SECRET   = Deno.env.get("PUSH_TRIGGER_SECRET")!;
const VAPID_PUBLIC_KEY      = Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE_KEY     = Deno.env.get("VAPID_PRIVATE_KEY")!;
const VAPID_SUBJECT         = Deno.env.get("VAPID_SUBJECT") ?? "mailto:trattoapp1@gmail.com";
const BREVO_API_KEY_ENV     = Deno.env.get("BREVO_API_KEY") ?? Deno.env.get("BREVO-API-KEY");
const REMITENTE_EMAIL       = "info@trattoapp.com.ar";
const REMITENTE_NOMBRE      = "Tratto";
const FUNCION_URL           = "https://qglsonbcsncgekzbfafk.supabase.co/functions/v1/quick-service";
// El logo vive en el repo de la app (logo-mail.png), servido por Vercel una
// vez que la rama llegue a producción. Hasta entonces, el mail sale igual;
// solo el encabezado con la imagen se ve roto en el cliente de correo.
const LOGO_MAIL_URL         = "https://www.trattoapp.com.ar/logo-mail.png";

const APNS_KEY_ID    = Deno.env.get("APNS_KEY_ID");
const APNS_TEAM_ID   = Deno.env.get("APNS_TEAM_ID");
const APNS_P8        = Deno.env.get("APNS_P8");
const APNS_BUNDLE_ID = Deno.env.get("APNS_BUNDLE_ID") ?? "ar.com.trattoapp";
// Las builds de TestFlight y de la App Store usan el entorno de producción.
const APNS_HOST      = Deno.env.get("APNS_ENTORNO") === "sandbox"
  ? "api.sandbox.push.apple.com" : "api.push.apple.com";

// Puerto 465 y no 587: el runtime de Supabase no soporta STARTTLS (subir una
// conexión en claro a cifrada). En 465 la conexión nace cifrada y funciona.
const SMTP_HOST = "smtp-relay.brevo.com";
const SMTP_PORT = 465;

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

// ── Firma del link de baja ───────────────────────────────────────────────
async function firmarBaja(userId: string): Promise<string> {
  const clave = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(PUSH_TRIGGER_SECRET),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const firma = await crypto.subtle.sign("HMAC", clave, new TextEncoder().encode(userId));
  return btoa(String.fromCharCode(...new Uint8Array(firma)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function linkBaja(userId: string, token: string): string {
  return `${FUNCION_URL}?accion=baja&u=${encodeURIComponent(userId)}&t=${encodeURIComponent(token)}`;
}

// ── APNs (app de iPhone) ─────────────────────────────────────────────────
// Apple pide un JWT firmado con ES256 que dure como mucho una hora y que no se
// renueve más de una vez cada 20 minutos: se reusa durante 50.
let jwtApns: { token: string; creado: number } | null = null;

function base64Url(bytes: Uint8Array | string): string {
  const texto = typeof bytes === "string" ? bytes : String.fromCharCode(...bytes);
  return btoa(texto).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function tokenApns(): Promise<string | null> {
  if (!APNS_KEY_ID || !APNS_TEAM_ID || !APNS_P8) return null;
  const ahora = Math.floor(Date.now() / 1000);
  if (jwtApns && ahora - jwtApns.creado < 50 * 60) return jwtApns.token;
  const pem = APNS_P8.replace(/-----[^-]+-----/g, "").replace(/\s+/g, "");
  const der = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));
  const clave = await crypto.subtle.importKey(
    "pkcs8", der, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]
  );
  const encabezado = base64Url(JSON.stringify({ alg: "ES256", kid: APNS_KEY_ID }));
  const reclamos = base64Url(JSON.stringify({ iss: APNS_TEAM_ID, iat: ahora }));
  const firma = new Uint8Array(await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" }, clave, new TextEncoder().encode(`${encabezado}.${reclamos}`)
  ));
  jwtApns = { token: `${encabezado}.${reclamos}.${base64Url(firma)}`, creado: ahora };
  return jwtApns.token;
}

async function mandarApns(
  tokenDispositivo: string, titulo: string, cuerpo: string, url: string
): Promise<"enviado" | "borrar" | "sin_configurar" | "error"> {
  if (!/^[0-9a-fA-F]{32,200}$/.test(tokenDispositivo)) return "borrar";
  const jwt = await tokenApns();
  if (!jwt) return "sin_configurar";
  const r = await fetch(`https://${APNS_HOST}/3/device/${tokenDispositivo}`, {
    method: "POST",
    headers: {
      "authorization": `bearer ${jwt}`,
      "apns-topic": APNS_BUNDLE_ID,
      "apns-push-type": "alert",
      "apns-priority": "10",
      "content-type": "application/json",
    },
    body: JSON.stringify({ aps: { alert: { title: titulo, body: cuerpo }, sound: "default" }, url }),
  });
  if (r.ok) return "enviado";
  const detalle = await r.text();
  // 410: el usuario desinstaló la app. BadDeviceToken: token de otro entorno o inválido.
  if (r.status === 410 || /BadDeviceToken|Unregistered|DeviceTokenNotForTopic/.test(detalle)) return "borrar";
  console.error("apns falló", r.status, detalle);
  return "error";
}

// ── El mail ───────────────────────────────────────────────────────────────
function armarHtmlMail(titulo: string, cuerpo: string, url: string, linkDeBaja?: string): string {
  const link = url && url !== "/" ? `https://www.trattoapp.com.ar${url}` : "https://www.trattoapp.com.ar";
  const pie = linkDeBaja
    ? `<p style="margin:22px 0 0;padding-top:14px;border-top:1px solid #E0DCD0;font-size:12px;color:#68766F">
         Te llega este mail porque activaste novedades y promociones de Tratto.
         <a href="${linkDeBaja}" style="color:#68766F;text-decoration:underline">Darme de baja</a>, gratis y al instante.</p>`
    : `<p style="margin:22px 0 0;padding-top:14px;border-top:1px solid #E0DCD0;font-size:12px;color:#68766F">
         Te llega este mail porque es un aviso sobre tu propio pedido o trabajo en Tratto —
         no es publicidad, y no depende de ningún permiso que hayas dado o retirado.</p>`;
  return `<div style="font-family:system-ui,sans-serif;max-width:480px;color:#0E1815;line-height:1.55">
    <img src="${LOGO_MAIL_URL}" alt="Tratto" width="200" style="display:block;border:0;margin:0 0 20px">
    <h2 style="font-size:19px;margin:0 0 14px">${titulo}</h2>
    <p style="margin:0 0 20px">${cuerpo}</p>
    <a href="${link}" style="display:inline-block;background:#1E5D49;color:#FCFBF8;text-decoration:none;
       padding:11px 18px;border-radius:8px;font-size:14px">Ver en Tratto</a>
    ${pie}
  </div>`;
}

async function traerConfig(clave: string): Promise<string | null> {
  const { data } = await supabase
    .from("config_app").select("valor").eq("clave", clave).maybeSingle();
  return data?.valor?.trim() || null;
}

async function mandarPorApi(clave: string, para: string, titulo: string, cuerpo: string, url: string, linkDeBaja?: string) {
  const r = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": clave, "Content-Type": "application/json", "Accept": "application/json" },
    body: JSON.stringify({
      sender: { name: REMITENTE_NOMBRE, email: REMITENTE_EMAIL },
      to: [{ email: para }],
      subject: `Tratto · ${titulo}`,
      htmlContent: armarHtmlMail(titulo, cuerpo, url, linkDeBaja),
    }),
  });
  if (!r.ok) {
    console.error("brevo api falló", r.status, await r.text());
    return { enviado: false, motivo: "api http " + r.status };
  }
  return { enviado: true, via: "api" };
}

async function mandarPorSmtp(clave: string, para: string, titulo: string, cuerpo: string, url: string, linkDeBaja?: string) {
  const usuario = await traerConfig("brevo_smtp_user");
  if (!usuario) return { enviado: false, motivo: "falta brevo_smtp_user" };

  const cliente = new SMTPClient({
    connection: {
      hostname: SMTP_HOST,
      port: SMTP_PORT,
      tls: true,
      auth: { username: usuario, password: clave },
    },
  });

  try {
    await cliente.send({
      from: `${REMITENTE_NOMBRE} <${REMITENTE_EMAIL}>`,
      to: para,
      subject: `Tratto · ${titulo}`,
      html: armarHtmlMail(titulo, cuerpo, url, linkDeBaja),
    });
    return { enviado: true, via: "smtp" };
  } finally {
    try { await cliente.close(); } catch { /* cerrar no debe tapar el error real */ }
  }
}

async function mandarMail(para: string, titulo: string, cuerpo: string, url: string, linkDeBaja?: string) {
  const clave = (await traerConfig("brevo_api_key")) ?? BREVO_API_KEY_ENV?.trim() ?? null;
  if (!clave) return { enviado: false, motivo: "sin clave de Brevo" };
  try {
    return clave.startsWith("xsmtpsib")
      ? await mandarPorSmtp(clave, para, titulo, cuerpo, url, linkDeBaja)
      : await mandarPorApi(clave, para, titulo, cuerpo, url, linkDeBaja);
  } catch (err) {
    console.error("mail excepción", err);
    return { enviado: false, motivo: String((err as Error)?.message ?? err).slice(0, 200) };
  }
}

// ── La página de confirmación de baja (la abre un navegador, no la app) ────
function paginaBaja(mensaje: string): Response {
  return new Response(
    `<!doctype html><html lang="es-AR"><meta charset="utf-8">
     <meta name="viewport" content="width=device-width, initial-scale=1">
     <title>Tratto</title>
     <body style="font-family:system-ui,sans-serif;background:#0C2620;color:#FCFBF8;
       display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:24px">
       <div style="max-width:360px;text-align:center">
         <img src="${LOGO_MAIL_URL}" alt="Tratto" width="160" style="display:inline-block;border:0;margin:0 0 20px">
         <p style="font-size:16px;line-height:1.5;margin:0">${mensaje}</p>
       </div>
     </body></html>`,
    { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } }
  );
}

async function manejarBaja(url: URL): Promise<Response> {
  const uid = url.searchParams.get("u");
  const token = url.searchParams.get("t");
  if (!uid || !token) return paginaBaja("Este enlace no es válido.");

  const esperado = await firmarBaja(uid);
  if (esperado !== token) return paginaBaja("Este enlace no es válido.");

  const { data: usuarioData } = await supabase.auth.admin.getUserById(uid);
  if (!usuarioData?.user) return paginaBaja("No encontramos esa cuenta.");

  await supabase.auth.admin.updateUserById(uid, {
    user_metadata: {
      ...usuarioData.user.user_metadata,
      publicidad_permiso: false,
      publicidad_permiso_fecha: new Date().toISOString(),
    },
  });

  return paginaBaja("Listo, no vas a recibir más novedades ni promociones de Tratto.");
}

Deno.serve(async (req) => {
  const url = new URL(req.url);

  if (req.method === "GET" && url.searchParams.get("accion") === "baja") {
    return manejarBaja(url);
  }

  if (req.method !== "POST") {
    return new Response("method not allowed", { status: 405 });
  }

  // Firma compartida: sin esto, cualquiera que encuentre la URL de la
  // function podría hacerle mandar un push a cualquier usuario.
  if (req.headers.get("x-tratto-firma") !== PUSH_TRIGGER_SECRET) {
    return new Response("no autorizado", { status: 401 });
  }

  let body: {
    user_id?: string;
    titulo?: string;
    cuerpo?: string;
    url?: string;
    tipo?: "servicio" | "publicidad";
    canal?: "push" | "mail" | "ambos";
  };
  try {
    body = await req.json();
  } catch {
    return new Response("json inválido", { status: 400 });
  }

  const { user_id, titulo, cuerpo, url: urlAviso, tipo, canal = "ambos" } = body;
  if (!user_id || !titulo) {
    return new Response("faltan user_id o titulo", { status: 400 });
  }

  const { data: usuarioData, error: errUsuario } = await supabase.auth.admin.getUserById(user_id);
  if (errUsuario || !usuarioData?.user) {
    return new Response(JSON.stringify({ ok: false, motivo: "usuario inexistente" }), { status: 200 });
  }
  const usuario = usuarioData.user;

  // Los avisos de servicio ("te llegó un presupuesto", "te pagaron") no
  // llevan interruptor. Los de publicidad sí lo necesitan, y se chequea
  // ACÁ, contra el dato real de la cuenta, nunca confiando en el llamador.
  if (tipo === "publicidad" && usuario.user_metadata?.publicidad_permiso !== true) {
    return new Response(JSON.stringify({ ok: true, enviados: 0, motivo: "sin permiso de publicidad" }), { status: 200 });
  }

  let enviados = 0;
  let borrados = 0;
  let apnsSinConfigurar = 0;

  if (canal !== "mail") {
    const { data: subs, error: errSubs } = await supabase
      .from("push_subscripciones")
      .select("id, endpoint, p256dh, auth_clave")
      .eq("user_id", user_id);

    if (errSubs) {
      return new Response(JSON.stringify({ ok: false, error: errSubs.message }), { status: 500 });
    }

    const payload = JSON.stringify({ titulo, cuerpo: cuerpo ?? "", url: urlAviso ?? "/" });
    const idsParaBorrar: number[] = [];

    await Promise.all((subs ?? []).map(async (s) => {
      if (s.endpoint.startsWith("apns:")) {
        const res = await mandarApns(s.endpoint.slice(5), titulo, cuerpo ?? "", urlAviso ?? "/");
        if (res === "enviado") enviados++;
        else if (res === "borrar") idsParaBorrar.push(s.id);
        else if (res === "sin_configurar") apnsSinConfigurar++;
        return;
      }
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth_clave } },
          payload
        );
        enviados++;
      } catch (err) {
        // 404/410: el navegador dio de baja esa suscripción del lado suyo.
        const status = (err as { statusCode?: number })?.statusCode;
        if (status === 404 || status === 410) {
          idsParaBorrar.push(s.id);
        } else {
          console.error("push falló", s.id, err);
        }
      }
    }));

    if (apnsSinConfigurar) console.warn(`${apnsSinConfigurar} suscripciones de iPhone sin enviar: faltan las claves de APNs`);

    if (idsParaBorrar.length) {
      await supabase.from("push_subscripciones").delete().in("id", idsParaBorrar);
      borrados = idsParaBorrar.length;
    }
  }

  let mail: { enviado: boolean; motivo?: string; via?: string } = { enviado: false, motivo: "no aplica" };
  if (canal !== "push" && usuario.email) {
    const linkDeBaja = tipo === "publicidad" ? linkBaja(user_id, await firmarBaja(user_id)) : undefined;
    mail = await mandarMail(usuario.email, titulo, cuerpo ?? "", urlAviso ?? "/", linkDeBaja);
  }

  return new Response(
    JSON.stringify({ ok: true, enviados, borrados, apns_sin_configurar: apnsSinConfigurar, mail }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
});
