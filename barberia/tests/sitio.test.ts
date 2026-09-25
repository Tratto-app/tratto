/**
 * Sitio público: portada y política de privacidad.
 *
 * No es decoración. Meta pide un sitio del negocio para verificarlo y una URL
 * de política de privacidad para publicar la app, y sin la app publicada el
 * bot no recibe mensajes. Lo que se verifica acá es que el HTML salga armado
 * desde la config, que nada quede sin escapar y que no se filtren los
 * PLACEHOLDER de una config a medio completar.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { cargarConfigNegocio, type ConfigNegocio } from '../src/config/negocio.js';
import { paginaInicio, paginaPrivacidad } from '../src/backend/sitio.js';
import { CONFIG_TEST } from './helpers.js';

const base = cargarConfigNegocio(CONFIG_TEST);

function conNegocio(cambios: Partial<ConfigNegocio['negocio']>): ConfigNegocio {
  return { ...base, negocio: { ...base.negocio, ...cambios } };
}

describe('portada', () => {
  const html = paginaInicio(base);

  test('es un documento HTML en español', () => {
    assert.match(html, /^<!doctype html>/);
    assert.match(html, /<html lang="es">/);
    assert.match(html, /<meta name="viewport"/);
  });

  test('muestra el nombre y la dirección del negocio', () => {
    assert.match(html, /<h1>Barberia Test<\/h1>/);
    assert.ok(html.includes('Calle Falsa 123'));
  });

  test('lista los servicios activos con precio, sin duración', () => {
    assert.ok(html.includes('Corte + Barba'));
    assert.ok(html.includes('12.000'));
    // El negocio pidió no mostrarle al cliente cuánto dura cada servicio.
    assert.doesNotMatch(html, /\d+\s*min\b|\b\d+ h\b/);
  });

  test('no muestra servicios dados de baja', () => {
    const cfg: ConfigNegocio = {
      ...base,
      servicios: base.servicios.map((s) => (s.id === 'barba' ? { ...s, activo: false } : s)),
    };
    assert.ok(!paginaInicio(cfg).includes('>Barba<'));
  });

  test('muestra los horarios de atención', () => {
    assert.ok(html.includes('Horarios'));
    assert.ok(/1[0-9]:00/.test(html));
  });

  test('lleva el logo con el nombre del negocio', () => {
    assert.match(html, /<svg class="logo"[^>]*aria-label="Logo de Barberia Test"/);
    assert.ok(html.includes('BARBERIA TEST'));
  });

  test('enlaza la política de privacidad, que es lo que pide Meta', () => {
    assert.ok(html.includes('href="/privacidad"'));
  });

  test('usa hoja de estilos externa: la CSP del servidor bloquea los estilos inline', () => {
    assert.ok(html.includes('<link rel="stylesheet" href="/sitio.css">'));
    assert.ok(!html.includes('<style'));
    assert.ok(!/style="/.test(html));
  });
});

describe('datos sin completar', () => {
  test('no se filtra ningún PLACEHOLDER al HTML', () => {
    assert.ok(!paginaInicio(base).includes('PLACEHOLDER'));
    assert.ok(!paginaPrivacidad(base).includes('PLACEHOLDER'));
  });

  test('sin teléfono cargado no aparece el botón de WhatsApp', () => {
    assert.ok(!paginaInicio(base).includes('wa.me'));
  });

  test('con teléfono cargado el botón apunta al número normalizado', () => {
    const html = paginaInicio(conNegocio({ telefono: '+54 9 11 2233 4455' }));
    assert.ok(html.includes('https://wa.me/5491122334455'));
  });

  test('un maps que no es http no se usa como enlace', () => {
    const html = paginaInicio(conNegocio({ maps: 'javascript:alert(1)' }));
    assert.ok(!html.includes('javascript:'));
    assert.ok(html.includes('Calle Falsa 123'));
  });

  test('un maps válido envuelve la dirección', () => {
    const html = paginaInicio(conNegocio({ maps: 'https://maps.app.goo.gl/abc' }));
    assert.ok(html.includes('href="https://maps.app.goo.gl/abc"'));
  });
});

describe('escapado', () => {
  test('el nombre del negocio no puede inyectar HTML', () => {
    const html = paginaInicio(conNegocio({ nombre: 'Barbería <script>alert(1)</script> & Cía' }));
    assert.ok(!html.includes('<script>alert(1)</script>'));
    assert.ok(html.includes('&lt;script&gt;'));
    assert.ok(html.includes('&amp; Cía'));
  });

  test('también en el título y la descripción', () => {
    const html = paginaInicio(conNegocio({ nombre: 'Corte "el" <b>mejor</b>' }));
    assert.ok(!/<title>[^<]*<b>/.test(html));
    assert.ok(!html.includes('content="Corte "'));
  });
});

describe('política de privacidad', () => {
  const html = paginaPrivacidad(base);

  test('dice qué datos se guardan y con quién se comparten', () => {
    for (const esperado of ['número de WhatsApp', 'nombre', 'turnos', 'Google Sheets', 'inteligencia artificial']) {
      assert.ok(html.includes(esperado), `falta mencionar: ${esperado}`);
    }
  });

  test('explica el borrado y los derechos del cliente', () => {
    assert.ok(html.includes('borran'));
    assert.ok(html.includes('Tus derechos'));
  });

  test('la retención sale de la config, no está escrita a mano', () => {
    assert.ok(paginaPrivacidad({ ...base, cierre_semanal: { ...base.cierre_semanal, conservar_dias: 0 } }).includes('una vez por semana'));
    assert.ok(paginaPrivacidad({ ...base, cierre_semanal: { ...base.cierre_semanal, conservar_dias: 30 } }).includes('a los 30 días'));
  });

  test('vuelve a la portada', () => {
    assert.ok(html.includes('href="/"'));
  });
});
