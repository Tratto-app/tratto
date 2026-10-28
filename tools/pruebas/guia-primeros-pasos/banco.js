// Banco de pruebas de la guía de primeros pasos: la app real (index.html servida
// en local) con Supabase, n8n y el permiso de notificaciones simulados. Nada sale
// a producción.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.TRATTO_URL || 'http://127.0.0.1:8765/index.html';
const SALIDA = process.env.CAPTURAS || path.join(require('os').tmpdir(), 'tratto-guia-capturas');
fs.mkdirSync(SALIDA, { recursive: true });

const HOY = new Date().toISOString();

function estadoNuevo(op) {
  return Object.assign({
    user: {
      id: '11111111-2222-3333-4444-555555555555', email: 'prueba@ejemplo.com', created_at: HOY,
      user_metadata: {}
    },
    proveedores: [], solicitudes: [], cuentaMP: null, mpFalla: false,
    puts: 0, patches: 0, posts: { proveedores: 0, solicitudes: 0 }, pushGuardadas: 0
  }, op || {});
}

const TIPICOS = [
  { rubro: 'Plomería y destapaciones', servicio: 'Cambio de inodoro', unidad: 'por trabajo' },
  { rubro: 'Plomería y destapaciones', servicio: 'Cambio o arreglo de canilla', unidad: 'por trabajo' },
  { rubro: 'Plomería y destapaciones', servicio: 'Destapación simple (pileta o inodoro)', unidad: 'por trabajo' },
  { rubro: 'Pintura', servicio: 'Habitación chica (3x3 m)', unidad: 'por trabajo' }
];

const json = (route, cuerpo, status, headers) => route.fulfill({
  status: status || 200, contentType: 'application/json',
  headers: Object.assign({ 'access-control-allow-origin': '*', 'access-control-allow-headers': '*',
    'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,HEAD,OPTIONS', 'access-control-expose-headers': 'content-range' }, headers || {}),
  body: JSON.stringify(cuerpo)
});

