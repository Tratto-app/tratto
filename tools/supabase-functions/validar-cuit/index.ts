// Edge Function: validar-cuit
//
// Confirma con ARCA (padrón ws_sr_padron_a13, gratis) que el nombre y el
// CUIL o CUIT de quien ofrece servicios van juntos. Reemplaza a la foto del
// DNI (fundador, 04/11/2026). La lógica está en handler.mjs, arca.mjs y
// comparar.mjs, con pruebas en handler.test.mjs.
//
// Secretos: PUSH_TRIGGER_SECRET (la firma que ya usan las otras funciones).
// El certificado de ARCA, su clave y el ticket están en la base (la clave, en
// Vault) y se leen con la RPC arca_credencial, que solo responde al servidor.
// Sin certificado cargado, la función responde "pendiente" en silencio y el
// registro sigue como antes.
//
// Desplegar con verify_jwt=false, como trabajo-protegido: la consulta no pide
// sesión (se hace antes de crear la cuenta y tiene límite de intentos), la
// sesión de "confirmar" se valida acá adentro (auth.getUser) y las llamadas
// de la base, con x-tratto-firma.

import { createClient } from "npm:@supabase/supabase-js@2.117.0";
import forge from "npm:node-forge@1.3.1";
import { crearHandler } from "./handler.mjs";
import { crearArca } from "./arca.mjs";

const sb = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
);

Deno.serve(crearHandler({
  sb,
  arca: crearArca({ forge, sb }),
  firma: Deno.env.get("PUSH_TRIGGER_SECRET"),
}));
