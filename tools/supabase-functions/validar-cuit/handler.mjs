// Lógica de la función validar-cuit, sin Deno ni red: la base y ARCA entran
// por parámetro, así se prueba con handler.test.mjs sin tocar producción.
//
// Acciones:
//   consultar (la app, con o sin sesión) → ¿el nombre coincide con el de ese
//       CUIL o CUIT en ARCA? Responde solo el resultado, nunca el nombre de
//       ARCA. Con límite de intentos por conexión y por número.
//   confirmar (la app, con sesión) → vuelve a chequear los datos de la cuenta
//       (o los que manda la hoja "Confirmá tu CUIL") y, si coinciden, le pone
//       el sello. Lo llama la app apenas se crea la cuenta.
//   revisar (la base, con firma) → chequea a quienes ofrecen servicios que
//       todavía no tienen sello (las cuentas viejas y las que quedaron
//       pendientes porque ARCA no respondió).
//   generar_pedido (la base, con firma) → arma la clave y el pedido del
//       certificado. La clave queda en Vault; sale solo el pedido.
//   probar (la base, con firma) → consulta un número y dice qué trajo ARCA,
//       sin nombres. Para comprobar que la conexión anda.

import { cuitValido, soloNumeros, tipoPorPrefijo, normalizar, resultadoPara } from './comparar.mjs';

const ORIGENES = ['https://www.trattoapp.com.ar', 'https://trattoapp.com.ar'];

function cors(req) {
  const origen = req.headers.get('origin') || '';
  return {
    'Access-Control-Allow-Origin': ORIGENES.includes(origen) ? origen : ORIGENES[0],
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  };
}

async function sha256(texto, c = globalThis.crypto) {
  const b = await c.subtle.digest('SHA-256', new TextEncoder().encode(texto));
  return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
}

// Lo que mandó la app, limpio. null si algo no cierra.
function datos(b) {
  const cuit = soloNumeros(b && b.cuit);
  const tipo = b && b.tipo;
  const nombre = String((b && b.nombre) ?? '').trim();
  if (!cuitValido(cuit) || !['persona', 'empresa'].includes(tipo)) return null;
  if (nombre.length < 2 || nombre.length > 120) return null;
  return { cuit, tipo, nombre };
}

