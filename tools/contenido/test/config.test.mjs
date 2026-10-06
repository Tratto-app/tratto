import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { afterEach, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { cargarConfig } from '../lib/config.mjs';
import { configTemporal, limpiarEntorno } from './ayudante.mjs';

afterEach(limpiarEntorno);

test('la configuración real es válida y avisa las hipótesis', () => {
  const c = cargarConfig();
  assert.deepEqual(c.errores, []);
  assert.ok(c.advertencias.some((a) => a.includes('hipótesis')));
});

test('detecta pilares que no suman 100, campos faltantes y JSON roto', () => {
  configTemporal({
    estrategia: (e) => { e.pilares[0].porcentaje = 99; return e; },
    marca: (m) => { delete m.cta_principal; return m; },
    audiencia: () => '{ roto',
  });
  const c = cargarConfig();
  const t = c.errores.join(' | ');
  assert.match(t, /suman 1\d\d/);
  assert.match(t, /cta_principal: falta/);
  assert.match(t, /no es JSON válido/);
});

test('falta un archivo de configuración → error claro, sin excepción', () => {
  configTemporal({ marca: () => undefined });
  const c = cargarConfig();
  assert.match(c.errores.join(), /No se pudo leer .*marca\.json/);
});

test('la marca es coherente con el workspace de Growth OS (mismas cifras y restricciones)', () => {
  const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
  const seed = path.join(raiz, 'growth/supabase/seed/tratto.sql');
  if (!fs.existsSync(seed)) return;
  const sql = fs.readFileSync(seed, 'utf8');
  const { marca } = cargarConfig();
  const comision = marca.modelo.match(/(\d+)%/)[1];
  assert.ok(sql.includes(`${comision}%`), `la comisión ${comision}% figura en el seed`);
  assert.ok(sql.includes('gas, electricidad, salud') && marca.restricciones.join().includes('gas, electricidad, salud'));
  assert.ok(/más de 40 rubros/i.test(sql) && marca.diferenciales.some((d) => /más de 40 rubros/i.test(d)));
});
