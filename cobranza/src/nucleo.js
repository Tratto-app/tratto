// El servidor de Cobranza sin vueltas: acceso del dueño, clientes, deudas,
// avisos del día, link de pago, avisos de Mercado Pago y de WhatsApp, y las
// tareas programadas. Recibe un `e` (entorno) con:
//   repo   → los datos (D1 en Cloudflare, memoria en la demo y las pruebas)
//   env    → las claves de las cuentas del negocio
//   ahora  → () => Date        salir → fetch        demo → sin acceso ni red

import {
  ETAPAS, NOMBRE_ETAPA, ahoraAR, sumarDias, diasEntre, inicioMes, inicioMesSiguiente, horario, etapaQueToca,
  puedeRecibir, motivoNoRecibe, avisosDelDia, textoAviso, variablesPlantilla, esBaja, siguienteVencimiento,
  conceptoSiguiente, textoAvisoLocal, avisosDeSaldo, fechaValida, avisosDeVuelta, proximoControl, textoControl, normalizarTelefono, parsearMonto, parsearFecha, formatearMonto, fechaLarga, primerNombre,
} from './logica.js';
import {
  sha256, igualSeguro, aleatorio, mpConectado, mpCrearPreferencia, mpPago, mpProbar, mpFirmaValida,
  waConectado, waEnviarPlantilla, waEnviarTexto, waProbar, waCrearPlantillas, waEstadoPlantillas, waFirmaValida,
  mailConectado, enviarMail,
} from './servicios.js';

export const TANDA = 15;             // avisos automáticos por ejecución (límites del plan gratis)
export const MAX_IMPORTAR = 10;      // deudas por pedido en la carga masiva
const SESION_DIAS = 30;
const MAX_INTENTOS = 5;
const BLOQUEO_MIN = 15;
const GALLETA = 'cobranza_sesion';

class Fallo extends Error {
  constructor(estado, mensaje) { super(mensaje); this.estado = estado; }
}
const json = (datos, estado = 200, cabeceras = {}) => new Response(JSON.stringify(datos), {
  status: estado,
  headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...cabeceras },
});
const iso = (e) => e.ahora().toISOString();
const modoDe = (cfg, e) => (cfg.modo === 'auto' && waConectado(e.env) ? 'auto' : 'toque');
const origenDe = (e, url) => e.origen || url.origin;
const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export async function manejar(request, e) {
  const url = new URL(request.url);
  const ruta = url.pathname.replace(/\/+$/, '') || '/';
  try {
    if (!ruta.startsWith('/p/') && !ruta.startsWith('/webhook/') && !ruta.startsWith('/api/')) return null;
    await e.repo.preparar();
    if (ruta.startsWith('/p/')) return await paginaPago(url, ruta, e);
    if (ruta === '/webhook/mp') return await avisoMercadoPago(request, url, e);
    if (ruta === '/webhook/whatsapp') return await avisoWhatsapp(request, url, e);
    return await api(request, url, ruta, e);
  } catch (err) {
    if (err instanceof Fallo) return json({ error: err.message }, err.estado);
    console.error('cobranza:', err?.stack || err);
    return json({ error: 'Algo falló del lado de la app. Probá de nuevo en un rato.' }, 500);
  }
}

// ── API del dueño ──────────────────────────────────────────────────────────
async function api(request, url, ruta, e) {
  const metodo = request.method;
  if (metodo !== 'GET' && !e.demo && !e.local && request.headers.get('X-Cobranza') !== '1') throw new Fallo(403, 'Pedido no permitido.');
  let cuerpo = {};
  if (metodo !== 'GET') {
    const crudo = await request.text();
    if (crudo.length > 400_000) throw new Fallo(413, 'Es demasiado grande.');
    try { cuerpo = crudo ? JSON.parse(crudo) : {}; } catch { throw new Fallo(400, 'No se entendió el pedido.'); }
    if (!cuerpo || typeof cuerpo !== 'object') throw new Fallo(400, 'No se entendió el pedido.');
  }
  const cfg = await e.repo.config();
  const sesion = !!e.demo || !!e.local || await haySesion(request, e);

  if (ruta === '/api/estado') {
    return json({
      instalada: !!cfg.clave_hash || !!e.demo || !!e.local, sesion, demo: !!e.demo, local: !!e.local, rubro: e.rubro?.id || 'cobranza', sal: cfg.clave_sal || '',
      negocio: { nombre: cfg.nombre || 'Mi negocio', color: cfg.color || '', logo: cfg.logo || '' },
    });
  }
  if (ruta === '/api/instalar' && metodo === 'POST') return instalar(e, cfg, cuerpo, url);
  if (ruta === '/api/entrar' && metodo === 'POST') return entrar(e, cfg, cuerpo, url);
  if (ruta === '/api/salir' && metodo === 'POST') return salirDeSesion(request, e);
  if (!sesion) throw new Fallo(401, 'Tenés que entrar de nuevo.');

  const c = { e, cfg, url, cuerpo, hoy: ahoraAR(e.ahora()).fecha };
  const parcial = ruta.match(/^\/api\/clientes\/(\d+)\/pago$/);
  if (parcial && metodo === 'POST') return json(await pagoParcial(c, Number(parcial[1])));
  const id = Number((ruta.match(/\/(\d+)$/) || [])[1] || 0);
  const base = id ? ruta.replace(/\/\d+$/, '/:id') : ruta;
  switch (`${metodo} ${base}`) {
    case 'GET /api/panel': return json(await panel(c));
    case 'GET /api/avisos': return json(await avisos(c));
    case 'POST /api/avisos/enviado': return json(await marcarEnviado(c));
    case 'POST /api/avisos/correr': return json(await enviarAutomaticos(e, cfg));
    case 'GET /api/clientes': return json(await listaClientes(c));
    case 'POST /api/clientes': return json({ id: await crearCliente(c, cuerpo) });
    case 'GET /api/clientes/:id': return json(await ficha(c, id));
    case 'PATCH /api/clientes/:id': return json(await editarCliente(c, id));
    case 'DELETE /api/clientes/:id': return json(await borrarCliente(c, id));
    case 'POST /api/deudas': return json(await crearDeuda(c, cuerpo));
    case 'PATCH /api/deudas/:id': return json(await cambiarDeuda(c, id));
    case 'POST /api/importar': return json(await importar(c));
    case 'GET /api/config': return json(verConfig(c));
    case 'POST /api/config': return json(await guardarConfig(c));
    case 'POST /api/clave': return json(await cambiarClave(c));
    case 'GET /api/probar': return json(await probar(c));
    case 'GET /api/whatsapp/plantillas': return json(await plantillas(c, false));
    case 'POST /api/whatsapp/plantillas': return json(await plantillas(c, true));
    default: throw new Fallo(404, 'Eso no existe.');
  }
}

