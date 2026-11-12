// Datos de ejemplo de cada demo: un negocio inventado con casos en todos los
// estados (al día, por vencer, vencido, pagó, sin celular). Los teléfonos y
// los alias son de mentira.
import { ahoraAR, sumarDias, sumarMeses, nombreMes } from '../src/logica.js';

export async function sembrar(rubro, { pedir, repo, ahora }) {
  const hoy = ahoraAR(ahora()).fecha;
  const mes = nombreMes(hoy);
  const dia = (n) => sumarDias(hoy, n);
  const creado = (n) => new Date(ahora().getTime() + n * 864e5).toISOString();
  let tel = 100;
  const celular = () => `11 5555-0${++tel}`;
  const config = (datos) => pedir('POST', '/api/config', { codigo_area: '11', ...datos });
  const cuota = async (cliente, deuda) => (await pedir('POST', '/api/deudas', { repite: 'unico', ...deuda, cliente: { acepta: true, telefono: celular(), ...cliente } })).datos;
  const persona = async (cliente) => (await pedir('POST', '/api/clientes', { acepta: true, telefono: celular(), ...cliente })).datos.id;
  const mensaje = (clienteId, deudaId, etapa, dias, estado = 'enviado') => repo.insertar('mensajes', { cliente_id: clienteId, deuda_id: deudaId, etapa, canal: 'toque', estado, dia: dia(dias), creado: creado(dias) });
  const pago = (deudaId, dias, medio) => repo.actualizar('deudas', deudaId, { estado: 'pagada', pagada_el: dia(dias), medio });

  if (rubro === 'cuotas' || rubro === 'combi') {
    const combi = rubro === 'combi';
    await config(combi ? { nombre: 'Transporte Los Pibes', datos_transferencia: 'Alias: los.pibes.demo' } : { nombre: 'Estudio de danza Giro', datos_transferencia: 'Alias: estudio.giro.demo' });
    const monto = combi ? '130.000' : '28.000';
    const concepto = combi ? `la combi de ${mes}` : `la cuota de ${mes}`;
    const g = combi ? ['Colegio San José · mañana', 'Colegio San José · tarde', 'Instituto Belgrano · mañana'] : ['Danza jazz · martes y jueves', 'Iniciación · sábados', 'Contemporáneo adultos · lunes'];
    const a = await cuota({ nombre: 'Laura Méndez', nota: combi ? 'Sofi y Tomás' : 'Sofi', grupo: g[0] }, { concepto, monto, vence: dia(-9), repite: 'mensual' });
    await repo.actualizar('deudas', a.id, { av_previo: dia(-12), av_dia: dia(-9), av_vencido: dia(-6) });
    await mensaje(a.cliente_id, a.id, 'dia', -9); await mensaje(a.cliente_id, a.id, 'vencido', -6);
    await cuota({ nombre: 'Martín Sosa', nota: 'Juli', grupo: g[0] }, { concepto, monto, vence: dia(-4), repite: 'mensual' });
    await cuota({ nombre: 'Camila Ortiz', nota: combi ? 'Bauti' : '', grupo: g[2] }, { concepto, monto, vence: dia(0), repite: 'mensual' });
    await cuota({ nombre: 'Diego Ramírez', nota: 'Mora', grupo: g[1] }, { concepto, monto, vence: dia(2), repite: 'mensual' });
    const v = await cuota({ nombre: 'Valeria Paz', nota: 'Emma', grupo: g[1] }, { concepto, monto, vence: dia(-3), repite: 'mensual' });
    await pago(v.id, -2, 'transferencia'); await mensaje(v.cliente_id, v.id, 'dia', -3);
    const n = await cuota({ nombre: 'Nicolás Díaz', nota: combi ? 'Fran' : '', grupo: g[2] }, { concepto, monto, vence: dia(-6), repite: 'mensual' });
    await pago(n.id, -5, 'efectivo');
    await cuota({ nombre: 'Julieta Moreno', telefono: '', nota: combi ? 'Lola' : '', grupo: g[1] }, { concepto: combi ? 'medio viaje de la semana' : 'una clase de prueba', monto: combi ? '32.000' : '7.000', vence: dia(-1) });
  }

  if (rubro === 'libreta') {
    // El día de cobro fue hace 3 días: lo anotado antes de esa fecha ya se puede reclamar.
    await config({ nombre: 'Almacén Don Luis', datos_transferencia: 'Alias: almacen.donluis.demo', dia_cobro: Math.min(28, Number(dia(-3).slice(8))) });
    const anotar = (cliente_id, concepto, monto, dias) => pedir('POST', '/api/deudas', { cliente_id, concepto, monto, vence: dia(dias) });
    const marta = await cuota({ nombre: 'Marta Gómez' }, { concepto: 'pan y leche', monto: '4.200', vence: dia(-20) });
    await anotar(marta.cliente_id, 'fiambre y queso', '8.900', -12); await anotar(marta.cliente_id, 'compra', '10.300', -6);
    const raul = await cuota({ nombre: 'Raúl Benítez' }, { concepto: 'compra', monto: '6.500', vence: dia(-15) });
    await anotar(raul.cliente_id, 'gaseosas', '3.200', -8);
    const susana = await cuota({ nombre: 'Susana Ríos' }, { concepto: 'compra grande', monto: '15.000', vence: dia(-25) });
    await mensaje(susana.cliente_id, null, 'saldo', -3);
    await cuota({ nombre: 'Carlos Vera' }, { concepto: 'yerba y azúcar', monto: '2.800', vence: dia(-1) });
    const elena = await cuota({ nombre: 'Elena Paz' }, { concepto: 'compra', monto: '12.000', vence: dia(-18) });
    await pedir('POST', `/api/clientes/${elena.cliente_id}/pago`, { monto: '5.000', medio: 'efectivo' });
    const hugo = await cuota({ nombre: 'Hugo Díaz' }, { concepto: 'compra', monto: '9.400', vence: dia(-14) });
    await pago(hugo.id, -2, 'transferencia');
    await cuota({ nombre: 'Doña Rosa', telefono: '' }, { concepto: 'verdura', monto: '3.600', vence: dia(-10) });
  }

  if (rubro === 'control') {
    await config({ nombre: 'Consultorio Dra. Acosta', datos_transferencia: 'Alias: consultorio.acosta.demo' });
    const hace = (meses, dias) => sumarDias(sumarMeses(hoy, -meses), -dias);
    await persona({ nombre: 'Ana Gómez', ultima: hace(6, 12), cada: 6 });
    const luis = await persona({ nombre: 'Luis Ferrari', ultima: hace(6, 40), cada: 6 });
    await repo.actualizar('clientes', luis, { av_control: 1, av_control_el: dia(-20) });
    await mensaje(luis, null, 'control', -20);
    await persona({ nombre: 'Carla Benítez', ultima: hace(12, 0), cada: 12 });
    await persona({ nombre: 'Pedro Sosa', ultima: dia(-60), cada: 6 });
    await persona({ nombre: 'Elsa Quiroga', telefono: '', ultima: hace(6, 25), cada: 6 });
    const mora = await cuota({ nombre: 'Mora Díaz', ultima: dia(-30), cada: 3 }, { concepto: `la cuota de ortodoncia de ${mes}`, monto: '45.000', vence: dia(0), repite: 'mensual' });
    await repo.actualizar('deudas', mora.id, { av_previo: dia(-3) });
    await cuota({ nombre: 'Tomás Ruiz', ultima: dia(-45), cada: 3 }, { concepto: `la cuota de ortodoncia de ${mes}`, monto: '45.000', vence: dia(-4), repite: 'mensual' });
    const paula = await cuota({ nombre: 'Paula Vera', ultima: dia(-20), cada: 6 }, { concepto: 'el implante, cuota 2 de 6', monto: '120.000', vence: dia(-8) });
    await pago(paula.id, -7, 'transferencia');
  }
}
