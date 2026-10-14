import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { analizar } from '../../../growth/web/src/lib/cerebro-core.ts';
import { analizarVideo } from '../lib/cerebro.mjs';
import { ErrorEntrada } from '../lib/errores.mjs';
import { ffmpegDisponible } from '../lib/fotogramas.mjs';

const W = 36, H = 64, FPS = 6, SR = 16000;

function cuadro(f) {
  const c = new Uint8Array(W * H * 4);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const v = f(x, y), i = (y * W + x) * 4;
    c[i] = v[0]; c[i + 1] = v[1]; c[i + 2] = v[2]; c[i + 3] = 255;
  }
  return c;
}
const gris = cuadro(() => [120, 120, 120]);
const rayas = cuadro((x) => (x % 6 < 3 ? [240, 200, 40] : [20, 60, 50]));
const cuadros = cuadro((x, y) => ((Math.floor(x / 6) + Math.floor(y / 6)) % 2 ? [250, 250, 250] : [30, 90, 70]));

function audio(segundos, f) {
  const a = new Float32Array(segundos * SR);
  for (let i = 0; i < a.length; i++) a[i] = f(i / SR);
  return a;
}
// Tono parejo (como una música sostenida) y algo parecido a la voz: varias
// frecuencias de la banda de la voz que suben y bajan unas 4 veces por segundo.
const tono = (t) => 0.2 * Math.sin(2 * Math.PI * 220 * t);
const voz = (t) => {
  const silaba = Math.max(0, Math.sin(2 * Math.PI * 4 * t)) ** 2;
  return silaba * 0.25 * (Math.sin(2 * Math.PI * 700 * t) + Math.sin(2 * Math.PI * 1200 * t) + 0.5 * Math.sin(2 * Math.PI * 1900 * t)) / 2.5;
};

const quieto = (seg) => Array.from({ length: seg * FPS }, () => gris);
const movido = (seg) => Array.from({ length: seg * FPS }, (_, i) => [rayas, cuadros, gris][Math.floor(i / 4) % 3]);

test('un video quieto y mudo engancha poco y lo dice', () => {
  const r = analizar({ ancho: W, alto: H, fps: FPS, cuadros: quieto(10), audio: null, muestreo: SR, duracion: 10 });
  assert.equal(r.segundos, '0-10');
  assert.equal(r.linea.length, 10);
  assert.ok(r.gancho < 25, `gancho ${r.gancho}`);
  assert.ok(r.regiones.foco >= 80, `foco ${r.regiones.foco}`);
  assert.equal(r.regiones.auditiva, 0);
  assert.equal(r.senales.sonido_desde, null);
  assert.equal(r.senales.cierre_con_marca, false);
  assert.ok(r.consejos.some((c) => c.includes('sonido no arranca')));
  assert.ok(r.consejos.some((c) => c.includes('engancha poco')));
  for (const v of [r.viral, r.gancho, r.retencion, ...Object.values(r.regiones), ...r.linea]) assert.ok(Number.isInteger(v) && v >= 0 && v <= 100);
});

test('con cambios y sonido desde el principio engancha más', () => {
  const quieto_ = analizar({ ancho: W, alto: H, fps: FPS, cuadros: quieto(10), audio: null, muestreo: SR, duracion: 10 });
  const r = analizar({ ancho: W, alto: H, fps: FPS, cuadros: movido(10), audio: audio(10, tono), muestreo: SR, duracion: 10 });
  assert.ok(r.gancho > quieto_.gancho + 30, `${r.gancho} vs ${quieto_.gancho}`);
  assert.ok(r.retencion > quieto_.retencion);
  assert.ok(r.viral > quieto_.viral);
  assert.ok(r.senales.cortes_por_segundo > 0.5);
  assert.equal(r.senales.sonido_desde, 0);
  assert.ok(r.regiones.auditiva >= 60);
  assert.ok(r.regiones.foco < quieto_.regiones.foco);
});

