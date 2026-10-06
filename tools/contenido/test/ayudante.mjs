// Utilidades compartidas por los tests: carpetas temporales para la memoria y
// la configuración, para no tocar nunca los datos reales.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { RAIZ } from '../lib/rutas.mjs';

export function memoriaTemporal() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'contenido-mem-'));
  process.env.CONTENIDO_MEMORIA_DIR = dir;
  return dir;
}

export function configTemporal(modificar = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'contenido-cfg-'));
  for (const f of fs.readdirSync(path.join(RAIZ, 'config'))) {
    const datos = JSON.parse(fs.readFileSync(path.join(RAIZ, 'config', f), 'utf8'));
    const nombre = f.replace('.json', '');
    const final = modificar[nombre] ? modificar[nombre](datos) : datos;
    if (final !== undefined) fs.writeFileSync(path.join(dir, f), typeof final === 'string' ? final : JSON.stringify(final));
  }
  process.env.CONTENIDO_CONFIG_DIR = dir;
  return dir;
}

export function limpiarEntorno() {
  delete process.env.CONTENIDO_MEMORIA_DIR;
  delete process.env.CONTENIDO_CONFIG_DIR;
}

// Una puntuación válida de reel con todas las dimensiones en `base`.
export function reel(base = 70, cambios = {}) {
  const dims = ['hook', 'retencion', 'claridad', 'valor', 'curiosidad', 'emocion', 'identificacion', 'novedad', 'autoridad', 'cta', 'comentarios', 'compartidos', 'guardados'];
  const dimensiones = {};
  for (const d of dims) dimensiones[d] = { puntaje: base, evidencia: `Fragmento observado para ${d} en la pieza de prueba` };
  for (const [d, p] of Object.entries(cambios)) dimensiones[d] = { puntaje: p, evidencia: `Evidencia específica y suficientemente larga de ${d}` };
  return { formato: 'reel', insumo: 'guion', dimensiones };
}
