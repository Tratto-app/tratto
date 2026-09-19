/* Simulador de chat: pega contra el mismo orquestador que el webhook real. */
'use strict';

const $ = (s) => document.querySelector(s);

const SUGERENCIAS = [
  'Hola, quiero sacar turno',
  'Hola, quiero cortarme el pelo mañana a la tarde',
  '¿Tenés algo para el sábado después de las 17?',
  '¿Cuánto sale el corte?',
  '¿A qué hora tengo turno?',
  'Quiero cambiar mi turno',
  'Quiero cancelar el turno que tengo mañana',
  '¿Dónde están?',
  '¿Trabajan los lunes?',
  'Quiero hablar con una persona',
];

function elemento(tag, clase, texto) {
  const el = document.createElement(tag);
  if (clase) el.className = clase;
  if (texto !== undefined) el.textContent = texto;
  return el;
}

function burbuja(clase, texto) {
  const el = elemento('div', `burbuja ${clase}`, texto);
  $('#chat').append(el);
  el.scrollIntoView({ behavior: 'smooth', block: 'end' });
  return el;
}

async function enviar(texto) {
  burbuja('cliente', texto);
  const esperando = elemento('div', 'escribiendo', 'escribiendo…');
  $('#chat').append(esperando);

  try {
    const resp = await fetch('/api/simulador/mensaje', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ texto, telefono: $('#telefono').value }),
    });
    esperando.remove();

    if (resp.status === 401) {
      burbuja('meta', 'Necesitás iniciar sesión en /panel para usar el simulador en producción.');
      return;
    }
    const datos = await resp.json();
    if (!resp.ok) {
      burbuja('meta', `Error: ${datos.mensaje || datos.error || resp.status}`);
      return;
    }

    if (datos.respuesta) burbuja('bot', datos.respuesta);
    else burbuja('meta', 'El bot decidió no responder (por ejemplo: la charla está derivada a una persona).');

    if (datos.botones && datos.botones.length) {
      const cont = elemento('div', 'sugerencias');
      datos.botones.forEach((b) => {
        const btn = elemento('button', '', b.titulo);
        btn.addEventListener('click', () => { cont.remove(); enviar(b.id); });
        cont.append(btn);
      });
      $('#chat').append(cont);
    }
    if (datos.lista && datos.lista.opciones && datos.lista.opciones.length) {
      const cont = elemento('div', 'sugerencias');
      datos.lista.opciones.forEach((o) => {
        const btn = elemento('button', '', o.titulo);
        btn.addEventListener('click', () => { cont.remove(); enviar(o.id); });
        cont.append(btn);
      });
      $('#chat').append(cont);
    }

    const detalles = [];
    detalles.push(datos.uso_ia ? '🧠 respondió la IA' : '📋 respondió el menú (sin IA)');
    if (datos.herramientas && datos.herramientas.length) detalles.push(`herramientas: ${datos.herramientas.join(', ')}`);
    if (datos.derivado) detalles.push('⚠️ derivado a una persona');
    burbuja('meta', detalles.join(' · '));

    pintarTurnos(datos.turnos_del_cliente || []);
  } catch (e) {
    esperando.remove();
    burbuja('meta', `No se pudo contactar al servidor: ${e.message}`);
  }
}

function pintarTurnos(turnos) {
  const cont = $('#estado-turnos');
  cont.textContent = '';
  cont.append(elemento('div', 'nombre', 'Turnos de este cliente en la base'));
  if (!turnos.length) {
    cont.append(elemento('div', 'vacio', 'Ninguno todavía.'));
    return;
  }
  turnos.forEach((t) => {
    cont.append(elemento('div', 'detalle', `${t.fecha} ${t.hora} — ${t.servicio} (${t.estado})`));
  });
}

$('#form').addEventListener('submit', (e) => {
  e.preventDefault();
  const texto = $('#texto').value.trim();
  if (!texto) return;
  $('#texto').value = '';
  enviar(texto);
});

$('#reiniciar').addEventListener('click', async () => {
  await fetch('/api/simulador/reiniciar', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({ telefono: $('#telefono').value }),
  });
  $('#chat').textContent = '';
  burbuja('meta', 'Conversación reiniciada. Los turnos ya creados siguen en la base.');
  pintarTurnos([]);
});

(function inicio() {
  const cont = $('#sugerencias');
  SUGERENCIAS.forEach((s) => {
    const b = elemento('button', '', s);
    b.addEventListener('click', () => enviar(s));
    cont.append(b);
  });
  fetch('/api/simulador/estado', { credentials: 'same-origin' })
    .then((r) => r.json())
    .then((d) => {
      $('#sub').textContent = d.ia_activa ? `${d.negocio} · IA activa (${d.modelo})` : `${d.negocio} · sin IA: modo menú`;
      burbuja('meta', d.ia_activa
        ? 'IA activa. Escribí como un cliente real.'
        : 'No hay AI_API_KEY configurada: el bot responde con el menú de respaldo. Igual podés reservar turnos.');
    })
    .catch(() => {});
})();
