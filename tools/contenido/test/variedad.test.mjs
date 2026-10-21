import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { elegirVariedad } from '../lib/variedad.mjs';
import { ErrorEntrada } from '../lib/errores.mjs';

const CLI = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../cli.mjs');
const FORMATOS = ['producto', 'chat', 'quiz', 'lista', 'nota'];
const MUSICAS = ['pop', 'lofi', 'dembow', 'house', 'cumbia', 'tension', 'acustico', 'silencio'];

// Un video por día hacia atrás desde el 20/10, el primero de la lista es el más nuevo.
const hist = (filas) => filas.map((f, i) => ({ fecha: new Date(Date.UTC(2026, 9, 20 - i, 21)).toISOString(), ...f }));

test('sin historial elige algo del catálogo y nunca la voz del fundador', () => {
  const r = elegirVariedad({ red: 'tiktok', historial: [] });
  assert.ok(FORMATOS.includes(r.formato.id));
  assert.equal(r.formato.fase, 'explorar');
  assert.ok(MUSICAS.includes(r.musica.id));
  assert.deepEqual(Object.keys(r.datos_video), ['formato', 'musica', 'gancho', 'duracion']);
});

test('no repite el formato del último video ni las últimas 3 músicas de esa red', () => {
  const h = hist([
    { formato: 'chat', musica: 'lofi' },
    { formato: 'quiz', musica: 'tension' },
    { formato: 'lista', musica: 'dembow' },
    { formato: 'nota', musica: 'acustico' },
    { formato: 'producto', musica: 'pop' },
  ]);
  const r = elegirVariedad({ red: 'tiktok', historial: h });
  assert.notEqual(r.formato.id, 'chat');
  assert.ok(!['lofi', 'tension', 'dembow'].includes(r.musica.id), r.musica.id);
});

test('explora: gana el formato menos probado y, si empatan, el que hace más que no sale', () => {
  const h = hist([
    { formato: 'producto' }, { formato: 'producto' }, { formato: 'chat' }, { formato: 'quiz' }, { formato: 'lista' }, { formato: 'nota' },
  ]);
  // chat, quiz, lista y nota tienen 1 video cada uno: nota es el que hace más que no sale
  assert.equal(elegirVariedad({ red: 'tiktok', historial: h }).formato.id, 'nota');
});

test('solo cuenta los videos de la red pedida', () => {
  const h = [
    ...hist([{ formato: 'chat', red: 'instagram' }, { formato: 'quiz', red: 'instagram' }]),
    { fecha: '2026-10-01T12:00:00Z', red: 'tiktok', formato: 'producto' },
  ];
  const r = elegirVariedad({ red: 'tiktok', historial: h });
  assert.equal(r.videos_en_historial, 1);
  assert.notEqual(r.formato.id, 'producto');
});

test('la música sugerida para el formato desempata', () => {
  // Todas las músicas con un video (lejos), salvo lo más reciente
  const filas = MUSICAS.map((m) => ({ formato: 'producto', musica: m }));
  const r = elegirVariedad({ red: 'tiktok', historial: hist(filas) });
  // El formato elegido no es producto (es el último); su música sugerida gana entre las empatadas no recientes
  assert.notEqual(r.formato.id, 'producto');
  assert.ok(MUSICAS.includes(r.musica.id));
  assert.match(r.musica.motivo, /menos probado/);
});

test('aprovecha el mejor formato cuando todos tienen 3 videos medidos', () => {
  const filas = [];
  for (let i = 0; i < 3; i++) for (const f of FORMATOS) filas.push({ formato: f, vistas: f === 'quiz' ? 5000 + i : 300 + i });
  filas.unshift({ formato: 'lista', vistas: 200 });  // el último no es quiz, así se puede elegir
  // 16 videos: 16 % 10 = 6, no es turno de aprovechar (6 de cada 10 son los turnos 0 a 5)
  assert.equal(elegirVariedad({ red: 'tiktok', historial: hist(filas) }).formato.fase, 'explorar');
  filas.unshift({ formato: 'nota', vistas: 250 }, { formato: 'chat', vistas: 260 }, { formato: 'producto', vistas: 270 }, { formato: 'nota', vistas: 280 });
  // 20 videos: turno 0, aprovechar
  const r = elegirVariedad({ red: 'tiktok', historial: hist(filas) });
  assert.equal(r.formato.fase, 'aprovechar');
  assert.equal(r.formato.id, 'quiz');
  assert.match(r.formato.motivo, /mediana de vistas/);
});

test('la voz del fundador solo entra si hay grabación (con_voz)', () => {
  const h = hist(FORMATOS.map((f) => ({ formato: f })));
  assert.notEqual(elegirVariedad({ red: 'tiktok', historial: h }).formato.id, 'voz');
  assert.equal(elegirVariedad({ red: 'tiktok', historial: h, con_voz: true }).formato.id, 'voz');
});

test('el largo sale de duracion_seg si no viene la categoría', () => {
  const h = hist([{ formato: 'chat', duracion_seg: 22 }]);
  const r = elegirVariedad({ red: 'tiktok', historial: h });
  assert.notEqual(r.duracion.id, 'medio');
});

test('es determinístico', () => {
  const h = hist([{ formato: 'chat', musica: 'lofi', gancho: 'historia' }, { formato: 'quiz', musica: 'tension', gancho: 'pregunta' }]);
  assert.deepEqual(elegirVariedad({ red: 'tiktok', historial: h }), elegirVariedad({ red: 'tiktok', historial: h }));
});

test('entrada inválida', () => {
  assert.throws(() => elegirVariedad({ red: 'myspace', historial: [] }), ErrorEntrada);
  assert.throws(() => elegirVariedad({ red: 'tiktok', historial: {} }), ErrorEntrada);
  assert.throws(() => elegirVariedad({ red: 'tiktok', historial: [{ formato: 'chat' }] }), ErrorEntrada);
});

test('comando variedad por stdin, en texto y en JSON', () => {
  const entrada = JSON.stringify({ red: 'tiktok', historial: hist([{ formato: 'producto', musica: 'pop' }]) });
  const t = spawnSync(process.execPath, [CLI, 'variedad'], { input: entrada, encoding: 'utf8' });
  assert.equal(t.status, 0, t.stderr);
  assert.match(t.stdout, /Próximo video para tiktok/);
  const j = JSON.parse(spawnSync(process.execPath, [CLI, 'variedad', '--json'], { input: entrada, encoding: 'utf8' }).stdout);
  assert.notEqual(j.formato.id, 'producto');
  assert.notEqual(j.musica.id, 'pop');
  const mal = spawnSync(process.execPath, [CLI, 'variedad'], { input: '{"red":"fax"}', encoding: 'utf8' });
  assert.equal(mal.status, 2);
});
