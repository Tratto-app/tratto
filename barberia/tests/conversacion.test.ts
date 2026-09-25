/**
 * Pruebas del circuito conversacional completo, en modo menú (sin IA).
 * Es el modo que tiene que funcionar SIEMPRE, incluso con la IA caída.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { procesarMensaje, reactivarBot } from '../src/conversation/orquestador.js';
import { turnosDeCliente, crearTurno } from '../src/booking/servicio.js';
import { clientesRepo } from '../src/database/repositories/clientes.js';
import { conversacionesRepo } from '../src/database/repositories/conversaciones.js';
import { contextoDePrueba, SABADO, TELEFONO_A, TELEFONO_B } from './helpers.js';

type Ctx = Awaited<ReturnType<typeof contextoDePrueba>>;

async function conContexto(fn: (ctx: Ctx) => Promise<void>) {
  const ctx = await contextoDePrueba();
  try {
    await fn(ctx);
  } finally {
    await ctx.cerrar();
  }
}

/** Manda un mensaje como si viniera de WhatsApp y devuelve el texto de respuesta. */
async function decir(ctx: Ctx, texto: string, telefono = TELEFONO_A): Promise<string> {
  const r = await procesarMensaje(ctx, { telefono, texto, idExterno: `msg-${Math.random()}`, origen: 'whatsapp' });
  return r.texto;
}

describe('flujo completo de reserva por menú', () => {
  test('un cliente nuevo reserva de punta a punta', async () => {
    await conContexto(async (ctx) => {
      const saludo = await decir(ctx, 'Hola');
      assert.match(saludo, /Sacar un turno/);

      assert.match(await decir(ctx, '1'), /Corte/);
      assert.match(await decir(ctx, 'srv_corte'), /día/i);
      assert.match(await decir(ctx, `dia_${SABADO}`), /horarios/i);

      const pideNombre = await decir(ctx, 'hora_17:30');
      assert.match(pideNombre, /nombre/i, 'a un cliente nuevo hay que pedirle el nombre');

      const resumen = await decir(ctx, 'Agustín');
      assert.match(resumen, /Antes de confirmar/);
      assert.match(resumen, /17:30/);
      assert.match(resumen, /Agustín/);
      assert.equal((await turnosDeCliente(ctx, TELEFONO_A)).length, 0, 'todavía no existe el turno');

      const confirmado = await decir(ctx, 'sí');
      assert.match(confirmado, /Agustín/);
      const turnos = await turnosDeCliente(ctx, TELEFONO_A);
      assert.equal(turnos.length, 1);
      assert.equal(turnos[0]!.horaInicio, '17:30');
      assert.equal(turnos[0]!.estado, 'reservado');
    });
  });

  test('si el cliente no confirma, no se crea nada y se libera el horario', async () => {
    await conContexto(async (ctx) => {
      for (const m of ['1', 'srv_corte', `dia_${SABADO}`, 'hora_17:30', 'Agustín']) await decir(ctx, m);
      const respuesta = await decir(ctx, 'no');
      assert.match(respuesta, /no reservo/i);
      assert.equal((await turnosDeCliente(ctx, TELEFONO_A)).length, 0);

      // El horario tiene que quedar libre para otro cliente enseguida.
      const otro = await crearTurno(ctx, {
        telefono: TELEFONO_B, nombre: 'Beto', servicioId: 'corte', fecha: SABADO, hora: '17:30', origen: 'whatsapp',
      });
      assert.equal(otro.horaInicio, '17:30');
    });
  });

  test('reconoce al cliente que ya vino y no le vuelve a pedir el nombre', async () => {
    await conContexto(async (ctx) => {
      for (const m of ['1', 'srv_corte', `dia_${SABADO}`, 'hora_17:30', 'Agustín', 'sí']) await decir(ctx, m);
      const cliente = await clientesRepo.porTelefono(ctx.db, TELEFONO_A);
      assert.equal(cliente?.nombre, 'Agustín');
      assert.equal(cliente?.totalTurnos, 1);

      const resumen = await decir(ctx, '1').then(() => decir(ctx, 'srv_barba')).then(() => decir(ctx, `dia_${SABADO}`)).then(() => decir(ctx, 'hora_11:00'));
      assert.match(resumen, /Antes de confirmar/, 'no debería volver a pedir el nombre');
      assert.match(resumen, /Agustín/);
    });
  });

  test('consultar el turno responde con día, hora y servicio', async () => {
    await conContexto(async (ctx) => {
      for (const m of ['1', 'srv_corte', `dia_${SABADO}`, 'hora_17:30', 'Agustín', 'sí']) await decir(ctx, m);
      const r = await decir(ctx, '¿A qué hora tengo turno?');
      assert.match(r, /17:30/);
      assert.match(r, /Corte/);
    });
  });

  test('cancelar pide confirmación antes de cancelar de verdad', async () => {
    await conContexto(async (ctx) => {
      for (const m of ['1', 'srv_corte', `dia_${SABADO}`, 'hora_17:30', 'Agustín', 'sí']) await decir(ctx, m);

      const pregunta = await decir(ctx, 'quiero cancelar el turno');
      assert.match(pregunta, /cancelar este turno/i);
      assert.equal((await turnosDeCliente(ctx, TELEFONO_A)).length, 1, 'todavía no se canceló');

      const hecho = await decir(ctx, 'cancelar_si');
      assert.match(hecho, /cancelé/i);
      assert.equal((await turnosDeCliente(ctx, TELEFONO_A)).length, 0);
    });
  });

  test('responder que no a la cancelación deja el turno en pie', async () => {
    await conContexto(async (ctx) => {
      for (const m of ['1', 'srv_corte', `dia_${SABADO}`, 'hora_17:30', 'Agustín', 'sí']) await decir(ctx, m);
      await decir(ctx, 'quiero cancelar');
      const r = await decir(ctx, 'no');
      assert.match(r, /sigue en pie/i);
      assert.equal((await turnosDeCliente(ctx, TELEFONO_A)).length, 1);
    });
  });

  test('informa precios y servicios sin inventar nada', async () => {
    await conContexto(async (ctx) => {
      const r = await decir(ctx, '¿cuánto sale el corte?');
      assert.match(r, /Corte/);
      assert.match(r, /8\.?000/, 'tiene que salir el precio de la configuración');
    });
  });
});