test('distingue voz de un sonido parejo', () => {
  const conTono = analizar({ ancho: W, alto: H, fps: FPS, cuadros: movido(8), audio: audio(8, tono), muestreo: SR, duracion: 8 });
  const conVoz = analizar({ ancho: W, alto: H, fps: FPS, cuadros: movido(8), audio: audio(8, voz), muestreo: SR, duracion: 8 });
  assert.ok(conTono.senales.voz < 0.15, `tono ${conTono.senales.voz}`);
  assert.ok(conVoz.senales.voz > 0.4, `voz ${conVoz.senales.voz}`);
  assert.ok(conVoz.regiones.lenguaje > conTono.regiones.lenguaje);
  assert.ok(conTono.consejos.some((c) => c.includes('voz en off')));
  assert.ok(!conVoz.consejos.some((c) => c.includes('voz en off')));
});

test('cierre con la marca: placa quieta y legible al final', () => {
  const placa = Array.from({ length: 2 * FPS }, () => cuadros);
  const conPlaca = analizar({ ancho: W, alto: H, fps: FPS, cuadros: [...movido(6), ...placa], audio: null, muestreo: SR, duracion: 8 });
  const sinPlaca = analizar({ ancho: W, alto: H, fps: FPS, cuadros: movido(8), audio: null, muestreo: SR, duracion: 8 });
  assert.equal(conPlaca.senales.cierre_con_marca, true);
  assert.equal(sinPlaca.senales.cierre_con_marca, false);
  assert.ok(conPlaca.regiones.memoria > sinPlaca.regiones.memoria);
  // Más largo que lo analizado y sin los cuadros del final: no se puede saber.
  const largo = analizar({ ancho: W, alto: H, fps: FPS, cuadros: movido(30), audio: null, muestreo: SR, duracion: 45 });
  assert.equal(largo.senales.cierre_con_marca, null);
  assert.ok(largo.consejos.some((c) => c.includes('Dura 45 segundos')));
  const largoConCola = analizar({ ancho: W, alto: H, fps: FPS, cuadros: movido(30), cola: placa, audio: null, muestreo: SR, duracion: 45 });
  assert.equal(largoConCola.senales.cierre_con_marca, true);
});

test('cerebro: valida el archivo', { skip: !ffmpegDisponible() && 'ffmpeg no instalado' }, async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cer-'));
  const txt = path.join(dir, 'nota.txt');
  fs.writeFileSync(txt, 'hola');
  await assert.rejects(analizarVideo(path.join(dir, 'no.mp4')), (e) => e instanceof ErrorEntrada && /No existe/.test(e.message));
  await assert.rejects(analizarVideo(txt), (e) => e instanceof ErrorEntrada && /Extensión no soportada/.test(e.message));
});

test('cerebro: analiza un video real con la CLI', { skip: !ffmpegDisponible() && 'ffmpeg no instalado' }, () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cer-'));
  const video = path.join(dir, 'prueba cerebro.mp4');
  const r = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', 'testsrc=duration=5:size=180x320:rate=12',
    '-f', 'lavfi', '-i', 'sine=frequency=440:duration=5', '-shortest', '-pix_fmt', 'yuv420p', video]);
  assert.equal(r.status, 0, String(r.stderr));
  const cli = path.resolve(import.meta.dirname, '../cli.mjs');
  const out = spawnSync(process.execPath, ['--no-warnings', cli, 'cerebro', video, '--json'], { encoding: 'utf8' });
  assert.equal(out.status, 0, out.stderr);
  const j = JSON.parse(out.stdout);
  assert.equal(j.archivo, 'prueba cerebro.mp4');
  assert.equal(j.estado, 'hecho');
  assert.equal(j.linea.length, 5);
  assert.deepEqual(Object.keys(j.regiones).sort(), ['atencion', 'auditiva', 'foco', 'lenguaje', 'memoria', 'visual']);
  assert.equal(j.senales.sonido_desde, 0);
  assert.ok(j.senales.voz < 0.2, `voz ${j.senales.voz}`);
});
