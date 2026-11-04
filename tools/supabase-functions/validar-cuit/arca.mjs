// Conexión con ARCA: el ticket de acceso (WSAA) y la consulta al padrón
// (ws_sr_padron_a13). Las dos son gratis; piden un certificado digital de
// Tratto, adherido al servicio desde la clave fiscal del titular.
//
// La clave privada se genera adentro de esta función (accion generar_pedido)
// y va directo a Vault: nunca pasa por el chat, el repo ni la computadora de
// nadie. Afuera sale solo el pedido del certificado, que es público.
//
// Todo lo de afuera (forge, fetch, la base) entra por parámetro.

import { leerPersona, leerTicket } from './comparar.mjs';

export const URLS = {
  wsaa: 'https://wsaa.afip.gov.ar/ws/services/LoginCms',
  a13: 'https://aws.afip.gov.ar/sr-padron/webservices/personaServiceA13',
};
const SERVICIO = 'ws_sr_padron_a13';

const enPem = (tipo, der) => {
  const b64 = btoa(String.fromCharCode(...new Uint8Array(der)));
  return `-----BEGIN ${tipo}-----\n${b64.match(/.{1,64}/g).join('\n')}\n-----END ${tipo}-----\n`;
};

export function crearArca({ forge, fetch: f = fetch, sb, crypto: c = globalThis.crypto, ahora = () => new Date(), esperar = ms => new Promise(r => setTimeout(r, ms)) }) {
  async function credencial() {
    const { data, error } = await sb.rpc('arca_credencial');
    if (error) throw new Error('arca_credencial: ' + error.message);
    return data || {};
  }

  // ── Pedido del certificado (CSR) ──
  // La clave se genera con WebCrypto (rápido y nativo) y se firma el pedido
  // con forge. Asunto como pide ARCA: serialNumber "CUIT <número>".
  async function generarPedido(cuit, nombre = 'tratto-padron') {
    const par = await c.subtle.generateKey(
      { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
      true, ['sign', 'verify']);
    const clavePem = enPem('PRIVATE KEY', await c.subtle.exportKey('pkcs8', par.privateKey));
    const publicaPem = enPem('PUBLIC KEY', await c.subtle.exportKey('spki', par.publicKey));
    const csr = forge.pki.createCertificationRequest();
    csr.publicKey = forge.pki.publicKeyFromPem(publicaPem);
    csr.setSubject([
      { name: 'countryName', value: 'AR' },
      { name: 'organizationName', value: 'Tratto' },
      { name: 'commonName', value: nombre },
      { name: 'serialNumber', value: 'CUIT ' + cuit },
    ]);
    csr.sign(forge.pki.privateKeyFromPem(clavePem), forge.md.sha256.create());
    return { clavePem, pedidoPem: forge.pki.certificationRequestToPem(csr) };
  }

  // ── Ticket de acceso ──
  // Dura 12 horas y ARCA no da otro mientras haya uno vigente, así que se
  // guarda en la base y se reusa.
  function firmarTRA(cred) {
    const t = ahora();
    const iso = d => new Date(d).toISOString().replace(/\.\d{3}Z$/, 'Z');
    const tra = '<?xml version="1.0" encoding="UTF-8"?><loginTicketRequest version="1.0"><header>' +
      `<uniqueId>${Math.floor(t.getTime() / 1000)}</uniqueId>` +
      `<generationTime>${iso(t.getTime() - 10 * 60e3)}</generationTime>` +
      `<expirationTime>${iso(t.getTime() + 10 * 60e3)}</expirationTime>` +
      `</header><service>${SERVICIO}</service></loginTicketRequest>`;
    const cert = forge.pki.certificateFromPem(cred.certificado);
    const p7 = forge.pkcs7.createSignedData();
    p7.content = forge.util.createBuffer(tra, 'utf8');
    p7.addCertificate(cert);
    p7.addSigner({
      key: forge.pki.privateKeyFromPem(cred.clave), certificate: cert, digestAlgorithm: forge.pki.oids.sha256,
      authenticatedAttributes: [
        { type: forge.pki.oids.contentType, value: forge.pki.oids.data },
        { type: forge.pki.oids.messageDigest },
        { type: forge.pki.oids.signingTime, value: t },
      ],
    });
    p7.sign();
    return forge.util.encode64(forge.asn1.toDer(p7.toAsn1()).getBytes());
  }

  const vigente = cred => cred.token && cred.sign && cred.vence && new Date(cred.vence).getTime() - ahora().getTime() > 5 * 60e3;

  async function ticket(cred) {
    if (vigente(cred)) return cred;
    const cms = firmarTRA(cred);
    const r = await f(URLS.wsaa, {
      method: 'POST', headers: { 'Content-Type': 'text/xml; charset=utf-8', SOAPAction: '' },
      body: '<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" ' +
        'xmlns:wsaa="http://wsaa.view.sua.dvadac.desein.afip.gov"><soapenv:Header/><soapenv:Body>' +
        `<wsaa:loginCms><wsaa:in0>${cms}</wsaa:in0></wsaa:loginCms></soapenv:Body></soapenv:Envelope>`,
    });
    const t = leerTicket(await r.text());
    if (t.error) {
      // Otra llamada al mismo tiempo ya lo pidió: se espera y se lee el suyo.
      if (t.yaTiene) {
        await esperar(1500);
        const otra = await credencial();
        if (vigente(otra)) return otra;
      }
      throw new Error('WSAA: ' + t.error);
    }
    const { error } = await sb.rpc('arca_guardar_ticket', { p_token: t.token, p_sign: t.sign, p_vence: t.vence });
    if (error) throw new Error('arca_guardar_ticket: ' + error.message);
    return { ...cred, ...t };
  }

  // ── Consulta al padrón ──
  // {estado:'ok', persona} | {estado:'no_existe'|'inactiva'} |
  // {estado:'sin_configurar'} | {estado:'error', detalle}
  async function consultar(cuit) {
    let cred;
    try { cred = await credencial(); } catch (e) { return { estado: 'error', detalle: String(e.message || e) }; }
    if (!cred.certificado || !cred.clave || !cred.cuit) return { estado: 'sin_configurar' };
    try {
      const t = await ticket(cred);
      const r = await f(URLS.a13, {
        method: 'POST', headers: { 'Content-Type': 'text/xml; charset=utf-8', SOAPAction: '' },
        body: '<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" ' +
          'xmlns:a13="http://a13.soap.ws.server.puc.sr/"><soapenv:Header/><soapenv:Body><a13:getPersona>' +
          `<token>${t.token}</token><sign>${t.sign}</sign>` +
          `<cuitRepresentada>${cred.cuit}</cuitRepresentada><idPersona>${cuit}</idPersona>` +
          '</a13:getPersona></soapenv:Body></soapenv:Envelope>',
      });
      return leerPersona(await r.text());
    } catch (e) {
      return { estado: 'error', detalle: String(e.message || e).slice(0, 200) };
    }
  }

  async function configurada() {
    try { const c2 = await credencial(); return !!(c2.certificado && c2.clave && c2.cuit); } catch { return false; }
  }

  return { generarPedido, consultar, configurada, firmarTRA };
}
