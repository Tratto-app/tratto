// node --test tools/supabase-functions/validar-cuit/handler.test.mjs
// Sin red, sin secretos y sin tocar producción: la base y ARCA son dobles que
// anotan lo que se les pidió. La prueba del certificado usa node-forge si
// está instalado (o TRATTO_FORGE_MODULE apunta a él); si no, se saltea.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crearHandler } from './handler.mjs';
import { crearArca } from './arca.mjs';
import {
  cuitValido, tipoPorPrefijo, normalizar, coincidePersona, coincideEmpresa,
  leerPersona, leerTicket, resultadoPara,
} from './comparar.mjs';

const ORIGEN = 'https://www.trattoapp.com.ar';
const CUIL = '20123456786';      // dígito verificador correcto
const CUIT_EMP = '30712345671';

test('los números de prueba son CUIT válidos', () => {
  assert.ok(cuitValido(CUIL));
  assert.ok(cuitValido('30-71234567-1'));
  assert.ok(!cuitValido('20123456781'));
  assert.equal(tipoPorPrefijo(CUIL), 'persona');
  assert.equal(tipoPorPrefijo(CUIT_EMP), 'empresa');
  assert.equal(tipoPorPrefijo('99123456789'), null);
});

test('persona: tildes, mayúsculas, orden y segundo nombre no importan', () => {
  const arca = { apellido: 'GÓMEZ', nombre: 'MARCELA BEATRIZ' };
  for (const ok of ['Marcela Gómez', 'gomez marcela', 'Marcela Beatriz Gomez', 'GÓMEZ, Marcela', 'Marcela  Gómez ']) {
    assert.ok(coincidePersona(ok, arca), ok);
  }
  for (const no of ['Marce Gomes', 'Marcela', 'Gómez', 'Marcela Pérez', 'Ana Gómez', 'Marcela Gómez López']) {
    assert.ok(!coincidePersona(no, arca), no);
  }
});

test('persona: apellidos compuestos y con partículas', () => {
  const arca = { apellido: 'DE LA FUENTE PAZ', nombre: 'JUAN IGNACIO' };
  assert.ok(coincidePersona('Juan de la Fuente', arca));
  assert.ok(coincidePersona('Ignacio Paz', arca));
  assert.ok(!coincidePersona('Juan Ignacio', arca), 'falta el apellido');
  const ñ = { apellido: 'MUÑOZ', nombre: 'IÑAKI' };
  assert.ok(coincidePersona('Iñaki Muñoz', ñ));
  assert.ok(coincidePersona('Inaki Munoz', ñ));
});

test('empresa: el tipo de sociedad, los puntos y las palabras de enlace no cuentan', () => {
  const arca = { razonSocial: 'CLIMATIZAR DEL SUR SOCIEDAD DE RESPONSABILIDAD LIMITADA' };
  for (const ok of ['Climatizar del Sur SRL', 'CLIMATIZAR DEL SUR S.R.L.', 'climatizar sur', 'Climatizar del Sur']) {
    assert.ok(coincideEmpresa(ok, arca), ok);
  }
  for (const no of ['Climatizar', 'Climatizar del Norte SRL', 'Climatizar del Sur Hermanos SRL', 'SRL']) {
    assert.ok(!coincideEmpresa(no, arca), no);
  }
  assert.ok(coincideEmpresa('Obras y Servicios S.A.', { razonSocial: 'OBRAS Y SERVICIOS SA' }));
  assert.ok(coincideEmpresa('Tech Andina SAS', { razonSocial: 'TECH ANDINA SOCIEDAD POR ACCIONES SIMPLIFICADA' }));
});

test('normalizar deja solo letras y números en mayúscula', () => {
  assert.equal(normalizar('  Gómez-Peña, José  '), 'GOMEZ PENA JOSE');
});

const respuesta = persona => '<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body>' +
  '<ns2:getPersonaResponse xmlns:ns2="http://a13.soap.ws.server.puc.sr/"><personaReturn><metadata><fechaHora>x</fechaHora></metadata>' +
  `<persona>${persona}</persona></personaReturn></ns2:getPersonaResponse></soap:Body></soap:Envelope>`;
const falla = texto => '<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body><soap:Fault>' +
  `<faultcode>soap:Server</faultcode><faultstring>${texto}</faultstring></soap:Fault></soap:Body></soap:Envelope>`;

