/* Panel del barbero. Vanilla JS, sin build: lo que se lee es lo que corre. */
'use strict';

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

const DIAS = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];
let CONFIG = null;
let SEMANA_DESDE = null;

// --- Utilidades -------------------------------------------------------------

async function api(ruta, opciones = {}) {
  const resp = await fetch(`/api${ruta}`, {
    credentials: 'same-origin',
    headers: opciones.body ? { 'content-type': 'application/json' } : {},
    ...opciones,
  });
  if (resp.status === 401) {
    mostrarIngreso();
    throw new Error('sesión vencida');
  }
  const datos = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(datos.mensaje || datos.error || `error ${resp.status}`);
  return datos;
}

function avisar(texto, tipo = 'ok') {
  const caja = document.createElement('div');
  caja.className = `aviso ${tipo}`;
  caja.textContent = texto;
  $('#mensajes').prepend(caja);
  setTimeout(() => caja.remove(), 5000);
}

function limpiar(nodo) {
  while (nodo.firstChild) nodo.removeChild(nodo.firstChild);
}

function elemento(tag, clase, texto) {
  const el = document.createElement(tag);
  if (clase) el.className = clase;
  if (texto !== undefined) el.textContent = texto;
  return el;
}

function fechaISO(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function nombreDeFecha(iso) {
  const [a, m, d] = iso.split('-').map(Number);
  const dt = new Date(a, m - 1, d);
  return `${DIAS[(dt.getDay() + 6) % 7]} ${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}`;
}

function confirmar(mensaje) {
  return window.confirm(mensaje);
}

// --- Ingreso ----------------------------------------------------------------

function mostrarIngreso() {
  $('#ingreso').hidden = false;
  $('#app').hidden = true;
}

function mostrarApp() {
  $('#ingreso').hidden = true;
  $('#app').hidden = false;
}

$('#form-ingreso').addEventListener('submit', async (e) => {
  e.preventDefault();
  const error = $('#error-ingreso');
  limpiar(error);
  try {
    await api('/login', { method: 'POST', body: JSON.stringify({ clave: $('#clave').value }) });
    $('#clave').value = '';
    await iniciar();
  } catch (err) {
    error.append(elemento('div', 'aviso error', err.message));
  }
});

$('#btn-salir').addEventListener('click', async () => {
  await fetch('/api/logout', { method: 'POST', credentials: 'same-origin' });
  mostrarIngreso();
});

// --- Pestañas ---------------------------------------------------------------

$$('nav.pestanas button').forEach((btn) => {
  btn.addEventListener('click', () => {
    $$('nav.pestanas button').forEach((b) => b.setAttribute('aria-selected', String(b === btn)));
    $$('section.panel').forEach((s) => s.classList.remove('activa'));
    $(`#panel-${btn.dataset.panel}`).classList.add('activa');
    if (btn.dataset.panel === 'semana') cargarSemana();
    if (btn.dataset.panel === 'ajustes') cargarAjustes();
    if (btn.dataset.panel === 'bloquear') cargarBloqueos();
    window.scrollTo(0, 0);
  });
});

// --- Agenda de hoy ----------------------------------------------------------

function tarjetaDeTurno(turno, recargar) {
  const card = elemento('div', 'tarjeta');
  const fila = elemento('div', `turno${turno.estado === 'cancelado' ? ' cancelado' : ''}`);
  fila.append(elemento('div', 'hora', turno.horaInicio));

  const datos = elemento('div', 'datos');
  datos.append(elemento('div', 'nombre', turno.nombreCliente || '(sin nombre)'));
  const detalle = `${turno.servicioNombre} · ${turno.duracionMin} min · hasta ${turno.horaFin}`;
  datos.append(elemento('div', 'detalle', detalle));
  const estado = elemento('span', `chip${turno.estado === 'cancelado' ? ' mal' : turno.estado === 'completado' ? ' ok' : ''}`, turno.estado);
  datos.append(estado);
  fila.append(datos);
  card.append(fila);

  if (turno.estado === 'reservado' || turno.estado === 'confirmado' || turno.estado === 'pendiente') {
    const acciones = elemento('div', 'acciones');

    const wa = elemento('a', 'boton', 'WhatsApp');
    wa.href = `https://wa.me/${turno.telefono}`;
    wa.target = '_blank';
    wa.rel = 'noopener';
    acciones.append(wa);

    const vino = elemento('button', '', 'Vino');
    vino.addEventListener('click', async () => {
      try {
        await api(`/turnos/${turno.id}/estado`, { method: 'POST', body: JSON.stringify({ estado: 'completado' }) });
        avisar('Turno marcado como completado.');
        recargar();
      } catch (e) { avisar(e.message, 'error'); }
    });
    acciones.append(vino);

    const noVino = elemento('button', '', 'No vino');
    noVino.addEventListener('click', async () => {
      if (!confirmar('¿Marcar que el cliente no vino?')) return;
      try {
        await api(`/turnos/${turno.id}/estado`, { method: 'POST', body: JSON.stringify({ estado: 'no_show' }) });
        recargar();
      } catch (e) { avisar(e.message, 'error'); }
    });
    acciones.append(noVino);

    const cancelar = elemento('button', 'peligro', 'Cancelar');
    cancelar.addEventListener('click', async () => {
      if (!confirmar(`¿Cancelar el turno de ${turno.nombreCliente || 'este cliente'} a las ${turno.horaInicio}?`)) return;
      try {
        await api(`/turnos/${turno.id}/cancelar`, { method: 'POST', body: JSON.stringify({ motivo: 'cancelado desde el panel' }) });
        avisar('Turno cancelado.');
        recargar();
      } catch (e) { avisar(e.message, 'error'); }
    });
    acciones.append(cancelar);

    card.append(acciones);
  }
  return card;
}

function pintarDia(contenedor, dia, recargar) {
  limpiar(contenedor);
  if (!dia.abierto) {
    contenedor.append(elemento('div', 'vacio', `Cerrado${dia.motivo_cerrado ? ` — ${dia.motivo_cerrado}` : ''}`));
    return;
  }
  const vivos = dia.turnos.filter((t) => ['pendiente', 'reservado', 'confirmado'].includes(t.estado));
  const otros = dia.turnos.filter((t) => !['pendiente', 'reservado', 'confirmado'].includes(t.estado));

  if (vivos.length === 0 && dia.bloqueos.length === 0) {
    contenedor.append(elemento('div', 'vacio', 'Sin turnos por ahora.'));
  }
  vivos.forEach((t) => contenedor.append(tarjetaDeTurno(t, recargar)));

  dia.bloqueos.forEach((b) => {
    const card = elemento('div', 'tarjeta');
    const fila = elemento('div', 'turno bloqueo');
    fila.append(elemento('div', 'hora', b.diaCompleto ? 'Todo' : b.horaInicio));
    const datos = elemento('div', 'datos');
    datos.append(elemento('div', 'nombre', '🔒 Bloqueado'));
    datos.append(elemento('div', 'detalle', `${b.horaInicio} a ${b.horaFin}${b.motivo ? ` · ${b.motivo}` : ''}`));
    fila.append(datos);
    card.append(fila);
    const acciones = elemento('div', 'acciones');
    const quitar = elemento('button', '', 'Quitar bloqueo');
    quitar.addEventListener('click', async () => {
      try {
        await api(`/bloqueos/${b.id}`, { method: 'DELETE' });
        avisar('Bloqueo eliminado.');
        recargar();
      } catch (e) { avisar(e.message, 'error'); }
    });
    acciones.append(quitar);
    card.append(acciones);
    contenedor.append(card);
  });

  if (otros.length) {
    const resumen = elemento('div', 'vacio', `${otros.length} turno(s) cancelado(s) o cerrado(s).`);
    contenedor.append(resumen);
  }
  const libres = elemento('div', 'vacio', `${dia.huecos_libres.length} hueco(s) libre(s).`);
  contenedor.append(libres);
}

async function cargarHoy() {
  try {
    const datos = await api('/agenda/hoy');
    pintarDia($('#agenda-hoy'), datos.hoy, cargarHoy);
    pintarDia($('#agenda-manana'), datos.manana, cargarHoy);
  } catch (e) {
    avisar(e.message, 'error');
  }
}

// --- Semana -----------------------------------------------------------------

async function cargarSemana() {
  const cont = $('#agenda-semana');
  limpiar(cont);
  try {
    const q = SEMANA_DESDE ? `?desde=${SEMANA_DESDE}` : '';
    const datos = await api(`/agenda/semana${q}`);
    const hoy = fechaISO(new Date());
    datos.dias.forEach((dia) => {
      const bloque = elemento('div', `dia-semana${dia.fecha === hoy ? ' hoy' : ''}`);
      bloque.append(elemento('h3', '', nombreDeFecha(dia.fecha)));
      const vivos = dia.turnos.filter((t) => ['pendiente', 'reservado', 'confirmado'].includes(t.estado));
      const cancelados = dia.turnos.filter((t) => t.estado === 'cancelado');
      bloque.append(
        elemento(
          'div',
          'resumen',
          dia.abierto
            ? `${vivos.length} turno(s) · ${dia.huecos_libres.length} libre(s)${cancelados.length ? ` · ${cancelados.length} cancelado(s)` : ''}`
            : `Cerrado${dia.motivo_cerrado ? ` — ${dia.motivo_cerrado}` : ''}`,
        ),
      );
      if (vivos.length || dia.bloqueos.length) {
        const ul = elemento('ul');
        vivos.forEach((t) => ul.append(elemento('li', '', `${t.horaInicio} · ${t.nombreCliente || '(sin nombre)'} — ${t.servicioNombre}`)));
        dia.bloqueos.forEach((b) => ul.append(elemento('li', '', `${b.horaInicio}-${b.horaFin} · 🔒 ${b.motivo || 'bloqueado'}`)));
        bloque.append(ul);
      }
      cont.append(bloque);
    });
    SEMANA_DESDE = datos.dias[0] ? datos.dias[0].fecha : SEMANA_DESDE;
  } catch (e) {
    avisar(e.message, 'error');
  }
}

function correrSemana(dias) {
  const base = SEMANA_DESDE ? new Date(`${SEMANA_DESDE}T12:00:00`) : new Date();
  base.setDate(base.getDate() + dias);
  SEMANA_DESDE = fechaISO(base);
  cargarSemana();
}

$('#semana-anterior').addEventListener('click', () => correrSemana(-7));
$('#semana-siguiente').addEventListener('click', () => correrSemana(7));
$('#semana-actual').addEventListener('click', () => { SEMANA_DESDE = null; cargarSemana(); });

// --- Turno nuevo ------------------------------------------------------------

async function refrescarHorariosDelForm() {
  const cont = $('#t-horarios');
  limpiar(cont);
  $('#t-hora').value = '';
  const fecha = $('#t-fecha').value;
  const servicio = $('#t-servicio').value;
  if (!fecha || !servicio) {
    cont.append(elemento('span', 'vacio', 'Elegí fecha y servicio.'));
    return;
  }
  try {
    const datos = await api(`/disponibilidad?fecha=${fecha}&servicio=${encodeURIComponent(servicio)}`);
    if (!datos.abierto) {
      cont.append(elemento('span', 'vacio', `Ese día está cerrado (${datos.motivo_cerrado || 'no laborable'}). Podés cargarlo igual escribiendo la hora abajo.`));
      const manual = elemento('input');
      manual.type = 'time';
      manual.addEventListener('change', () => { $('#t-hora').value = manual.value; });
      cont.append(manual);
      return;
    }
    if (!datos.horarios.length) {
      cont.append(elemento('span', 'vacio', 'No quedan huecos libres ese día.'));
      return;
    }
    datos.horarios.forEach((h) => {
      const b = elemento('button', '', h);
      b.type = 'button';
      b.setAttribute('aria-pressed', 'false');
      b.addEventListener('click', () => {
        $$('#t-horarios button').forEach((x) => x.setAttribute('aria-pressed', 'false'));
        b.setAttribute('aria-pressed', 'true');
        $('#t-hora').value = h;
      });
      cont.append(b);
    });
  } catch (e) {
    cont.append(elemento('span', 'vacio', e.message));
  }
}

$('#t-fecha').addEventListener('change', refrescarHorariosDelForm);
$('#t-servicio').addEventListener('change', refrescarHorariosDelForm);

$('#form-turno').addEventListener('submit', async (e) => {
  e.preventDefault();
  const hora = $('#t-hora').value;
  if (!hora) { avisar('Elegí un horario.', 'error'); return; }
  try {
    await api('/turnos', {
      method: 'POST',
      body: JSON.stringify({
        nombre: $('#t-nombre').value,
        telefono: $('#t-telefono').value,
        servicio_id: $('#t-servicio').value,
        fecha: $('#t-fecha').value,
        hora,
        observaciones: $('#t-obs').value,
      }),
    });
    avisar('Turno cargado ✅');
    $('#form-turno').reset();
    limpiar($('#t-horarios'));
    cargarHoy();
  } catch (err) {
    avisar(err.message, 'error');
  }
});

// --- Bloqueos ---------------------------------------------------------------

$('#b-dia-completo').addEventListener('change', (e) => {
  $('#b-rango').style.display = e.target.checked ? 'none' : 'flex';
});

$('#form-bloqueo').addEventListener('submit', async (e) => {
  e.preventDefault();
  const diaCompleto = $('#b-dia-completo').checked;
  try {
    const r = await api('/bloqueos', {
      method: 'POST',
      body: JSON.stringify({
        fecha: $('#b-fecha').value,
        dia_completo: diaCompleto,
        ...(diaCompleto ? {} : { desde: $('#b-desde').value, hasta: $('#b-hasta').value }),
        motivo: $('#b-motivo').value,
      }),
    });
    if (r.turnos_afectados && r.turnos_afectados.length) {
      avisar(`Bloqueado. OJO: hay ${r.turnos_afectados.length} turno(s) ya reservado(s) en ese rango, avisales.`, 'error');
    } else {
      avisar('Horario bloqueado ✅');
    }
    cargarBloqueos();
    cargarHoy();
  } catch (err) {
    avisar(err.message, 'error');
  }
});

async function cargarBloqueos() {
  const cont = $('#lista-bloqueos');
  limpiar(cont);
  try {
    const datos = await api('/agenda/semana');
    const bloqueos = datos.dias.flatMap((d) => d.bloqueos);
    if (!bloqueos.length) { cont.append(elemento('div', 'vacio', 'No hay bloqueos esta semana.')); return; }
    bloqueos.forEach((b) => {
      const card = elemento('div', 'tarjeta');
      card.append(elemento('div', 'nombre', `${nombreDeFecha(b.fecha)} · ${b.diaCompleto ? 'todo el día' : `${b.horaInicio} a ${b.horaFin}`}`));
      if (b.motivo) card.append(elemento('div', 'detalle', b.motivo));
      const acciones = elemento('div', 'acciones');
      const quitar = elemento('button', '', 'Quitar');
      quitar.addEventListener('click', async () => {
        try { await api(`/bloqueos/${b.id}`, { method: 'DELETE' }); cargarBloqueos(); cargarHoy(); } catch (e) { avisar(e.message, 'error'); }
      });
      acciones.append(quitar);
      card.append(acciones);
      cont.append(card);
    });
  } catch (e) {
    avisar(e.message, 'error');
  }
}

// --- Ajustes ----------------------------------------------------------------

function filaDeServicio(s) {
  const card = elemento('div', 'tarjeta');
  card.dataset.servicio = '1';

  const campos = [
    ['nombre', 'Nombre', 'text', s.nombre],
    ['precio', 'Precio (0 = a confirmar)', 'number', s.precio],
    ['duracion_min', 'Duración (min)', 'number', s.duracion_min],
  ];
  campos.forEach(([clave, etiqueta, tipo, valor]) => {
    const l = elemento('label', '', etiqueta);
    const i = elemento('input');
    i.type = tipo;
    i.value = valor;
    i.dataset.campo = clave;
    if (tipo === 'number') { i.min = '0'; }
    card.append(l, i);
  });

  const lAct = elemento('label');
  const chk = elemento('input');
  chk.type = 'checkbox';
  chk.checked = s.activo;
  chk.dataset.campo = 'activo';
  lAct.append(chk, document.createTextNode(' Activo (se ofrece a los clientes)'));
  card.append(lAct);

  const oculto = elemento('input');
  oculto.type = 'hidden';
  oculto.dataset.campo = 'id';
  oculto.value = s.id;
  card.append(oculto);

  const alias = elemento('input');
  alias.type = 'hidden';
  alias.dataset.campo = 'alias';
  alias.value = (s.alias || []).join('|');
  card.append(alias);

  const desc = elemento('input');
  desc.type = 'hidden';
  desc.dataset.campo = 'descripcion';
  desc.value = s.descripcion || '';
  card.append(desc);

  return card;
}

function filaDeDia(numero, dia) {
  const card = elemento('div', 'tarjeta');
  card.dataset.dia = String(numero);
  const titulo = elemento('label');
  const chk = elemento('input');
  chk.type = 'checkbox';
  chk.checked = dia.abierto;
  chk.dataset.campo = 'abierto';
  titulo.append(chk, document.createTextNode(` ${DIAS[numero - 1]}`));
  card.append(titulo);

  const tramos = elemento('input');
  tramos.type = 'text';
  tramos.dataset.campo = 'tramos';
  tramos.placeholder = '10:00-13:00, 15:00-20:00';
  tramos.value = (dia.tramos || []).map((t) => `${t[0]}-${t[1]}`).join(', ');
  card.append(tramos);
  return card;
}

async function cargarAjustes() {
  try {
    const { config } = await api('/config');
    CONFIG = config;

    const contServicios = $('#editor-servicios');
    limpiar(contServicios);
    config.servicios.forEach((s) => contServicios.append(filaDeServicio(s)));

    const contHorarios = $('#editor-horarios');
    limpiar(contHorarios);
    for (let d = 1; d <= 7; d++) contHorarios.append(filaDeDia(d, config.horarios.dias[String(d)] || { abierto: false, tramos: [] }));

    $('#a-feriados').value = config.horarios.feriados.map((f) => `${f.fecha} ${f.motivo || ''}`.trim()).join('\n');
    $('#a-vacaciones').value = config.horarios.vacaciones.map((v) => `${v.desde} a ${v.hasta} ${v.motivo || ''}`.trim()).join('\n');
    $('#a-anticipacion').value = config.reglas.anticipacion_minima_min;
    $('#a-maximo').value = config.reglas.anticipacion_maxima_dias;
    $('#a-max-turnos').value = config.reglas.max_turnos_futuros_por_cliente;
    $('#a-cancelacion').value = config.reglas.cancelacion_minima_horas;
    $('#a-margen').value = config.reglas.margen_entre_turnos_min;

    const estado = await api('/estado');
    const cont = $('#estado-sistema');
    limpiar(cont);
    const filas = [
      ['Base de datos', estado.base_de_datos],
      ['IA', estado.ia.activa ? `activa (${estado.ia.modelo})` : 'apagada — el bot atiende por menú'],
      ['WhatsApp', estado.whatsapp.configurado ? `conectado (${estado.whatsapp.version_api})` : 'sin configurar'],
      ['Google Sheets', estado.sheets.configurado ? `conectado · ${estado.sheets.pendientes_de_sincronizar} pendiente(s)` : 'sin configurar'],
    ];
    filas.forEach(([k, v]) => {
      const f = elemento('div', 'detalle');
      f.append(elemento('strong', '', `${k}: `), document.createTextNode(v));
      cont.append(f);
    });

    const derivadas = await api('/conversaciones/derivadas');
    const contDer = $('#lista-derivadas');
    limpiar(contDer);
    if (!derivadas.telefonos.length) {
      contDer.append(elemento('div', 'vacio', 'Ninguna charla está esperando que respondas vos.'));
    } else {
      derivadas.telefonos.forEach((tel) => {
        const card = elemento('div', 'tarjeta');
        card.append(elemento('div', 'nombre', tel));
        const acciones = elemento('div', 'acciones');
        const wa = elemento('a', 'boton', 'Abrir WhatsApp');
        wa.href = `https://wa.me/${tel}`;
        wa.target = '_blank';
        wa.rel = 'noopener';
        const volver = elemento('button', '', 'Devolver al bot');
        volver.addEventListener('click', async () => {
          try {
            await api(`/conversaciones/${tel}/bot`, { method: 'POST', body: JSON.stringify({ activar: true }) });
            avisar('El bot vuelve a atender esa charla.');
            cargarAjustes();
          } catch (e) { avisar(e.message, 'error'); }
        });
        acciones.append(wa, volver);
        card.append(acciones);
        contDer.append(card);
      });
    }
  } catch (e) {
    avisar(e.message, 'error');
  }
}

$('#agregar-servicio').addEventListener('click', () => {
  const id = `servicio_${Date.now().toString(36)}`;
  $('#editor-servicios').append(filaDeServicio({ id, nombre: 'Servicio nuevo', precio: 0, duracion_min: 30, activo: true, alias: [], descripcion: '' }));
});

function parsearTramos(texto) {
  return texto
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean)
    .map((t) => {
      const [desde, hasta] = t.split('-').map((x) => x.trim());
      return [desde, hasta];
    });
}

