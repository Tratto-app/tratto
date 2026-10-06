import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ErrorEntrada } from '../lib/errores.mjs';
import { puntajeMarkdown, puntuar, revisarRubrica, rubrica } from '../lib/puntaje.mjs';
import { reel } from './ayudante.mjs';

const falla = (fn, texto) => assert.throws(fn, (e) => e instanceof ErrorEntrada && [e.message, ...(e.detalles || [])].join(' | ').includes(texto));

test('la rúbrica es coherente: pesos suman 100, niveles y bandas continuos', () => {
  assert.deepEqual(revisarRubrica(), []);
});

test('revisarRubrica detecta pesos que no suman 100 y dimensiones inexistentes', () => {
  const r = structuredClone(rubrica());
  r.formatos.reel.pesos.hook = 50;
  r.formatos.reel.pesos.inventada = 1;
  const p = revisarRubrica(r).join(' | ');
  assert.match(p, /suman/);
  assert.match(p, /desconocida inventada/);
});

test('puntuación normal: total ponderado, banda y confianza', () => {
  const r = puntuar(reel(70));
  assert.equal(r.total, 70);
  assert.equal(r.banda, 'bueno');
  assert.equal(r.confianza, 'media');
  assert.equal(r.topes_aplicados.length, 0);
  assert.equal(r.desglose.length, 13);
  assert.ok(r.advertencias.some((a) => a.includes('mismo puntaje')));
});

test('el peso del formato cambia el total', () => {
  const alto = puntuar(reel(60, { hook: 100, retencion: 100 }));
  const bajo = puntuar(reel(60, { cta: 100, autoridad: 100 }));
  assert.ok(alto.total > bajo.total, `${alto.total} > ${bajo.total}`);
});

test('tope por hook débil aunque lo demás sea excelente', () => {
  const r = puntuar(reel(95, { hook: 30 }));
  assert.equal(r.total, 55);
  assert.ok(r.total_sin_topes > 80);
  assert.deepEqual(r.topes_aplicados.map((t) => t.id), ['hook_debil']);
});

test('tope sin motivo de acción usa el máximo de compartidos/guardados/comentarios', () => {
  const r = puntuar(reel(90, { compartidos: 30, guardados: 35, comentarios: 20 }));
  assert.equal(r.total, 65);
  const r2 = puntuar(reel(90, { compartidos: 30, guardados: 50, comentarios: 20 }));
  assert.equal(r2.topes_aplicados.length, 0);
});

test('idea: retención, claridad, autoridad y cta no son obligatorias', () => {
  const e = reel(60);
  e.formato = 'idea'; e.insumo = 'idea';
  for (const d of ['retencion', 'claridad', 'autoridad', 'cta']) delete e.dimensiones[d];
  const r = puntuar(e);
  assert.equal(r.total, 60);
  assert.equal(r.confianza, 'baja');
  assert.deepEqual(r.no_evaluadas.sort(), ['autoridad', 'claridad', 'cta', 'retencion']);
});

test('dimensión sin peso en el formato se acepta y no suma', () => {
  const e = reel(50);
  e.formato = 'historia';
  const r = puntuar(e);
  assert.equal(r.total, 50);
  assert.equal(r.desglose.find((d) => d.dimension === 'novedad').peso, 0);
});

test('entradas incompletas o inválidas se rechazan con detalle', () => {
  const sinHook = reel(70); delete sinHook.dimensiones.hook;
  falla(() => puntuar(sinHook), 'Faltan dimensiones para reel: hook');
  falla(() => puntuar(reel(70, { hook: 101 })), 'entero de 0 a 100');
  falla(() => puntuar({ ...reel(70), dimensiones: { ...reel(70).dimensiones, hook: { puntaje: 70.5, evidencia: 'texto suficiente de evidencia' } } }), 'entero');
  falla(() => puntuar({ ...reel(70), dimensiones: { ...reel(70).dimensiones, hook: { puntaje: '70', evidencia: 'texto suficiente de evidencia' } } }), 'entero');
  falla(() => puntuar({ ...reel(70), formato: 'tiktok' }), 'Formato desconocido');
  falla(() => puntuar({ ...reel(70), insumo: 'rumor' }), 'Insumo desconocido');
  falla(() => puntuar({ ...reel(70), dimensiones: { ...reel(70).dimensiones, magia: { puntaje: 1, evidencia: 'x' } } }), 'dimensión desconocida');
  falla(() => puntuar(null), 'objeto JSON');
  falla(() => puntuar([]), 'objeto JSON');
  falla(() => puntuar({ formato: 'reel', insumo: 'guion' }), 'Falta "dimensiones"');
});

test('evidencia corta se rechaza, y más exigente en los extremos', () => {
  const e = reel(70);
  e.dimensiones.hook = { puntaje: 70, evidencia: 'muy corto' };
  falla(() => puntuar(e), 'hook: la evidencia');
  e.dimensiones.hook = { puntaje: 95, evidencia: 'Tiene veinte caracteres' };
  falla(() => puntuar(e), 'hacen falta al menos 30');
  e.dimensiones.hook = { puntaje: 95, evidencia: '"Te cobraron 80 mil por destapar la pileta?" en el segundo 0' };
  assert.equal(puntuar(e).desglose.find((d) => d.dimension === 'hook').puntaje, 95);
});

test('evidencia muy larga se recorta y no rompe la tabla markdown', () => {
  const e = reel(70);
  e.dimensiones.hook.evidencia = 'a|b\n'.repeat(1000);
  const r = puntuar(e);
  assert.ok(r.desglose.find((d) => d.dimension === 'hook').evidencia.length <= 601);
  const md = puntajeMarkdown(r);
  const fila = md.split('\n').find((l) => l.startsWith('| Hook'));
  assert.ok(fila.includes('\\|'));
  assert.match(md, /^VIRALIDAD: 70\/100 \(bueno · confianza media\)/);
});

test('bandas en los bordes', () => {
  assert.equal(puntuar(reel(39, { hook: 40, retencion: 40, compartidos: 40 })).banda, 'bajo');
  assert.equal(puntuar(reel(75)).banda, 'alto');
  assert.equal(puntuar(reel(90)).banda, 'excepcional');
});

test('advierte puntaje muy alto con confianza baja', () => {
  const e = reel(92); e.insumo = 'descripcion';
  e.dimensiones = Object.fromEntries(Object.entries(e.dimensiones).map(([k, v]) => [k, { ...v, evidencia: `${v.evidencia} con detalle extra observado` }]));
  assert.ok(puntuar(e).advertencias.some((a) => a.includes('confianza baja')));
});
