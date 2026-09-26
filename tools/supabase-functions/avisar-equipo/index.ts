// Edge Function: avisar-equipo
//
// Manda un mail de alerta al equipo de Tratto. La llaman las tareas
// programadas de la base (privado.avisar) cuando algo anda mal: llamadas a n8n
// que fallan, pedidos sin proveedores, tareas que fallan, base o fotos cerca
// del tope del plan.
//
// Va por el relay SMTP de Brevo con la misma clave que usa quick-service
// (config_app: brevo_api_key = xsmtpsib-..., brevo_smtp_user). La API REST de
// Brevo no sirve desde acá: la clave de API tiene restringidas las IPs.
//
// Seguridad: exige el encabezado x-tratto-firma = PUSH_TRIGGER_SECRET (el
// mismo secreto que ya usa quick-service; en la base está en Vault como
// push_firma_quick_service). El destinatario es fijo: aunque alguien tuviera
// el secreto, no puede usar esto para mandar mails a terceros.

import { createClient } from "npm:@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const DESTINO = "trattoapp1@gmail.com";
const REMITENTE = "Tratto alertas <info@trattoapp.com.ar>";
const FIRMA = Deno.env.get("PUSH_TRIGGER_SECRET");

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
);

async function config(clave: string) {
  const { data } = await supabase.from("config_app").select("valor").eq("clave", clave).maybeSingle();
  return data?.valor?.trim() || null;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("método no permitido", { status: 405 });
  if (!FIRMA || req.headers.get("x-tratto-firma") !== FIRMA) {
    return new Response("no autorizado", { status: 401 });
  }
  let asunto = "", texto = "";
  try {
    const b = await req.json();
    asunto = String(b.asunto ?? "").slice(0, 200);
    texto = String(b.texto ?? "").slice(0, 5000);
  } catch {
    return new Response("json inválido", { status: 400 });
  }
  if (!asunto) return new Response("falta asunto", { status: 400 });

  const clave = await config("brevo_api_key");
  const usuario = await config("brevo_smtp_user");
  if (!clave?.startsWith("xsmtpsib") || !usuario) {
    return Response.json({ ok: false, motivo: "falta la clave SMTP de Brevo en config_app" }, { status: 500 });
  }
  const smtp = new SMTPClient({
    connection: { hostname: "smtp-relay.brevo.com", port: 465, tls: true, auth: { username: usuario, password: clave } },
  });
  try {
    await smtp.send({ from: REMITENTE, to: DESTINO, subject: `[Tratto] ${asunto}`, content: texto });
    return Response.json({ ok: true });
  } catch (e) {
    console.error("avisar-equipo", e);
    return Response.json({ ok: false, motivo: String((e as Error)?.message ?? e).slice(0, 200) }, { status: 502 });
  } finally {
    try { await smtp.close(); } catch { /* nada */ }
  }
});
