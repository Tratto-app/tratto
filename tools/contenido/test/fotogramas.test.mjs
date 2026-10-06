import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { ErrorEntrada } from '../lib/errores.mjs';
import { extraerFotogramas, ffmpegDisponible, momentos } from '../lib/fotogramas.mjs';

test('momentos: prioriza el hook y reparte el resto', () => {
  assert.deepEqual(momentos(30, 5), [0, 1, 2, 11.3, 20.7]);
  assert.equal(new Set(momentos(6, 5)).size, 5);
  assert.deepEqual(momentos(1.5, 4).slice(0, 2), [0, 1]);
  assert.ok(momentos(100, 500).length <= 24);
  assert.ok(momentos(10, 8).every((t) => t < 10));
});

test('valida archivo, extensión y parámetros', { skip: !ffmpegDisponible() && 'ffmpeg no instalado' }, () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fg-'));
  const txt = path.join(dir, 'nota.txt');
  fs.writeFileSync(txt, 'hola');
  const falla = (fn, t) => assert.throws(fn, (e) => e instanceof ErrorEntrada && e.message.includes(t));
  falla(() => extraerFotogramas(path.join(dir, 'no.mp4'), dir), 'No existe');
  falla(() => extraerFotogramas(txt, dir), 'Extensión no soportada');
  const falso = path.join(dir, 'falso.mp4');
  fs.writeFileSync(falso, 'no soy un video');
  falla(() => extraerFotogramas(falso, dir), 'No se pudo leer el video');
  falla(() => extraerFotogramas(falso, dir, { cantidad: 0 }), 'cantidad');
});

test('extrae fotogramas de un video real', { skip: !ffmpegDisponible() && 'ffmpeg no instalado' }, () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fg-'));
  const video = path.join(dir, 'prueba con espacios.mp4');
  const r = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', 'testsrc=duration=6:size=320x568:rate=10', '-pix_fmt', 'yuv420p', video]);
  assert.equal(r.status, 0, String(r.stderr));
  const out = extraerFotogramas(video, path.join(dir, 'salida'), { cantidad: 5, ancho: 160 });
  assert.equal(out.fotogramas.length, 5);
  assert.equal(out.segundos, 6);
  assert.match(out.nota, /no tiene audio/);
  for (const f of out.fotogramas) assert.ok(fs.statSync(f.archivo).size > 0);
});