test('lee la persona de ARCA sin confundir los domicilios', () => {
  const r = leerPersona(respuesta('<apellido>INTENTAR</apellido><domicilio><calle>AV LOS INCAS</calle><localidad>MERLO</localidad></domicilio>' +
    '<estadoClave>ACTIVO</estadoClave><idPersona>27015942210</idPersona><nombre>JAZMIN</nombre><tipoClave>CUIT</tipoClave><tipoPersona>FISICA</tipoPersona>'));
  assert.equal(r.estado, 'ok');
  assert.deepEqual(r.persona, { tipoPersona: 'FISICA', tipoClave: 'CUIT', estadoClave: 'ACTIVO', nombre: 'JAZMIN', apellido: 'INTENTAR', razonSocial: '' });
  assert.equal(leerPersona(respuesta('<razonSocial>OBRAS &amp; SERVICIOS SA</razonSocial><estadoClave>ACTIVO</estadoClave><tipoPersona>JURIDICA</tipoPersona>')).persona.razonSocial, 'OBRAS & SERVICIOS SA');
  assert.equal(leerPersona(respuesta('<apellido>X</apellido><nombre>Y</nombre><estadoClave>INACTIVO</estadoClave>')).estado, 'inactiva');
  assert.equal(leerPersona(falla('La Clave (CUIT/CUIL) consultada es inexistente')).estado, 'no_existe');
  assert.equal(leerPersona(falla('La clave (CUIT/CUIL) consultada se encuentra INACTIVA')).estado, 'inactiva');
  assert.equal(leerPersona(falla('No autorizado, par token/sign invalido.')).estado, 'error');
});

test('lee el ticket de WSAA (viene escapado adentro del SOAP)', () => {
  const adentro = '<?xml version="1.0"?><loginTicketResponse><header><expirationTime>2026-11-05T02:00:00.000-03:00</expirationTime></header>' +
    '<credentials><token>TOK+/=</token><sign>SIG==</sign></credentials></loginTicketResponse>';
  const esc = adentro.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const t = leerTicket(`<soapenv:Envelope><soapenv:Body><loginCmsResponse><loginCmsReturn>${esc}</loginCmsReturn></loginCmsResponse></soapenv:Body></soapenv:Envelope>`);
  assert.deepEqual(t, { token: 'TOK+/=', sign: 'SIG==', vence: '2026-11-05T02:00:00.000-03:00' });
  const ya = leerTicket(falla('El CEE ya posee un TA valido para el acceso al WSN solicitado'));
  assert.equal(ya.yaTiene, true);
});

test('resultado: persona elegida con número de empresa y al revés', () => {
  assert.equal(resultadoPara('persona', 'Ana Paz', { tipoPersona: 'JURIDICA', razonSocial: 'ANA PAZ SA' }), 'tipo_distinto');
  assert.equal(resultadoPara('empresa', 'Ana Paz', { tipoPersona: 'FISICA', apellido: 'PAZ', nombre: 'ANA' }), 'tipo_distinto');
  assert.equal(resultadoPara('persona', 'Ana Paz', { tipoPersona: 'FISICA', apellido: 'PAZ', nombre: 'ANA' }), 'coincide');
});

// ── La función entera, con dobles ─────────────────────────────────────────
function pedido(cuerpo, { token, firma, ip = '200.1.2.3' } = {}) {
  const headers = { origin: ORIGEN, 'content-type': 'application/json', 'x-forwarded-for': ip + ', 10.0.0.1' };
  if (token) headers.authorization = 'Bearer ' + token;
  if (firma) headers['x-tratto-firma'] = firma;
  return new Request('https://x/functions/v1/validar-cuit', { method: 'POST', headers, body: JSON.stringify(cuerpo) });
}

