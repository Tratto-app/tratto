import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { DateTime } from 'luxon';
import { interpretarFecha, fechaHumana, fechaRelativaHumana, rangoDeFechas, lunesDeLaSemana } from '../src/shared/tiempo.js';
import { normalizarTelefono, telefonoParecePlausible, sanearNombre, sanearMensaje } from '../src/shared/texto.js';
import { ZONA } from './helpers.js';

// Miércoles 16/09/2026 a las 11:00 en Buenos Aires.
const REF = DateTime.fromISO('2026-09-16T11:00:00', { zone: ZONA });

describe('interpretación de fechas en lenguaje natural', () => {
  const casos: Array<[string, string | null]> = [
    ['hoy', '2026-09-16'],
    ['mañana', '2026-09-17'],
    ['pasado mañana', '2026-09-18'],
    ['el sábado', '2026-09-19'],
    ['este sábado', '2026-09-19'],
    ['el martes', '2026-09-22'],
    ['dentro de dos días', '2026-09-18'],
    ['en 3 dias', '2026-09-19'],
    ['la semana que viene', '2026-09-23'],
    ['20/09', '2026-09-20'],
    ['el 24/12/2026', '2026-12-24'],
    ['2026-10-01', '2026-10-01'],
    ['cualquier cosa sin fecha', null],
  ];

  for (const [texto, esperado] of casos) {
    test(`"${texto}" → ${esperado ?? 'sin fecha'}`, () => {
      assert.equal(interpretarFecha(texto, REF).fecha, esperado);
    });
  }

  test('"el sábado que viene" cuando hoy es sábado salta una semana', () => {
    const sabado = DateTime.fromISO('2026-09-19T11:00:00', { zone: ZONA });
    assert.equal(interpretarFecha('el sábado que viene', sabado).fecha, '2026-09-26');
    assert.equal(interpretarFecha('este sábado', sabado).fecha, '2026-09-19');
  });

  test('una fecha de dd/mm ya pasada se entiende como del año que viene', () => {
    assert.equal(interpretarFecha('01/02', REF).fecha, '2027-02-01');
  });

  test('distingue "mañana" (día) de "a la mañana" (franja)', () => {
    assert.deepEqual(
      { fecha: interpretarFecha('mañana', REF).fecha, rango: interpretarFecha('mañana', REF).rango },
      { fecha: '2026-09-17', rango: null },
    );
    const combinado = interpretarFecha('mañana a la mañana', REF);
    assert.equal(combinado.fecha, '2026-09-17');
    assert.equal(combinado.rango, 'mañana');
  });

  test('detecta franjas del día', () => {
    assert.equal(interpretarFecha('el sábado a la tarde', REF).rango, 'tarde');
    assert.equal(interpretarFecha('el viernes a la noche', REF).rango, 'noche');
    assert.equal(interpretarFecha('mañana temprano', REF).rango, 'mañana');
  });

  test('detecta horas exactas y aperturas de rango', () => {
    assert.equal(interpretarFecha('17:30', REF).hora, '17:30');
    assert.equal(interpretarFecha('a las 17', REF).hora, '17:00');
    assert.equal(interpretarFecha('tipo 11', REF).hora, '11:00');
    assert.equal(interpretarFecha('5 de la tarde', REF).hora, '17:00');
    assert.equal(interpretarFecha('¿tenés algo el sábado después de las 17?', REF).desdeHora, '17:00');
  });

  test('interpreta la hora chica como horario de tarde, que es lo que pide la gente', () => {
    // Nadie pide turno en una barbería a las 5 de la mañana.
    assert.equal(interpretarFecha('a las 5', REF).hora, '17:00');
    assert.equal(interpretarFecha('a las 5 de la tarde', REF).hora, '17:00');
    assert.equal(interpretarFecha('a las 11', REF).hora, '11:00');
  });

  test('un mensaje sin nada útil no inventa datos', () => {
    const r = interpretarFecha('hola qué tal todo bien?', REF);
    assert.deepEqual(r, { fecha: null, rango: null, hora: null, desdeHora: null });
  });
});

describe('formato de fechas para el cliente', () => {
  test('usa nombres en castellano rioplatense', () => {
    assert.equal(fechaHumana(DateTime.fromISO('2026-09-19', { zone: ZONA })), 'sábado 19/09');
    assert.equal(fechaHumana(DateTime.fromISO('2026-09-23', { zone: ZONA })), 'miércoles 23/09');
  });

  test('dice hoy/mañana cuando corresponde', () => {
    assert.equal(fechaRelativaHumana(REF, REF), 'hoy');
    assert.equal(fechaRelativaHumana(REF.plus({ days: 1 }), REF), 'mañana');
    assert.equal(fechaRelativaHumana(REF.plus({ days: 2 }), REF), 'pasado mañana');
    assert.equal(fechaRelativaHumana(REF.plus({ days: 5 }), REF), 'lunes 21/09');
  });

  test('la semana arranca en lunes', () => {
    assert.equal(lunesDeLaSemana('2026-09-19', ZONA), '2026-09-14');
    assert.equal(rangoDeFechas('2026-09-14', '2026-09-20', ZONA).length, 7);
  });
});

describe('saneamiento de datos que entran de afuera', () => {
  test('normaliza teléfonos argentinos en cualquier formato', () => {
    for (const entrada of ['11 2233 4455', '011 15 2233 4455', '+54 9 11 2233 4455', '5411 2233 4455', '5491122334455']) {
      const n = normalizarTelefono(entrada);
      assert.equal(n, '5491122334455', `falló con "${entrada}"`);
      assert.ok(telefonoParecePlausible(n));
    }
  });

  test('respeta otros códigos de país', () => {
    assert.equal(normalizarTelefono('11 2233 4455', { codigoPais: '598' }), '5981122334455');
    assert.equal(normalizarTelefono('598 11 2233 4455', { codigoPais: '598' }), '5981122334455');
  });

  test('rechaza teléfonos que no tienen forma de número', () => {
    assert.equal(telefonoParecePlausible(normalizarTelefono('abc')), false);
    assert.equal(telefonoParecePlausible('123'), false);
  });

  test('limpia nombres sin romper acentos ni apellidos compuestos', () => {
    assert.equal(sanearNombre('agustín'), 'Agustín');
    assert.equal(sanearNombre('  juan  josé  '), 'Juan José');
    assert.equal(sanearNombre("o'connor"), "O'connor");
  });

  test('saca inyecciones obvias del nombre', () => {
    const limpio = sanearNombre('<script>alert(1)</script>');
    assert.ok(!/[<>()/]/.test(limpio), `quedaron caracteres peligrosos: ${limpio}`);
    assert.ok(!sanearNombre('Juan http://spam.com').includes('http'));
  });

  test('recorta mensajes larguísimos y saca caracteres de control', () => {
    assert.equal(sanearMensaje('hola\u0000mundo'), 'holamundo');
    assert.equal(sanearMensaje('x'.repeat(5000)).length, 2000);
  });
});
