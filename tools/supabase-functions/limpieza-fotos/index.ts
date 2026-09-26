// Edge Function: limpieza-fotos
//
// Borra de Storage las fotos que la Política de privacidad promete borrar:
//   * las de pedidos que vencieron sin respuesta (15 días), y
//   * las de cuentas dadas de baja (su carpeta ya no tiene dueño).
// La base no puede borrar archivos de Storage por SQL, por eso esto vive acá.
//
// La llama pg_cron una vez por día (tarea "limpiar-fotos") con el encabezado
// x-tratto-firma = PUSH_TRIGGER_SECRET (en la base: Vault,
// push_firma_quick_service). No recibe parámetros: qué borrar lo decide la
// base (public.fotos_para_borrar). Usa la clave de servicio que Supabase
// inyecta sola en las funciones.

import { createClient } from "npm:@supabase/supabase-js@2";

const sb = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
);

const FIRMA = Deno.env.get("PUSH_TRIGGER_SECRET");

Deno.serve(async (req) => {
  if (!FIRMA || req.headers.get("x-tratto-firma") !== FIRMA) {
    return new Response("no autorizado", { status: 401 });
  }
  const { data, error } = await sb.rpc("fotos_para_borrar", { limite: 200 });
  if (error) {
    console.error("fotos_para_borrar", error);
    return Response.json({ ok: false, paso: "listar" }, { status: 500 });
  }
  const nombres = [...new Set((data ?? []).map((f: { nombre: string }) => f.nombre).filter(Boolean))];
  if (!nombres.length) return Response.json({ ok: true, borradas: 0 });

  const { data: borradas, error: e2 } = await sb.storage.from("publicaciones").remove(nombres);
  if (e2) {
    console.error("storage.remove", e2);
    return Response.json({ ok: false, paso: "borrar" }, { status: 500 });
  }
  // Un archivo que ya no estaba cuenta igual como resuelto: se limpia la referencia.
  const { data: limpias, error: e3 } = await sb.rpc("fotos_borradas", { nombres });
  if (e3) console.error("fotos_borradas", e3);

  console.log(`limpieza-fotos: ${borradas?.length ?? 0} archivos borrados, ${limpias ?? 0} pedidos actualizados`);
  return Response.json({ ok: true, borradas: borradas?.length ?? 0, pedidos: limpias ?? 0 });
});
