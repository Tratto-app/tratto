// Recorre las cuatro micro apps de nicho en un navegador con tamaño de celular:
// carga, avisos, entregas a cuenta, "le toca volver", copia de seguridad y que
// los datos sigan ahí al recargar. También abre las cuatro demos.
//   npm run armar && node tools/probar-nichos.mjs [carpeta-para-capturas]
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { ahoraAR, horario, sumarMeses, sumarDias, nombreMes } from '../src/logica.js';

const { chromium } = createRequire(import.meta.url)('playwright');
const dist = fileURLToPath(new URL('../dist/', import.meta.url));
const capturas = process.argv[2];
const PUERTO = 8792;
const servidor = http.createServer(async (req, res) => {
  try { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(await readFile(dist + req.url.split('?')[0].slice(1))); }
  catch { res.writeHead(404); res.end('no'); }
}).listen(PUERTO);
const navegador = await chromium.launch();
const errores = [];
let paso = 0;
const hoy = ahoraAR().fecha;
const abierto = horario(ahoraAR()).abierto;

async function abrir(archivo, opciones = {}) {
  const contexto = await navegador.newContext({ viewport: { width: 390, height: 844 }, locale: 'es-AR', timezoneId: 'America/Argentina/Buenos_Aires', acceptDownloads: true, ...opciones });
  const p = await contexto.newPage();
  p.on('console', (m) => { if (m.type() === 'error') errores.push(`${archivo}: ${m.text()}`); });
  p.on('pageerror', (e) => errores.push(`${archivo}: ${e}`));
  await p.goto(`http://localhost:${PUERTO}/${archivo}`);
  const ver = (texto) => p.getByText(texto, { exact: false }).first().waitFor({ timeout: 8000 });
  const foto = async (nombre) => { if (capturas) await p.screenshot({ path: `${capturas}/${String(++paso).padStart(2, '0')}-${nombre}.png`, fullPage: true }); };
  const nav = (texto) => p.click(`nav >> text=${texto}`);
  return { p, ver, foto, nav, contexto };
}

