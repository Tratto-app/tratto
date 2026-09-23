/**
 * Parámetros de las plantillas de WhatsApp.
 *
 * Desde 2025 Meta dejó de aceptar variables numeradas ({{1}}, {{2}}...) en
 * plantillas nuevas: exige nombres en minúscula ({{nombre_cliente}}...). Si el
 * envío manda los parámetros solo por posición, sin `parameter_name`, Meta lo
 * rechaza. Esto no se puede probar contra la API real sin credenciales, así
 * que se verifica el cuerpo exacto del POST interceptando `fetch`.
 */
import { test, describe, before, after, mock } from 'node:test';
import assert from 'node:assert/strict';

process.env.WHATSAPP_ACCESS_TOKEN = 'token-de-prueba';
process.env.WHATSAPP_PHONE_NUMBER_ID = '000000000';
process.env.WHATSAPP_VERIFY_TOKEN = 'verify-de-prueba';
process.env.NODE_ENV = 'test';

type ModuloCliente = typeof import('../src/whatsapp/cliente.js');
let whatsapp: ModuloCliente['whatsapp'];

before(async () => {
  ({ whatsapp } = await import('../src/whatsapp/cliente.js'));
});

function respuestaOk() {
  return new Response(JSON.stringify({ messages: [{ id: 'wamid.123' }] }), { status: 200 });
}

describe('plantillas: parámetros por nombre', () => {
  let llamadas: Array<{ url: string; body: unknown }>;
  let original: typeof fetch;

  before(() => {
    original = globalThis.fetch;
  });
  after(() => {
    globalThis.fetch = original;
  });

  function interceptar() {
    llamadas = [];
    globalThis.fetch = mock.fn(async (url: string, init: RequestInit) => {
      llamadas.push({ url: String(url), body: JSON.parse(String(init.body)) });
      return respuestaOk();
    }) as unknown as typeof fetch;
  }

  test('el recordatorio manda cada variable con su parameter_name', async () => {
    interceptar();
    await whatsapp.enviarPlantilla('5491133334444', 'recordatorio_turno', 'es_AR', [
      { nombre: 'nombre_cliente', valor: 'Juan' },
      { nombre: 'fecha_turno', valor: 'martes 29 de septiembre' },
      { nombre: 'hora_turno', valor: '16:00' },
      { nombre: 'servicio', valor: 'Corte + Barba' },
    ]);

    assert.equal(llamadas.length, 1);
    const cuerpo = llamadas[0].body as {
      template: { name: string; language: { code: string }; components: Array<{ type: string; parameters: unknown[] }> };
    };
    assert.equal(cuerpo.template.name, 'recordatorio_turno');
    assert.equal(cuerpo.template.language.code, 'es_AR');
    assert.deepEqual(cuerpo.template.components, [
      {
        type: 'body',
        parameters: [
          { type: 'text', parameter_name: 'nombre_cliente', text: 'Juan' },
          { type: 'text', parameter_name: 'fecha_turno', text: 'martes 29 de septiembre' },
          { type: 'text', parameter_name: 'hora_turno', text: '16:00' },
          { type: 'text', parameter_name: 'servicio', text: 'Corte + Barba' },
        ],
      },
    ]);
    // Ninguna variable viaja como {{1}}, {{2}}... (formato que Meta ya rechaza).
    for (const p of cuerpo.template.components[0].parameters as Array<Record<string, unknown>>) {
      assert.ok(!('index' in p));
      assert.match(String(p.parameter_name), /^[a-z][a-z0-9_]*$/);
    }
  });

  test('el pedido de reseña manda nombre, link y descuento por nombre', async () => {
    interceptar();
    await whatsapp.enviarPlantilla('5491133334444', 'pedido_resena', 'es_AR', [
      { nombre: 'nombre_cliente', valor: 'Ana' },
      { nombre: 'link_resena', valor: 'https://g.page/r/barberia-de-prueba/review' },
      { nombre: 'descuento', valor: '10' },
    ]);

    const cuerpo = llamadas[0].body as { template: { components: Array<{ parameters: Array<Record<string, unknown>> }> } };
    const params = cuerpo.template.components[0].parameters;
    assert.deepEqual(
      params.map((p) => p.parameter_name),
      ['nombre_cliente', 'link_resena', 'descuento'],
    );
    assert.equal(params[1].text, 'https://g.page/r/barberia-de-prueba/review');
  });

  test('sin parámetros no manda "components" (plantillas sin variables)', async () => {
    interceptar();
    await whatsapp.enviarPlantilla('5491133334444', 'aviso_simple', 'es_AR', []);
    const cuerpo = llamadas[0].body as { template: Record<string, unknown> };
    assert.ok(!('components' in cuerpo.template));
  });
});