describe('manejo de casos raros', () => {
  test('un mensaje ambiguo no inventa turno: vuelve a preguntar', async () => {
    await conContexto(async (ctx) => {
      const r = await decir(ctx, 'asdkjhasd qwe zzz');
      assert.match(r, /Sacar un turno/, 'ante la duda, ofrece el menú');
      assert.equal((await turnosDeCliente(ctx, TELEFONO_A)).length, 0);
    });
  });

  test('un horario inválido en el paso de horarios no rompe la conversación', async () => {
    await conContexto(async (ctx) => {
      for (const m of ['1', 'srv_corte', `dia_${SABADO}`]) await decir(ctx, m);
      const r = await decir(ctx, 'a las tres de la matina');
      assert.match(r, /horarios|entendí/i);
      assert.equal((await turnosDeCliente(ctx, TELEFONO_A)).length, 0);
    });
  });

  test('un mensaje vacío no genera respuesta', async () => {
    await conContexto(async (ctx) => {
      const r = await procesarMensaje(ctx, { telefono: TELEFONO_A, texto: '   ', origen: 'whatsapp', idExterno: 'x1' });
      assert.equal(r.texto, '');
    });
  });

  test('el mismo mensaje de WhatsApp dos veces se procesa una sola vez', async () => {
    await conContexto(async (ctx) => {
      const primera = await procesarMensaje(ctx, { telefono: TELEFONO_A, texto: 'Hola', idExterno: 'wamid.ABC', origen: 'whatsapp' });
      const segunda = await procesarMensaje(ctx, { telefono: TELEFONO_A, texto: 'Hola', idExterno: 'wamid.ABC', origen: 'whatsapp' });
      assert.ok(primera.texto.length > 0);
      assert.equal(segunda.duplicado, true);
      assert.equal(segunda.texto, '');
    });
  });

  test('un reenvío del webhook no duplica el turno', async () => {
    await conContexto(async (ctx) => {
      for (const m of ['1', 'srv_corte', `dia_${SABADO}`, 'hora_17:30', 'Agustín']) await decir(ctx, m);
      const idRepetido = 'wamid.CONFIRMA';
      await procesarMensaje(ctx, { telefono: TELEFONO_A, texto: 'sí', idExterno: idRepetido, origen: 'whatsapp' });
      await procesarMensaje(ctx, { telefono: TELEFONO_A, texto: 'sí', idExterno: idRepetido, origen: 'whatsapp' });
      assert.equal((await turnosDeCliente(ctx, TELEFONO_A)).length, 1);
    });
  });
});

