// Lógica de la función trabajo-protegido, sin Deno ni red: todo lo de afuera
// (base, Storage, Mercado Pago) entra por parámetro, así se prueba con
// handler.test.mjs sin tocar producción.
//
// Acciones:
//   clave   (cliente con sesión)  → clave pública de Mercado Pago de Tratto,
//                                   para que la tarjeta se tokenice a su nombre.
//   cobrar  (cliente con sesión)  → cobra la cuota con la cuenta de Tratto y
//                                   activa la protección.
//   devolver (base, con firma)    → devuelve las cuotas que soporte aprobó.
//   limpiar  (base, con firma)    → borra las fotos de identidad que ya no
//                                   hacen falta (decididas, viejas o huérfanas).

const ORIGENES = ['https://www.trattoapp.com.ar', 'https://trattoapp.com.ar'];

const RECHAZOS = {
  cc_rejected_insufficient_amount: 'La tarjeta no tiene saldo suficiente. Probá con otra.',
  cc_rejected_bad_filled_security_code: 'Revisá el código de seguridad.',
  cc_rejected_bad_filled_date: 'Revisá el vencimiento.',
  cc_rejected_bad_filled_card_number: 'Revisá el número de la tarjeta.',
  cc_rejected_bad_filled_other: 'Revisá los datos de la tarjeta.',
  cc_rejected_call_for_authorize: 'Tu banco pide que autorices el pago. Llamalo y probá de nuevo.',
  cc_rejected_card_disabled: 'La tarjeta está deshabilitada. Probá con otra.',
  cc_rejected_duplicated_payment: 'Ya hiciste un pago igual hace un momento. Esperá unos minutos.',
  cc_rejected_max_attempts: 'Llegaste al límite de intentos con esta tarjeta. Probá con otra.',
};

function cors(req) {
  const origen = req.headers.get('origin') || '';
  return {
    'Access-Control-Allow-Origin': ORIGENES.includes(origen) ? origen : ORIGENES[0],
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  };
}

export function crearHandler({ sb, mp, firma, publicKey }) {
  return async function handler(req) {
    const h = cors(req);
    const json = (cuerpo, status = 200) =>
      new Response(JSON.stringify(cuerpo), { status, headers: { ...h, 'Content-Type': 'application/json' } });

    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: h });
    if (req.method !== 'POST') return json({ error: 'Método no permitido.' }, 405);

    let b;
    try { b = await req.json(); } catch { return json({ error: 'Pedido inválido.' }, 400); }
    const accion = b && b.accion;

    // ── Lo que llama la base (cron o una decisión de soporte) ──
    if (accion === 'devolver' || accion === 'limpiar') {
      if (!firma || req.headers.get('x-tratto-firma') !== firma) return json({ error: 'No autorizado.' }, 401);
      return accion === 'devolver' ? json(await devolver(sb, mp)) : json(await limpiar(sb));
    }

    // ── Lo que llama la app, con la sesión del cliente ──
    const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
    if (!token) return json({ error: 'Iniciá sesión.' }, 401);
    const { data: u, error: eu } = await sb.auth.getUser(token);
    const usuario = u && u.user;
    if (eu || !usuario) return json({ error: 'Tu sesión venció. Volvé a entrar.' }, 401);

    if (!mp || !publicKey) return json({ error: 'Trabajo protegido todavía no está disponible.' }, 503);

    if (accion === 'clave') return json({ public_key: publicKey });

    if (accion === 'cobrar') {
      const id = Number(b.presupuesto_id);
      const cardToken = typeof b.card_token === 'string' ? b.card_token : '';
      const medio = typeof b.payment_method_id === 'string' ? b.payment_method_id : '';
      if (!Number.isSafeInteger(id) || id <= 0 || !cardToken || !medio || cardToken.length > 200 || medio.length > 40) {
        return json({ estado: 'no', detalle: 'Faltan datos del pago.' }, 400);
      }

      const { data: c, error: ec } = await sb.rpc('proteccion_preparar', { p_presupuesto_id: id, p_cliente: usuario.id });
      if (ec || !c) return json({ estado: 'no', detalle: 'No pudimos revisar el presupuesto. Probá de nuevo.' }, 502);
      if (!c.puede) return json({ estado: 'no', detalle: c.motivo || 'Este trabajo no se puede proteger.' }, 409);
      const cuota = Number(c.cuota);

      const pago = await mp.cobrar({
        transaction_amount: cuota,
        token: cardToken,
        description: 'Trabajo protegido de Tratto',
        installments: 1,
        payment_method_id: medio,
        payer: { email: usuario.email },
        external_reference: 'protegido-' + id,
        statement_descriptor: 'TRATTO',
        binary_mode: true,
      }, 'tratto-protegido-' + id + '-' + cardToken);

      if (!pago || pago.status !== 'approved' || !pago.id) {
        const detalle = (pago && RECHAZOS[pago.status_detail]) || 'Mercado Pago rechazó el pago. Probá con otra tarjeta.';
        return json({ estado: 'rechazado', detalle });
      }

      const pagoId = String(pago.id);
      const { data: r, error: er } = await sb.rpc('proteccion_activar', {
        p_presupuesto_id: id, p_cliente: usuario.id, p_pago_id: pagoId, p_cuota: cuota,
      });
      if (!er && r === 'activa') return json({ estado: 'activa', cuota });

      // Se cobró pero no se pudo registrar (o ya estaba protegido): se devuelve
      // en el acto, para que nadie pague por algo que no tiene.
      const dev = await mp.devolver(pagoId, 'tratto-devolucion-auto-' + pagoId);
      const devuelto = !!(dev && dev.id);
      return json({
        estado: 'no',
        detalle: (r === 'duplicado' ? 'Este trabajo ya estaba protegido.' : 'No pudimos registrar la protección.') +
          (devuelto ? ' No te cobramos: devolvimos el pago.' : ' Escribinos a soporte para devolverte el pago.'),
        devuelto,
      }, 409);
    }

    return json({ error: 'Acción desconocida.' }, 400);
  };
}

