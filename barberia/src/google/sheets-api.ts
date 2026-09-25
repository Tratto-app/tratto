/** Cliente minimo de la API de Google Sheets v4 (solo lo que usa el proyecto). */
import { tokenDeAcceso, limpiarCacheDeToken } from './auth.js';
import { log } from '../shared/log.js';

// Igual que en auth.ts: la variable existe para los tests, no para produccion.
const BASE = process.env.GOOGLE_SHEETS_API_URL || 'https://sheets.googleapis.com/v4/spreadsheets';

export class ErrorSheets extends Error {
  readonly status: number;
  constructor(status: number, mensaje: string) {
    super(mensaje);
    this.name = 'ErrorSheets';
    this.status = status;
  }
  /** Errores donde reintentar tiene sentido (cuota, corte de red, 5xx). */
  get reintentable(): boolean {
    return this.status === 0 || this.status === 429 || this.status >= 500;
  }
}

async function pedir<T>(ruta: string, opciones: RequestInit = {}, reintentoAuth = true): Promise<T> {
  let token: string;
  try {
    token = await tokenDeAcceso();
  } catch (e) {
    throw new ErrorSheets(401, e instanceof Error ? e.message : 'no se pudo obtener el token de Google');
  }

  let r: Response;
  try {
    r = await fetch(`${BASE}${ruta}`, {
      ...opciones,
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
        ...(opciones.headers as Record<string, string> | undefined),
      },
      signal: AbortSignal.timeout(20_000),
    });
  } catch (e) {
    throw new ErrorSheets(0, `no se pudo conectar con Google Sheets: ${e instanceof Error ? e.message : e}`);
  }

  if (r.status === 401 && reintentoAuth) {
    limpiarCacheDeToken();
    return pedir<T>(ruta, opciones, false);
  }
  if (!r.ok) {
    const texto = await r.text().catch(() => '');
    throw new ErrorSheets(r.status, `Sheets respondio ${r.status}: ${texto.slice(0, 300)}`);
  }
  if (r.status === 204) return {} as T;
  return (await r.json()) as T;
}

export interface PropiedadesHoja {
  sheetId: number;
  title: string;
  index: number;
  gridProperties?: { rowCount: number; columnCount: number };
}

export const sheets = {
  async hojas(spreadsheetId: string): Promise<PropiedadesHoja[]> {
    const r = await pedir<{ sheets?: Array<{ properties: PropiedadesHoja }> }>(
      `/${spreadsheetId}?fields=sheets.properties`,
    );
    return (r.sheets ?? []).map((s) => s.properties);
  },

  async titulo(spreadsheetId: string): Promise<string> {
    const r = await pedir<{ properties?: { title?: string } }>(`/${spreadsheetId}?fields=properties.title`);
    return r.properties?.title ?? '';
  },

  /**
   * Lee un rango. Con `sinFormato`, los números vuelven como números (10000)
   * y no como se ven en pantalla ("$10.000"): así se pueden volver a escribir
   * sin que cambien de valor según el idioma de la planilla.
   */
  async leer(spreadsheetId: string, rango: string, opciones: { sinFormato?: boolean } = {}): Promise<string[][]> {
    const consulta = opciones.sinFormato ? '?valueRenderOption=UNFORMATTED_VALUE' : '';
    const r = await pedir<{ values?: string[][] }>(`/${spreadsheetId}/values/${encodeURIComponent(rango)}${consulta}`);
    return r.values ?? [];
  },

  /**
   * Escribe un rango. Con `tal cual` (RAW), Google guarda el texto exacto: no
   * convierte "+54 9 11..." en fórmula, ni un teléfono en número con notación
   * científica, ni "=..." en una fórmula (lo que escribe un cliente nunca se
   * ejecuta). Sin eso, interpreta como si alguien lo tipeara (USER_ENTERED).
   */
  async escribir(spreadsheetId: string, rango: string, valores: unknown[][], opciones: { talCual?: boolean } = {}): Promise<void> {
    const modo = opciones.talCual ? 'RAW' : 'USER_ENTERED';
    await pedir(`/${spreadsheetId}/values/${encodeURIComponent(rango)}?valueInputOption=${modo}`, {
      method: 'PUT',
      body: JSON.stringify({ range: rango, majorDimension: 'ROWS', values: valores }),
    });
  },

  async agregar(spreadsheetId: string, rango: string, valores: unknown[][], opciones: { talCual?: boolean } = {}): Promise<void> {
    const modo = opciones.talCual ? 'RAW' : 'USER_ENTERED';
    await pedir(
      `/${spreadsheetId}/values/${encodeURIComponent(rango)}:append?valueInputOption=${modo}&insertDataOption=INSERT_ROWS`,
      { method: 'POST', body: JSON.stringify({ range: rango, majorDimension: 'ROWS', values: valores }) },
    );
  },

  async limpiar(spreadsheetId: string, rango: string): Promise<void> {
    await pedir(`/${spreadsheetId}/values/${encodeURIComponent(rango)}:clear`, { method: 'POST', body: '{}' });
  },

  async batchUpdate(spreadsheetId: string, requests: unknown[]): Promise<void> {
    if (requests.length === 0) return;
    await pedir(`/${spreadsheetId}:batchUpdate`, { method: 'POST', body: JSON.stringify({ requests }) });
  },

  /** Crea las hojas que falten. Devuelve los nombres creados. */
  async asegurarHojas(spreadsheetId: string, nombres: string[]): Promise<string[]> {
    const existentes = new Set((await sheets.hojas(spreadsheetId)).map((h) => h.title));
    const faltantes = nombres.filter((n) => !existentes.has(n));
    if (faltantes.length === 0) return [];
    await sheets.batchUpdate(
      spreadsheetId,
      faltantes.map((title) => ({ addSheet: { properties: { title } } })),
    );
    log.info({ hojas: faltantes }, 'hojas creadas en la planilla');
    return faltantes;
  },
};
