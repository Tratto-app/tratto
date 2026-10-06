// Carga de archivos JSON del sistema con mensajes claros si están rotos.
import fs from 'node:fs';
import path from 'node:path';
import { rutas } from './rutas.mjs';

const cache = new Map();

export function leerJSON(archivo) {
  let crudo;
  try {
    crudo = fs.readFileSync(archivo, 'utf8');
  } catch (e) {
    throw new Error(`No se pudo leer ${archivo}: ${e.code || e.message}`);
  }
  try {
    return JSON.parse(crudo);
  } catch (e) {
    throw new Error(`${archivo} no es JSON válido: ${e.message}`);
  }
}

export function conocimiento(nombre) {
  const archivo = path.join(rutas.conocimiento, `${nombre}.json`);
  if (!cache.has(archivo)) cache.set(archivo, leerJSON(archivo));
  return cache.get(archivo);
}