// ── Acceso ─────────────────────────────────────────────────────────────────
// La contraseña se estira en el navegador (PBKDF2, 600.000 vueltas) y acá se
// guarda solo el SHA-256 de ese resultado: el plan gratis de Cloudflare da 10
// milésimas de procesador por pedido y no alcanza para estirarla en el servidor.
const esHex = (t, largo) => typeof t === 'string' && new RegExp(`^[0-9a-f]{${largo}}$`).test(t);

function leerGalleta(request) {
  const m = (request.headers.get('Cookie') || '').match(new RegExp(`(?:^|;\\s*)${GALLETA}=([^;]+)`));
  return m ? m[1] : '';
}
async function haySesion(request, e) {
  const ficha = leerGalleta(request);
  if (!ficha) return false;
  const [s] = await e.repo.filas('sesiones', { hash: await sha256(ficha) });
  return !!s && s.vence > iso(e);
}
async function abrirSesion(e, url) {
  const ficha = aleatorio(32);
  const vence = new Date(e.ahora().getTime() + SESION_DIAS * 864e5).toISOString();
  await e.repo.insertar('sesiones', { hash: await sha256(ficha), vence });
  await e.repo.guardarConfig({ origen: url.origin });
  return json({ ok: true }, 200, {
    'Set-Cookie': `${GALLETA}=${ficha}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESION_DIAS * 86400}`,
  });
}
async function frenoDeIntentos(e, cfg) {
  if (cfg.bloqueo_hasta && cfg.bloqueo_hasta > iso(e)) {
    throw new Fallo(429, `Demasiados intentos. Esperá ${BLOQUEO_MIN} minutos y probá de nuevo.`);
  }
}
async function contarIntento(e, cfg) {
  const intentos = Number(cfg.intentos || 0) + 1;
  if (intentos >= MAX_INTENTOS) {
    await e.repo.guardarConfig({ intentos: 0, bloqueo_hasta: new Date(e.ahora().getTime() + BLOQUEO_MIN * 60e3).toISOString() });
  } else await e.repo.guardarConfig({ intentos });
}
async function instalar(e, cfg, cuerpo, url) {
  if (cfg.clave_hash) throw new Fallo(409, 'La app ya está instalada. Entrá con tu usuario.');
  await frenoDeIntentos(e, cfg);
  if (!e.env.CLAVE_INSTALACION) throw new Fallo(500, 'Falta cargar CLAVE_INSTALACION en Cloudflare (paso 5 del manual).');
  if (!igualSeguro(cuerpo.clave_instalacion, e.env.CLAVE_INSTALACION)) {
    await contarIntento(e, cfg);
    throw new Fallo(403, 'La clave de instalación no coincide.');
  }
  const usuario = String(cuerpo.usuario || '').trim().toLowerCase();
  if (usuario.length < 3 || usuario.length > 40) throw new Fallo(400, 'El usuario tiene que tener entre 3 y 40 letras.');
  if (!esHex(cuerpo.sal, 32) || !esHex(cuerpo.derivada, 64)) throw new Fallo(400, 'No se pudo preparar la contraseña.');
  await e.repo.guardarConfig({
    usuario, clave_sal: cuerpo.sal, clave_hash: await sha256(cuerpo.derivada),
    nombre: String(cuerpo.nombre || '').trim().slice(0, 60) || 'Mi negocio', modo: 'toque', intentos: 0,
  });
  return abrirSesion(e, url);
}
async function entrar(e, cfg, cuerpo, url) {
  await frenoDeIntentos(e, cfg);
  const usuario = String(cuerpo.usuario || '').trim().toLowerCase();
  const bien = !!cfg.clave_hash && esHex(cuerpo.derivada, 64)
    && igualSeguro(usuario, cfg.usuario) && igualSeguro(await sha256(cuerpo.derivada), cfg.clave_hash);
  if (!bien) {
    await contarIntento(e, cfg);
    throw new Fallo(401, 'El usuario o la contraseña no coinciden.');
  }
  if (Number(cfg.intentos || 0)) await e.repo.guardarConfig({ intentos: 0 });
  return abrirSesion(e, url);
}
async function salirDeSesion(request, e) {
  const ficha = leerGalleta(request);
  if (ficha) await e.repo.borrar('sesiones', { hash: await sha256(ficha) });
  return json({ ok: true }, 200, { 'Set-Cookie': `${GALLETA}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0` });
}
async function cambiarClave({ e, cfg, cuerpo }) {
  if (e.demo) return { ok: true };
  if (!esHex(cuerpo.actual, 64) || !igualSeguro(await sha256(cuerpo.actual), cfg.clave_hash)) {
    throw new Fallo(403, 'La contraseña actual no coincide.');
  }
  if (!esHex(cuerpo.sal, 32) || !esHex(cuerpo.derivada, 64)) throw new Fallo(400, 'No se pudo preparar la contraseña nueva.');
  await e.repo.guardarConfig({ clave_sal: cuerpo.sal, clave_hash: await sha256(cuerpo.derivada) });
  return { ok: true };
}

// ── Datos comunes ──────────────────────────────────────────────────────────
async function pendientes(e) {
  const [deudas, clientes] = await Promise.all([e.repo.filas('deudas', { estado: 'pendiente' }), e.repo.filas('clientes')]);
  return { deudas, clientes: new Map(clientes.map((x) => [x.id, x])) };
}
const suma = (lista) => lista.reduce((t, d) => t + d.monto, 0);
const mensajesRecientes = (e, hoy) => e.repo.filas('mensajes', { dia: { desde: sumarDias(hoy, -35) } });

