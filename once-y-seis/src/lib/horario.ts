// Horarios: convierte "7:30 a 20:00" en minutos, arma el texto agrupado
// ("Lunes a viernes 7:30 a 20:00") y los datos para Google y para el cartel
// de "Abierto ahora" que se calcula en el navegador con la hora de Buenos Aires.

const DIAS = [
  { clave: 'lunes', nombre: 'Lunes', corto: 'Lun', plural: 'Lunes', schema: 'Monday', js: 1 },
  { clave: 'martes', nombre: 'Martes', corto: 'Mar', plural: 'Martes', schema: 'Tuesday', js: 2 },
  { clave: 'miercoles', nombre: 'Miércoles', corto: 'Mié', plural: 'Miércoles', schema: 'Wednesday', js: 3 },
  { clave: 'jueves', nombre: 'Jueves', corto: 'Jue', plural: 'Jueves', schema: 'Thursday', js: 4 },
  { clave: 'viernes', nombre: 'Viernes', corto: 'Vie', plural: 'Viernes', schema: 'Friday', js: 5 },
  { clave: 'sabado', nombre: 'Sábado', corto: 'Sáb', plural: 'Sábados', schema: 'Saturday', js: 6 },
  { clave: 'domingo', nombre: 'Domingo', corto: 'Dom', plural: 'Domingos', schema: 'Sunday', js: 0 },
] as const;

type Clave = (typeof DIAS)[number]['clave'];
export type Franja = { abre: number; cierra: number } | null;

function aMinutos(h: string, m: string) {
  return Number(h) * 60 + Number(m);
}
export function hora(min: number) {
  return `${Math.floor(min / 60)}:${String(min % 60).padStart(2, '0')}`;
}
function hora24(min: number) {
  return `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
}

function leerFranja(dia: string, valor: string): Franja {
  const v = valor.trim().toLowerCase();
  if (v === 'cerrado') return null;
  const m = v.match(/^(\d{1,2})[:.](\d{2})\s*(?:a|-|–)\s*(\d{1,2})[:.](\d{2})$/);
  if (!m) {
    throw new Error(
      `\n\n✖ En contenido.yaml, horarios → ${dia}: "${valor}" no se entiende.\n` +
      '  Escribilo como "7:30 a 20:00", o  cerrado  si ese día no abren.\n',
    );
  }
  const abre = aMinutos(m[1], m[2]);
  const cierra = aMinutos(m[3], m[4]);
  if (cierra <= abre) {
    throw new Error(`\n\n✖ En contenido.yaml, horarios → ${dia}: la hora de cierre tiene que ser después de la de apertura.\n`);
  }
  return { abre, cierra };
}

export function leerHorarios(datos: Record<Clave, string> & { cerrado_los_dias: string[] }) {
  const dias = DIAS.map((d) => ({ ...d, franja: leerFranja(d.clave, datos[d.clave]) }));

  // Agrupa días seguidos con el mismo horario: "Lunes a viernes", "Sábados y domingos"
  const grupos: { desde: (typeof dias)[number]; hasta: (typeof dias)[number]; cantidad: number; franja: Franja }[] = [];
  for (const d of dias) {
    const ultimo = grupos.at(-1);
    const igual = ultimo && JSON.stringify(ultimo.franja) === JSON.stringify(d.franja);
    if (igual) { ultimo.hasta = d; ultimo.cantidad++; } else grupos.push({ desde: d, hasta: d, cantidad: 1, franja: d.franja });
  }
  const texto = (g: (typeof grupos)[number], corto = false) => {
    const a = corto ? g.desde.corto : g.desde.nombre;
    const b = corto ? g.hasta.corto : g.hasta.nombre;
    if (g.cantidad === 1) return a;
    if (g.cantidad === 2) return corto ? `${a} y ${b.toLowerCase()}` : `${g.desde.plural} y ${g.hasta.plural.toLowerCase()}`;
    return `${a} a ${b.toLowerCase()}`;
  };
  const lineas = grupos.map((g) => ({
    dias: texto(g),
    diasCortos: texto(g, true),
    horario: g.franja ? `${hora(g.franja.abre)} a ${hora(g.franja.cierra)}` : 'Cerrado',
  }));

  return {
    lineas,
    resumen: lineas.map((l) => `${l.dias} ${l.horario}`).join(' · '),
    resumenCorto: lineas.map((l) => `${l.diasCortos} ${l.horario}`).join(' · '),
    // Para Google (schema.org)
    especificacion: grupos
      .filter((g) => g.franja)
      .map((g) => ({
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: dias.slice(dias.indexOf(g.desde), dias.indexOf(g.hasta) + 1).map((d) => `https://schema.org/${d.schema}`),
        opens: hora24(g.franja!.abre),
        closes: hora24(g.franja!.cierra),
      })),
    // Para el cartel en vivo: índice 0 = domingo, como en JavaScript
    paraNavegador: {
      semana: [0, 1, 2, 3, 4, 5, 6].map((js) => {
        const f = dias.find((d) => d.js === js)!.franja;
        return f ? [f.abre, f.cierra] : null;
      }),
      cerrados: datos.cerrado_los_dias,
    },
  };
}
