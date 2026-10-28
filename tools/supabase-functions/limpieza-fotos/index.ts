// Edge Function: limpieza-fotos
//
// Borra de Storage las fotos que la Política de privacidad promete borrar:
//   * las de pedidos que vencieron sin respuesta (15 días), y
//   * las de cuentas dadas de baja (su carpeta ya no tiene dueño), y
//   * las evidencias privadas puestas en cola al eliminar acuerdos/reclamos,
//     o subidas huérfanas seleccionadas por la RPC de mantenimiento.
// La base no puede borrar archivos de Storage por SQL, por eso esto vive acá.
//
// La llama pg_cron una vez por día (tarea "limpiar-fotos") con el encabezado
// x-tratto-firma = PUSH_TRIGGER_SECRET (en la base: Vault,
// push_firma_quick_service). No recibe parámetros: qué borrar lo decide la
// base (public.fotos_para_borrar). Usa la clave de servicio que Supabase
// inyecta sola en las funciones.

import { createClient } from "npm:@supabase/supabase-js@2.117.0";
import { createCleanupHandler } from "./handler.mjs";

const sb = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
);

const FIRMA = Deno.env.get("PUSH_TRIGGER_SECRET");

Deno.serve(createCleanupHandler(sb, FIRMA));
