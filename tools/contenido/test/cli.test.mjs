import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { reel } from './ayudante.mjs';

const CLI = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../cli.mjs');
const mem = fs.mkdtempSync(path.join(os.tmpdir(), 'contenido-cli-'));
const correr = (args, entrada) => spawnSync(process.execPath, [CLI, ...args], {
  input: entrada === undefined ? '' : typeof entrada === 'string' ? entrada : JSON.stringify(entrada),
  encoding: 'utf8', env: { ...process.env, CONTENIDO_MEMORIA_DIR: mem },
});

test('ayuda y comando desconocido', () => {
  assert.equal(correr(['ayuda']).status, 0);
  const r = correr(['volar']);
  assert.equal(r.status, 2);
  assert.match(r.stderr, /Comando desconocido/);
});

test('puntuar por stdin, en texto y en JSON', () => {
  const t = correr(['puntuar'], reel(70));
  assert.equal(t.status, 0, t.stderr);
  assert.match(t.stdout, /VIRALIDAD: 70\/100/);
  const j = JSON.parse(correr(['puntuar', '--json'], reel(70)).stdout);
  assert.equal(j.total, 70);
  const e = correr(['puntuar', '--etiqueta', 'POTENCIAL'], reel(70));
  assert.match(e.stdout, /^POTENCIAL: 70/);
});

test('errores de entrada salen con código 2 y mensaje claro', () => {
  let r = correr(['puntuar'], '{no es json');
  assert.equal(r.status, 2); assert.match(r.stderr, /no es JSON válido/);
  r = correr(['puntuar'], '');
  assert.equal(r.status, 2); assert.match(r.stderr, /Falta la entrada/);
  r = correr(['puntuar', '--archivo', '/no/existe.json']);
  assert.equal(r.status, 2); assert.match(r.stderr, /No existe el archivo/);
  r = correr(['puntuar'], 'x'.repeat(1024 * 1024 + 10));
  assert.equal(r.status, 2); assert.match(r.stderr, /pesa más/);
  r = correr(['registrar']);
  assert.equal(r.status, 2); assert.match(r.stderr, /Falta el tipo/);
  r = correr(['contexto', '--limite', 'muchos']);
  assert.equal(r.status, 2);
});

test('flujo de memoria: registrar, listar, actualizar, métricas, validar', () => {
  const c = JSON.parse(correr(['registrar', 'contenido', '--json'], { formato: 'carrusel', titulo: 'Qué incluye un presupuesto', pilar: 'como_elegir', hook: 'El presupuesto barato que sale caro' }).stdout);
  assert.match(c.id, /^c-/);
  const lote = JSON.parse(correr(['registrar', 'idea', '--json'], [{ texto: 'Idea uno' }, { texto: 'Idea dos' }]).stdout);
  assert.equal(lote.length, 2);
  assert.equal(JSON.parse(correr(['memoria', 'hook']).stdout).length, 1);
  assert.equal(correr(['actualizar', 'contenido', c.id], { estado: 'publicado' }).status, 0);
  assert.equal(correr(['registrar', 'resultado'], { contenido_id: c.id, fecha: '2026-10-05', alcance: 500, comentarios: 3, compartidos: 6, guardados: 20 }).status, 0);
  assert.match(correr(['metricas']).stdout, /5\.8% · instagram · carrusel/);
  const comparado = JSON.parse(correr(['metricas', '--comparar'], { alcance: 500, comentarios: 1, compartidos: 1, guardados: 1 }).stdout);
  assert.ok(comparado.comparacion.guardados_por_alcance);
  const v = correr(['validar']);
  assert.equal(v.status, 0, v.stdout + v.stderr);
  const h = correr(['hooks'], { formato: 'carrusel', hooks: [{ texto: 'El presupuesto barato que sale caro', categoria: 'contrarian' }] });
  assert.match(h.stdout, /ya usado/);
  assert.match(correr(['contexto']).stdout, /Qué incluye un presupuesto/);
});

test('validar detecta memoria corrupta', () => {
  const otra = fs.mkdtempSync(path.join(os.tmpdir(), 'contenido-cli-'));
  fs.writeFileSync(path.join(otra, 'ideas.jsonl'), 'basura\n');
  const r = spawnSync(process.execPath, [CLI, 'validar'], { encoding: 'utf8', env: { ...process.env, CONTENIDO_MEMORIA_DIR: otra } });
  assert.equal(r.status, 2);
  assert.match(r.stdout, /ideas\.jsonl: línea 1 ilegible/);
});

test('no se cuelga si stdin queda abierto sin datos', async () => {
  // stdin abierto que nunca se escribe ni se cierra: antes esto colgaba el proceso.
  const correrAbierto = (args) => new Promise((resolve) => {
    const hijo = spawn(process.execPath, [CLI, ...args], { env: { ...process.env, CONTENIDO_MEMORIA_DIR: mem } });
    let err = '';
    hijo.stderr.on('data', (d) => { err += d; });
    const corte = setTimeout(() => hijo.kill(), 10000);
    hijo.on('exit', (codigo) => { clearTimeout(corte); hijo.stdin.destroy(); resolve({ codigo, err }); });
  });
  const r = await correrAbierto(['puntuar']);
  assert.equal(r.codigo, 2);
  assert.match(r.err, /Falta la entrada/);
  assert.equal((await correrAbierto(['metricas'])).codigo, 0);
});