export function crearHandler({ sb, arca, firma, crypto: c = globalThis.crypto }) {
  const hashNombre = (d) => sha256(d.tipo + '|' + normalizar(d.nombre), c);

  // Chequea un número contra ARCA (o la respuesta guardada de las últimas 24
  // horas) y anota la consulta. origen: de dónde vino, para el límite.
  async function chequear(d, origen, userId = null) {
    // El tipo de número tiene que ir con lo que eligió: no hace falta ARCA.
    if (tipoPorPrefijo(d.cuit) && tipoPorPrefijo(d.cuit) !== d.tipo) return { resultado: 'tipo_distinto' };
    const nombreHash = await hashNombre(d);
    const { data: antes, error: ea } = await sb.rpc('cuit_antes_de_consultar',
      { p_cuit: d.cuit, p_tipo: d.tipo, p_nombre_hash: nombreHash, p_origen: origen });
    if (ea) return { resultado: 'pendiente' };
    if (antes && antes.configurada === false) return { resultado: 'pendiente', silencioso: true };
    if (antes && antes.cache) return { resultado: antes.cache };
    if (antes && antes.limite) return { resultado: 'limite' };

    const r = await arca.consultar(d.cuit);
    let resultado;
    if (r.estado === 'ok') resultado = resultadoPara(d.tipo, d.nombre, r.persona);
    else if (r.estado === 'no_existe' || r.estado === 'inactiva') resultado = r.estado;
    else if (r.estado === 'sin_configurar') return { resultado: 'pendiente', silencioso: true };
    else resultado = 'pendiente';
    await sb.rpc('cuit_anotar_consulta', {
      p_cuit: d.cuit, p_tipo: d.tipo, p_nombre_hash: nombreHash, p_resultado: resultado,
      p_origen: origen, p_user: userId, p_detalle: r.estado === 'error' ? r.detalle : null,
    });
    return { resultado };
  }

  // Deja asentado el resultado de una cuenta: sello si coincide; si no, el
  // estado para que la app le pida corregirlo (o para reintentar si ARCA no
  // respondió).
  async function asentar(userId, d, resultado) {
    if (resultado === 'coincide') {
      const { error } = await sb.rpc('cuit_marcar_verificado', { p_user: userId, p_cuit: d.cuit, p_tipo: d.tipo });
      if (error) return 'pendiente';
    } else if (resultado !== 'limite') {
      await sb.rpc('cuit_marcar_estado', { p_user: userId, p_resultado: resultado });
    }
    return resultado;
  }

  return async function handler(req) {
    const h = cors(req);
    const json = (cuerpo, status = 200) =>
      new Response(JSON.stringify(cuerpo), { status, headers: { ...h, 'Content-Type': 'application/json' } });

    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: h });
    if (req.method !== 'POST') return json({ error: 'Método no permitido.' }, 405);

    let b;
    try { b = await req.json(); } catch { return json({ error: 'Pedido inválido.' }, 400); }
    const accion = b && b.accion;

    // ── Lo que llama la base, con la firma del servidor ──
    if (['revisar', 'generar_pedido', 'probar'].includes(accion)) {
      if (!firma || req.headers.get('x-tratto-firma') !== firma) return json({ error: 'No autorizado.' }, 401);

      if (accion === 'generar_pedido') {
        const cuit = soloNumeros(b.cuit);
        if (!cuitValido(cuit)) return json({ error: 'CUIT inválido.' }, 400);
        if (await arca.configurada() && b.forzar !== true) return json({ error: 'Ya hay un certificado cargado.' }, 409);
        const { clavePem, pedidoPem } = await arca.generarPedido(cuit);
        const { error } = await sb.rpc('arca_guardar_pedido', { p_cuit: cuit, p_clave: clavePem, p_pedido: pedidoPem });
        if (error) return json({ error: 'No se pudo guardar: ' + error.message }, 500);
        return json({ pedido: pedidoPem });
      }

      if (accion === 'probar') {
        const cuit = soloNumeros(b.cuit);
        if (!cuitValido(cuit)) return json({ error: 'CUIT inválido.' }, 400);
        const r = await arca.consultar(cuit);
        const p = r.persona || {};
        return json({ estado: r.estado, detalle: r.detalle || null, tipoPersona: p.tipoPersona || null,
          tipoClave: p.tipoClave || null, trae_nombre: !!p.nombre, trae_apellido: !!p.apellido, trae_razon: !!p.razonSocial });
      }

      // revisar
      if (!(await arca.configurada())) return json({ revisadas: 0, motivo: 'sin_configurar' });
      const { data: lote, error } = await sb.rpc('cuit_pendientes_lote', { p_limite: Math.min(Number(b.limite) || 20, 50) });
      if (error) return json({ error: error.message }, 500);
      const cuenta = {};
      for (const x of lote || []) {
        const d = datos({ cuit: x.cuit, tipo: x.tipo || tipoPorPrefijo(x.cuit), nombre: x.nombre });
        if (!d) { await sb.rpc('cuit_marcar_estado', { p_user: x.user_id, p_resultado: 'sin_cuit' }); cuenta.sin_cuit = (cuenta.sin_cuit || 0) + 1; continue; }
        const { resultado } = await chequear(d, 'revision', x.user_id);
        const fin = await asentar(x.user_id, d, resultado);
        cuenta[fin] = (cuenta[fin] || 0) + 1;
      }
      return json({ revisadas: (lote || []).length, ...cuenta });
    }

    // ── Lo que llama la app ──
    if (accion === 'consultar') {
      const d = datos(b);
      if (!d) return json({ error: 'Faltan datos.' }, 400);
      const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'sin-ip';
      return json(await chequear(d, await sha256('ip|' + ip, c)));
    }

    if (accion === 'confirmar') {
      const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
      const { data: u, error: eu } = token ? await sb.auth.getUser(token) : { data: null, error: true };
      const usuario = u && u.user;
      if (eu || !usuario) return json({ error: 'Iniciá sesión.' }, 401);
      const meta = usuario.user_metadata || {};
      if (meta.rol !== 'proveedor') return json({ resultado: 'no_aplica' });

      // Con datos: la hoja "Confirmá tu CUIL" de las cuentas que ya estaban.
      // Sin datos: los que la persona cargó al crear la cuenta.
      const propios = b.cuit !== undefined;
      const d = datos(propios ? b : { cuit: meta.cuit, tipo: meta.cuit_tipo || tipoPorPrefijo(meta.cuit), nombre: meta.nombre });
      if (!d) return json({ resultado: propios ? 'datos' : 'sin_cuit' }, propios ? 400 : 200);

      const r = await chequear(d, await sha256('user|' + usuario.id, c), usuario.id);
      if (r.silencioso) return json(r);
      const resultado = await asentar(usuario.id, d, r.resultado);
      // Si corrigió el número desde la hoja y coincide, ese pasa a ser su CUIT.
      if (propios && resultado === 'coincide' && (meta.cuit !== d.cuit || meta.cuit_tipo !== d.tipo)) {
        await sb.auth.admin.updateUserById(usuario.id, { user_metadata: { ...meta, cuit: d.cuit, cuit_tipo: d.tipo } });
      }
      return json({ resultado });
    }

    return json({ error: 'Acción desconocida.' }, 400);
  };
}
