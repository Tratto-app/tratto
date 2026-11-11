// Demo para mostrar en una visita: la app entera corre en el navegador con un
// negocio inventado y datos de ejemplo en memoria. No hay servidor, no se
// manda ningún mensaje y no se cobra nada. Al recargar vuelve a empezar.
import { iniciar } from './app.js';
import { manejar } from '../src/nucleo.js';
import { repoMemoria } from '../src/datos.js';
import { ahoraAR, sumarDias, fechaLarga } from '../src/logica.js';

// Para que la demo siempre tenga avisos para mostrar: si es domingo o fuera
// de las 9 a 20, hace de cuenta que es el próximo día hábil a las 10:30.
function ahora() {
  let d = new Date();
  let ar = ahoraAR(d);
  if (ar.diaSemana === 0) { d = new Date(d.getTime() + 864e5); ar = ahoraAR(d); }
  if (ar.hora < 9 || ar.hora >= 20) d = new Date(`${ar.fecha}T10:30:00-03:00`);
  return d;
}
let n = 0;
const repo = repoMemoria();
const e = {
  repo, demo: true, ahora, origen: 'https://pilates-sur.workers.dev',
  env: { MP_ACCESS_TOKEN: 'demo', WA_TOKEN: 'demo', WA_PHONE_ID: 'demo' },
  salir: async (url) => new Response(JSON.stringify(String(url).endsWith('/messages') ? { messages: [{ id: `wamid.demo${++n}` }] } : {}), { status: 200 }),
};
async function pedir(metodo, ruta, cuerpo) {
  const r = await manejar(new Request(`https://demo.local${ruta}`, {
    method: metodo, headers: { 'Content-Type': 'application/json' }, body: metodo === 'GET' ? undefined : JSON.stringify(cuerpo ?? {}),
  }), e);
  let datos = {};
  try { datos = await r.json(); } catch { datos = {}; }
  return { estado: r.status, datos };
}

async function sembrar() {
  const hoy = ahoraAR(ahora()).fecha;
  const mes = fechaLarga(hoy).split(' de ')[1];
  const dia = (n) => sumarDias(hoy, n);
  await pedir('POST', '/api/config', { nombre: 'Pilates Sur', color: '#7a3e8f', codigo_area: '11', datos_transferencia: 'Alias: pilates.sur.demo · a nombre de Pilates Sur (ejemplo)' });
  const cargar = async (nombre, telefono, concepto, monto, vence, extra = {}) => (await pedir('POST', '/api/deudas', {
    concepto, monto, vence, repite: extra.repite || 'unico', cliente: { nombre, telefono, acepta: extra.acepta ?? true },
  })).datos;
  const carla = await cargar('Carla Benítez', '11 5555-0101', `la cuota de ${mes}`, '38.000', dia(-9), { repite: 'mensual' });
  await cargar('Martín Sosa', '11 5555-0102', `la cuota de ${mes}`, '38.000', dia(-4), { repite: 'mensual' });
  await cargar('Lucía Fernández', '11 5555-0103', 'el pack de 8 clases', '52.000', dia(0));
  await cargar('Diego Ramírez', '11 5555-0104', `la cuota de ${mes}`, '38.000', dia(2), { repite: 'mensual' });
  await cargar('Sofía Acosta', '11 5555-0105', 'la matrícula anual', '15.000', dia(12));
  const pablo = await cargar('Pablo Giménez', '11 5555-0106', 'dos clases sueltas', '24.500', dia(-15));
  const valeria = await cargar('Valeria Ortiz', '11 5555-0107', `la cuota de ${mes}`, '38.000', dia(-3), { repite: 'mensual' });
  const nicolas = await cargar('Nicolás Paz', '11 5555-0108', `la cuota de ${mes}`, '38.000', dia(-6), { repite: 'mensual' });
  await cargar('Julieta Moreno', '', 'una clase de prueba', '9.500', dia(-1));
  const creado = (dias) => new Date(ahora().getTime() + dias * 864e5).toISOString();
  const mensaje = (deuda, etapa, dias, estado = 'leido') => repo.insertar('mensajes', { cliente_id: deuda.cliente_id, deuda_id: deuda.id, etapa, canal: 'toque', estado, dia: dia(dias), creado: creado(dias) });
  // Carla ya recibió el aviso de vencido: hoy le toca el último.
  await repo.actualizar('deudas', carla.id, { av_previo: dia(-12), av_dia: dia(-9), av_vencido: dia(-6) });
  await mensaje(carla, 'dia', -9); await mensaje(carla, 'vencido', -6, 'entregado');
  // Pablo pidió la baja.
  await repo.actualizar('deudas', pablo.id, { av_dia: dia(-15), av_vencido: dia(-12) });
  await mensaje(pablo, 'vencido', -12);
  await repo.insertar('respuestas', { cliente_id: pablo.cliente_id, telefono: '5491155550106', texto: 'BAJA', wa_id: 'demo', creado: creado(-12) });
  await repo.actualizar('clientes', pablo.cliente_id, { baja: 1 });
  // Valeria pagó por el link y Nicolás en efectivo.
  await repo.actualizar('deudas', valeria.id, { estado: 'pagada', pagada_el: dia(-2), medio: 'mercadopago', av_dia: dia(-3) });
  await mensaje(valeria, 'dia', -3);
  await repo.actualizar('deudas', nicolas.id, { estado: 'pagada', pagada_el: dia(-5), medio: 'efectivo', av_previo: dia(-9), av_dia: dia(-6) });
  await mensaje(nicolas, 'dia', -6);
}

sembrar().then(() => iniciar({ pedir }));