async function abrir(browser, estado, op) {
  op = op || {};
  const ctx = await browser.newContext({
    viewport: op.viewport || { width: 390, height: 844 },
    deviceScaleFactor: 2, isMobile: !op.escritorio, hasTouch: !op.escritorio,
    userAgent: op.ua || undefined
  });
  // Permiso de notificaciones simulado: __permiso es lo que dice el navegador,
  // __respuesta lo que contesta la persona en el cartel.
  await ctx.addInitScript(({ permiso, respuesta, sinPush }) => {
    if (sinPush) { try { delete window.PushManager; } catch (e) {} }
    window.__permiso = permiso; window.__respuesta = respuesta; window.__sub = null;
    try {
      Object.defineProperty(Notification, 'permission', { get: () => window.__permiso, configurable: true });
      Notification.requestPermission = async () => { window.__permiso = window.__respuesta; return window.__respuesta; };
    } catch (e) {}
    const sub = { endpoint: 'https://push.ejemplo/abc', toJSON: () => ({ keys: { p256dh: 'p', auth: 'a' } }), unsubscribe: async () => { window.__sub = null; return true; } };
    const reg = { pushManager: { getSubscription: async () => window.__sub, subscribe: async () => (window.__sub = sub) } };
    try { navigator.serviceWorker.register = async () => reg; } catch (e) {}
    localStorage.setItem('mkt_sesion', JSON.stringify({ access_token: 'tok', refresh_token: 'ref', modo: 'cliente' }));
  }, { permiso: op.permiso || 'default', respuesta: op.respuesta || 'granted', sinPush: !!op.sinPush });

  const page = await ctx.newPage();
  page.setDefaultTimeout(6000);
  page.on('pageerror', e => { (estado.errores = estado.errores || []).push(String(e)); });
  page.on('console', m => { if (m.type() === 'error') (estado.consola = estado.consola || []).push(m.text()); });

  await page.route(/fonts\.(googleapis|gstatic)\.com|_vercel|sdk\.mercadopago/, r => r.abort());
  await page.route(/marketplace-servicios\.app\.n8n\.cloud/, r => json(r, {}));
  await page.route(/marketplace-servicios\.app\.n8n\.cloud\/webhook\/mp-iniciar/, r =>
    r.request().method() === 'OPTIONS' ? json(r, {}) : estado.mpFalla ? json(r, { error: 'falla' }, 500) : json(r, { url: 'about:blank#mercadopago' }));
  await page.route(/qglsonbcsncgekzbfafk\.supabase\.co/, async route => {
    const req = route.request(), url = new URL(req.url()), m = req.method(), p = url.pathname;
    if (p === '/auth/v1/user') {
      if (m === 'PUT') {
        const d = JSON.parse(req.postData() || '{}').data || {};
        estado.user.user_metadata = Object.assign({}, estado.user.user_metadata, d);
        estado.puts++;
      }
      return json(route, estado.user);
    }
    if (p.startsWith('/auth/v1/')) return json(route, {});
    if (p === '/rest/v1/rpc/calculadora_servicios') return json(route, TIPICOS);
    if (p === '/rest/v1/rpc/registrar_push_subscripcion') { estado.pushGuardadas++; return json(route, null); }
    if (p.startsWith('/rest/v1/rpc/')) return json(route, []);
    const tabla = p.replace('/rest/v1/', '');
    if (tabla === 'proveedores') {
      if (m === 'POST') {
        const fila = Object.assign({ id: 900 + estado.proveedores.length, created_at: HOY }, JSON.parse(req.postData()));
        estado.proveedores.unshift(fila); estado.posts.proveedores++;
        return json(route, [fila], 201);
      }
      if (m === 'PATCH') {
        const id = Number((url.searchParams.get('id') || '').replace('eq.', ''));
        const f = estado.proveedores.find(x => x.id === id);
        if (!f) return json(route, []);
        Object.assign(f, JSON.parse(req.postData())); estado.patches++;
        return json(route, [f]);
      }
      return json(route, estado.proveedores);
    }
    if (tabla === 'solicitudes') {
      if (m === 'POST') {
        const fila = Object.assign({ id: 500 + estado.solicitudes.length, created_at: HOY, estado: 'pendiente' }, JSON.parse(req.postData()));
        estado.solicitudes.unshift(fila); estado.posts.solicitudes++;
        return route.fulfill({ status: 201, body: '' });
      }
      return json(route, estado.solicitudes);
    }
    if (tabla === 'cuentas_mp') return json(route, estado.cuentaMP ? [estado.cuentaMP] : []);
    if (tabla === 'visitas_perfil') return route.fulfill({ status: 200, headers: { 'content-range': '0-0/0' }, body: '' });
    if (tabla === 'pedidos_abiertos') return json(route, []);
    if (tabla === 'perfil_proveedor' && m === 'POST') return json(route, [{}], 201);
    if (m === 'GET' || m === 'HEAD') return json(route, []);
    return json(route, []);
  });

  await page.goto(BASE);
  await page.waitForTimeout(op.espera || 2200);
  return { ctx, page };
}

// Medidas para comprobar que la tarjeta entra en pantalla y no tapa lo señalado.
async function medir(page) {
  return page.evaluate(() => {
    const t = document.getElementById('guia-tarjeta'), a = document.getElementById('guia-aro');
    const vis = !document.getElementById('guia').hidden;
    const r = t.getBoundingClientRect(), ra = a.getBoundingClientRect();
    const aroVisible = vis && !a.classList.contains('oculto');
    const pisa = aroVisible && !(r.bottom <= ra.top + 1 || r.top >= ra.bottom - 1);
    return {
      guia: vis, mini: !document.getElementById('guia-mini').hidden,
      tit: (document.getElementById('guia-tit') || {}).textContent || '',
      paso: (document.querySelector('.gt-paso') || {}).textContent || '',
      estado: (document.querySelector('.gt-estado .sello') || {}).textContent || '',
      festejo: (document.querySelector('.gt-ok') || {}).textContent || '',
      dentro: !vis || (r.top >= -1 && r.bottom <= innerHeight + 1 && r.left >= -1 && r.right <= innerWidth + 1),
      tapaLoSenalado: pisa, pantalla: (document.querySelector('.pantalla.activa') || {}).id
    };
  });
}

module.exports = { abrir, estadoNuevo, medir, SALIDA, chromium };