try {
  // ── Cuotas al día ────────────────────────────────────────────────────────
  {
    const { p, ver, nav, contexto } = await abrir('cuotas-al-dia.html');
    await ver('Bienvenido a Cuotas al día');
    await nav('Ajustes');
    await p.fill('#aj-nombre', 'Escuela Ritmo');
    await p.click('form:has(#aj-nombre) >> text=Guardar');
    await ver('Negocio guardado');
    await p.fill('#ajl-transf', 'Alias: escuela.ritmo');
    await p.fill('#ajl-area', '11');
    await p.click('form:has(#ajl-transf) >> text=Guardar');
    await ver('Guardado');
    await nav('Inicio');
    await p.click('text=Cargar la primera cuota');
    await p.fill('#n-nombre', 'Laura Méndez');
    await p.fill('#n-tel', '5555-4444');
    await p.fill('#n-nota', 'Sofi');
    await p.fill('#n-grupo', 'Danza jazz');
    await p.check('#n-acepta');
    assert.equal(await p.inputValue('#n-concepto'), `la cuota de ${nombreMes(hoy)}`);
    assert.equal(await p.inputValue('#n-repite'), 'mensual');
    await p.fill('#n-monto', '28.000');
    await p.click('text=Guardar la cuota');
    await ver('Sofi · Danza jazz');
    await ver('$ 28.000');
    await p.click('text=Entregó una parte');
    await p.fill('#en-monto', '10.000');
    await p.click('text=En efectivo');
    await ver('$ 18.000');
    await nav('Avisos');
    await ver(`Hola Laura, hoy vence tu pago de $ 18.000 por la cuota de ${nombreMes(hoy)} de Sofi. Para transferir: Alias: escuela.ritmo`);
    if (abierto) {
      assert.match(await p.getAttribute('a.btn.wa', 'href'), /^https:\/\/wa\.me\/5491155554444\?text=Hola%20Laura/);
      const [pestana] = await Promise.all([contexto.waitForEvent('page'), p.click('a.btn.wa')]);
      await pestana.close();
      await ver('No queda nada por mandar hoy');
    }
    await nav('Alumnos');
    await ver('Danza jazz');
    // Los datos siguen ahí al recargar
    await p.reload();
    await ver('Laura Méndez');
    await nav('Inicio');
    await ver('Escuela Ritmo');
    // Copia de seguridad: guardar, borrar todo y recuperar
    await nav('Ajustes');
    const [descarga] = await Promise.all([p.waitForEvent('download'), p.click('text=Guardar una copia')]);
    const ruta = await descarga.path();
    const copia = JSON.parse(await readFile(ruta, 'utf8'));
    assert.equal(copia.app, 'cuotas');
    assert.equal(copia.datos.tablas.clientes[0].nombre, 'Laura Méndez');
    await p.evaluate(() => localStorage.clear());
    await p.reload();
    await nav('Inicio');
    await ver('Bienvenido a Cuotas al día');
    await nav('Ajustes');
    await p.setInputFiles('#cp-archivo', ruta);
    await p.click('.modal button:has-text("Recuperar")');
    await p.waitForLoadState('load');
    await nav('Inicio');
    await ver('Escuela Ritmo');
    await nav('Alumnos');
    await ver('Laura Méndez');
    await contexto.close();
  }

  // ── Libreta ──────────────────────────────────────────────────────────────
  {
    const { p, ver, nav, contexto } = await abrir('libreta.html');
    await ver('La libreta está en blanco');
    await p.click('text=Anotar el primer fiado');
    await p.fill('#n-nombre', 'Marta Gómez');
    await p.fill('#n-tel', '11 5555-1111');
    await p.check('#n-acepta');
    await p.fill('#n-monto', '4.200');
    await p.fill('#n-concepto', 'pan y leche');
    await p.click('button:has-text("Anotar")');
    await ver('Debe en total');
    await p.click('text=Anotarle');
    await p.fill('#n-monto', '1.300');
    await p.click('button:has-text("Anotar")');
    await ver('$ 5.500');
    await p.click('text=Entregó una parte');
    await p.fill('#en-monto', '2.000');
    await p.click('text=En efectivo');
    await ver('$ 3.500');
    await nav('Inicio');
    await ver('Quién tiene fiado');
    await ver('Total fiado');
    assert.match(await p.locator('.talon').innerText(), /\$ 3\.500[\s\S]*Clientes que deben[\s\S]*\$ 2\.000/i);
    await p.click('text=Marta Gómez');
    await p.click('text=Pagó todo');
    await p.click('text=Por transferencia');
    await ver('Está al día');
    await nav('Ajustes');
    await ver('Día de cobro');
    await contexto.close();
  }

  // ── Control al día ───────────────────────────────────────────────────────
  {
    const { p, ver, nav, contexto } = await abrir('control-al-dia.html');
    await ver('Todavía no cargaste pacientes');
    await p.click('text=Cargar el primer paciente');
    await p.fill('#n-nombre', 'Ana Gómez');
    await p.fill('#n-tel', '11 5555-2222');
    await p.fill('#n-ultima', sumarDias(sumarMeses(hoy, -6), -10));
    await p.check('#n-acepta');
    await p.click('text=Guardar el paciente');
    await ver('Le toca volver');
    await nav('Inicio');
    await ver('Les toca el control');
    await ver('hace 10 días');
    await nav('Avisos');
    await ver('Hola Ana, te escribimos. Ya pasaron 6 meses de tu último control y te toca el próximo.');
    await nav('Pacientes');
    await p.click('text=Ana Gómez');
    await p.click('text=Vino hoy');
    await ver('Anotado: vino hoy');
    await ver('Le toca el');
    // Un paciente con cuotas de ortodoncia
    await nav('Inicio');
    await p.click('text=Cargar paciente');
    await p.fill('#n-nombre', 'Mora Díaz');
    await p.fill('#n-tel', '11 5555-3333');
    await p.check('#n-acepta');
    await p.check('#n-concuota');
    await p.fill('#n-monto', '45.000');
    await p.click('text=Guardar el paciente');
    await ver(`la cuota de ortodoncia de ${nombreMes(hoy)}`);
    // Lista pegada de pacientes
    await p.goto(`http://localhost:${PUERTO}/control-al-dia.html#importar`);
    await p.fill('#imp-texto', 'Luis Ferrari; 11 5555-4444; 10/01/2026\nElsa Quiroga; ; \n; 11 5555-0000; ');
    await p.click('text=Revisar la lista');
    await ver('2 para cargar · 1 fila con error');
    await p.check('#imp-acepta');
    await p.click('button:has-text("Cargar 2")');
    await ver('Se cargaron 2');
    await p.locator('.lista .fila').first().waitFor();
    await ver('Elsa Quiroga');
    assert.equal(await p.locator('.lista .fila').count(), 4);
    await contexto.close();
  }

  // ── Combi al día ─────────────────────────────────────────────────────────
  {
    const { p, ver, nav, contexto } = await abrir('combi-al-dia.html');
    await p.click('text=Cargar la primera familia');
    await p.fill('#n-nombre', 'Laura Méndez');
    await p.fill('#n-tel', '11 5555-5555');
    await p.fill('#n-nota', 'Sofi y Tomás');
    await p.fill('#n-grupo', 'San José, mañana');
    await p.check('#n-acepta');
    assert.equal(await p.inputValue('#n-concepto'), `la combi de ${nombreMes(hoy)}`);
    await p.fill('#n-monto', '130.000');
    await p.click('text=Guardar la cuota');
    await ver('Sofi y Tomás · San José, mañana');
    await nav('Avisos');
    await ver(`por la combi de ${nombreMes(hoy)} de Sofi y Tomás`);
    await nav('Familias');
    await ver('San José, mañana');
    await contexto.close();
  }

  // ── Las cuatro demos: abren solas, sin red, sin errores ──────────────────
  for (const [archivo, negocio, alguien] of [['cuotas-al-dia-demo.html', 'Estudio de danza Giro', 'Laura Méndez'], ['libreta-demo.html', 'Almacén Don Luis', 'Marta Gómez'],
    ['control-al-dia-demo.html', 'Consultorio Dra. Acosta', 'Ana Gómez'], ['combi-al-dia-demo.html', 'Transporte Los Pibes', 'Laura Méndez']]) {
    for (const esquema of ['light', 'dark']) {
      const { p, ver, foto, nav, contexto } = await abrir(archivo, { colorScheme: esquema });
      await ver(negocio);
      await ver(alguien);
      assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `${archivo} no se desborda de costado`);
      await foto(`${archivo.replace('-demo.html', '')}-inicio-${esquema}`);
      if (esquema === 'light') {
        await nav('Avisos');
        await p.locator('.burbuja').nth(1).waitFor({ timeout: 8000 });   // hay al menos dos avisos de ejemplo
        await foto(`${archivo.replace('-demo.html', '')}-avisos`);
        await p.click('button:has-text("Enviar por WhatsApp") >> nth=0');
        await ver('Así le llega a');
        await p.click('text=Listo, enviado');
        await ver('Enviados hoy');
        await p.click('nav >> button >> nth=2');
        await p.click(`text=${alguien}`);
        await foto(`${archivo.replace('-demo.html', '')}-ficha`);
      }
      await contexto.close();
    }
  }
  assert.deepEqual(errores, [], 'sin errores en la consola');
  console.log(`Micro apps: todo bien${abierto ? '' : ' (fuera del horario de avisos: no se probó el envío por WhatsApp)'}.`);
} finally {
  await navegador.close();
  servidor.close();
}
