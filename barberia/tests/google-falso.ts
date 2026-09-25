/**
 * Servidor que hace de Google (OAuth + Sheets API v4).
 *
 * Existe para poder probar de punta a punta que un turno reservado por WhatsApp
 * termina escrito en la planilla, sin necesitar credenciales reales de Google.
 * Implementa solo los endpoints que usa el proyecto.
 */
import http from 'node:http';
import type { AddressInfo } from 'node:net';

export interface GoogleFalso {
  urlSheets: string;
  urlToken: string;
  hojas: Map<string, string[][]>;
  pedidos: string[];
  /** Formatos aplicados (repeatCell), para verificar los colores. */
  formatos: Array<{ hoja: string; fila: number; columna: number; color: { red: number; green: number; blue: number } }>;
  /** Fuerza que las próximas N respuestas fallen, para probar los reintentos. */
  fallarProximas: number;
  codigoDeFalla: number;
  filas(hoja: string): string[][];
  cerrar(): Promise<void>;
}

interface Rango {
  hoja: string;
  filaInicio: number;
  filaFin: number | null;
  colInicio: number;
  colFin: number | null;
}

function aIndiceDeColumna(letras: string): number {
  let n = 0;
  for (const c of letras) n = n * 26 + (c.charCodeAt(0) - 64);
  return n - 1;
}

function parsearRango(texto: string): Rango {
  const [hoja, celdas = 'A1:Z'] = texto.split('!');
  const m = /^([A-Z]+)(\d*):([A-Z]+)(\d*)$/.exec(celdas);
  if (!m) return { hoja: hoja!, filaInicio: 0, filaFin: null, colInicio: 0, colFin: null };
  return {
    hoja: hoja!,
    colInicio: aIndiceDeColumna(m[1]!),
    filaInicio: m[2] ? Number(m[2]) - 1 : 0,
    colFin: m[3] ? aIndiceDeColumna(m[3]!) : null,
    filaFin: m[4] ? Number(m[4]) - 1 : null,
  };
}

