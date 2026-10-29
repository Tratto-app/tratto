// Lógica de la función pago-mp, sin Deno ni red: todo lo de afuera (base y
// Mercado Pago) entra por parámetro, así se prueba con handler.test.mjs sin
// tocar producción.
//
// Pagar un presupuesto en la página de Mercado Pago (Checkout Pro), además de
// con tarjeta dentro de la app. Ahí la persona paga con el dinero de su cuenta
// de Mercado Pago (que se carga con una transferencia desde cualquier banco),
// con tarjeta o en cuotas sin tarjeta. El cobro va a la cuenta de quien hizo el
// trabajo, con la comisión de Tratto (marketplace_fee), igual que con tarjeta.
// Efectivo (Rapipago, Pago Fácil) queda afuera: tarda días en acreditarse.
//
// Acciones:
//   preferencia (cliente con sesión) → arma el pago en Mercado Pago y devuelve
//                                      el link para ir a pagar.
//   verificar   (cliente con sesión) → al volver de Mercado Pago, le pregunta a
//                                      Mercado Pago si el pago salió y lo registra.
//   aviso       (Mercado Pago)       → la notificación de pago; se confirma igual,
//                                      preguntándole a Mercado Pago (no se cree
//                                      en lo que llega).
//   medio       (cliente con sesión) → si quien cobra tiene un cobro sin comisión
//                                      (premio de referidos): la app lo manda a
//                                      pagar acá en vez de con tarjeta por n8n.
//
// Premio de referidos: si quien cobra tiene un cobro sin comisión libre, se
// reserva para este presupuesto (credito_cobro_reservar) y el pago va sin
// marketplace_fee; al confirmarse, el premio queda usado (credito_cobro_usar).

export const COMISION_PORC = 3;
const APP = 'https://www.trattoapp.com.ar';
const ORIGENES = [APP, 'https://trattoapp.com.ar'];

// Igual que JURISDICCION en index.html: se guarda en el momento del cobro.
const JURISDICCION = {
  CABA: 'CABA',
  'GBA Norte': 'PBA', 'GBA Oeste': 'PBA', 'GBA Sur': 'PBA',
  'Buenos Aires (interior)': 'PBA',
};
const jurisdiccionDe = zona => JURISDICCION[zona] || null;

function cors(req) {
  const origen = req.headers.get('origin') || '';
  return {
    'Access-Control-Allow-Origin': ORIGENES.includes(origen) ? origen : ORIGENES[0],
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  };
}

// El presupuesto, las partes y la cuenta de Mercado Pago de quien cobra.
async function leerCobro(sb, id) {
  const { data: x } = await sb.from('mensajes')
    .select('id,match_id,tipo,monto,estado_presupuesto,trabajo_estado,pago_estado')
    .eq('id', id).maybeSingle();
  if (!x || x.tipo !== 'presupuesto') return null;
  const { data: m } = await sb.from('matches')
    .select('id,solicitudes(user_id,zona,servicio_necesitado),proveedores(user_id,zona)')
    .eq('id', x.match_id).maybeSingle();
  if (!m || !m.solicitudes || !m.proveedores) return null;
  const { data: c } = await sb.from('cuentas_mp').select('access_token')
    .eq('user_id', m.proveedores.user_id).maybeSingle();
  return { x, m, token: (c && c.access_token) || null };
}

// Pregunta a Mercado Pago por el pago y, si es de este presupuesto, salió y es
// por el monto, lo deja registrado. Se puede llamar varias veces.
async function confirmar(sb, mp, cobro, pagoId) {
  const { x, m } = cobro;
  if (x.pago_estado) return { estado: 'cobrado' };
  const pago = await mp.pago(pagoId);
  if (!pago || !pago.id) return { estado: 'no', detalle: 'Mercado Pago no encuentra ese pago.' };
  if (pago.external_reference !== 'presu-' + x.id) return { estado: 'no', detalle: 'Ese pago no es de este presupuesto.' };
  if (pago.status !== 'approved') return { estado: pago.status || 'no', detalle: 'El pago no se completó.' };
  if (pago.currency_id !== 'ARS' || Number(pago.transaction_amount) + 0.5 < Number(x.monto)) {
    return { estado: 'no', detalle: 'El monto pagado no coincide con el presupuesto. Escribinos a soporte.' };
  }
  await sb.rpc('credito_cobro_usar', { p_presupuesto_id: x.id });
  const { error } = await sb.from('mensajes').update({
    pago_id: String(pago.id), pago_estado: 'cobrado',
    jurisdiccion_proveedor: jurisdiccionDe(m.proveedores.zona),
    jurisdiccion_trabajo: jurisdiccionDe(m.solicitudes.zona),
    zona_proveedor: m.proveedores.zona || null,
    zona_trabajo: m.solicitudes.zona || null,
  }).eq('id', x.id).is('pago_estado', null);
  if (error) return { estado: 'no', detalle: 'Se pagó, pero no pudimos registrarlo. Escribinos a soporte.' };
  return { estado: 'cobrado' };
}