$('#guardar-ajustes').addEventListener('click', async () => {
  if (!CONFIG) return;
  const nueva = JSON.parse(JSON.stringify(CONFIG));

  nueva.servicios = $$('#editor-servicios [data-servicio]').map((card) => {
    const valor = (campo) => card.querySelector(`[data-campo="${campo}"]`);
    return {
      id: valor('id').value,
      nombre: valor('nombre').value,
      descripcion: valor('descripcion').value,
      precio: Number(valor('precio').value) || 0,
      duracion_min: Number(valor('duracion_min').value) || 30,
      activo: valor('activo').checked,
      alias: valor('alias').value ? valor('alias').value.split('|').filter(Boolean) : [],
    };
  });

  $$('#editor-horarios [data-dia]').forEach((card) => {
    const numero = card.dataset.dia;
    const abierto = card.querySelector('[data-campo="abierto"]').checked;
    const tramos = parsearTramos(card.querySelector('[data-campo="tramos"]').value);
    nueva.horarios.dias[numero] = { abierto, tramos: abierto ? tramos : [] };
  });

  nueva.horarios.feriados = $('#a-feriados').value
    .split('\n').map((l) => l.trim()).filter(Boolean)
    .map((l) => { const [fecha, ...resto] = l.split(' '); return { fecha, motivo: resto.join(' ') }; });

  nueva.horarios.vacaciones = $('#a-vacaciones').value
    .split('\n').map((l) => l.trim()).filter(Boolean)
    .map((l) => {
      const m = l.match(/(\d{4}-\d{2}-\d{2})\s*(?:a|hasta|-)\s*(\d{4}-\d{2}-\d{2})\s*(.*)/);
      return m ? { desde: m[1], hasta: m[2], motivo: (m[3] || '').trim() } : null;
    })
    .filter(Boolean);

  nueva.reglas.anticipacion_minima_min = Number($('#a-anticipacion').value);
  nueva.reglas.anticipacion_maxima_dias = Number($('#a-maximo').value);
  nueva.reglas.max_turnos_futuros_por_cliente = Number($('#a-max-turnos').value);
  nueva.reglas.cancelacion_minima_horas = Number($('#a-cancelacion').value);
  nueva.reglas.margen_entre_turnos_min = Number($('#a-margen').value);

  try {
    await api('/config', { method: 'PUT', body: JSON.stringify({ config: nueva }) });
    avisar('Cambios guardados ✅ El bot ya los está usando.');
    await cargarConfigBasica();
    cargarAjustes();
  } catch (e) {
    avisar(e.message, 'error');
  }
});

$('#sync-sheets').addEventListener('click', async () => {
  try {
    const r = await api('/sheets/sync', { method: 'POST' });
    avisar(`Planilla actualizada: ${r.turnos} turno(s).`);
  } catch (e) {
    avisar(e.message, 'error');
  }
});

// --- Arranque ---------------------------------------------------------------

async function cargarConfigBasica() {
  const { config, servicios } = await api('/config');
  CONFIG = config;
  $('#titulo-negocio').textContent = config.negocio.nombre;
  $('#subtitulo').textContent = 'Agenda y turnos';
  const select = $('#t-servicio');
  limpiar(select);
  servicios.forEach((s) => {
    const opt = elemento('option', '', `${s.nombre} (${s.duracion_min} min)`);
    opt.value = s.id;
    select.append(opt);
  });
  const hoy = fechaISO(new Date());
  $('#t-fecha').value = hoy;
  $('#b-fecha').value = hoy;
}

async function iniciar() {
  try {
    await api('/sesion');
    mostrarApp();
    await cargarConfigBasica();
    await cargarHoy();
  } catch {
    mostrarIngreso();
  }
}

iniciar();
