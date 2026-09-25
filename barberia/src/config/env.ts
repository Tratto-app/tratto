/**
 * Variables de entorno. Nada sensible vive en el codigo ni en config/negocio.json:
 * tokens, claves y credenciales entran solo por aca. Ver .env.example.
 */
import 'dotenv/config';
import { z } from 'zod';

const bool = (def: boolean) =>
  z
    .string()
    .optional()
    .transform((v) => (v === undefined || v === '' ? def : ['1', 'true', 'si', 'sí', 'yes', 'on'].includes(v.toLowerCase())));

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  APP_BASE_URL: z.string().url().optional(),

  // --- Base de datos ---
  DATABASE_URL: z.string().optional(),
  SQLITE_PATH: z.string().default('./data/barberia.sqlite'),

  // --- WhatsApp Cloud API ---
  WHATSAPP_ACCESS_TOKEN: z.string().optional(),
  WHATSAPP_PHONE_NUMBER_ID: z.string().optional(),
  WHATSAPP_VERIFY_TOKEN: z.string().optional(),
  WHATSAPP_APP_SECRET: z.string().optional(),
  WHATSAPP_GRAPH_VERSION: z.string().default('v26.0'),
  /** Id de la cuenta de WhatsApp Business (WABA). Con esto el servidor suscribe la app a sus webhooks al arrancar. */
  WHATSAPP_BUSINESS_ACCOUNT_ID: z.string().optional(),
  BARBERO_WHATSAPP: z.string().optional(),

  // --- IA ---
  /** Qué motor usa el bot: 'claude' (Anthropic) u 'openai'. */
  AI_PROVEEDOR: z.enum(['claude', 'openai']).default('claude'),
  AI_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  AI_MODEL: z.string().default('claude-opus-5'),
  AI_EFFORT: z.enum(['low', 'medium', 'high', 'xhigh', 'max']).default('low'),
  AI_MAX_TOKENS: z.coerce.number().int().positive().default(2000),
  AI_TIMEOUT_MS: z.coerce.number().int().positive().default(25000),
  AI_MAX_ITERACIONES: z.coerce.number().int().positive().default(6),
  AI_HABILITADA: bool(true),
  AI_FALLBACK_REHUSO: bool(true),

  // --- OpenAI (solo si AI_PROVEEDOR=openai) ---
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().default('gpt-6-sol'),
  /** Solo para tests o proxies corporativos. En producción se deja vacío. */
  OPENAI_BASE_URL: z.string().optional(),
  AI_BASE_URL: z.string().optional(),

  // --- Google Sheets ---
  GOOGLE_SPREADSHEET_ID: z.string().optional(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_REFRESH_TOKEN: z.string().optional(),
  GOOGLE_SERVICE_ACCOUNT_JSON: z.string().optional(),
  SHEETS_HABILITADO: bool(true),
  SHEETS_INTERVALO_MS: z.coerce.number().int().positive().default(5000),

  // --- Panel del barbero ---
  DASHBOARD_PASSWORD: z.string().optional(),
  SESSION_SECRET: z.string().optional(),
  SESSION_HORAS: z.coerce.number().int().positive().default(720),

  // --- Modo prueba ---
  SIMULADOR_HABILITADO: bool(true),

  // --- Workers ---
  RECORDATORIOS_HABILITADOS: bool(true),
  WORKERS_HABILITADOS: bool(true),
});

export type Env = z.infer<typeof envSchema>;

function construir(): Env {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const detalle = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Variables de entorno invalidas:\n${detalle}`);
  }
  return parsed.data;
}

export const env: Env = construir();

export const esProduccion = env.NODE_ENV === 'production';
export const esTest = env.NODE_ENV === 'test';

export const claveIA = env.AI_API_KEY || env.ANTHROPIC_API_KEY || '';
export const claveDelProveedor = env.AI_PROVEEDOR === 'openai' ? env.OPENAI_API_KEY ?? '' : claveIA;
export const modeloEnUso = env.AI_PROVEEDOR === 'openai' ? env.OPENAI_MODEL : env.AI_MODEL;
export const iaConfigurada = Boolean(claveDelProveedor) && env.AI_HABILITADA;

export const whatsappConfigurado = Boolean(
  env.WHATSAPP_ACCESS_TOKEN && env.WHATSAPP_PHONE_NUMBER_ID && env.WHATSAPP_VERIFY_TOKEN,
);

export const sheetsConfigurado =
  env.SHEETS_HABILITADO &&
  Boolean(env.GOOGLE_SPREADSHEET_ID) &&
  Boolean((env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET && env.GOOGLE_REFRESH_TOKEN) || env.GOOGLE_SERVICE_ACCOUNT_JSON);

export const driverBD: 'postgres' | 'sqlite' =
  env.DATABASE_URL && /^postgres(ql)?:\/\//.test(env.DATABASE_URL) ? 'postgres' : 'sqlite';

/**
 * Chequeos que solo importan en produccion. Se corren al arrancar: mejor fallar
 * en el arranque que descubrir a la noche que el webhook no valida firmas.
 */
export function revisarEnvProduccion(): string[] {
  const faltantes: string[] = [];
  if (!esProduccion) return faltantes;
  if (!whatsappConfigurado) faltantes.push('WhatsApp sin configurar (WHATSAPP_ACCESS_TOKEN / PHONE_NUMBER_ID / VERIFY_TOKEN)');
  if (!env.WHATSAPP_APP_SECRET) faltantes.push('WHATSAPP_APP_SECRET es obligatorio: sin el no se puede validar la firma del webhook');
  if (!env.SESSION_SECRET || env.SESSION_SECRET.length < 32) faltantes.push('SESSION_SECRET tiene que tener al menos 32 caracteres');
  if (!env.DASHBOARD_PASSWORD || env.DASHBOARD_PASSWORD.length < 10) faltantes.push('DASHBOARD_PASSWORD tiene que tener al menos 10 caracteres');
  if (driverBD !== 'postgres') faltantes.push('En produccion se recomienda DATABASE_URL de PostgreSQL (SQLite no escala a varias instancias)');
  // Ojo acá: tiene que mirar la clave del proveedor EN USO (claveDelProveedor),
  // no claveIA (que solo resuelve Claude). Con AI_PROVEEDOR=openai, claveIA
  // queda vacia aunque OPENAI_API_KEY este bien cargada, y esto tiraba abajo
  // el arranque en producción con OpenAI aunque todo estuviera bien puesto.
  if (!claveDelProveedor) {
    const variable = env.AI_PROVEEDOR === 'openai' ? 'OPENAI_API_KEY' : 'AI_API_KEY';
    faltantes.push(`${variable} sin configurar: el bot va a funcionar solo en modo menu`);
  }
  return faltantes;
}
