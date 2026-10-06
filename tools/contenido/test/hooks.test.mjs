import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ErrorEntrada } from '../lib/errores.mjs';
import { hooksMarkdown, verificarHooks } from '../lib/hooks.mjs';
import { similitud } from '../lib/texto.mjs';

const crit = (n) => ({ retencion: n, claridad: n, curiosidad: n, identificacion: n, viralidad: n });

test('hook bueno pasa; genérico y largo no', () => {
  const r = verificarHooks({ formato: 'reel', hooks: [
    { texto: '¿Te cobraron $80.000 por destapar la pileta?', categoria: 'shock' },
    { texto: 'Hola a todos, hoy hablamos de plomería', categoria: 'lista' },
    { texto: 'Lo que nadie te dice antes de llamar a un plomero un domingo a la noche', categoria: 'curiosidad' },
  ] });
  assert.equal(r.hooks[0].apto, true);
  assert.match(r.hooks[1].problemas.join(), /Apertura genérica/);
  assert.match(r.hooks[2].problemas.join(), /Largo/);
  const tips = verificarHooks({ hooks: ['Tips para contratar un plomero', 'Consejos de limpieza', 'Te cuento cómo elegir'] });
  assert.ok(tips.hooks.every((h) => !h.apto), 'las etiquetas tipo "tips" no son hooks');
});

test('detecta palabras que la marca no usa', () => {
  const r = verificarHooks({ formato: 'carrusel', hooks: [{ texto: 'La solución integral para tu casa', categoria: 'resultado' }] }, [], ['solución integral', 'profes']);
  assert.match(r.hooks[0].problemas.join(), /solucion integral/);
  const r2 = verificarHooks({ formato: 'carrusel', hooks: [{ texto: 'Qué preguntarle a los profesionales', categoria: 'pregunta' }] }, [], ['profes']);
  assert.equal(r2.hooks[0].apto, true, 'profes no debe coincidir dentro de profesionales');
});

test('detecta parecido con hooks ya usados y dentro del lote', () => {
  const historial = [{ texto: 'Cuánto sale destapar una cañería en 2026' }];
  const r = verificarHooks({ formato: 'reel', hooks: [
    { texto: '¿Cuánto sale destapar una cañería en 2026?', categoria: 'pregunta' },
    { texto: 'Tres errores al contratar un pintor', categoria: 'error' },
    { texto: 'Los tres errores al contratar a un pintor', categoria: 'error' },
  ] }, historial);
  assert.match(r.hooks[0].problemas.join(), /ya usado/);
  assert.equal(r.hooks[1].apto, true);
  assert.match(r.hooks[2].advertencias.join(), /Casi igual a la opción 2/);
  assert.ok(r.avisos.length === 0 || r.avisos.every((a) => !a.includes('misma categoría')));
});

test('ranking por criterios: gana la mejor apta, no la mejor puntuada si no pasa', () => {
  const r = verificarHooks({ formato: 'reel', hooks: [
    { texto: 'Hola a todos, cuánto sale un plomero', categoria: 'pregunta', criterios: crit(95) },
    { texto: '¿Cuánto sale un plomero un domingo?', categoria: 'pregunta', criterios: crit(70) },
    { texto: 'El presupuesto que parece barato y no es', categoria: 'contrarian', criterios: crit(80) },
  ] });
  assert.equal(r.mejor.texto, 'El presupuesto que parece barato y no es');
  assert.equal(r.ranking[r.ranking.length - 1].apto, false);
  assert.match(hooksMarkdown(r), /MEJOR OPCIÓN/);
});

test('avisa si todas las opciones son de la misma categoría', () => {
  const r = verificarHooks({ formato: 'reel', hooks: ['Uno dos tres', 'Cuatro cinco seis', 'Siete ocho nueve'].map((t) => ({ texto: t, categoria: 'lista' })) });
  assert.ok(r.avisos.some((a) => a.includes('misma categoría')));
});

test('acepta hooks como texto plano y advierte los muy cortos', () => {
  const r = verificarHooks({ hooks: ['Ojo'] });
  assert.equal(r.formato, 'reel');
  assert.match(r.hooks[0].advertencias.join(), /Muy corto/);
});

test('rechaza entradas inválidas', () => {
  const falla = (e, t) => assert.throws(() => verificarHooks(e), (x) => x instanceof ErrorEntrada && [x.message, ...(x.detalles || [])].join(' | ').includes(t));
  falla({ hooks: [] }, 'Falta "hooks"');
  falla({}, 'Falta "hooks"');
  falla({ formato: 'tiktok', hooks: ['a b'] }, 'Formato desconocido');
  falla({ hooks: [{ texto: 'algo', categoria: 'magia' }] }, 'categoría "magia"');
  falla({ hooks: [{ texto: '' }] }, 'falta el texto');
  falla({ hooks: [{ texto: 'algo', criterios: { retencion: 200 } }] }, 'criterios.retencion');
  falla({ hooks: Array.from({ length: 41 }, (_, i) => `hook ${i}`) }, 'Demasiados');
});

test('similitud ignora tildes, signos y palabras vacías', () => {
  assert.equal(similitud('¿Cuánto SALE un plomero?', 'cuanto sale plomero'), 1);
  assert.equal(similitud('', ''), 1);
  assert.equal(similitud('Te cobraron 80 mil', '¿Te cobraron $80.000?'), 1);
  assert.equal(similitud('80 lucas', '80.000'), 1);
  assert.equal(similitud('plomero', ''), 0);
});
