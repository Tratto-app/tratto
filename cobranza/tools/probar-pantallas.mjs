// Recorre la app de punta a punta en un navegador con tamaño de celular:
// instalación, carga de una deuda, aviso con un toque, pago, carga masiva,
// ajustes, link de pago y vuelta a entrar. También abre la demo.
//   npm run armar && node tools/probar-pantallas.mjs [carpeta-para-capturas]
// Levanta sola la app local con los servicios de afuera simulados.
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const { chromium } = createRequire(import.meta.url)('playwright');
const raiz = fileURLToPath(new URL('..', import.meta.url));
const capturas = process.argv[2];
const PUERTO = 8791;
const URL_APP = `http://localhost:${PUERTO}`;

const servidor = spawn(process.execPath, ['tools/local.mjs'], { cwd: raiz, env: { ...process.env, PUERTO: String(PUERTO), SIMULAR: '1', NODE_NO_WARNINGS: '1' }, stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise((listo) => servidor.stdout.on('data', (d) => String(d).includes('localhost') && listo()));
const navegador = await chromium.launch();
const errores = [];
let paso = 0;
async function foto(pagina, nombre) {
  if (capturas) await pagina.screenshot({ path: `${capturas}/${String(++paso).padStart(2, '0')}-${nombre}.png`, fullPage: true });
}
try {
  const contexto = await navegador.newContext({ viewport: { width: 390, height: 844 }, locale: 'es-AR', timezoneId: 'America/Argentina/Buenos_Aires' });
  const p = await contexto.newPage();
  // El 401 del paso 8 (contraseña mal a propósito) lo anota el navegador: no es un error de la app.
  p.on('console', (m) => { if (m.type() === 'error' && !/status of 401/.test(m.text())) errores.push(m.text()); });
  p.on('pageerror', (e) => errores.push(String(e)));
  const ver = (texto) => p.getByText(texto, { exact: false }).first().waitFor({ timeout: 8000 });

  // 1. Primera vez
  await p.goto(URL_APP);
  await ver('Primera vez');
  await p.fill('#i-instalacion', 'instalar-local');
  await p.fill('#i-nombre', 'Taller Rivas');
  await p.fill('#i-usuario', 'rivas');
  await p.fill('#i-clave', 'unaclavelarga1');
  await p.fill('#i-clave2', 'unaclavelarga1');
  await p.click('text=Crear el acceso');
  await ver('Nadie te debe nada');

  // 2. Cargar una deuda con un cliente nuevo
  await p.click('text=Cargar la primera deuda');
  await p.fill('#n-nombre', 'Ana Gómez');
  await p.fill('#n-tel', '11 5555-4444');
  await p.check('#n-acepta');
  await p.fill('#n-concepto', 'el cambio de pastillas');
  await p.fill('#n-monto', '82.500');
  await p.click('text=Guardar la deuda');
  await ver('el cambio de pastillas');
  await ver('$ 82.500');
  await foto(p, 'ficha');

  // 3. Aviso con un toque (si es horario de avisos)
  await p.goto(`${URL_APP}/#avisos`);
  await ver('Para mandar');
  const abierto = await p.locator('a.btn.wa').count();
  if (abierto) {
    await ver('Hola Ana, hoy vence tu pago de $ 82.500 por el cambio de pastillas');
    await foto(p, 'avisos');
    assert.match(await p.getAttribute('a.btn.wa', 'href'), /^https:\/\/wa\.me\/5491155554444\?text=Hola%20Ana/);
    const [pestana] = await Promise.all([contexto.waitForEvent('page'), p.click('a.btn.wa')]);
    await pestana.close();
    await ver('No queda nada por mandar hoy');
    await ver('Enviados hoy');
  } else await ver('Los avisos salen');

  // 4. Link de pago como lo ve el cliente
  const link = await p.evaluate(async () => (await (await fetch('/api/clientes/1')).json()).deudas[0].link);
  const cliente = await contexto.newPage();
  await cliente.goto(link);
  await cliente.getByText('Hola Ana').waitFor();
  await cliente.getByText('$ 82.500').waitFor();
  await foto(cliente, 'link-de-pago');
  await cliente.click('text=Pagar con Mercado Pago');
  await cliente.waitForURL(/pago-simulado=/);
  await cliente.close();

  // 5. Ya me pagó
  await p.goto(`${URL_APP}/#cliente-1`);
  await p.click('text=Ya me pagó');
  await p.click('text=En efectivo');
  await ver('Está al día');
  await p.goto(`${URL_APP}/#inicio`);
  await ver('Entró este mes');
  assert.match(await p.locator('.talon-b').innerText(), /\$ 82\.500/);

  // 6. Carga masiva pegando una lista
  await p.goto(`${URL_APP}/#importar`);
  await p.fill('#imp-texto', 'Nombre;Celular;Concepto;Monto;Vence\nLuis Paz;11 4444-3333;la cuota de marzo;15.000;01/01/2026\nMarta Ríos;;el arreglo del embrague;120.000,50;02/01/2026\nSin monto;11 4444-2222;algo;gratis;03/01/2026');
  await p.click('text=Revisar la lista');
  await ver('2 deudas listas para cargar · 1 fila con error');
  await p.check('#imp-acepta');
  await foto(p, 'carga-masiva');
  await p.click('button:has-text("Cargar 2 deudas")');
  await ver('Quién te debe');
  await ver('Marta Ríos');
  assert.equal(await p.locator('.lista .fila').count(), 2);
  await foto(p, 'inicio');

  // 7. Ajustes: nombre y color
  await p.goto(`${URL_APP}/#ajustes`);
  await ver('Tu negocio');
  await p.fill('#aj-nombre', 'Taller Rivas Hnos');
  await p.fill('#aj-color', '#b3541e');
  await p.click('form:has(#aj-nombre) >> text=Guardar');
  await ver('Negocio guardado');
  assert.equal(await p.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--marca').trim()), '#b3541e');
  await foto(p, 'ajustes');

  // 8. Salir y volver a entrar
  await p.click('text=Salir');
  await ver('Entrá para ver quién te debe');
  await p.fill('#e-usuario', 'rivas');
  await p.fill('#e-clave', 'mala-clave-1234');
  await p.click('button:has-text("Entrar")');
  await ver('El usuario o la contraseña no coinciden');
  await p.fill('#e-clave', 'unaclavelarga1');
  await p.click('button:has-text("Entrar")');
  await ver('Quién te debe');

  // 9. La demo: abre sola, con datos de ejemplo, sin red
  for (const [esquema, ancho] of [['light', 390], ['dark', 390], ['light', 1100]]) {
    const cd = await navegador.newContext({ viewport: { width: ancho, height: 844 }, colorScheme: esquema, locale: 'es-AR', offline: true });
    const d = await cd.newPage();
    d.on('console', (m) => { if (m.type() === 'error') errores.push(`demo: ${m.text()}`); });
    d.on('pageerror', (e) => errores.push(`demo: ${e}`));
    await d.goto(`file://${raiz}dist/demo.html`);
    await d.getByText('Pilates Sur').first().waitFor();
    await d.getByText('Carla Benítez').first().waitFor();
    assert.ok(await d.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'la demo no se desborda de costado');
    await foto(d, `demo-inicio-${esquema}-${ancho}`);
    if (ancho === 390 && esquema === 'light') {
      await d.click('nav >> text=Avisos');
      await d.getByText('Último aviso').first().waitFor();
      await foto(d, 'demo-avisos');
      await d.click('button:has-text("Enviar por WhatsApp") >> nth=0');
      await d.getByText('Así le llega a').waitFor();
      await foto(d, 'demo-mensaje');
      await d.click('text=Listo, enviado');
      await d.getByText('Enviados hoy').waitFor();
      await d.click('nav >> text=Clientes');
      await d.click('text=Pablo Giménez');
      await d.getByText('Respondió: BAJA').waitFor();
      await foto(d, 'demo-ficha-baja');
      await d.click('nav >> text=Ajustes');
      await d.getByText('Avisos por WhatsApp').waitFor();
      await d.check('#aj-modo-auto');
      await d.getByText('Modo automático activado').waitFor();
      await d.click('nav >> text=Avisos');
      await d.click('text=Mandar ahora');
      await d.getByText(/Salieron \d+ avisos?/).waitFor();
    }
    await cd.close();
  }
  assert.deepEqual(errores, [], 'sin errores en la consola');
  console.log('Pantallas: todo bien.');
} finally {
  await navegador.close();
  servidor.kill();
}