describe('derivación a una persona', () => {
  test('pedir hablar con alguien pausa el bot y avisa al barbero', async () => {
    await conContexto(async (ctx) => {
      const r = await procesarMensaje(ctx, {
        telefono: TELEFONO_A, texto: 'quiero hablar con una persona', idExterno: 'm1', origen: 'whatsapp',
      });
      assert.equal(r.avisarAlBarbero, true);
      assert.ok(r.texto.length > 0);

      const conv = await conversacionesRepo.obtener(ctx.db, TELEFONO_A);
      assert.equal(conv.modo, 'humano');

      // Mientras atiende una persona, el bot no contesta.
      const siguiente = await procesarMensaje(ctx, { telefono: TELEFONO_A, texto: '¿hola?', idExterno: 'm2', origen: 'whatsapp' });
      assert.equal(siguiente.texto, '');
      assert.equal(siguiente.avisarAlBarbero, true);
    });
  });

  test('el barbero puede devolver la charla al bot', async () => {
    await conContexto(async (ctx) => {
      await procesarMensaje(ctx, { telefono: TELEFONO_A, texto: 'quiero hablar con el barbero', idExterno: 'm1', origen: 'whatsapp' });
      await reactivarBot(ctx, TELEFONO_A);
      const conv = await conversacionesRepo.obtener(ctx.db, TELEFONO_A);
      assert.equal(conv.modo, 'bot');
      const r = await decir(ctx, 'hola');
      assert.ok(r.length > 0, 'el bot vuelve a responder');
    });
  });
});

describe('contexto de la conversación', () => {
  test('recuerda lo dicho en mensajes anteriores', async () => {
    await conContexto(async (ctx) => {
      await decir(ctx, '1');
      await decir(ctx, 'srv_corte_barba');
      await decir(ctx, `dia_${SABADO}`);
      const r = await decir(ctx, 'hora_15:00');
      assert.match(r, /nombre/i);
      const resumen = await decir(ctx, 'Agustín');
      assert.match(resumen, /Corte \+ Barba/, 'tiene que acordarse del servicio elegido tres mensajes atrás');
    });
  });

  test('cada teléfono tiene su propia conversación', async () => {
    await conContexto(async (ctx) => {
      await decir(ctx, '1', TELEFONO_A);
      await decir(ctx, 'srv_corte', TELEFONO_A);
      const respuestaB = await decir(ctx, 'hola', TELEFONO_B);
      assert.match(respuestaB, /Sacar un turno/, 'el cliente B arranca de cero');
    });
  });

  test('el historial no crece sin límite', async () => {
    await conContexto(async (ctx) => {
      for (let i = 0; i < 20; i++) await decir(ctx, `mensaje ${i}`);
      const conv = await conversacionesRepo.obtener(ctx.db, TELEFONO_A);
      assert.ok(conv.historial.length <= 14, `historial de ${conv.historial.length} mensajes`);
    });
  });
});