async function devolver(sb, mp) {
  if (!mp) return { ok: false, motivo: 'sin cuenta de Mercado Pago configurada' };
  const { data, error } = await sb.rpc('proteccion_devoluciones_pendientes');
  if (error) return { ok: false, motivo: 'no se pudo leer la lista' };
  let hechas = 0, fallidas = 0;
  for (const t of data || []) {
    const dev = await mp.devolver(String(t.pago_id), 'tratto-devolucion-' + t.id);
    if (!dev || !dev.id) { fallidas++; continue; }
    const { error: e } = await sb.rpc('proteccion_devuelta', { p_id: t.id, p_devolucion_id: String(dev.id) });
    if (e) fallidas++; else hechas++;
  }
  return { ok: fallidas === 0, hechas, fallidas };
}

async function limpiar(sb) {
  const { data, error } = await sb.rpc('identidad_archivos_por_borrar', { p_limite: 200 });
  if (error) return { ok: false, motivo: 'no se pudo leer la lista' };
  const nombres = (data || []).map(x => (typeof x === 'string' ? x : x && x.identidad_archivos_por_borrar)).filter(Boolean);
  if (!nombres.length) return { ok: true, borradas: 0 };
  const { error: e } = await sb.storage.from('identidad').remove(nombres);
  return e ? { ok: false, motivo: 'Storage no confirmó el borrado' } : { ok: true, borradas: nombres.length };
}

// Mercado Pago con la cuenta de Tratto. Devuelve el cuerpo de la respuesta
// (o null si no hubo respuesta): quien llama decide según status e id.
export function crearMP(accessToken, fetchFn = fetch) {
  if (!accessToken) return null;
  const pedir = async (url, cuerpo, idem) => {
    try {
      const r = await fetchFn(url, {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + accessToken, 'Content-Type': 'application/json', 'X-Idempotency-Key': idem },
        body: JSON.stringify(cuerpo),
      });
      return await r.json().catch(() => null);
    } catch {
      return null;
    }
  };
  return {
    cobrar: (cuerpo, idem) => pedir('https://api.mercadopago.com/v1/payments', cuerpo, idem),
    devolver: (pagoId, idem) =>
      pedir('https://api.mercadopago.com/v1/payments/' + encodeURIComponent(pagoId) + '/refunds', {}, idem),
  };
}