// Los avisos de hoy. Por deuda (cuotas con vencimiento) o por saldo (libreta de fiado).
function listaDeAvisos(e, cfg, hoy, deudas, clientes, recientes) {
  if (e.rubro?.avisos === 'saldo') return avisosDeSaldo({ deudas, clientes, mensajes: recientes, hoy, dia: Number(cfg.dia_cobro) || 5 });
  const recibieron = new Set(recientes.filter((m) => m.dia === hoy).map((m) => m.cliente_id));
  const lista = avisosDelDia({ deudas, clientes, recibieronHoy: recibieron, hoy });
  if (!e.rubro?.vuelta) return lista;
  return [...lista, ...avisosDeVuelta({ clientes, hoy, ocupados: new Set([...recibieron, ...lista.map((x) => x.cliente.id)]) })];
}
// Pacientes o clientes a los que ya les toca volver, del más atrasado al más reciente.
function losQueTocan(clientes, hoy) {
  return [...clientes.values()].map((c) => ({ c, toca: proximoControl(c) })).filter((x) => x.toca && x.toca <= hoy && !x.c.baja)
    .map((x) => ({ cliente_id: x.c.id, cliente: x.c.nombre, toca: x.toca, dias: diasEntre(x.toca, hoy), avisos: x.c.av_control || 0 }))
    .sort((a, b) => b.dias - a.dias || a.cliente_id - b.cliente_id);
}
// "la cuota de marzo" pasa a "la cuota de marzo de Sofi" cuando el mensaje le llega al adulto.
function conceptoDe(e, deuda, cliente) {
  return e.rubro?.notaEnMensaje && cliente.nota && deuda.id ? `${deuda.concepto} de ${cliente.nota}` : deuda.concepto;
}
function porCliente(deudas, clientes, hoy) {
  const cuentas = new Map();
  for (const d of deudas) {
    const c = cuentas.get(d.cliente_id) || { cliente_id: d.cliente_id, cliente: clientes.get(d.cliente_id)?.nombre || '(sin nombre)', saldo: 0, cantidad: 0, desde: d.vence };
    c.saldo += d.monto; c.cantidad += 1;
    if (d.vence < c.desde) c.desde = d.vence;
    cuentas.set(d.cliente_id, c);
  }
  return [...cuentas.values()].map((c) => ({ ...c, dias: diasEntre(c.desde, hoy) })).sort((a, b) => b.saldo - a.saldo || a.cliente_id - b.cliente_id);
}

async function panel({ e, cfg, hoy }) {
  await mantenimiento(e, cfg, hoy);
  const { deudas, clientes } = await pendientes(e);
  const rango = { desde: inicioMes(hoy), hasta: inicioMesSiguiente(hoy) };
  const [pagadas, recientes] = await Promise.all([
    e.repo.filas('deudas', { estado: 'pagada', pagada_el: rango }),
    mensajesRecientes(e, hoy),
  ]);
  const delMes = recientes.filter((m) => m.dia >= rango.desde);
  const deHoy = delMes.filter((m) => m.dia === hoy);
  const lista = listaDeAvisos(e, cfg, hoy, deudas, clientes, recientes);
  const vencidas = deudas.filter((d) => d.vence < hoy);
  return {
    hoy,
    modo: modoDe(cfg, e),
    horario: horario(ahoraAR(e.ahora())),
    alerta: cfg.alerta || '',
    resumen: { entro: suma(pagadas), pagos: pagadas.length, falta: suma(deudas), vencido: suma(vencidas), vencidas: vencidas.length },
    avisos: { pendientes: lista.length, enviados_hoy: deHoy.length },
    mensajes_mes: {
      auto: delMes.filter((m) => m.canal === 'auto' && m.estado !== 'fallido').length,
      toque: delMes.filter((m) => m.canal === 'toque').length,
    },
    deudores: deudas.map((d) => ({
      id: d.id, cliente_id: d.cliente_id, cliente: clientes.get(d.cliente_id)?.nombre || '(sin nombre)',
      concepto: d.concepto, monto: d.monto, vence: d.vence, dias: diasEntre(d.vence, hoy), repite: d.repite,
    })).sort((a, b) => b.dias - a.dias || a.id - b.id),
    por_cliente: porCliente(deudas, clientes, hoy),
    vuelta: e.rubro?.vuelta ? losQueTocan(clientes, hoy) : [],
    clientes: clientes.size,
    ultima_copia: cfg.ultima_copia || '',
  };
}

async function avisos({ e, cfg, url, hoy }) {
  const { deudas, clientes } = await pendientes(e);
  const recientes = await mensajesRecientes(e, hoy);
  const deHoy = recientes.filter((m) => m.dia === hoy);
  const lista = listaDeAvisos(e, cfg, hoy, deudas, clientes, recientes);
  const origen = origenDe(e, url);
  const sinAviso = new Map();
  for (const d of deudas) {
    const cli = clientes.get(d.cliente_id);
    if (cli && !puedeRecibir(cli) && etapaQueToca(d, hoy)) sinAviso.set(cli.id, { cliente_id: cli.id, cliente: cli.nombre, motivo: motivoNoRecibe(cli) });
  }
  return {
    modo: modoDe(cfg, e),
    horario: horario(ahoraAR(e.ahora())),
    lista: lista.map(({ deuda, cliente, etapa }) => {
      const paraMensaje = { ...deuda, concepto: conceptoDe(e, deuda, cliente) };
      const texto = etapa === 'control' ? textoControl(cliente, cfg.nombre, cliente.cada, (cliente.av_control || 0) + 1)
        : e.local ? textoAvisoLocal(etapa, paraMensaje, cliente, cfg.datos_transferencia)
        : textoAviso(etapa, paraMensaje, cliente, `${origen}/p/${deuda.token}`);
      return {
        deuda_id: deuda.id, cliente_id: cliente.id, cliente: cliente.nombre, telefono: cliente.telefono,
        detalle: etapa === 'control' ? `Le toca desde el ${fechaLarga(deuda.vence)}` : etapa === 'saldo' ? `Tiene anotado ${formatearMonto(deuda.monto).replace(' ', '\u00a0')}` : `${deuda.concepto} · ${formatearMonto(deuda.monto).replace(' ', '\u00a0')}`,
        etapa, nombre_etapa: NOMBRE_ETAPA[etapa], concepto: deuda.concepto, monto: deuda.monto, vence: deuda.vence,
        texto, wa: `https://wa.me/${cliente.telefono}?text=${encodeURIComponent(texto)}`,
      };
    }),
    enviados: deHoy.map((m) => ({
      cliente_id: m.cliente_id, cliente: clientes.get(m.cliente_id)?.nombre || '', etapa: m.etapa,
      nombre_etapa: NOMBRE_ETAPA[m.etapa] || '', canal: m.canal, estado: m.estado, error: m.error || '',
    })),
    sin_aviso: [...sinAviso.values()],
  };
}

