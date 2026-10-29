// Edge Function: pago-mp
//
// Pagar un presupuesto en la página de Mercado Pago (Checkout Pro): con el
// dinero de la cuenta de Mercado Pago (que se carga con una transferencia),
// con tarjeta o en cuotas sin tarjeta. Cobra la cuenta de quien hizo el
// trabajo (token de cuentas_mp) con la comisión de Tratto. La lógica está en
// handler.mjs (con pruebas en handler.test.mjs).
//
// No necesita secretos propios: usa el token que cada persona conectó.
// Desplegar con verify_jwt=false: la sesión del cliente se valida acá adentro
// (auth.getUser) y la notificación de Mercado Pago no trae sesión (se confirma
// preguntándole a Mercado Pago por el pago).

import { createClient } from "npm:@supabase/supabase-js@2.117.0";
import { crearHandler, crearMP } from "./handler.mjs";

const url = Deno.env.get("SUPABASE_URL")!;
const sb = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

Deno.serve(crearHandler({
  sb,
  mpDe: (token: string) => crearMP(token),
  urlFuncion: url + "/functions/v1/pago-mp",
}));