export function crearHandler({ sb, mpDe, urlFuncion, app = APP }) {
  return async function handler(req) {
    const h = cors(req);
    const json = (cuerpo, status = 200) =>
      new Response(JSON.stringify(cuerpo), { status, headers: { ...h, 'Content-Type': 'application/json' } });

    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: h });
    if (req.method !== 'POST') return json({ error: 'Método no permitido.' }, 405);

    const url = new URL(req.url);
    let b = {};
    try { b = await req.json(); } catch { b = {}; }

    // ── La notificación de Mercado Pago ──
    if (url.searchParams.get('aviso') === '1') {
      const id = Number(url.searchParams.get('presu'));
      const tipo = b.type || b.topic || url.searchParams.get('type') || url.searchParams.get('topic');
      const pagoId = String((b.data && b.data.id) || url.searchParams.get('data.id') || url.searchParams.get('id') || '');
      if (tipo !== 'payment' || !pagoId || !Number.isSafeInteger(id) || id <= 0) return json({ ok: true });
      const cobro = await leerCobro(sb, id);
      if (!cobro || !cobro.token) return json({ ok: true });
      return json(await confirmar(sb, mpDe(cobro.token), cobro, pagoId));
    }

    // ── Lo que llama la app, con la sesión del cliente ──
    const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
    if (!token) return json({ error: 'Iniciá sesión.' }, 401);
    const { data: u, error: eu } = await sb.auth.getUser(token);
    const usuario = u && u.user;
    if (eu || !usuario) return json({ error: 'Tu sesión venció. Volvé a entrar.' }, 401);

    const id = Number(b.presupuesto_id);
    if (!Number.isSafeInteger(id) || id <= 0) return json({ error: 'Falta el presupuesto.' }, 400);
    const cobro = await leerCobro(sb, id);
    if (!cobro || cobro.m.solicitudes.user_id !== usuario.id) return json({ error: 'Ese presupuesto no es tuyo.' }, 403);
    const { x, m } = cobro;

    if (b.accion === 'medio') {
      const { data: libres } = await sb.from('creditos').select('id,reservado_en')
        .eq('user_id', m.proveedores.user_id).eq('tipo', 'cobro_sin_comision').is('usado_at', null);
      return json({ sin_comision: (libres || []).some(k => k.reservado_en == null || Number(k.reservado_en) === id) });
    }

    if (b.accion === 'preferencia') {
      if (x.pago_estado) return json({ error: 'Ese trabajo ya está pagado.' }, 409);
      if (x.estado_presupuesto !== 'aceptado' || x.trabajo_estado !== 'terminado') {
        return json({ error: 'Se paga cuando quien hizo el trabajo lo da por terminado.' }, 409);
      }
      if (!cobro.token) return json({ error: 'Quien hizo el trabajo todavía no conectó su cuenta de Mercado Pago.' }, 409);
      const monto = Number(x.monto);
      const { data: sinComision } = await sb.rpc('credito_cobro_reservar', { p_proveedor: m.proveedores.user_id, p_presupuesto_id: id });
      const pref = await mpDe(cobro.token).preferencia({
        items: [{
          id: 'presu-' + id,
          title: 'Tratto · ' + (m.solicitudes.servicio_necesitado || 'servicio'),
          description: 'Presupuesto #' + id,
          quantity: 1, unit_price: monto, currency_id: 'ARS',
        }],
        marketplace_fee: sinComision === true ? 0 : Math.round(monto * COMISION_PORC / 100),
        external_reference: 'presu-' + id,
        payer: { email: usuario.email },
        back_urls: { success: app + '/?pago_mp=' + id, pending: app + '/?pago_mp=' + id, failure: app + '/?pago_mp=' + id },
        auto_return: 'approved',
        notification_url: urlFuncion + '?aviso=1&presu=' + id,
        payment_methods: { excluded_payment_types: [{ id: 'ticket' }, { id: 'atm' }] },
        statement_descriptor: 'TRATTO',
        binary_mode: true,
      }, 'tratto-pref-' + id + '-' + Date.now());
      if (!pref || !pref.init_point) {
        return json({ error: 'Mercado Pago no respondió. Probá de nuevo o pagá con tarjeta desde acá.' }, 502);
      }
      return json({ link: pref.init_point, sin_comision: sinComision === true });
    }

    if (b.accion === 'verificar') {
      const pagoId = typeof b.pago_id === 'string' ? b.pago_id.trim() : '';
      if (!/^\d{1,20}$/.test(pagoId)) return json({ estado: 'no', detalle: 'El pago no se completó.' });
      if (!cobro.token && !x.pago_estado) return json({ estado: 'no', detalle: 'No pudimos confirmar el pago.' });
      return json(await confirmar(sb, cobro.token ? mpDe(cobro.token) : null, cobro, pagoId));
    }

    return json({ error: 'Acción desconocida.' }, 400);
  };
}

// Mercado Pago con la cuenta de quien cobra. Devuelve el cuerpo de la
// respuesta (o null si no hubo respuesta).
export function crearMP(accessToken, fetchFn = fetch) {
  const pedir = async (url, init) => {
    try {
      const r = await fetchFn(url, init);
      return await r.json().catch(() => null);
    } catch {
      return null;
    }
  };
  const cab = { Authorization: 'Bearer ' + accessToken };
  return {
    preferencia: (cuerpo, idem) => pedir('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: { ...cab, 'Content-Type': 'application/json', 'X-Idempotency-Key': idem },
      body: JSON.stringify(cuerpo),
    }),
    pago: id => pedir('https://api.mercadopago.com/v1/payments/' + encodeURIComponent(id), { headers: cab }),
  };
}