function dobles({ configurada = true, persona, estado = 'ok', antes, lote = [], meta = { rol: 'proveedor', nombre: 'Marcela Gómez', cuit: CUIL } } = {}) {
  const log = { rpc: [], arca: [], meta: [] };
  const sb = {
    auth: {
      getUser: async t => t === 'tok' ? { data: { user: { id: 'u1', user_metadata: meta } }, error: null } : { data: { user: null }, error: { message: 'no' } },
      admin: { updateUserById: async (id, x) => { log.meta.push([id, x]); return { error: null }; } },
    },
    rpc: async (nombre, args) => {
      log.rpc.push([nombre, args]);
      if (nombre === 'cuit_antes_de_consultar') return { data: antes ?? { configurada, limite: false }, error: null };
      if (nombre === 'cuit_pendientes_lote') return { data: lote, error: null };
      if (nombre === 'arca_guardar_pedido') return { data: null, error: null };
      return { data: null, error: null };
    },
  };
  const arca = {
    configurada: async () => configurada,
    consultar: async cuit => { log.arca.push(cuit); return estado === 'ok' ? { estado, persona: persona ?? { tipoPersona: 'FISICA', apellido: 'GOMEZ', nombre: 'MARCELA', estadoClave: 'ACTIVO' } } : { estado, detalle: 'x' }; },
    generarPedido: async cuit => ({ clavePem: '-----BEGIN PRIVATE KEY-----\nsecreto', pedidoPem: '-----BEGIN CERTIFICATE REQUEST-----\n' + cuit }),
  };
  return { sb, arca, log };
}
const nombres = log => log.rpc.map(r => r[0]);

test('consultar: coincide, anota la consulta con la huella del nombre y nunca devuelve el nombre de ARCA', async () => {
  const { sb, arca, log } = dobles();
  const r = await crearHandler({ sb, arca, firma: 'f' })(pedido({ accion: 'consultar', cuit: '20-12345678-6', tipo: 'persona', nombre: 'marcela gomez' }));
  const j = await r.json();
  assert.deepEqual(j, { resultado: 'coincide' });
  assert.equal(r.headers.get('access-control-allow-origin'), ORIGEN);
  assert.deepEqual(log.arca, [CUIL]);
  const anota = log.rpc.find(x => x[0] === 'cuit_anotar_consulta')[1];
  assert.match(anota.p_nombre_hash, /^[0-9a-f]{64}$/);
  assert.match(anota.p_origen, /^[0-9a-f]{64}$/, 'la IP se guarda como huella, no tal cual');
  assert.equal(anota.p_resultado, 'coincide');
  assert.ok(!JSON.stringify(log.rpc).includes('marcela'), 'el nombre escrito no se guarda');
});

test('consultar: no coincide, no existe, inactiva y ARCA caída', async () => {
  const casos = [
    [{ persona: { tipoPersona: 'FISICA', apellido: 'PEREZ', nombre: 'JUAN' } }, 'no_coincide'],
    [{ estado: 'no_existe' }, 'no_existe'],
    [{ estado: 'inactiva' }, 'inactiva'],
    [{ estado: 'error' }, 'pendiente'],
  ];
  for (const [op, esperado] of casos) {
    const { sb, arca } = dobles(op);
    const j = await (await crearHandler({ sb, arca })(pedido({ accion: 'consultar', cuit: CUIL, tipo: 'persona', nombre: 'Marcela Gómez' }))).json();
    assert.equal(j.resultado, esperado);
  }
});

test('consultar: sin certificado cargado responde pendiente en silencio y no llama a ARCA', async () => {
  const { sb, arca, log } = dobles({ configurada: false });
  const j = await (await crearHandler({ sb, arca })(pedido({ accion: 'consultar', cuit: CUIL, tipo: 'persona', nombre: 'Marcela Gómez' }))).json();
  assert.deepEqual(j, { resultado: 'pendiente', silencioso: true });
  assert.deepEqual(log.arca, []);
});

test('consultar: usa lo guardado y respeta el límite sin llamar a ARCA', async () => {
  const c = dobles({ antes: { configurada: true, cache: 'no_coincide' } });
  assert.equal((await (await crearHandler(c)(pedido({ accion: 'consultar', cuit: CUIL, tipo: 'persona', nombre: 'Ana Paz' }))).json()).resultado, 'no_coincide');
  const l = dobles({ antes: { configurada: true, limite: true } });
  assert.equal((await (await crearHandler(l)(pedido({ accion: 'consultar', cuit: CUIL, tipo: 'persona', nombre: 'Ana Paz' }))).json()).resultado, 'limite');
  assert.deepEqual([...c.log.arca, ...l.log.arca], []);
});

