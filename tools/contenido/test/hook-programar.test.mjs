import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { decidir, redesConTexto, textosDelPost } from '../hooks/antes-de-programar.mjs';

const script = fileURLToPath(new URL('../hooks/antes-de-programar.mjs', import.meta.url));
const correr = (entrada) => spawnSync(process.execPath, [script], { input: entrada, encoding: 'utf8' });

test('lee el texto, el título de TikTok y el primer comentario (info como texto JSON u objeto)', () => {
  const info = { text: 'Hola', tiktokData: { title: 'Otro título' }, firstCommentText: 'Comentario' };
  assert.equal(textosDelPost({ info: JSON.stringify(info) }).length, 3);
  assert.equal(textosDelPost({ info }).length, 3);
  assert.equal(textosDelPost({ info: { text: 'Igual', tiktokData: { title: 'Igual' } } }).length, 1, 'el título igual al texto no se cuenta dos veces');
  assert.deepEqual(textosDelPost({ info: '{roto' }), []);
});

test('frena lo que suena a IA y deja pasar lo que está bien', () => {
  const mal = decidir({ info: JSON.stringify({ text: 'Seamos honestos: descubre cómo llevar tu casa al siguiente nivel.' }) });
  assert.equal(mal.hookSpecificOutput.permissionDecision, 'deny');
  assert.match(mal.hookSpecificOutput.permissionDecisionReason, /sinceridad/);
  assert.equal(decidir({ info: JSON.stringify({ text: 'Cuánto sale un flete chico en CABA en octubre. #fletes #mudanzas #tratto' }) }), null);
});

test('como hook: responde por stdout, sale con 0 y nunca traba si la entrada es ilegible', () => {
  const mal = correr(JSON.stringify({ tool_input: { info: JSON.stringify({ text: '¿El resultado? Spoiler: no es solo un flete, es tranquilidad.' }) } }));
  assert.equal(mal.status, 0);
  assert.equal(JSON.parse(mal.stdout).hookSpecificOutput.permissionDecision, 'deny');
  const bien = correr(JSON.stringify({ tool_input: { info: JSON.stringify({ text: 'Flete chico en CABA, octubre.' }) } }));
  assert.equal(bien.status, 0);
  assert.equal(bien.stdout, '');
  const roto = correr('no es json');
  assert.equal(roto.status, 0);
  assert.equal(roto.stdout, '');
});

const LINKS = {
  instagram: { usuario: '@trattoapp_', link_en_perfil: true, links_del_perfil: ['Pedí un servicio'], canal_buffer: 'aaaaaaaaaaaaaaaaaaaaaaaa' },
  tiktok: { usuario: '@trattoapp', link_en_perfil: false, canal_buffer: 'bbbbbbbbbbbbbbbbbbbbbbbb' },
};

test('Buffer: lee texto, título de TikTok y primer comentario, y la red por el canal o por metadata', () => {
  const tt = { channelId: 'bbbbbbbbbbbbbbbbbbbbbbbb', text: 'Hola', metadata: { tiktok: { title: 'Otro título' } } };
  assert.equal(textosDelPost(tt).length, 2);
  assert.deepEqual(redesConTexto(tt, LINKS), ['tiktok']);
  assert.deepEqual(redesConTexto({ channelId: 'bbbbbbbbbbbbbbbbbbbbbbbb', text: 'Hola' }, LINKS), ['tiktok'], 'TikTok sin metadata se reconoce por el canal');
  const ig = { channelId: 'aaaaaaaaaaaaaaaaaaaaaaaa', text: 'Hola', metadata: { instagram: { type: 'reel', shouldShareToFeed: true, firstComment: 'Comentario' } } };
  assert.equal(textosDelPost(ig).length, 2);
  assert.deepEqual(redesConTexto(ig, LINKS), ['instagram']);
  assert.deepEqual(redesConTexto({ channelId: 'cccccccccccccccccccccccc', text: 'x', metadata: { instagram: { type: 'story', shouldShareToFeed: false } } }, LINKS), [], 'las historias no llevan texto');
  assert.deepEqual(textosDelPost({ postId: 'dddddddddddddddddddddddd', mode: 'customScheduled' }), [], 'reprogramar sin texto no revisa nada');
});

test('Buffer: frena el reel de Instagram sin link de un toque y deja pasar el que lo tiene', () => {
  const sinLink = decidir({ channelId: 'aaaaaaaaaaaaaaaaaaaaaaaa', text: 'Flete chico en CABA, octubre. Entrá a trattoapp.com.ar', metadata: { instagram: { type: 'reel', shouldShareToFeed: true } } }, LINKS);
  assert.equal(sinLink.hookSpecificOutput.permissionDecision, 'deny');
  assert.match(sinLink.hookSpecificOutput.permissionDecisionReason, /Link de un toque/);
  const conLink = decidir({ channelId: 'aaaaaaaaaaaaaaaaaaaaaaaa', text: 'Flete chico en CABA, octubre.\n👉 Tocá @trattoapp_ y entrá al link «Pedí un servicio».', metadata: { instagram: { type: 'reel', shouldShareToFeed: true } } }, LINKS);
  assert.equal(conLink, null);
  const ia = decidir({ channelId: 'bbbbbbbbbbbbbbbbbbbbbbbb', text: 'Seamos honestos: descubre cómo llevar tu casa al siguiente nivel.' }, LINKS);
  assert.equal(ia.hookSpecificOutput.permissionDecision, 'deny');
});
