import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { decidir, textosDelPost } from '../hooks/antes-de-programar.mjs';

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