// Modo un toque: el dueño tocó "Enviar" y el mensaje salió por su WhatsApp.
async function marcarEnviado({ e, cfg, cuerpo, hoy }) {
  const h = horario(ahoraAR(e.ahora()));
  if (!h.abierto) throw new Fallo(409, h.motivo);
  // Avisos que no son de una deuda puntual: el saldo de la libreta o "te toca volver".
  const suelto = e.rubro?.avisos === 'saldo' ? 'saldo' : (cuerpo.etapa === 'control' && e.rubro?.vuelta ? 'control' : '');
  if (suelto) {
    const { deudas, clientes } = await pendientes(e);
    const item = listaDeAvisos(e, cfg, hoy, deudas, clientes, await mensajesRecientes(e, hoy))
      .find((x) => x.etapa === suelto && x.cliente.id === Number(cuerpo.cliente_id));
    if (!item) throw new Fallo(409, 'Ese aviso ya no corresponde.');
    if (suelto === 'control') await e.repo.actualizar('clientes', item.cliente.id, { av_control: (item.cliente.av_control || 0) + 1, av_control_el: hoy });
    await e.repo.insertar('mensajes', { cliente_id: item.cliente.id, deuda_id: null, etapa: suelto, canal: 'toque', estado: 'enviado', dia: hoy, creado: iso(e) });
    return { ok: true, etapa: suelto };
  }
  const deuda = await e.repo.fila('deudas', Number(cuerpo.deuda_id));
  if (!deuda) throw new Fallo(404, 'Esa deuda no existe.');
  const cliente = await e.repo.fila('clientes', deuda.cliente_id);
  const etapa = etapaQueToca(deuda, hoy);
  if (!etapa || !puedeRecibir(cliente)) throw new Fallo(409, 'Ese aviso ya no corresponde.');
  const ya = await e.repo.filas('mensajes', { dia: hoy, cliente_id: cliente.id });
  if (ya.length) throw new Fallo(409, 'Ese cliente ya recibió un aviso hoy.');
  await e.repo.actualizar('deudas', deuda.id, { [`av_${etapa}`]: hoy });
  await e.repo.insertar('mensajes', { cliente_id: cliente.id, deuda_id: deuda.id, etapa, canal: 'toque', estado: 'enviado', dia: hoy, creado: iso(e) });
  return { ok: true, etapa };
}

