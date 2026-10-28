// Edge Function: trabajo-protegido
//
// Cobra la cuota de Trabajo protegido (5 % del presupuesto, mínimo $1.500)
// con la cuenta de Mercado Pago de Tratto, devuelve las cuotas que soporte
// aprobó y borra las fotos de identidad que ya no hacen falta. La lógica está
// en handler.mjs (con pruebas en handler.test.mjs).
//
// Secretos (Supabase → Edge Functions → Secrets; nunca en el repo):
//   MP_TRATTO_ACCESS_TOKEN  Access Token de producción de la cuenta de Tratto
//   MP_TRATTO_PUBLIC_KEY    Public Key de producción de la misma cuenta
//   PUSH_TRIGGER_SECRET     la firma que ya usan avisar-equipo y limpieza-fotos
// Sin los dos de Mercado Pago, la función responde "todavía no está
// disponible" y no cobra nada.
//
// Desplegar con verify_jwt=false: la sesión del cliente se valida acá adentro
// (auth.getUser) y las llamadas de la base, con x-tratto-firma.

import { createClient } from "npm:@supabase/supabase-js@2.117.0";
import { crearHandler, crearMP } from "./handler.mjs";

const sb = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
);

Deno.serve(crearHandler({
  sb,
  mp: crearMP(Deno.env.get("MP_TRATTO_ACCESS_TOKEN")),
  firma: Deno.env.get("PUSH_TRIGGER_SECRET"),
  publicKey: Deno.env.get("MP_TRATTO_PUBLIC_KEY"),
}));
