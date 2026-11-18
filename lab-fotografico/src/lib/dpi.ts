// Cuentas de la calculadora de tamaños. Las usa el servidor (para mostrar el
// ejemplo inicial) y el navegador (cuando la persona elige su foto).

export interface Tamano { nombre: string; corto: number; largo: number }
export type Nivel = 'optima' | 'buena' | 'baja';

export interface Resultado {
  nombre: string;
  dpi: number;
  nivel: Nivel;
  necesarios: string;   // píxeles necesarios para 300 DPI, en la orientación de la foto
  recorte: boolean;     // si la proporción de la foto no coincide con la del papel
}

const PULGADA = 2.54;

export function calcular(ancho: number, alto: number, tamanos: Tamano[]): Resultado[] {
  const largoPx = Math.max(ancho, alto);
  const cortoPx = Math.min(ancho, alto);
  const horizontal = ancho >= alto;
  return tamanos.map((t) => {
    const largoIn = t.largo / PULGADA;
    const cortoIn = t.corto / PULGADA;
    // Para llenar el papel sin bordes, manda el lado que queda más justo.
    const dpi = Math.min(largoPx / largoIn, cortoPx / cortoIn);
    const nivel: Nivel = dpi >= 300 ? 'optima' : dpi >= 200 ? 'buena' : 'baja';
    const nLargo = Math.round(largoIn * 300);
    const nCorto = Math.round(cortoIn * 300);
    const necesarios = horizontal ? `${nLargo} × ${nCorto} px` : `${nCorto} × ${nLargo} px`;
    const proporcionFoto = largoPx / cortoPx;
    const proporcionPapel = t.largo / t.corto;
    const recorte = Math.abs(proporcionFoto - proporcionPapel) / proporcionPapel > 0.04;
    return { nombre: t.nombre, dpi: Math.round(dpi), nivel, necesarios, recorte };
  });
}

export const TEXTO_NIVEL: Record<Nivel, string> = {
  optima: 'Óptima',
  buena: 'Buena',
  baja: 'No recomendada',
};