// ── Clientes ───────────────────────────────────────────────────────────────
function datosCliente(cuerpo, cfg, parcial = false) {
  const d = {};
  if (!parcial || 'nombre' in cuerpo) {
    d.nombre = String(cuerpo.nombre || '').trim().slice(0, 80);
    if (!d.nombre) throw new Fallo(400, 'Falta el nombre del cliente.');
  }
  if (!parcial || 'telefono' in cuerpo) {
    const crudo = String(cuerpo.telefono || '').trim();
    d.telefono = normalizarTelefono(crudo, cfg.codigo_area);
    if (crudo && !d.telefono) throw new Fallo(400, 'El celular no se entiende. Escribilo con el código de área, por ejemplo 11 5555-4444.');
  }
  if (!parcial || 'mail' in cuerpo) {
    d.mail = String(cuerpo.mail || '').trim().slice(0, 120);
    if (d.mail && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(d.mail)) throw new Fallo(400, 'El mail no parece un mail.');
  }
  for (const k of ['acepta', 'pausado', 'baja']) if (k in cuerpo) d[k] = cuerpo[k] ? 1 : 0;
  for (const [k, largo] of [['grupo', 60], ['nota', 120]]) if (k in cuerpo) d[k] = String(cuerpo[k] || '').trim().slice(0, largo) || null;
  if ('ultima' in cuerpo) {
    d.ultima = cuerpo.ultima ? parsearFecha(cuerpo.ultima) : null;
    if (cuerpo.ultima && !d.ultima) throw new Fallo(400, 'La fecha de la última visita no se entiende.');
    Object.assign(d, { av_control: 0, av_control_el: null });   // visita nueva: el aviso de control arranca de cero
  }
  if ('cada' in cuerpo) { const n = Number(cuerpo.cada); d.cada = Number.isInteger(n) && n >= 0 && n <= 36 ? n : 0; }
  return d;
}
async function crearCliente({ e, cfg }, cuerpo) {
  const d = datosCliente(cuerpo, cfg);
  if (d.telefono) {
    const [igual] = await e.repo.filas('clientes', { telefono: d.telefono });
    if (igual) return igual.id;
  }
  return e.repo.insertar('clientes', { acepta: 0, pausado: 0, baja: 0, ...d, creado: iso(e) });
}
async function listaClientes({ e, url, hoy }) {
  const { deudas, clientes } = await pendientes(e);
  const q = (url.searchParams.get('q') || '').toLowerCase().trim();
  const saldo = new Map();
  for (const d of deudas) {
    const s = saldo.get(d.cliente_id) || { saldo: 0, vencidas: 0 };
    s.saldo += d.monto; if (d.vence < hoy) s.vencidas += 1;
    saldo.set(d.cliente_id, s);
  }
  return {
    clientes: [...clientes.values()]
      .filter((x) => !q || x.nombre.toLowerCase().includes(q) || (x.telefono || '').includes(q.replace(/\D/g, '') || '~'))
      .map((x) => ({ id: x.id, nombre: x.nombre, grupo: x.grupo || '', nota: x.nota || '', toca: proximoControl(x), telefono: x.telefono, puede: puedeRecibir(x), baja: x.baja, pausado: x.pausado, ...(saldo.get(x.id) || { saldo: 0, vencidas: 0 }) }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')),
  };
}
async function ficha({ e, url, hoy }, id) {
  const cliente = await e.repo.fila('clientes', id);
  if (!cliente) throw new Fallo(404, 'Ese cliente no existe.');
  const [deudas, mensajes, respuestas] = await Promise.all([
    e.repo.filas('deudas', { cliente_id: id }, { orden: 'vence desc' }),
    e.repo.filas('mensajes', { cliente_id: id }, { orden: 'id desc', limite: 60 }),
    e.repo.filas('respuestas', { cliente_id: id }, { orden: 'id desc', limite: 60 }),
  ]);
  const origen = origenDe(e, url);
  return {
    cliente, puede: puedeRecibir(cliente), motivo: motivoNoRecibe(cliente), toca: proximoControl(cliente),
    deudas: deudas.map((d) => ({
      id: d.id, concepto: d.concepto, monto: d.monto, vence: d.vence, repite: d.repite, estado: d.estado,
      pagada_el: d.pagada_el, medio: d.medio, dias: diasEntre(d.vence, hoy), link: `${origen}/p/${d.token}`,
    })),
    mensajes: mensajes.map((m) => ({ etapa: m.etapa, nombre_etapa: NOMBRE_ETAPA[m.etapa] || 'Mensaje', canal: m.canal, estado: m.estado, error: m.error || '', creado: m.creado })),
    respuestas: respuestas.map((r) => ({ texto: r.texto, creado: r.creado })),
  };
}
async function editarCliente({ e, cfg, cuerpo }, id) {
  if (!(await e.repo.fila('clientes', id))) throw new Fallo(404, 'Ese cliente no existe.');
  await e.repo.actualizar('clientes', id, datosCliente(cuerpo, cfg, true));
  return { ok: true };
}
async function borrarCliente({ e }, id) {
  await e.repo.borrar('mensajes', { cliente_id: id });
  await e.repo.borrar('respuestas', { cliente_id: id });
  await e.repo.borrar('deudas', { cliente_id: id });
  await e.repo.borrar('clientes', { id });
  return { ok: true };
}

// ── Deudas ─────────────────────────────────────────────────────────────────
function datosDeuda(cuerpo, hoy) {
  const concepto = String(cuerpo.concepto || '').trim().slice(0, 120);
  if (!concepto) throw new Fallo(400, 'Falta el concepto (por qué te debe).');
  const monto = Number.isInteger(cuerpo.monto_centavos) && cuerpo.monto_centavos > 0 ? cuerpo.monto_centavos : parsearMonto(cuerpo.monto);
  if (!monto) throw new Fallo(400, 'El monto no se entiende.');
  const vence = parsearFecha(cuerpo.vence, hoy);
  if (!vence) throw new Fallo(400, 'La fecha de vencimiento no se entiende.');
  const repite = ['semanal', 'mensual'].includes(cuerpo.repite) ? cuerpo.repite : 'unico';
  return { concepto, monto, vence, repite, dia_mes: repite === 'mensual' ? Number(vence.slice(8)) : null };
}
async function crearDeuda(c, cuerpo) {
  const { e, hoy } = c;
  const d = datosDeuda(cuerpo, hoy);
  let clienteId = Number(cuerpo.cliente_id || 0);
  if (clienteId) {
    if (!(await e.repo.fila('clientes', clienteId))) throw new Fallo(404, 'Ese cliente no existe.');
  } else clienteId = await crearCliente(c, cuerpo.cliente || {});
  const id = await e.repo.insertar('deudas', { ...d, cliente_id: clienteId, estado: 'pendiente', token: aleatorio(12), siguiente_creada: 0, creado: iso(e) });
  return { id, cliente_id: clienteId };
}
async function pagar(e, deuda, medio, pagoMp = null) {
  await e.repo.actualizar('deudas', deuda.id, { estado: 'pagada', pagada_el: ahoraAR(e.ahora()).fecha, medio, mp_pago: pagoMp });
}
async function cambiarDeuda({ e, cuerpo, hoy }, id) {
  const deuda = await e.repo.fila('deudas', id);
  if (!deuda) throw new Fallo(404, 'Esa deuda no existe.');
  switch (cuerpo.accion) {
    case 'pagar': {
      const medios = e.demo ? ['efectivo', 'transferencia', 'mercadopago'] : ['efectivo', 'transferencia'];
      if (deuda.estado !== 'pendiente') throw new Fallo(409, 'Esa deuda ya no está pendiente.');
      await pagar(e, deuda, medios.includes(cuerpo.medio) ? cuerpo.medio : 'efectivo');
      break;
    }
    case 'reabrir': await e.repo.actualizar('deudas', id, { estado: 'pendiente', pagada_el: null, medio: null, mp_pago: null }); break;
    case 'anular': await e.repo.actualizar('deudas', id, { estado: 'anulada', repite: 'unico' }); break;
    case 'no_repetir': await e.repo.actualizar('deudas', id, { repite: 'unico' }); break;
    case 'editar': {
      const d = datosDeuda({ concepto: cuerpo.concepto ?? deuda.concepto, monto: cuerpo.monto ?? String(deuda.monto / 100).replace('.', ','), vence: cuerpo.vence ?? deuda.vence, repite: deuda.repite }, hoy);
      const cambios = { concepto: d.concepto, monto: d.monto, vence: d.vence };
      if (d.monto !== deuda.monto) Object.assign(cambios, { mp_preferencia: null, mp_link: null });
      if (d.vence !== deuda.vence) Object.assign(cambios, { av_previo: null, av_dia: null, av_vencido: null, av_ultimo: null });
      await e.repo.actualizar('deudas', id, cambios);
      break;
    }
    default: throw new Fallo(400, 'No se entendió qué hacer con la deuda.');
  }
  return { ok: true };
}
// Entrega a cuenta: paga las deudas más viejas primero. Si no alcanza para una
// entera, esa queda pendiente por lo que falta y la parte pagada queda anotada.
async function pagoParcial({ e, cuerpo, hoy }, id) {
  const monto = parsearMonto(cuerpo.monto);
  if (!monto) throw new Fallo(400, 'El monto no se entiende.');
  const deudas = await e.repo.filas('deudas', { cliente_id: id, estado: 'pendiente' }, { orden: 'vence asc' });
  const saldo = suma(deudas);
  if (!deudas.length) throw new Fallo(409, 'Ese cliente no debe nada.');
  if (monto > saldo) throw new Fallo(400, `Debe ${formatearMonto(saldo)}: no puede pagar más que eso.`);
  const medio = ['efectivo', 'transferencia'].includes(cuerpo.medio) ? cuerpo.medio : 'efectivo';
  let resto = monto;
  for (const d of deudas) {
    if (!resto) break;
    if (resto >= d.monto) { await pagar(e, d, medio); resto -= d.monto; continue; }
    await e.repo.actualizar('deudas', d.id, { monto: d.monto - resto, mp_preferencia: null, mp_link: null });
    await e.repo.insertar('deudas', {
      cliente_id: id, concepto: `${d.concepto} (entrega)`.slice(0, 120), monto: resto, vence: d.vence, repite: 'unico', estado: 'pagada',
      pagada_el: hoy, medio, token: aleatorio(12), siguiente_creada: 0, creado: iso(e),
    });
    resto = 0;
  }
  return { ok: true, saldo: saldo - monto };
}
async function importar(c) {
  const filas = Array.isArray(c.cuerpo.filas) ? c.cuerpo.filas : [];
  if (!filas.length || filas.length > MAX_IMPORTAR) throw new Fallo(400, `Se cargan de a ${MAX_IMPORTAR} como máximo por vez.`);
  const errores = [];
  let creadas = 0;
  for (const [i, f] of filas.entries()) {
    try {
      await crearDeuda(c, { ...f, cliente: { nombre: f.nombre, telefono: f.telefono, mail: f.mail, acepta: f.acepta } });
      creadas += 1;
    } catch (err) {
      if (!(err instanceof Fallo)) throw err;
      errores.push({ indice: i, error: err.message });
    }
  }
  return { creadas, errores };
}

// ── Configuración ──────────────────────────────────────────────────────────
function verConfig({ e, cfg, url }) {
  return {
    nombre: cfg.nombre || 'Mi negocio', color: cfg.color || '', logo: cfg.logo || '', usuario: cfg.usuario || '',
    dia_cobro: Number(cfg.dia_cobro) || 5, ultima_copia: cfg.ultima_copia || '', local: !!e.local,
    datos_transferencia: cfg.datos_transferencia || '', mail_dueno: cfg.mail_dueno || '', codigo_area: cfg.codigo_area || '',
    modo: modoDe(cfg, e), origen: origenDe(e, url),
    conexiones: {
      mp: mpConectado(e.env), whatsapp: waConectado(e.env), whatsapp_plantillas: !!e.env.WA_WABA_ID,
      whatsapp_respuestas: !!(e.env.WA_APP_SECRET && e.env.WA_VERIFY_TOKEN), mail: mailConectado(e.env),
    },
  };
}
async function guardarConfig({ e, cuerpo }) {
  const cambios = {};
  if ('nombre' in cuerpo) {
    cambios.nombre = String(cuerpo.nombre || '').trim().slice(0, 60);
    if (!cambios.nombre) throw new Fallo(400, 'Falta el nombre del negocio.');
  }
  if ('color' in cuerpo) {
    if (cuerpo.color && !/^#[0-9a-f]{6}$/i.test(cuerpo.color)) throw new Fallo(400, 'El color no se entiende.');
    cambios.color = cuerpo.color || null;
  }
  if ('logo' in cuerpo) {
    if (cuerpo.logo && (!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(cuerpo.logo) || cuerpo.logo.length > 140_000)) {
      throw new Fallo(400, 'El logo tiene que ser una imagen chica (PNG, JPG o WebP).');
    }
    cambios.logo = cuerpo.logo || null;
  }
  if ('datos_transferencia' in cuerpo) cambios.datos_transferencia = String(cuerpo.datos_transferencia || '').trim().slice(0, 300) || null;
  if ('mail_dueno' in cuerpo) {
    const m = String(cuerpo.mail_dueno || '').trim();
    if (m && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(m)) throw new Fallo(400, 'El mail no parece un mail.');
    cambios.mail_dueno = m || null;
  }
  if ('dia_cobro' in cuerpo) {
    const dia = Number(cuerpo.dia_cobro);
    if (!Number.isInteger(dia) || dia < 1 || dia > 28) throw new Fallo(400, 'El día de cobro va del 1 al 28.');
    cambios.dia_cobro = dia;
  }
  if ('ultima_copia' in cuerpo) cambios.ultima_copia = fechaValida(cuerpo.ultima_copia) ? cuerpo.ultima_copia : null;
  if ('codigo_area' in cuerpo) {
    const a = String(cuerpo.codigo_area || '').replace(/\D/g, '').replace(/^0/, '');
    if (a && (a.length < 2 || a.length > 4)) throw new Fallo(400, 'El código de área tiene entre 2 y 4 números (por ejemplo 11).');
    cambios.codigo_area = a || null;
  }
  if ('modo' in cuerpo) {
    if (cuerpo.modo === 'auto' && !waConectado(e.env)) throw new Fallo(409, 'Para el modo automático primero hay que conectar WhatsApp (manual, parte B).');
    cambios.modo = cuerpo.modo === 'auto' ? 'auto' : 'toque';
    cambios.alerta = null;
  }
  await e.repo.guardarConfig(cambios);
  return { ok: true };
}
async function probar({ e, url }) {
  const cual = url.searchParams.get('cual');
  if (cual === 'mp') return mpConectado(e.env) ? mpProbar(e) : { ok: false, detalle: 'Falta cargar MP_ACCESS_TOKEN en Cloudflare.' };
  if (cual === 'whatsapp') return waConectado(e.env) ? waProbar(e) : { ok: false, detalle: 'Faltan WA_TOKEN y WA_PHONE_ID en Cloudflare.' };
  if (cual === 'mail') {
    const cfg = await e.repo.config();
    if (!mailConectado(e.env) || !cfg.mail_dueno) return { ok: false, detalle: 'Falta RESEND_API_KEY en Cloudflare o el mail del dueño acá.' };
    const r = await enviarMail(e, { para: cfg.mail_dueno, asunto: 'Prueba de Cobranza sin vueltas', html: '<p>Si te llegó este mail, el resumen de la mañana va a funcionar.</p>' });
    return r.ok ? { ok: true, detalle: `Te mandamos un mail de prueba a ${cfg.mail_dueno}.` } : r;
  }
  throw new Fallo(400, 'No se entendió qué probar.');
}
async function plantillas({ e, url }, crear) {
  if (!waConectado(e.env) || !e.env.WA_WABA_ID) throw new Fallo(409, 'Faltan WA_TOKEN, WA_PHONE_ID y WA_WABA_ID en Cloudflare (manual, parte B).');
  if (crear) return { creadas: await waCrearPlantillas(e, origenDe(e, url)) };
  return waEstadoPlantillas(e);
}

// ── Link de pago (página pública que ve el cliente) ────────────────────────
function pagina(cfg, titulo, cuerpoHtml, estado = 200) {
  const color = /^#[0-9a-f]{6}$/i.test(cfg.color || '') ? cfg.color : '#0b5d6b';
  const html = `<!doctype html><html lang="es-AR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex">
<title>${esc(titulo)} · ${esc(cfg.nombre || 'Pago')}</title>
<style>body{margin:0;font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;background:#f4f2ee;color:#1c1b19;line-height:1.5}
main{max-width:420px;margin:0 auto;padding:32px 16px}.t{background:#fff;border-radius:16px;padding:24px;box-shadow:0 1px 3px rgba(0,0,0,.08)}
.n{display:flex;align-items:center;gap:10px;font-weight:600;margin-bottom:20px}.n img{width:40px;height:40px;border-radius:10px;object-fit:cover}
h1{font-size:1.15rem;margin:0 0 4px}.m{font-size:2.2rem;font-weight:700;margin:12px 0 4px;letter-spacing:-.02em}.s{color:#6b675f;font-size:.95rem;margin:0}
a.b{display:block;text-align:center;background:${color};color:#fff;text-decoration:none;font-weight:600;padding:14px;border-radius:12px;margin-top:20px}
.x{margin-top:18px;padding-top:16px;border-top:1px solid #e7e3db;font-size:.95rem;white-space:pre-line}
@media(prefers-color-scheme:dark){body{background:#151412;color:#f1eee8}.t{background:#211f1c}.s{color:#a9a399}.x{border-color:#37332e}}</style></head>
<body><main><div class="t"><div class="n">${cfg.logo ? `<img src="${esc(cfg.logo)}" alt="">` : ''}<span>${esc(cfg.nombre || '')}</span></div>${cuerpoHtml}</div></main></body></html>`;
  return new Response(html, {
    status: estado,
    headers: {
      'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex',
      'Content-Security-Policy': "default-src 'none'; img-src data:; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
    },
  });
}
async function paginaPago(url, ruta, e) {
  const [, , token, accion] = ruta.split('/');
  const cfg = await e.repo.config();
  let [deuda] = token ? await e.repo.filas('deudas', { token }) : [];
  if (!deuda || deuda.estado === 'anulada') {
    return pagina(cfg, 'Link no disponible', '<h1>Este link ya no está disponible</h1><p class="s">Si tenés dudas, escribinos.</p>', 404);
  }
  const pagoId = url.searchParams.get('payment_id') || url.searchParams.get('collection_id') || '';
  if (deuda.estado === 'pendiente' && /^\d+$/.test(pagoId) && mpConectado(e.env)) {
    if (await registrarPagoMp(e, pagoId)) deuda = await e.repo.fila('deudas', deuda.id);
  }
  if (accion === 'pagar' && deuda.estado === 'pendiente' && mpConectado(e.env)) {
    let link = deuda.mp_link;
    if (!link) {
      const p = await mpCrearPreferencia(e, { deuda, origen: origenDe(e, url) });
      await e.repo.actualizar('deudas', deuda.id, { mp_preferencia: p.id, mp_link: p.link });
      link = p.link;
    }
    return new Response(null, { status: 302, headers: { Location: link, 'Cache-Control': 'no-store' } });
  }
  const cliente = await e.repo.fila('clientes', deuda.cliente_id);
  const nombre = esc(primerNombre(cliente?.nombre));
  if (deuda.estado === 'pagada') {
    return pagina(cfg, 'Pago registrado', `<h1>¡Gracias${nombre ? ', ' + nombre : ''}!</h1><p class="m">${esc(formatearMonto(deuda.monto))}</p><p class="s">El pago de ${esc(deuda.concepto)} ya está registrado.</p>`);
  }
  const transferencia = cfg.datos_transferencia ? `<div class="x"><strong>${mpConectado(e.env) ? 'También podés transferir' : 'Datos para transferir'}</strong>\n${esc(cfg.datos_transferencia)}\n\nDespués avisanos y lo registramos.</div>` : '';
  const boton = mpConectado(e.env) ? `<a class="b" href="/p/${esc(deuda.token)}/pagar" rel="nofollow">Pagar con Mercado Pago</a>` : '';
  return pagina(cfg, 'Tu pago', `<h1>${nombre ? `Hola ${nombre}` : 'Hola'}</h1><p class="s">${esc(deuda.concepto)}</p><p class="m">${esc(formatearMonto(deuda.monto))}</p><p class="s">Vence el ${esc(fechaLarga(deuda.vence))}</p>${boton}${transferencia}`);
}

// Le pregunta a Mercado Pago por el pago (con la clave del negocio) y, si está
// aprobado y alcanza el monto, marca la deuda como pagada. Nunca confía en lo
// que dice el aviso: siempre consulta.
async function registrarPagoMp(e, pagoId) {
  const pago = await mpPago(e, pagoId);
  if (!pago || pago.status !== 'approved' || !pago.external_reference) return false;
  const [deuda] = await e.repo.filas('deudas', { token: String(pago.external_reference) });
  if (!deuda || deuda.estado !== 'pendiente') return false;
  if (Math.round(Number(pago.transaction_amount) * 100) < deuda.monto) return false;
  await pagar(e, deuda, 'mercadopago', String(pago.id));
  return true;
}
async function avisoMercadoPago(request, url, e) {
  if (request.method !== 'POST') return new Response('ok');
  const crudo = await request.text();
  let cuerpo = {};
  try { cuerpo = JSON.parse(crudo) || {}; } catch { cuerpo = {}; }
  if (e.env.MP_WEBHOOK_SECRET && !(await mpFirmaValida(request, url, e.env.MP_WEBHOOK_SECRET))) {
    return new Response('firma inválida', { status: 401 });
  }
  const tipo = cuerpo.type || url.searchParams.get('type') || url.searchParams.get('topic');
  const id = String(cuerpo.data?.id || url.searchParams.get('data.id') || url.searchParams.get('id') || '');
  if (tipo === 'payment' && /^\d+$/.test(id) && mpConectado(e.env)) await registrarPagoMp(e, id);
  return new Response('ok');
}

// ── WhatsApp: entregas y respuestas ────────────────────────────────────────
const ESTADO_WA = { sent: 'enviado', delivered: 'entregado', read: 'leido', failed: 'fallido' };
const RANGO = { enviado: 1, entregado: 2, leido: 3, fallido: 4 };

async function avisoWhatsapp(request, url, e) {
  if (request.method === 'GET') {
    const bien = e.env.WA_VERIFY_TOKEN && url.searchParams.get('hub.mode') === 'subscribe'
      && igualSeguro(url.searchParams.get('hub.verify_token'), e.env.WA_VERIFY_TOKEN);
    return bien ? new Response(url.searchParams.get('hub.challenge') || '') : new Response('no', { status: 403 });
  }
  const crudo = await request.text();
  if (!(await waFirmaValida(crudo, request.headers.get('x-hub-signature-256'), e.env.WA_APP_SECRET))) {
    return new Response('firma inválida', { status: 401 });
  }
  let cuerpo = {};
  try { cuerpo = JSON.parse(crudo) || {}; } catch { cuerpo = {}; }
  for (const entrada of cuerpo.entry || []) {
    for (const cambio of entrada.changes || []) {
      const v = cambio.value || {};
      for (const s of v.statuses || []) await estadoDeMensaje(e, s);
      for (const m of v.messages || []) await mensajeEntrante(e, m);
    }
  }
  return new Response('ok');
}
async function estadoDeMensaje(e, s) {
  const estado = ESTADO_WA[s.status];
  if (!estado || !s.id) return;
  const [m] = await e.repo.filas('mensajes', { wa_id: String(s.id) });
  if (!m || (RANGO[m.estado] || 0) >= RANGO[estado]) return;
  const error = estado === 'fallido' ? String(s.errors?.[0]?.error_data?.details || s.errors?.[0]?.title || 'No se pudo entregar').slice(0, 300) : null;
  await e.repo.actualizar('mensajes', m.id, { estado, error });
}
async function mensajeEntrante(e, m) {
  if (!m.id || !m.from) return;
  const [repetido] = await e.repo.filas('respuestas', { wa_id: String(m.id) });
  if (repetido) return;
  const telefono = String(m.from).replace(/\D/g, '');
  const texto = String(m.text?.body || m.button?.text || `[${m.type || 'mensaje'}]`).trim().slice(0, 1000);
  const [cliente] = await e.repo.filas('clientes', { telefono });
  await e.repo.insertar('respuestas', { cliente_id: cliente?.id ?? null, telefono, texto, wa_id: String(m.id), creado: iso(e) });
  if (cliente && !cliente.baja && esBaja(texto)) {
    await e.repo.actualizar('clientes', cliente.id, { baja: 1 });
    try { await waEnviarTexto(e, telefono, 'Listo, no te mandamos más avisos por acá.'); } catch { /* la baja ya quedó registrada */ }
  }
}

// ── Tareas ─────────────────────────────────────────────────────────────────
// Modo automático: manda los avisos del día por la API de WhatsApp, de a
// tandas, respetando horario, uno por día por cliente y los cortes.
export async function enviarAutomaticos(e, cfg) {
  if (modoDe(cfg, e) !== 'auto') return { enviados: 0, fallidos: 0, motivo: 'El modo automático no está activo.' };
  const ar = ahoraAR(e.ahora());
  const h = horario(ar);
  if (!h.abierto) return { enviados: 0, fallidos: 0, motivo: h.motivo };
  const hoy = ar.fecha;
  const { deudas, clientes } = await pendientes(e);
  const deHoy = await e.repo.filas('mensajes', { dia: hoy });
  const lista = avisosDelDia({ deudas, clientes, recibieronHoy: new Set(deHoy.map((m) => m.cliente_id)), hoy }).slice(0, TANDA);
  let enviados = 0, fallidos = 0;
  for (const { deuda, cliente, etapa } of lista) {
    const campo = `av_${etapa}`;
    await e.repo.actualizar('deudas', deuda.id, { [campo]: hoy });
    let r;
    try {
      r = await waEnviarPlantilla(e, { telefono: cliente.telefono, etapa, variables: variablesPlantilla(etapa, deuda, cliente), token: deuda.token });
    } catch {
      await e.repo.actualizar('deudas', deuda.id, { [campo]: null });
      return { enviados, fallidos, motivo: 'No hubo conexión con WhatsApp. Se reintenta en la próxima tanda.' };
    }
    const base = { cliente_id: cliente.id, deuda_id: deuda.id, etapa, canal: 'auto', dia: hoy, creado: iso(e) };
    if (r.ok) { await e.repo.insertar('mensajes', { ...base, estado: 'enviado', wa_id: r.id }); enviados += 1; }
    else if (r.deCuenta) {
      await e.repo.actualizar('deudas', deuda.id, { [campo]: null });
      await e.repo.guardarConfig({ alerta: `WhatsApp frenó los avisos automáticos: ${r.mensaje}` });
      return { enviados, fallidos, motivo: r.mensaje };
    } else { await e.repo.insertar('mensajes', { ...base, estado: 'fallido', error: r.mensaje }); fallidos += 1; }
  }
  if (enviados && cfg.alerta) await e.repo.guardarConfig({ alerta: null });
  return { enviados, fallidos, motivo: '' };
}

// Una vez por día: crea la próxima cuota de las deudas que se repiten (una
// semana antes de que venza) y limpia las sesiones vencidas.
export async function mantenimiento(e, cfg, hoy) {
  if (cfg.ultimo_mantenimiento === hoy) return;
  cfg.ultimo_mantenimiento = hoy;
  await e.repo.guardarConfig({ ultimo_mantenimiento: hoy });
  const series = await e.repo.filas('deudas', { siguiente_creada: 0, repite: { en: ['semanal', 'mensual'] } });
  for (let d of series) {
    for (let tope = 0; tope < 6 && d.estado !== 'anulada'; tope++) {
      const sig = siguienteVencimiento(d.vence, d.repite, d.dia_mes);
      if (!sig || sumarDias(sig, -7) > hoy) break;
      const nueva = {
        cliente_id: d.cliente_id, concepto: conceptoSiguiente(d.concepto, d.vence, sig), monto: d.monto, vence: sig,
        repite: d.repite, dia_mes: d.dia_mes, estado: 'pendiente', token: aleatorio(12), siguiente_creada: 0, creado: iso(e),
      };
      const id = await e.repo.insertar('deudas', nueva);
      await e.repo.actualizar('deudas', d.id, { siguiente_creada: 1 });
      d = { ...nueva, id };
    }
  }
  await e.repo.borrar('sesiones', { vence: { hasta: iso(e) } });
}

// Modo un toque: a la mañana, un mail al dueño con los avisos del día.
export async function mailDeLaManana(e, cfg) {
  const ar = ahoraAR(e.ahora());
  if (ar.diaSemana === 0 || ar.hora < 8 || (ar.hora === 8 && ar.minuto < 30)) return { enviado: false };
  if (cfg.ultimo_mail === ar.fecha || modoDe(cfg, e) !== 'toque' || !cfg.mail_dueno || !mailConectado(e.env)) return { enviado: false };
  await e.repo.guardarConfig({ ultimo_mail: ar.fecha });
  const { deudas, clientes } = await pendientes(e);
  const deHoy = await e.repo.filas('mensajes', { dia: ar.fecha });
  const lista = avisosDelDia({ deudas, clientes, recibieronHoy: new Set(deHoy.map((m) => m.cliente_id)), hoy: ar.fecha });
  if (!lista.length) return { enviado: false };
  const origen = e.origen || cfg.origen || '';
  const filas = lista.map(({ deuda, cliente, etapa }) => `<tr><td style="padding:8px 12px 8px 0"><strong>${esc(cliente.nombre)}</strong><br><span style="color:#6b675f">${esc(NOMBRE_ETAPA[etapa])} · ${esc(deuda.concepto)}</span></td><td style="padding:8px 0;text-align:right;white-space:nowrap">${esc(formatearMonto(deuda.monto))}</td></tr>`).join('');
  const r = await enviarMail(e, {
    para: cfg.mail_dueno,
    asunto: `Hoy tenés ${lista.length} ${lista.length === 1 ? 'aviso' : 'avisos'} para mandar`,
    html: `<div style="font-family:system-ui,sans-serif;max-width:480px"><p>Buen día. Estos son los avisos de hoy de ${esc(cfg.nombre || 'tu negocio')}:</p><table style="width:100%;border-collapse:collapse">${filas}</table>${origen ? `<p><a href="${esc(origen)}/#avisos" style="display:inline-block;background:#0b5d6b;color:#fff;padding:12px 18px;border-radius:10px;text-decoration:none;font-weight:600">Abrir los avisos de hoy</a></p>` : ''}<p style="color:#6b675f;font-size:13px">Cada uno se manda con un toque desde tu WhatsApp.</p></div>`,
  });
  return { enviado: r.ok, cantidad: lista.length };
}

// Lo que corre cada 15 minutos en Cloudflare.
export async function tareas(e) {
  await e.repo.preparar();
  const cfg = await e.repo.config();
  if (!cfg.clave_hash && !e.demo) return { instalada: false };
  await mantenimiento(e, cfg, ahoraAR(e.ahora()).fecha);
  const mail = await mailDeLaManana(e, cfg);
  const envio = await enviarAutomaticos(e, cfg);
  return { instalada: true, mail, envio };
}

export { ETAPAS };
