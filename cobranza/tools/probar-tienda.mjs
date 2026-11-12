// Una compra de punta a punta en la tienda, con Mercado Pago simulado:
// página de venta → pagar → gracias → la app abre sola; y los candados
// (sin licencia no abre, la de otra app no sirve, se recupera con el mail).
//   npm run armar && node tools/probar-tienda.mjs [carpeta-para-capturas]
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import { crearTienda } from './tienda-local.mjs';

const { chromium } = createRequire(import.meta.url)('playwright');
const capturas = process.argv[2];
const { servidor, origen, pagos } = crearTienda({ puerto: 8794 });
const lenta = crearTienda({ puerto: 8795, estadoPago: 'in_process' });
const navegador = await chromium.launch();
const errores = [];
let paso = 0;
async function abrir(ruta, opciones = {}) {
  const contexto = await navegador.newContext({ viewport: { width: 390, height: 844 }, locale: 'es-AR', ...opciones });
  const p = await contexto.newPage();
  // Los 404 son esperados: son los intentos con un código o un mail que no corresponde.
  p.on('console', (m) => { if (m.type() === 'error' && !/status of 404/.test(m.text())) errores.push(`${ruta}: ${m.text()}`); });
  p.on('pageerror', (e) => errores.push(`${ruta}: ${e}`));
  await p.goto(ruta.startsWith('http') ? ruta : origen + ruta);
  const ver = (texto) => p.getByText(texto, { exact: false }).first().waitFor({ timeout: 8000 });
  const foto = async (nombre, completa = true) => { if (capturas) await p.screenshot({ path: `${capturas}/${String(++paso).padStart(2, '0')}-${nombre}.png`, fullPage: completa }); };
  return { p, ver, foto, contexto };
}
try {
  // Página de venta, con la demo viva adentro del celular
  let link;
  {
    const { p, ver, foto, contexto } = await abrir('/cuotas-al-dia/');
    await ver('Sabé quién te debe la cuota');
    await p.frameLocator('.telefono iframe').getByText('Estudio de danza Giro').first().waitFor({ timeout: 10000 });
    assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'la página de venta no se desborda');
    await foto('venta-celular');
    // Comprar → Mercado Pago (simulado) → gracias → abrir la app
    await p.click('.hero .btn.pri');
    await ver('Mercado Pago simulado');
    await ver('$ 29.000');
    await p.click('#pagar');
    await ver('ya es tuya');
    link = await p.inputValue('#link');
    assert.match(link, /\/cuotas-al-dia\/app\.html\?licencia=/);
    await foto('gracias');
    await p.click('text=Abrir mi app');
    await ver('Bienvenido a Cuotas al día');
    await p.fill('#bv-nombre', 'Escuela Ritmo');
    await p.click('text=Empezar');
    await ver('Nadie debe la cuota');
    await foto('app-recien-comprada');
    await contexto.close();
  }
  // Sin licencia, la app no abre: ofrece comprar o activar
  {
    const { p, ver, foto, contexto } = await abrir('/cuotas-al-dia/app.html');
    await ver('Comprar por $ 29.000');
    await ver('¿Ya la compraste?');
    await foto('sin-licencia');
    await p.fill('#lic-codigo', 'cualquier-cosa');
    await p.click('button:has-text("Activar")');
    await ver('Ese código no corresponde a esta app');
    await p.fill('#lic-codigo', link);                       // pega el link que le quedó al comprar
    await p.click('button:has-text("Activar")');
    await ver('Bienvenido a Cuotas al día');
    await contexto.close();
  }
  // El link de la compra abre la app en otro celular y no queda a la vista
  {
    const { p, ver, contexto } = await abrir(link);
    await ver('Bienvenido a Cuotas al día');
    assert.ok(!p.url().includes('licencia='), 'la licencia no queda en la dirección');
    await contexto.close();
  }
  // La licencia de una app no abre otra
  {
    const { ver, contexto } = await abrir(`/libreta/app.html?licencia=${new URL(link).searchParams.get('licencia')}`);
    await ver('Comprar por $ 19.000');
    await contexto.close();
  }
  // Recuperar la compra a mano, con el número de operación y el mail
  {
    const [numero] = [...pagos.keys()];
    const { p, ver, contexto } = await abrir('/gracias.html?app=cuotas');
    await ver('¿Ya compraste Cuotas al día?');
    await p.fill('#rec-pago', numero);
    await p.fill('#rec-mail', 'otra@ejemplo.com');
    await p.click('text=Buscar mi compra');
    await ver('No encontramos ese pago');
    await p.fill('#rec-pago', numero);
    await p.fill('#rec-mail', 'compradora@ejemplo.com');
    await p.click('text=Buscar mi compra');
    await ver('ya es tuya');
    await contexto.close();
  }
  // Un pago que queda en proceso no entrega la app
  {
    const { p, ver, contexto } = await abrir(`${lenta.origen}/control-al-dia/`);
    await p.click('.hero .btn.pri');
    await p.click('#pagar');
    await ver('todavía se está procesando');
    await contexto.close();
  }
  // Catálogo y página de venta en pantalla grande y en oscuro
  {
    const { p, ver, foto, contexto } = await abrir('/', { viewport: { width: 1200, height: 800 } });
    await ver('Apps simples para cobrar');
    assert.equal(await p.locator('.ficha').count(), 4);
    await foto('catalogo');
    await p.click('text=Control al día');
    await ver('Que tus pacientes vuelvan al control');
    await p.frameLocator('.telefono iframe').getByText('Consultorio Dra. Acosta').first().waitFor({ timeout: 10000 });
    await foto('venta-escritorio', false);
    await contexto.close();
  }
  {
    const { p, foto, contexto } = await abrir('/libreta/', { colorScheme: 'dark' });
    await p.frameLocator('.telefono iframe').getByText('Almacén Don Luis').first().waitFor({ timeout: 10000 });
    await foto('venta-oscuro', false);
    await contexto.close();
  }
  assert.deepEqual(errores, [], 'sin errores en la consola');
  console.log('Tienda: todo bien.');
} finally {
  await navegador.close();
  servidor.close();
  lenta.servidor.close();
}
