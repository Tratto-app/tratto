import assert from 'node:assert/strict';
import { test } from 'node:test';
import { revisarIA } from '../lib/humanizador.mjs';

test('un texto lleno de marcas de IA da alto y pide reescribir el párrafo', () => {
  const r = revisarIA('Te lo digo claro: crecer en Instagram no va de publicar más. Es crucial destacar que un buen gancho. En conclusión, desbloquea tu potencial.');
  assert.ok(r.porcentaje >= 55, `dio ${r.porcentaje}`);
  assert.equal(r.veredicto, 'suena a IA');
  assert.equal(r.parrafos[0].accion, 'reescribir el párrafo');
});

test('un caption con voseo y datos concretos da bajo', () => {
  const r = revisarIA('Tu cuñado opina. Nadie sabe cuánto sale un flete.\nY ninguno del grupo de la familia acertó. Antes de decir que sí, poné el precio que te pasaron en la calculadora de Tratto: en 20 segundos sabés si es caro, justo o barato.');
  assert.ok(r.porcentaje < 25, `dio ${r.porcentaje}`);
  assert.equal(r.veredicto, 'suena humano');
});

test('el tuteo, los remates armados y el paralelismo se marcan aunque estén solos', () => {
  for (const t of ['Si tienes un problema, llamanos.', '¿El resultado? Más pedidos.', 'No es solo un precio, es tranquilidad.']) {
    const r = revisarIA(t);
    assert.equal(r.parrafos[0].accion, 'reemplazar lo marcado', t);
  }
});

test('marca exceso de emojis, hashtags y rayas', () => {
  const r = revisarIA('Precios de octubre 🔥🔥🔥🔥 — mirá — todo — acá #a #b #c #d #e #f');
  assert.ok(r.formato.some((f) => f.includes('emojis')));
  assert.ok(r.formato.some((f) => f.includes('hashtags')));
  assert.ok(r.formato.some((f) => f.includes('rayas')));
});

test('texto vacío no rompe', () => {
  assert.equal(revisarIA('').veredicto, 'sin texto');
});

test('corregir: lista lo que hay que cambiar sí o sí', () => {
  assert.deepEqual(revisarIA('Cuánto sale un flete chico en CABA.').corregir, []);
  const r = revisarIA('Seamos honestos: la mudanza cansa.');
  assert.equal(r.corregir.length, 1);
  assert.match(r.corregir[0], /sinceridad/);
  assert.deepEqual(revisarIA('').corregir, []);
});

test('el voseo con tilde no se confunde con tuteo', () => {
  assert.deepEqual(revisarIA('¿Necesitás un servicio? Tratto').corregir, []);
  assert.deepEqual(revisarIA('Desbloqueá el celular y entrá.').corregir, []);
  assert.equal(revisarIA('¿Tienes un servicio? Tú puedes.').corregir.length, 1);
});
