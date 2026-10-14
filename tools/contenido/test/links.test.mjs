import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cargarConfig } from '../lib/config.mjs';
import { revisarCaminoAlLink } from '../lib/links.mjs';
import { verificarPieza } from '../lib/verificar.mjs';
import { decidir } from '../hooks/antes-de-programar.mjs';

const { marca } = cargarConfig();
const links = marca.links;
const conTikTok = (habilitado) => ({ ...links, tiktok: { ...links.tiktok, link_en_perfil: habilitado } });
const post = (text, providers, extra = {}) => ({ info: JSON.stringify({ text, providers: providers.map((network) => ({ network })), ...extra }) });

test('Instagram: sin la mención a la cuenta no hay camino de un toque', () => {
  assert.equal(revisarCaminoAlLink('Probala en trattoapp.com.ar/calculadora #precios', 'instagram', links).length, 1);
  assert.deepEqual(revisarCaminoAlLink('Hook.\n👉 Calculadora gratis: tocá @trattoapp_ y entrá al link «Calculadora de precios».', 'instagram', links), []);
  assert.equal(revisarCaminoAlLink('Escribile a @trattoapp_oficial', 'instagram', links).length, 1, 'otra cuenta que empieza igual no cuenta');
});

test('TikTok: no promete un link del perfil que no existe ni menciona la cuenta de Instagram', () => {
  assert.match(revisarCaminoAlLink('Entrá al link de la bio', 'tiktok', conTikTok(false))[0], /todavía no tiene link/);
  assert.match(revisarCaminoAlLink('Tocá @trattoapp_ y entrá', 'tiktok', conTikTok(false))[0], /otra cuenta/);
  assert.deepEqual(revisarCaminoAlLink('Entrá a trattoapp.com.ar/r/tt-es-caro', 'tiktok', conTikTok(false)), []);
  assert.match(revisarCaminoAlLink('Entrá a trattoapp.com.ar', 'tiktok', conTikTok(true))[0], /link de nuestro perfil/);
  assert.deepEqual(revisarCaminoAlLink('Tocá el link de nuestro perfil', 'tiktok', conTikTok(true)), []);
});

test('verificar con "red": el camino al link es error y la historia sin link avisa', () => {
  const mal = verificarPieza({ formato: 'publicacion', red: 'instagram', texto: 'Cuánto sale un flete. Entrá a trattoapp.com.ar #fletes #mudanzas #tratto' }, marca);
  assert.equal(mal.ok, false);
  assert.match(mal.errores.join(), /no se puede tocar/);
  const bien = verificarPieza({ formato: 'publicacion', red: 'instagram', texto: 'Cuánto sale un flete.\n👉 Tocá @trattoapp_ y entrá al link «Calculadora de precios». #fletes #mudanzas #tratto' }, marca);
  assert.equal(bien.ok, true);
  assert.equal(verificarPieza({ formato: 'publicacion', texto: 'Sin red indicada #a #b #c' }, marca).ok, true, 'sin red no se exige');
  const historia = verificarPieza({ formato: 'historia', pantallas: ['¿Cuánto te cobraron?', 'Comparalo gratis, tocá el link'] }, marca);
  assert.match(historia.advertencias.join(), /sticker de link/);
});

test('hook: frena Instagram sin la mención, Instagram y TikTok juntos y deja pasar las historias', () => {
  const ig = decidir(post('Cuánto sale un flete. Entrá a trattoapp.com.ar #fletes', ['instagram']), links);
  assert.match(ig.hookSpecificOutput.permissionDecisionReason, /Link de un toque/);
  assert.equal(decidir(post('Cuánto sale un flete.\n👉 Tocá @trattoapp_ y entrá al link «Calculadora de precios». #fletes', ['instagram']), links), null);
  const juntos = decidir(post('Cuánto sale un flete.\n👉 Tocá @trattoapp_ y entrá al link «Calculadora de precios».', ['instagram', 'tiktok']), links);
  assert.match(juntos.hookSpecificOutput.permissionDecisionReason, /por separado/);
  assert.equal(decidir(post('', ['instagram'], { instagramData: { type: 'STORY' } }), links), null);
  assert.equal(decidir(post('Entrá a trattoapp.com.ar/r/tt-es-caro #fletes', ['tiktok']), conTikTok(false)), null);
});

test('tiendas: solo se nombra la tienda donde la app ya está', () => {
  const soloApple = { ...links, tiendas: { app_store: { publicada: true }, google_play: { publicada: false } } };
  assert.deepEqual(revisarCaminoAlLink('Bajala en la App Store, buscá Tratto', 'tiktok', soloApple), []);
  assert.match(revisarCaminoAlLink('Bajala en Google Play', 'tiktok', soloApple)[0], /todavía no está en Google Play/);
  assert.match(revisarCaminoAlLink('Descargala gratis en las tiendas', 'tiktok', soloApple)[0], /solo está en la App Store/);
  assert.match(revisarCaminoAlLink('Ya está en Play Store.\n👉 Tocá @trattoapp_ y entrá al link «Pedí un servicio».', 'instagram', soloApple)[0], /Google Play/);
  const ninguna = { ...links, tiendas: { app_store: { publicada: false }, google_play: { publicada: false } } };
  assert.equal(revisarCaminoAlLink('Bajala en la App Store o en Google Play', 'tiktok', ninguna).length, 2);
  const ambas = { ...links, tiendas: { app_store: { publicada: true }, google_play: { publicada: true } } };
  assert.deepEqual(revisarCaminoAlLink('Bajala de las tiendas: App Store o Google Play', 'tiktok', ambas), []);
  assert.deepEqual(revisarCaminoAlLink('Tiendas de ropa del barrio', 'tiktok', soloApple), [], '"tiendas" suelto no es la tienda de apps');
});

test('la marca de hoy: App Store sí, Google Play no', () => {
  assert.equal(links.tiendas.app_store.publicada, true);
  assert.equal(links.tiendas.google_play.publicada, false);
  assert.match(links.tiendas.app_store.url, /^https:\/\/apps\.apple\.com\//);
});