test('consultar: número de empresa con "Por mi cuenta" se frena sin ARCA; datos malos, 400', async () => {
  const { sb, arca, log } = dobles();
  const h = crearHandler({ sb, arca });
  assert.equal((await (await h(pedido({ accion: 'consultar', cuit: CUIT_EMP, tipo: 'persona', nombre: 'Ana Paz' }))).json()).resultado, 'tipo_distinto');
  assert.equal((await h(pedido({ accion: 'consultar', cuit: '20123456781', tipo: 'persona', nombre: 'Ana Paz' }))).status, 400);
  assert.equal((await h(pedido({ accion: 'consultar', cuit: CUIL, tipo: 'otra', nombre: 'Ana Paz' }))).status, 400);
  assert.equal((await h(pedido({ accion: 'consultar', cuit: CUIL, tipo: 'persona', nombre: 'A' }))).status, 400);
  assert.deepEqual(log.arca, []);
});

test('confirmar: con los datos de la cuenta, pone el sello', async () => {
  const { sb, arca, log } = dobles();
  const j = await (await crearHandler({ sb, arca })(pedido({ accion: 'confirmar' }, { token: 'tok' }))).json();
  assert.deepEqual(j, { resultado: 'coincide' });
  assert.deepEqual(log.rpc.find(x => x[0] === 'cuit_marcar_verificado')[1], { p_user: 'u1', p_cuit: CUIL, p_tipo: 'persona' });
  assert.deepEqual(log.meta, [], 'no toca los datos de la cuenta');
});

test('confirmar: si no coincide, deja el estado para pedírselo en la app', async () => {
  const { sb, arca, log } = dobles({ persona: { tipoPersona: 'FISICA', apellido: 'PEREZ', nombre: 'JUAN' } });
  const j = await (await crearHandler({ sb, arca })(pedido({ accion: 'confirmar' }, { token: 'tok' }))).json();
  assert.equal(j.resultado, 'no_coincide');
  assert.deepEqual(log.rpc.find(x => x[0] === 'cuit_marcar_estado')[1], { p_user: 'u1', p_resultado: 'no_coincide' });
  assert.ok(!nombres(log).includes('cuit_marcar_verificado'));
});

test('confirmar desde la hoja: si coincide con otro número, ese pasa a ser su CUIT', async () => {
  const { sb, arca, log } = dobles({ meta: { rol: 'proveedor', nombre: 'Pinturería Gómez', cuit: '20111111112' } });
  const j = await (await crearHandler({ sb, arca })(pedido({ accion: 'confirmar', cuit: CUIL, tipo: 'persona', nombre: 'Marcela Gómez' }, { token: 'tok' }))).json();
  assert.equal(j.resultado, 'coincide');
  assert.equal(log.meta.length, 1);
  assert.equal(log.meta[0][1].user_metadata.cuit, CUIL);
  assert.equal(log.meta[0][1].user_metadata.nombre, 'Pinturería Gómez', 'el nombre que ven los clientes no cambia');
});

test('confirmar: sin sesión, 401; cliente, no aplica; sin CUIT, sin_cuit', async () => {
  let d = dobles();
  assert.equal((await crearHandler(d)(pedido({ accion: 'confirmar' }))).status, 401);
  d = dobles({ meta: { rol: 'cliente', nombre: 'Ana' } });
  assert.equal((await (await crearHandler(d)(pedido({ accion: 'confirmar' }, { token: 'tok' }))).json()).resultado, 'no_aplica');
  d = dobles({ meta: { rol: 'proveedor', nombre: 'Ana Paz' } });
  assert.equal((await (await crearHandler(d)(pedido({ accion: 'confirmar' }, { token: 'tok' }))).json()).resultado, 'sin_cuit');
});

test('revisar, generar_pedido y probar: solo con la firma del servidor', async () => {
  const { sb, arca } = dobles();
  const h = crearHandler({ sb, arca, firma: 'secreta' });
  for (const accion of ['revisar', 'generar_pedido', 'probar']) {
    assert.equal((await h(pedido({ accion, cuit: CUIL }))).status, 401, accion);
    assert.equal((await h(pedido({ accion, cuit: CUIL }, { firma: 'otra' }))).status, 401, accion);
  }
  const sinFirma = crearHandler({ sb, arca });
  assert.equal((await sinFirma(pedido({ accion: 'revisar' }, { firma: 'x' }))).status, 401, 'sin firma configurada no entra nadie');
});

