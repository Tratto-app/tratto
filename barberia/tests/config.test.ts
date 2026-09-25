/**
 * Configuración del negocio: los datos reales que ve el cliente y que la
 * configuración editada desde el panel sobreviva a un nuevo despliegue.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { cargarConfigNegocio, serviciosActivos } from '../src/config/negocio.js';
import { configDeArranque, guardarConfigEditada } from '../src/config/guardada.js';
import { crearSqlite } from '../src/database/sqlite.js';
import { promptEstable } from '../src/ai/prompt.js';
import { formatearPrecio } from '../src/shared/texto.js';
import { mensajeConfirmado } from '../src/conversation/mensajes.js';
import type { Contexto } from '../src/booking/servicio.js';
import type { Turno } from '../src/booking/tipos.js';
import { AHORA_FIJO } from './helpers.js';
import { CONFIG_TEST } from './helpers.js';

describe('config/negocio.json (la de producción)', () => {
  const cfg = cargarConfigNegocio('config/negocio.json');

  test('el corte sale $10.000', () => {
    const corte = serviciosActivos(cfg).find((s) => s.id === 'corte');
    assert.equal(corte?.precio, 10000);
    assert.equal(formatearPrecio(corte!.precio, cfg.negocio.moneda), '$10.000');
  });

  test('nombre, teléfono, dirección y mapa del local cargados, sin textos de ejemplo', () => {
    assert.equal(cfg.negocio.nombre, 'Barbería Panamá');
    assert.equal(cfg.negocio.telefono, '+54 9 11 6858-1736');
    assert.equal(cfg.negocio.direccion, 'Panamá 7442, Martín Coronado');
    assert.match(cfg.negocio.maps, /^https:\/\/maps\.app\.goo\.gl\//);
    assert.equal(cfg.resenas.link_google_maps, cfg.negocio.maps);
    assert.doesNotMatch(JSON.stringify(cfg), /PLACEHOLDER/i);
  });

  test('el prompt del bot lleva el precio real, el nombre del local y ninguna duración', () => {
    const prompt = promptEstable(cfg);
    assert.match(prompt, /Corte \(id: corte\) — \$10\.000/);
    assert.match(prompt, /Barbería Panamá/);
    assert.doesNotMatch(prompt, /PLACEHOLDER/);
    const servicios = prompt.slice(prompt.indexOf('## Servicios'), prompt.indexOf('## Horarios'));
    assert.doesNotMatch(servicios, /\d+\s*min/);
  });

  test('el turno confirmado le dice al cliente dónde es, con el link de Maps', () => {
    const ctx = { cfg, ahora: () => AHORA_FIJO } as unknown as Contexto;
    const turno = {
      id: 'TUR-X', telefono: '5491100000000', nombreCliente: 'Santi', servicioId: 'corte', servicioNombre: 'Corte',
      precio: 10000, duracionMin: 45, fecha: '2026-09-19', horaInicio: '11:00', horaFin: '11:45', estado: 'reservado',
      descuentoPorcentaje: 0,
    } as unknown as Turno;
    const texto = mensajeConfirmado(ctx, turno);
    assert.match(texto, /📍 Panamá 7442, Martín Coronado/);
    assert.match(texto, /🗺️ https:\/\/maps\.app\.goo\.gl\//);
    assert.match(texto, /💵 \$10\.000/);
  });

  test('no promete cosas que el negocio no confirmó', () => {
    assert.deepEqual(cfg.negocio.medios_de_pago, []);
    const descripciones = cfg.servicios.map((s) => s.descripcion).join(' ');
    assert.doesNotMatch(descripciones, /lavado|toalla|12 años/i);
  });
});

describe('datos sin completar', () => {
  test('un "PLACEHOLDER - ..." se trata como vacío (no se le muestra al cliente)', () => {
    const cfg = cargarConfigNegocio(CONFIG_TEST);
    assert.equal(cfg.negocio.como_llegar, '');
    assert.equal(cfg.negocio.instagram, '');
    assert.doesNotMatch(JSON.stringify(cfg), /PLACEHOLDER/i);
  });
});

describe('la configuración editada desde el panel sobrevive a un deploy', () => {
  async function entorno() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cfg-'));
    const ruta = path.join(dir, 'negocio.json');
    fs.copyFileSync('config/negocio.json', ruta);
    const db = crearSqlite(':memory:');
    await db.migrar();
    return { ruta, db, limpiar: async () => { await db.cerrar(); fs.rmSync(dir, { recursive: true, force: true }); } };
  }

  test('sin nada guardado, arranca con el archivo', async () => {
    const e = await entorno();
    try {
      const cfg = await configDeArranque(e.db, e.ruta);
      assert.equal(cfg.servicios.find((s) => s.id === 'corte')?.precio, 10000);
    } finally {
      await e.limpiar();
    }
  });

  test('un precio cambiado en el panel sigue ahí aunque el archivo vuelva a la versión del repositorio', async () => {
    const e = await entorno();
    try {
      const original = fs.readFileSync(e.ruta, 'utf8');
      const cfg = cargarConfigNegocio(e.ruta);
      const editada = { ...cfg, servicios: cfg.servicios.map((s) => (s.id === 'barba' ? { ...s, precio: 6500 } : s)) };
      await guardarConfigEditada(e.db, editada, new Date().toISOString(), e.ruta);

      // Deploy nuevo: el disco vuelve a tener el archivo del repositorio.
      fs.writeFileSync(e.ruta, original);
      const alArrancar = await configDeArranque(e.db, e.ruta);
      assert.equal(alArrancar.servicios.find((s) => s.id === 'barba')?.precio, 6500);
      assert.equal(cargarConfigNegocio(e.ruta).servicios.find((s) => s.id === 'barba')?.precio, 6500, 'y queda copiada al archivo');
    } finally {
      await e.limpiar();
    }
  });

  test('una configuración inválida no se guarda', async () => {
    const e = await entorno();
    try {
      await assert.rejects(() => guardarConfigEditada(e.db, { negocio: {} }, new Date().toISOString(), e.ruta));
      const filas = await e.db.query('SELECT * FROM configuracion');
      assert.equal(filas.length, 0);
    } finally {
      await e.limpiar();
    }
  });
});
