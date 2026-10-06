import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cargarConfig } from '../lib/config.mjs';
import { ErrorEntrada } from '../lib/errores.mjs';
import { verificarHooks } from '../lib/hooks.mjs';
import { verificarPieza } from '../lib/verificar.mjs';

const { marca } = cargarConfig();
const falla = (e, t) => assert.throws(() => verificarPieza(e, marca), (x) => x instanceof ErrorEntrada && x.message.includes(t));

test('carrusel: límites de la plataforma son errores, guías son advertencias', () => {
  const r = verificarPieza({ formato: 'carrusel', slides: Array.from({ length: 21 }, (_, i) => `Slide ${i}`) }, marca);
  assert.equal(r.ok, false);
  assert.match(r.errores.join(), /de 2 a 20/);
  const bien = verificarPieza({ formato: 'carrusel', slides: ['Qué incluye un presupuesto', 'Mano de obra', 'Materiales', 'Garantía del trabajo', 'Guardalo para la próxima'] }, marca);
  assert.equal(bien.ok, true);
  assert.deepEqual(bien.advertencias, []);
});

test('reglas de marca: palabras evitadas, rubros con matrícula, plazos y precios', () => {
  const r = verificarPieza({ formato: 'publicacion', texto: 'La solución integral: un electricista en minutos por $20.000' }, marca);
  const t = r.advertencias.join(' | ');
  assert.match(t, /solución integral/);
  assert.match(t, /matrícula/);
  assert.match(t, /plazo/);
  assert.match(t, /tabla de referencia/);
});

test('reel: duración estimada, hook largo y falta de CTA', () => {
  const guion = 'Hoy les vengo a contar una cosa muy importante sobre los plomeros de la zona norte. ' + 'Explicación larga. '.repeat(100);
  const r = verificarPieza({ formato: 'reel', guion }, marca);
  assert.ok(r.medidas.duracion_estimada);
  assert.match(r.advertencias.join(), /Hook de \d+ palabras/);
  assert.match(r.advertencias.join(), /pedido de acción/);
  assert.equal(verificarPieza({ formato: 'reel', guion: 'Guardalo.', duracion_seg: 200 }, marca).ok, false);
});

test('perfil: bio, usuario y destacadas', () => {
  const r = verificarPieza({ formato: 'perfil', usuario: 'tratto app!', bio: 'x'.repeat(151), destacadas: ['Cómo funciona Tratto paso a paso'] }, marca);
  assert.equal(r.errores.length, 2);
  assert.match(r.advertencias.join(), /se corta/);
  const emoji = verificarPieza({ formato: 'perfil', bio: '🔧'.repeat(150) + ' Pedí gratis' }, marca);
  assert.equal(emoji.medidas.bio_caracteres, 162);
});

test('historia: largo por pantalla y secuencia', () => {
  const r = verificarPieza({ formato: 'historia', pantallas: ['Una pantalla con muchísimas palabras '.repeat(6)] }, marca);
  assert.match(r.advertencias.join(), /Pantalla 1/);
  assert.match(r.advertencias.join(), /secuencia/);
});

test('entradas inválidas', () => {
  falla({ formato: 'tiktok' }, 'Formato desconocido');
  falla({ formato: 'reel' }, 'Falta "guion"');
  falla({ formato: 'carrusel', slides: 'uno' }, 'lista');
  falla({ formato: 'carrusel', slides: [1, 2] }, 'texto');
  falla({ formato: 'perfil' }, 'al menos uno');
  falla({ formato: 'reel', guion: 'hola', duracion_seg: -3 }, 'duracion_seg');
  falla({ formato: 'publicacion', texto: 'x'.repeat(20001) }, 'demasiado largo');
  falla(null, 'objeto JSON');
});

test('anti-copia: un hook igual al del original no pasa', () => {
  const r = verificarHooks({ formato: 'reel', evitar: ['Nadie te dice esto sobre los electricistas'], hooks: [
    { texto: 'Nadie te dice esto sobre los plomeros', categoria: 'curiosidad' },
    { texto: 'El presupuesto barato que te sale el doble', categoria: 'contrarian' },
  ] });
  assert.match(r.hooks[0].problemas.join(), /Copia al contenido original/);
  assert.equal(r.hooks[1].apto, true);
  assert.throws(() => verificarHooks({ hooks: ['a b'], evitar: 'texto' }), /evitar/);
});
