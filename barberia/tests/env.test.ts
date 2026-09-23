/**
 * Chequeo de producción: la clave de IA tiene que mirar el proveedor en uso.
 *
 * Bug real que motivó este test: `revisarEnvProduccion` miraba `claveIA`
 * (que solo resuelve Claude) sin importar qué decía `AI_PROVEEDOR`. Con
 * AI_PROVEEDOR=openai y OPENAI_API_KEY bien cargada, el arranque en
 * producción igual se caía diciendo "AI_API_KEY sin configurar" — pasó en el
 * despliegue real de Render.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

process.env.NODE_ENV = 'production';
process.env.AI_PROVEEDOR = 'openai';
process.env.OPENAI_API_KEY = 'sk-de-prueba';
process.env.WHATSAPP_ACCESS_TOKEN = 'token-de-prueba';
process.env.WHATSAPP_PHONE_NUMBER_ID = '000000000';
process.env.WHATSAPP_VERIFY_TOKEN = 'verify-de-prueba';
process.env.WHATSAPP_APP_SECRET = 'app-secret-de-prueba';
process.env.SESSION_SECRET = 'a'.repeat(32);
process.env.DASHBOARD_PASSWORD = 'contraseña-larga';
process.env.DATABASE_URL = 'postgres://usuario:clave@host:5432/base';

const { revisarEnvProduccion, claveDelProveedor } = await import('../src/config/env.js');

describe('revisarEnvProduccion con AI_PROVEEDOR=openai', () => {
  test('con OPENAI_API_KEY cargada, no reclama ninguna clave de IA', () => {
    assert.ok(claveDelProveedor, 'debería resolver a OPENAI_API_KEY');
    assert.deepEqual(revisarEnvProduccion(), []);
  });

  test('sin OPENAI_API_KEY, el aviso nombra la variable correcta (no AI_API_KEY)', () => {
    // env.ts lee process.env una sola vez al importarse, así que para probar
    // el caso "falta la clave" hace falta un proceso nuevo, sin la variable.
    const { OPENAI_API_KEY: _quitada, ...resto } = process.env;
    const salida = execFileSync(
      process.execPath,
      ['--import', 'tsx', '-e', "import('./src/config/env.ts').then(m => console.log(JSON.stringify(m.revisarEnvProduccion())))"],
      { cwd: RAIZ, env: resto, encoding: 'utf8' },
    );
    const faltantes = JSON.parse(salida.trim().split('\n').pop()!) as string[];
    assert.ok(
      faltantes.some((f) => f.startsWith('OPENAI_API_KEY sin configurar')),
      `esperaba un aviso de OPENAI_API_KEY, salió: ${JSON.stringify(faltantes)}`,
    );
    assert.ok(
      !faltantes.some((f) => f.startsWith('AI_API_KEY')),
      'con AI_PROVEEDOR=openai no debería mencionar AI_API_KEY',
    );
  });
});
