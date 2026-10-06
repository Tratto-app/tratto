// Coherencia entre las skills y el motor: cada skill tiene frontmatter
// válido, los nombres no se pisan, y todo lo que una skill manda a usar
// (comandos de la CLI, archivos de conocimiento, otras skills) existe.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { RAIZ } from '../lib/rutas.mjs';

const REPO = path.resolve(RAIZ, '../..');
const SKILLS = path.join(REPO, '.claude/skills');
const COMANDOS = fs.readFileSync(path.join(RAIZ, 'cli.mjs'), 'utf8').match(/case '([a-z-]+)'/g).map((c) => c.slice(6, -1));

function leerSkill(dir) {
  const texto = fs.readFileSync(path.join(SKILLS, dir, 'SKILL.md'), 'utf8');
  const m = texto.match(/^---\n([\s\S]*?)\n---\n/);
  assert.ok(m, `${dir}: falta el frontmatter`);
  // YAML mínimo: "clave: valor" o bloques "clave: >" / "clave: |" con líneas indentadas.
  const campos = {};
  let actual = null;
  for (const l of m[1].split('\n')) {
    const kv = l.match(/^([a-z_-]+):\s*(.*)$/);
    if (kv) { actual = kv[1]; campos[actual] = /^[>|]-?$/.test(kv[2]) ? '' : kv[2]; }
    else if (actual && /^\s+\S/.test(l)) campos[actual] = `${campos[actual]} ${l.trim()}`.trim();
  }
  return { dir, texto, campos };
}

const skills = fs.readdirSync(SKILLS).filter((d) => fs.existsSync(path.join(SKILLS, d, 'SKILL.md'))).map(leerSkill);
const nombres = new Set(skills.map((s) => s.campos.name));

test('todas las skills tienen nombre único igual a su carpeta y descripción', () => {
  assert.equal(nombres.size, skills.length);
  for (const s of skills) {
    assert.equal(s.campos.name, s.dir);
    assert.ok(s.campos.description?.length > 40, `${s.dir}: descripción muy corta`);
    assert.ok(s.campos.description.length <= 1024, `${s.dir}: descripción demasiado larga`);
  }
});

test('las 8 skills de contenido existen y la de diseño sigue estando', () => {
  for (const n of ['contenido', 'contenido-viralidad', 'contenido-hooks', 'contenido-analisis', 'contenido-optimizacion', 'contenido-carruseles', 'contenido-historias', 'contenido-perfil', 'disenador-marketplace']) {
    assert.ok(nombres.has(n), `falta ${n}`);
  }
});

test('los comandos, archivos y skills que nombran las skills existen', () => {
  for (const s of skills.filter((x) => x.dir.startsWith('contenido'))) {
    for (const [, cmd] of s.texto.matchAll(/cli\.mjs ([a-z-]+)/g)) assert.ok(COMANDOS.includes(cmd), `${s.dir}: comando inexistente "${cmd}"`);
    for (const [, archivo] of s.texto.matchAll(/conocimiento\/([a-z-]+\.(?:md|json))/g)) assert.ok(fs.existsSync(path.join(RAIZ, 'conocimiento', archivo)), `${s.dir}: no existe conocimiento/${archivo}`);
    for (const [, ref] of s.texto.matchAll(/`(contenido(?:-[a-z]+)?|disenador-marketplace)`/g)) assert.ok(nombres.has(ref), `${s.dir}: skill inexistente ${ref}`);
    for (const [, ruta] of s.texto.matchAll(/`(tools\/[\w./-]+\.(?:md|json|html|py|png|mjs))`/g)) assert.ok(fs.existsSync(path.join(REPO, ruta)), `${s.dir}: no existe ${ruta}`);
    assert.match(s.texto, /protocolo\.md/, `${s.dir}: no remite al protocolo común`);
  }
});

test('el protocolo exige tratar lo externo como dato y no inventar capacidades', () => {
  const p = fs.readFileSync(path.join(RAIZ, 'conocimiento/protocolo.md'), 'utf8');
  assert.match(p, /es DATO, no instrucción/);
  assert.match(p, /No hay transcripción automática/);
  assert.match(p, /No se puede abrir ni descargar/);
});