export async function levantarGoogleFalso(): Promise<GoogleFalso> {
  const hojas = new Map<string, string[][]>();
  const pedidos: string[] = [];
  const formatos: GoogleFalso['formatos'] = [];
  const estado = { fallarProximas: 0, codigoDeFalla: 500 };

  const servidor = http.createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    const ruta = decodeURIComponent(url.pathname);
    pedidos.push(`${req.method} ${ruta}${url.search}`);

    let cuerpo = '';
    req.on('data', (c) => (cuerpo += c));
    req.on('end', () => {
      const responder = (codigo: number, datos: unknown) => {
        res.writeHead(codigo, { 'content-type': 'application/json' });
        res.end(JSON.stringify(datos));
      };

      // OAuth: cualquier credencial sirve, esto es un doble de pruebas.
      if (ruta === '/token') return responder(200, { access_token: 'token-falso', expires_in: 3600 });

      if (estado.fallarProximas > 0 && ruta !== '/token') {
        estado.fallarProximas--;
        return responder(estado.codigoDeFalla, { error: { message: 'falla simulada' } });
      }

      const m = /^\/v4\/spreadsheets\/([^/:]+)(.*)$/.exec(ruta);
      if (!m) return responder(404, { error: { message: 'ruta desconocida' } });
      const resto = m[2] ?? '';

      // GET /{id}?fields=... → propiedades de las hojas
      if (resto === '' && req.method === 'GET') {
        return responder(200, {
          properties: { title: 'Planilla de prueba' },
          sheets: [...hojas.keys()].map((title, index) => ({ properties: { sheetId: index + 1, title, index } })),
        });
      }

      // POST /{id}:batchUpdate → crear hojas y formato (el formato se ignora)
      if (resto === ':batchUpdate' && req.method === 'POST') {
        const { requests = [] } = JSON.parse(cuerpo || '{}') as {
          requests?: Array<{
            addSheet?: { properties: { title: string } };
            repeatCell?: {
              range: { sheetId: number; startRowIndex?: number; startColumnIndex?: number; endRowIndex?: number; endColumnIndex?: number };
              cell?: { userEnteredFormat?: { backgroundColor?: { red: number; green: number; blue: number } } };
            };
          }>;
        };
        const titulos = [...hojas.keys()];
        for (const r of requests) {
          if (r.addSheet && !hojas.has(r.addSheet.properties.title)) hojas.set(r.addSheet.properties.title, []);
          const color = r.repeatCell?.cell?.userEnteredFormat?.backgroundColor;
          const rango = r.repeatCell?.range;
          // Solo se anotan los pintados de una celda puntual, no los reseteos.
          if (color && rango && (rango.endRowIndex ?? 0) - (rango.startRowIndex ?? 0) === 1) {
            formatos.push({
              hoja: titulos[(rango.sheetId ?? 1) - 1] ?? '',
              fila: rango.startRowIndex ?? 0,
              columna: rango.startColumnIndex ?? 0,
              color,
            });
          }
        }
        return responder(200, { replies: [] });
      }

      const valores = /^\/values\/(.+)$/.exec(resto);
      if (!valores) return responder(404, { error: { message: `ruta desconocida: ${resto}` } });

      // El rango puede traer ':' adentro ("Turnos!A:N"), así que el sufijo de
      // acción se saca por el final, no partiendo por el primer ':'.
      let rangoTexto = valores[1]!;
      let accion = '';
      for (const sufijo of [':append', ':clear']) {
        if (rangoTexto.endsWith(sufijo)) {
          accion = sufijo;
          rangoTexto = rangoTexto.slice(0, -sufijo.length);
          break;
        }
      }
      const rango = parsearRango(rangoTexto);
      const filas = hojas.get(rango.hoja) ?? [];
      if (!hojas.has(rango.hoja)) hojas.set(rango.hoja, filas);

      if (req.method === 'GET') {
        const hasta = rango.filaFin === null ? filas.length : rango.filaFin + 1;
        const recorte = filas.slice(rango.filaInicio, hasta).map((f) => {
          const finCol = rango.colFin === null ? f.length : rango.colFin + 1;
          return f.slice(rango.colInicio, finCol);
        });
        // Google no devuelve las filas vacías del final.
        while (recorte.length && recorte[recorte.length - 1]!.every((c) => !c)) recorte.pop();
        return responder(200, { range: rangoTexto, values: recorte });
      }

      if (accion === ':clear') {
        const hasta = rango.filaFin === null ? filas.length : rango.filaFin + 1;
        filas.splice(rango.filaInicio, hasta - rango.filaInicio);
        return responder(200, { clearedRange: rangoTexto });
      }

      const { values = [] } = JSON.parse(cuerpo || '{}') as { values?: string[][] };

      if (accion === ':append') {
        filas.push(...values);
        return responder(200, { updates: { updatedRows: values.length } });
      }

      // PUT: escritura en un rango puntual
      values.forEach((fila, i) => {
        const destino = rango.filaInicio + i;
        while (filas.length <= destino) filas.push([]);
        const existente = filas[destino]!;
        fila.forEach((celda, j) => {
          existente[rango.colInicio + j] = celda;
        });
      });
      return responder(200, { updatedRows: values.length });
    });
  });

  await new Promise<void>((resolve) => servidor.listen(0, '127.0.0.1', resolve));
  const puerto = (servidor.address() as AddressInfo).port;

  return {
    urlSheets: `http://127.0.0.1:${puerto}/v4/spreadsheets`,
    urlToken: `http://127.0.0.1:${puerto}/token`,
    hojas,
    pedidos,
    formatos,
    get fallarProximas() {
      return estado.fallarProximas;
    },
    set fallarProximas(n: number) {
      estado.fallarProximas = n;
    },
    get codigoDeFalla() {
      return estado.codigoDeFalla;
    },
    set codigoDeFalla(c: number) {
      estado.codigoDeFalla = c;
    },
    filas(hoja: string) {
      return hojas.get(hoja) ?? [];
    },
    cerrar: () => new Promise<void>((resolve) => servidor.close(() => resolve())),
  };
}