test('revisar: chequea el lote, pone sellos y marca a quien no tiene CUIT', async () => {
  const { sb, arca, log } = dobles({ lote: [
    { user_id: 'a', cuit: CUIL, tipo: null, nombre: 'Marcela Gómez' },
    { user_id: 'b', cuit: CUIL, tipo: 'persona', nombre: 'Otro Nombre' },
    { user_id: 'c', cuit: '', tipo: null, nombre: 'Sin Cuit' },
  ] });
  const j = await (await crearHandler({ sb, arca, firma: 'f' })(pedido({ accion: 'revisar' }, { firma: 'f' }))).json();
  assert.deepEqual(j, { revisadas: 3, coincide: 1, no_coincide: 1, sin_cuit: 1 });
  assert.equal(log.rpc.find(x => x[0] === 'cuit_antes_de_consultar')[1].p_origen, 'revision');
});

test('revisar: sin certificado no hace nada', async () => {
  const { sb, arca, log } = dobles({ configurada: false });
  const j = await (await crearHandler({ sb, arca, firma: 'f' })(pedido({ accion: 'revisar' }, { firma: 'f' }))).json();
  assert.deepEqual(j, { revisadas: 0, motivo: 'sin_configurar' });
  assert.deepEqual(log.rpc, []);
});

test('generar_pedido: guarda la clave en la base y devuelve solo el pedido', async () => {
  const { sb, arca, log } = dobles({ configurada: false });
  const j = await (await crearHandler({ sb, arca, firma: 'f' })(pedido({ accion: 'generar_pedido', cuit: '20-47254863-9' }, { firma: 'f' }))).json();
  assert.match(j.pedido, /^-----BEGIN CERTIFICATE REQUEST-----/);
  assert.ok(!JSON.stringify(j).includes('PRIVATE KEY'), 'la clave no sale de la función');
  assert.equal(log.rpc[0][0], 'arca_guardar_pedido');
  const ya = dobles({ configurada: true });
  assert.equal((await crearHandler({ ...ya, firma: 'f' })(pedido({ accion: 'generar_pedido', cuit: '20472548639' }, { firma: 'f' }))).status, 409);
});

// ── Certificado y firma de verdad (con node-forge, si está) ───────────────
let forge = null;
try { forge = (await import(process.env.TRATTO_FORGE_MODULE || 'node-forge')).default; } catch {}

test('pedido del certificado y firma del ticket con forge', { skip: !forge && 'node-forge no está instalado' }, async () => {
  const guardado = {};
  const sb = { rpc: async (n, a) => { guardado[n] = a; return { data: {}, error: null }; } };
  const a = crearArca({ forge, sb, fetch: async () => { throw new Error('sin red'); } });
  const { clavePem, pedidoPem } = await a.generarPedido('20472548639');
  assert.match(clavePem, /^-----BEGIN PRIVATE KEY-----/);
  const csr = forge.pki.certificationRequestFromPem(pedidoPem);
  assert.ok(csr.verify());
  assert.equal(csr.subject.attributes.find(x => x.type === '2.5.4.5').value, 'CUIT 20472548639');
  assert.equal(csr.subject.getField('C').value, 'AR');
  // Certificado de prueba firmado por uno mismo, para firmar el pedido de ticket.
  const cert = forge.pki.createCertificate();
  cert.publicKey = csr.publicKey; cert.serialNumber = '01';
  cert.validity.notBefore = new Date(); cert.validity.notAfter = new Date(Date.now() + 864e5);
  cert.setSubject(csr.subject.attributes); cert.setIssuer(csr.subject.attributes);
  cert.sign(forge.pki.privateKeyFromPem(clavePem), forge.md.sha256.create());
  const cms = a.firmarTRA({ certificado: forge.pki.certificateToPem(cert), clave: clavePem });
  const der = forge.util.decode64(cms);
  const p7 = forge.pkcs7.messageFromAsn1(forge.asn1.fromDer(der));
  assert.equal(p7.certificates.length, 1);
  assert.ok(der.includes('<service>ws_sr_padron_a13</service>'), 'el pedido de ticket va adentro del CMS');
});