describe('respaldo cuando la IA no está disponible (requisito crítico)', () => {
  test('si el modelo falla, el cliente igual puede reservar por menú', async () => {
    await conContexto(async (ctx) => {
      const iaCaida = {
        nombre: 'claude' as const,
        modelo: 'falso',
        iniciar: () => ({
          async siguiente(): Promise<never> {
            throw new Error('529 overloaded');
          },
          agregarResultados() {},
        }),
      };

      // Todo el circuito de reserva, con la IA caída en cada mensaje.
      const pasos = ['Hola, quiero sacar turno', 'srv_corte', `dia_${SABADO}`, 'hora_17:30', 'Agustín', 'sí'];
      let ultima = '';
      for (const [i, texto] of pasos.entries()) {
        const r = await procesarMensaje(
          ctx,
          { telefono: TELEFONO_A, texto, idExterno: `caida-${i}`, origen: 'whatsapp' },
          { proveedorIA: iaCaida },
        );
        assert.equal(r.usoIA, false, 'tiene que haber respondido el menú');
        assert.ok(r.texto.length > 0, `el paso "${texto}" quedó sin respuesta`);
        ultima = r.texto;
      }

      assert.match(ultima, /quedó reservado/i);
      const turnos = await turnosDeCliente(ctx, TELEFONO_A);
      assert.equal(turnos.length, 1);
      assert.equal(turnos[0]!.horaInicio, '17:30');
    });
  });

  test('cuando la IA responde bien, se usa la IA', async () => {
    await conContexto(async (ctx) => {
      const iaOk = {
        nombre: 'openai' as const,
        modelo: 'falso',
        iniciar: () => ({
          async siguiente() {
            return { texto: '¡Buenas! ¿Qué día te queda cómodo? ✂️', herramientas: [], motivo: 'texto' as const };
          },
          agregarResultados() {},
        }),
      };
      const r = await procesarMensaje(
        ctx,
        { telefono: TELEFONO_A, texto: 'hola', idExterno: 'ok-1', origen: 'whatsapp' },
        { proveedorIA: iaOk },
      );
      assert.equal(r.usoIA, true);
      assert.match(r.texto, /qué día/i);
    });
  });
});

describe('el menú entiende cómo habla la gente', () => {
  const casos: Array<[string, RegExp]> = [
    ['quiero sacar turno', /qué te querés hacer/i],
    ['hola, quiero un turno', /qué te querés hacer/i],
    ['quiero cortarme el pelo', /qué te querés hacer/i],
    ['que turno tengo', /no tenés ningún turno/i],
    ['¿a qué hora tengo turno?', /no tenés ningún turno/i],
    ['cuándo es mi turno', /no tenés ningún turno/i],
    ['qué día tengo el turno', /no tenés ningún turno/i],
    ['quiero cancelar el turno', /no tenés turnos para cancelar/i],
    ['no voy a poder ir', /no tenés turnos para cancelar/i],
    ['quiero cambiar mi turno', /no encuentro ningún turno/i],
    ['¿puedo pasar mi turno para las 18?', /no encuentro ningún turno/i],
    ['cuánto sale el corte', /estos son los servicios/i],
    ['quiero hablar con una persona', /le aviso al barbero/i],
  ];

  for (const [frase, esperado] of casos) {
    test(`"${frase}"`, async () => {
      await conContexto(async (ctx) => {
        // Cliente sin turnos: así la respuesta revela qué intención se detectó.
        const r = await decir(ctx, frase);
        assert.match(r, esperado, `"${frase}" se interpretó mal: "${r.split('\n')[0]}"`);
      });
    });
  }

  test('"quiero cancelar" con un turno vivo ofrece cancelar ese turno', async () => {
    await conContexto(async (ctx) => {
      for (const m of ['1', 'srv_corte', `dia_${SABADO}`, 'hora_17:30', 'Agustín', 'sí']) await decir(ctx, m);
      const r = await decir(ctx, 'no voy a poder ir');
      assert.match(r, /cancelar este turno/i);
    });
  });
});

describe('el cliente no ve duraciones', () => {
  // El negocio pidió no mostrar cuánto dura cada servicio. La duración sigue
  // existiendo por dentro (arma la grilla de horarios), pero no se escribe.
  const DURACION = /\b\d+\s*min\b|\b\d+\s*h\b/;

  test('la lista de servicios para reservar muestra nombre y precio, sin minutos', async () => {
    await conContexto(async (ctx) => {
      const r = await decir(ctx, '1');
      assert.match(r, /Corte \+ Barba/);
      assert.ok(!DURACION.test(r), `apareció una duración: ${r}`);
    });
  });

  test('la consulta de precios tampoco muestra minutos', async () => {
    await conContexto(async (ctx) => {
      const r = await decir(ctx, 'cuánto sale el corte?');
      assert.match(r, /Corte/);
      assert.ok(!DURACION.test(r), `apareció una duración: ${r}`);
    });
  });
});
