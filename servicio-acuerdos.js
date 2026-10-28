/* Acuerdos del trabajo. La autorización y las transiciones se verifican en SQL. */
(function (scope) {
  'use strict';

  const PROJECT = 'qglsonbcsncgekzbfafk.supabase.co';
  const STATUS = {
    propuesta: 'Esperando tu respuesta', aceptado: 'Aceptado por el cliente',
    rechazado: 'No aceptado', reemplazado: 'Reemplazado por otra propuesta',
    en_camino: 'En camino · aviso del proveedor', llego: 'Llegada informada por el proveedor',
    visita_confirmada: 'Llegada confirmada por el cliente', retiro_realizado: 'Retiro informado por el proveedor',
    devolucion_informada: 'Devolución informada por el proveedor', devuelto: 'Devolución confirmada por el cliente',
    recibido: 'Reclamo recibido', en_revision: 'En revisión', resuelto: 'Resuelto', cerrado: 'Cerrado'
  };
  const TITLES = { visita: 'La visita y quién viene', adicional: 'Trabajo adicional', retiro: 'Retiro de un equipo' };
  let active = null;

  function safePhotoRef(value) {
    if (typeof value !== 'string' || value.length > 512) return null;
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/[1-9][0-9]*\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$/i.test(value) ? value : null;
  }
  function safeImageUrl(value) {
    if (typeof value !== 'string' || value.length > 8192) return null;
    try {
      const url = new URL(value);
      if (url.protocol !== 'https:' || url.hostname !== PROJECT || url.port || url.username || url.password || url.hash) return null;
      const prefix = '/storage/v1/object/sign/servicio-evidencias/';
      if (!url.pathname.startsWith(prefix) || !safePhotoRef(url.pathname.slice(prefix.length))) return null;
      if ([...url.searchParams.keys()].some(key => !['token', 'download', 'width', 'height', 'resize', 'quality'].includes(key)) || !url.searchParams.get('token')) return null;
      return url.href;
    } catch (_) { return null; }
  }
  function money(value) {
    const number = Number(value);
    return Number.isFinite(number) ? new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 2 }).format(number) : 'Monto sin confirmar';
  }
  function dateOnly(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return 'Fecha sin confirmar';
    const [year, month, day] = value.split('-');
    return day + '/' + month + '/' + year;
  }
  function stamp(value) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '' : date.toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' });
  }
  function errorText(error) {
    const text = String(error && (error.message || error.error_description || error.details) || error || '');
    if (/version|desactualiz|stale|conflict|cambi[oó]/i.test(text)) return 'Este acuerdo cambió. Actualizá la información y revisá la nueva versión antes de responder.';
    if (/schema cache|could not find|does not exist|PGRST202|404|servicio.*not found/i.test(text)) return 'Los acuerdos del trabajo todavía no están disponibles. Podés seguir usando el chat y volver a intentar más tarde.';
    if (/permiso|permission|not authorized|forbidden|403|42501/i.test(text)) return 'No tenés permiso para esta acción o el trabajo cambió de estado. Actualizá la información.';
    if (/fetch|network|conexi|offline|timeout/i.test(text)) return 'No se pudo confirmar el resultado. Revisá tu conexión y actualizá la información antes de volver a intentar.';
    if (/presupuesto original ya no admite|presupuesto aceptado pendiente/i.test(text)) return 'Este presupuesto ya no admite cambios. Actualizá el chat para revisar el estado del trabajo.';
    if (/adicional aceptado no se modifica|retiro confirmado no se modifica/i.test(text)) return 'Este acuerdo ya fue aceptado y no se puede editar. Coordiná lo que pasó por el chat o registrá un reclamo.';
    if (/fecha de visita|fecha de devoluci/i.test(text)) return 'Elegí una fecha desde hoy y dentro de los próximos doce meses.';
    if (/límite diario/i.test(text)) return 'Llegaste al límite de acciones de hoy. Conservá la información y volvé a intentar más tarde.';
    if (/Foto no válida|foto.*trabajo/i.test(text)) return 'No se pudo vincular una foto a este trabajo. Volvé a adjuntarla.';
    if (/sin código HTML|sin HTML/i.test(text)) return 'Escribí la información como texto, sin etiquetas HTML ni los signos < y >.';
    return 'No se pudo confirmar el cambio. Actualizá la información antes de volver a intentar.';
  }
  function receiptText(row) {
    const d = row.datos || {};
    return [
      'Tratto · Constancia de retiro', 'Acuerdo: ' + row.id, 'Trabajo: ' + row.match_id,
      'Estado: ' + (STATUS[row.estado] || row.estado), 'Creado: ' + stamp(row.created_at),
      'Último cambio: ' + stamp(row.updated_at), '', 'Equipo: ' + (d.equipo || ''),
      'Marca: ' + (d.marca || 'Sin indicar'), 'Modelo: ' + (d.modelo || 'Sin indicar'),
      'Número de serie: ' + (d.serie || 'Sin indicar'), 'Estado al retirar: ' + (d.estado_equipo || ''),
      'Accesorios: ' + (d.accesorios || 'Sin indicar'), 'Devolución prevista: ' + dateOnly(d.devolucion_prevista),
      'Nota: ' + (d.nota || ''), 'Fotos guardadas en Tratto: ' + (d.fotos || []).map(safePhotoRef).filter(Boolean).length, '',
      'La propuesta solo queda aceptada cuando el cliente la confirma en Tratto.',
      'Esta constancia no acredita por sí sola un pago, una devolución o una garantía de Tratto.'
    ].join('\n');
  }

  function mount(container, options) {
    if (!container || !options || typeof options.request !== 'function') throw new Error('Acuerdos: faltan contenedor o conexión.');
    if (!/^\d+$/.test(String(options.matchId)) || !['cliente', 'proveedor'].includes(options.role)) throw new Error('Acuerdos: trabajo o rol inválido.');
    if (active) active.unmount();
    const doc = container.ownerDocument;
    const state = { alive: true, loading: false, busy: false, agreements: [], complaints: [], events: [], baseBudgetId: options.baseBudgetId || options.acceptedBudgetId || null, loaded: false, timer: null };
    const controller = { refresh, unmount, ready: null };
    active = controller;

    function el(tag, className, text) {
      const node = doc.createElement(tag);
      if (className) node.className = className;
      if (text !== undefined && text !== null) node.textContent = String(text);
      return node;
    }
    function button(text, fn, kind) {
      const node = el('button', 'sa-button' + (kind ? ' sa-button-' + kind : ''), text);
      node.type = 'button';
      node.addEventListener('click', fn);
      return node;
    }
    const area = el('section', 'sa-panel');
    area.setAttribute('aria-label', 'Acuerdos del trabajo');
    const head = el('div', 'sa-heading');
    const intro = el('div');
    intro.append(el('h2', 'sa-title', 'Acuerdos del trabajo'), el('p', 'sa-intro', 'Dejen por escrito la visita, los cambios y lo que se retira. Cada propuesta necesita una respuesta del cliente.'));
    const reload = button('Actualizar', () => refresh(), 'subtle');
    head.append(intro, reload);
    const notice = el('p', 'sa-feedback'); notice.setAttribute('role', 'status'); notice.setAttribute('aria-live', 'polite'); notice.tabIndex = -1;
    const body = el('div', 'sa-body');
    area.append(head, notice, body);
    container.replaceChildren(area);

    function feedback(text, bad) {
      if (!state.alive) return;
      notice.textContent = text || '';
      notice.classList.toggle('sa-feedback-error', !!bad);
      notice.setAttribute('role', bad ? 'alert' : 'status');
    }
    async function request(path, payload) {
      const result = await options.request(path, payload || {});
      if (result && !Array.isArray(result) && (result.error || (result.code && !result.id))) throw new Error(result.message || result.error || result.code);
      return result;
    }
    async function refresh({ preserveMessage = false } = {}) {
      if (!state.alive || state.loading) return false;
      state.loading = true;
      reload.disabled = true;
      if (!preserveMessage) feedback('Cargando los acuerdos…');
      try {
        const id = encodeURIComponent(String(options.matchId));
        const [agreements, complaints, budgets] = await Promise.all([
          request('/rest/v1/servicio_acuerdos?match_id=eq.' + id + '&order=created_at.desc&select=*'),
          request('/rest/v1/servicio_reclamos?match_id=eq.' + id + '&order=created_at.desc&select=*'),
          state.baseBudgetId ? Promise.resolve([]) : request('/rest/v1/mensajes?match_id=eq.' + id + '&tipo=eq.presupuesto&estado_presupuesto=eq.aceptado&order=created_at.asc&select=id')
        ]);
        if (!state.alive) return false;
        if (!Array.isArray(agreements) || !Array.isArray(complaints) || !Array.isArray(budgets)) throw new Error('Respuesta inválida');
        state.agreements = agreements;
        state.complaints = complaints;
        if (!state.baseBudgetId && budgets[0]) state.baseBudgetId = budgets[0].id;
        const ids = complaints.map(row => String(row.id)).filter(id => /^[0-9a-f-]{36}$/i.test(id));
        state.events = ids.length ? await request('/rest/v1/servicio_reclamo_eventos?reclamo_id=in.(' + ids.join(',') + ')&order=created_at.asc&select=*') : [];
        if (!state.alive) return false;
        if (!Array.isArray(state.events)) throw new Error('Respuesta de historial inválida');
        state.loaded = true;
        render();
        if (!preserveMessage) feedback('Información actualizada.');
        return true;
      } catch (error) {
        if (!state.alive) return false;
        feedback(errorText(error), true);
        if (!state.loaded) body.replaceChildren(el('p', 'sa-empty', 'Los acuerdos no se pudieron cargar. El chat sigue disponible.'));
        return false;
      } finally {
        state.loading = false;
        if (state.alive) reload.disabled = false;
      }
    }
    async function mutate(rpc, data, success) {
      if (state.busy || state.loading || !state.alive) return false;
      state.busy = true;
      area.setAttribute('aria-busy', 'true');
      area.querySelectorAll('button').forEach(node => { node.disabled = true; });
      feedback('Guardando…');
      try {
        await request('/rest/v1/rpc/' + rpc, { method: 'POST', body: data });
        if (!state.alive) return false;
        const refreshed = await refresh({ preserveMessage: true });
        if (state.alive) {
          feedback(refreshed ? success : 'El cambio se guardó, pero no se pudo actualizar la información. Tocá Actualizar para comprobar cómo quedó.', !refreshed);
          notice.focus({ preventScroll: true });
        }
        if (typeof options.refreshChat === 'function') await options.refreshChat();
        return true;
      } catch (error) {
        if (state.alive) {
          const message = errorText(error);
          await refresh({ preserveMessage: true });
          feedback(message, true);
          notice.focus({ preventScroll: true });
        }
        return false;
      } finally {
        state.busy = false;
        if (state.alive) {
          area.removeAttribute('aria-busy');
          area.querySelectorAll('button').forEach(node => { node.disabled = false; });
        }
      }
    }
    function info(parent, label, value) {
      if (value === undefined || value === null || value === '') return;
      const item = el('div', 'sa-fact'); item.append(el('dt', '', label), el('dd', '', value)); parent.append(item);
    }
    function photos(parent, values, description) {
      const refs = (Array.isArray(values) ? values : []).map(safePhotoRef).filter(Boolean);
      if (!refs.length) return;
      if (typeof options.resolveImage !== 'function') { parent.append(el('p', 'sa-help', 'Fotos guardadas. No se pudieron abrir en este momento.')); return; }
      const strip = el('div', 'sa-photos'); parent.append(strip);
      refs.forEach((ref, i) => {
        const placeholder = el('span', 'sa-help', 'Cargando foto…');strip.append(placeholder);
        Promise.resolve().then(() => options.resolveImage(ref)).then(value => {
          if (!state.alive || !placeholder.isConnected) return;
          const url = safeImageUrl(value);
          if (!url) throw new Error('Foto no disponible');
          const link = el('a'); link.href = url; link.target = '_blank'; link.rel = 'noopener noreferrer'; link.referrerPolicy = 'no-referrer';
          const img = el('img'); img.src = url; img.alt = description + ' ' + (i + 1); img.loading = 'lazy'; img.referrerPolicy = 'no-referrer';
          img.addEventListener('error', () => { link.replaceWith(el('span', 'sa-help', 'Foto no disponible. Actualizá para volver a abrirla.')); }, { once: true });
          link.append(img); placeholder.replaceWith(link);
        }).catch(() => { if (state.alive && placeholder.isConnected) placeholder.textContent = 'Foto no disponible. Actualizá para volver a abrirla.'; });
      });
    }
    function details(title, subtitle) {
      const box = el('details', 'sa-section');
      const summary = el('summary', 'sa-summary', title); box.append(summary);
      const inner = el('div', 'sa-section-body');
      if (subtitle) inner.append(el('p', 'sa-help', subtitle));
      box.append(inner); return { box, inner };
    }
    function retentionNotice(parent) {
      const note = el('p', 'sa-help', 'Si borrás tu cuenta con un reclamo abierto o un retiro pendiente, se conserva un resguardo mínimo durante 180 días. Las fotos son privadas y no forman parte de ese resguardo. ');
      const guide = el('a', '', 'Cómo funcionan estos acuerdos'); guide.href = '/confianza.html';
      const privacy = el('a', '', 'Baja y conservación'); privacy.href = '/privacidad.html#baja-y-conservacion';
      note.append(guide, doc.createTextNode(' · '), privacy);parent.append(note);
    }
    function field(form, name, label, { type = 'text', required = false, max = 500, value = '', help = '', min = '', step = '' } = {}) {
      const wrap = el('label', 'sa-field'); wrap.append(el('span', 'sa-label', label));
      const control = el(type === 'textarea' ? 'textarea' : 'input');
      if (type !== 'textarea') control.type = type;
      control.name = name; control.required = required; control.value = String(value || '');
      if (!['date', 'number', 'file'].includes(type)) control.maxLength = max;
      if (min) control.min = min;
      if (step) control.step = step;
      if (type === 'number') control.inputMode = 'decimal';
      if (type === 'textarea') control.rows = 3;
      if (required) wrap.firstChild.append(el('span', 'sa-required', ' · obligatorio'));
      wrap.append(control);
      if (help) wrap.append(el('span', 'sa-help', help));
      form.append(wrap);return control;
    }
    function photoField(form, name, label, maximum = 5) {
      if (typeof options.uploadImage === 'function') {
        const control = field(form, name, label + ' · opcional', { type: 'file', help: 'Hasta ' + maximum + ' foto' + (maximum > 1 ? 's' : '') + '. No incluyas documentos, caras de terceros ni datos que no hagan falta.' });
        control.accept = 'image/jpeg,image/png,image/webp';
        control.multiple = maximum > 1;
        return { control, async get() {
          const files = Array.from(control.files || []);
          if (files.length > maximum) throw new Error('Seleccioná como máximo ' + maximum + ' fotos.');
          if (files.some(file => file.size > 5 * 1024 * 1024 || !/^image\/(jpeg|png|webp)$/.test(file.type))) throw new Error('Usá fotos JPG, PNG o WebP de hasta 5 MB.');
          const urls = [];
          for (const file of files) {
            const url = await options.uploadImage(file);
            if (!safePhotoRef(url)) throw new Error('No se pudo adjuntar una de las fotos.');
            urls.push(url);
          }
          return urls;
        } };
      }
      form.append(el('p', 'sa-help', label + ': no se pueden adjuntar fotos en este momento. Podés continuar sin foto.'));
      return { control: null, async get() { return []; } };
    }
    function submit(form, text, handler) {
      const send = el('button', 'sa-button sa-button-primary', text); send.type = 'submit';
      const problem = el('p', 'sa-form-error'); problem.setAttribute('role', 'alert');
      form.append(problem, send);
      form.addEventListener('submit', async event => {
        event.preventDefault(); if (state.busy || !form.reportValidity()) return;
        send.disabled = true; problem.textContent = '';
        try { await handler(); } catch (error) { problem.textContent = error.message || 'Revisá los datos.'; }
        finally { if (send.isConnected && !state.busy) send.disabled = false; }
      });
    }
    function proposalForm(type, replacement) {
      const d = replacement && replacement.datos || {};
      const form = el('form', 'sa-form');
      const values = {};
      if (type === 'visita') {
        values.nombre_visitante = field(form, 'nombre_visitante', 'Nombre de quien va a realizar el trabajo', { required: true, max: 120, value: d.nombre_visitante, help: 'Si va otra persona, indicá su nombre. El cliente debe aceptar el cambio antes de la visita.' });
        values.dia = field(form, 'dia', 'Día de la visita', { type: 'date', required: true, value: d.dia });
        values.franja = field(form, 'franja', 'Horario o franja', { required: true, max: 80, value: d.franja, help: 'Por ejemplo: de 14 a 16 hs.' });
        values.nota = field(form, 'nota', 'Aclaraciones · opcional', { type: 'textarea', max: 1000, value: d.nota });
        values.photo = photoField(form, 'foto', 'Foto de quien realiza la visita', 1);
        form.append(el('p', 'sa-notice', 'La persona y la foto son informadas por el proveedor. Tratto no comprobó su identidad, matrícula ni antecedentes.'));
      } else if (type === 'adicional') {
        values.descripcion = field(form, 'descripcion', 'Qué trabajo se agrega', { type: 'textarea', required: true, max: 1000, value: d.descripcion, help: 'Describí solo lo que no estaba incluido en el presupuesto original.' });
        values.monto = field(form, 'monto', 'Precio del adicional en pesos', { type: 'number', required: true, min: '0.01', step: '0.01', value: d.monto }); values.monto.max = '100000000';
        values.incluye = field(form, 'incluye', 'Qué incluye y qué no incluye', { type: 'textarea', required: true, max: 1000, value: d.incluye });
        values.plazo = field(form, 'plazo', 'Plazo acordado', { required: true, max: 200, value: d.plazo });
        form.append(el('p', 'sa-notice', 'No empieces el adicional hasta que el cliente lo acepte. El presupuesto original se conserva. Aceptarlo no realiza ningún cobro.'));
      } else {
        values.equipo = field(form, 'equipo', 'Equipo o bien que se retira', { required: true, max: 160, value: d.equipo });
        for (const [key, label, max] of [['marca', 'Marca · opcional', 100], ['modelo', 'Modelo · opcional', 100], ['serie', 'Número de serie · opcional', 100]]) values[key] = field(form, key, label, { max, value: d[key] });
        values.estado_equipo = field(form, 'estado_equipo', 'Estado al retirar', { type: 'textarea', required: true, max: 1000, value: d.estado_equipo, help: 'Incluí marcas, fallas o daños que ya tenía.' });
        values.accesorios = field(form, 'accesorios', 'Accesorios que se lleva · opcional', { max: 500, value: d.accesorios });
        values.devolucion_prevista = field(form, 'devolucion_prevista', 'Fecha prevista de devolución', { type: 'date', required: true, value: d.devolucion_prevista });
        values.nota = field(form, 'nota', 'Aclaraciones · opcional', { type: 'textarea', max: 1000, value: d.nota });
        values.photo = photoField(form, 'fotos', 'Fotos del equipo y su estado');
      }
      retentionNotice(form);
      submit(form, replacement ? 'Proponer el cambio al cliente' : 'Enviar propuesta al cliente', async () => {
        const data = {};
        for (const [key, control] of Object.entries(values)) if (key !== 'photo') data[key] = control.value.trim();
        if (values.photo) {
          const urls = await values.photo.get();
          if (type === 'visita') data.foto_ref = urls[0] || safePhotoRef(d.foto_ref) || null;
          else data.fotos = urls.length ? urls : (d.fotos || []).map(safePhotoRef).filter(Boolean);
        }
        if (type === 'adicional') {
          data.monto = Number(data.monto);
          data.presupuesto_base_id = Number(d.presupuesto_base_id || state.baseBudgetId);
          if (!data.presupuesto_base_id) throw new Error('Actualizá el chat para encontrar el presupuesto aceptado.');
        }
        if (type === 'visita' && data.nombre_visitante.length < 2 || type === 'retiro' && data.equipo.length < 2 || type === 'adicional' && (data.descripcion.length < 5 || data.incluye.length < 5 || data.plazo.length < 2)) throw new Error('Completá la información con una descripción clara.');
        await mutate('servicio_proponer', { p_match_id: Number(options.matchId), p_tipo: type, p_datos: data, p_reemplaza_id: replacement ? replacement.id : null }, 'Propuesta guardada. Falta que el cliente la acepte.');
      });
      return form;
    }
    function agreementCard(row) {
      const d = row.datos || {};
      const card = el('article', 'sa-agreement' + (['reemplazado', 'rechazado'].includes(row.estado) ? ' sa-history' : ''));
      const top = el('div', 'sa-card-top'); top.append(el('h3', 'sa-subtitle', TITLES[row.tipo] || 'Acuerdo'));
      const badge = el('span', 'sa-status', row.estado === 'propuesta' && options.role === 'proveedor' ? 'Esperando al cliente' : STATUS[row.estado] || 'Estado sin confirmar');
      badge.dataset.state = row.estado; top.append(badge); card.append(top);
      card.append(el('p', 'sa-date', 'Propuesto el ' + stamp(row.created_at)));
      const facts = el('dl', 'sa-facts');
      if (row.tipo === 'visita') {
        info(facts, 'Va a ir', d.nombre_visitante); info(facts, 'Día', dateOnly(d.dia)); info(facts, 'Horario', d.franja); info(facts, 'Aclaraciones', d.nota);
        card.append(facts); photos(card, [d.foto_ref], 'Foto informada por el proveedor');
        card.append(el('p', 'sa-help', 'Datos informados por el proveedor. No equivalen a una identidad comprobada por Tratto.'));
      } else if (row.tipo === 'adicional') {
        info(facts, 'Trabajo que se agrega', d.descripcion); info(facts, 'Precio del adicional', money(d.monto)); info(facts, 'Incluye / no incluye', d.incluye); info(facts, 'Plazo', d.plazo);
        card.append(facts, el('p', 'sa-help', 'Es un acuerdo aparte del presupuesto original. Aceptarlo no cobra dinero ni autoriza otros cambios.'));
      } else {
        for (const [key, label] of [['equipo','Equipo'],['marca','Marca'],['modelo','Modelo'],['serie','Número de serie'],['estado_equipo','Estado al retirar'],['accesorios','Accesorios'],['nota','Aclaraciones']]) info(facts, label, d[key]);
        info(facts, 'Devolución prevista', dateOnly(d.devolucion_prevista)); card.append(facts); photos(card, d.fotos, 'Foto del equipo');
        card.append(button('Guardar constancia de retiro', () => {
          const file = new Blob([receiptText(row)], { type: 'text/plain;charset=utf-8' }); const url = URL.createObjectURL(file);
          const link = el('a'); link.href = url; link.download = 'tratto-retiro-' + String(row.id).replace(/[^a-z0-9-]/gi,'') + '.txt';
          doc.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
        }, 'subtle'));
      }
      const actions = el('div', 'sa-actions');
      if (row.estado === 'propuesta' && options.role === 'cliente') {
        retentionNotice(card);
        const ack = el('label', 'sa-check'); const check = el('input'); check.type = 'checkbox';
        ack.append(check, el('span', '', row.tipo === 'visita' ? 'Revisé quién viene, el día y el horario.' : row.tipo === 'retiro' ? 'Revisé el equipo, su estado y la fecha prevista de devolución.' : 'Revisé el precio, lo que incluye y el plazo del adicional.'));
        card.append(ack);
        actions.append(button('Aceptar ' + (row.tipo === 'adicional' ? 'adicional' : row.tipo === 'retiro' ? 'constancia' : 'visita'), () => {
          if (!check.checked) { feedback('Revisá los datos y marcá la confirmación antes de aceptar.', true); check.focus(); return; }
          mutate('servicio_responder', { p_id: row.id, p_aceptar: true, p_version: row.version }, 'Aceptación guardada.');
        }, 'primary'), button('No aceptar', () => mutate('servicio_responder', { p_id: row.id, p_aceptar: false, p_version: row.version }, 'La propuesta no fue aceptada. Podés coordinar otra opción por el chat.'), 'subtle'));
      }
      const next = row.tipo === 'visita'
        ? options.role === 'proveedor' ? { aceptado:['en_camino','Avisar que estoy en camino'], en_camino:['llego','Avisar que llegué'] }[row.estado] : { llego:['visita_confirmada','Confirmar que llegó la persona acordada'] }[row.estado]
        : row.tipo === 'retiro' ? options.role === 'proveedor' ? { aceptado:['retiro_realizado','Informar que retiré el equipo'], retiro_realizado:['devolucion_informada','Informar que devolví el equipo'] }[row.estado] : { retiro_realizado:['devuelto','Confirmar que recibí el equipo'], devolucion_informada:['devuelto','Confirmar que recibí el equipo'] }[row.estado] : null;
      if (next) actions.append(button(next[1], () => mutate('servicio_cambiar_estado', { p_id: row.id, p_estado: next[0], p_version: row.version }, 'Estado guardado.'), 'primary'));
      if (actions.childNodes.length) card.append(actions);
      if (options.role === 'proveedor' && (row.tipo === 'visita' ? !['rechazado','reemplazado','visita_confirmada'].includes(row.estado) : row.estado === 'propuesta')) {
        const edit = details(row.tipo === 'visita' ? 'Proponer otro horario o persona' : 'Proponer una corrección', 'Se guarda una propuesta nueva y el cliente tiene que revisarla. La constancia anterior queda en el historial.');
        edit.inner.append(proposalForm(row.tipo, row));card.append(edit.box);
      }
      return card;
    }
    function complaintForm() {
      const form = el('form', 'sa-form');
      const motive = field(form, 'motivo', 'Qué problema ocurrió', { required: true, max: 120, help: 'Por ejemplo: no se presentó, cambió el precio, daño o equipo sin devolver.' });
      const detail = field(form, 'detalle', 'Contanos qué pasó', { type: 'textarea', required: true, max: 4000 });
      const evidence = photoField(form, 'fotos', 'Fotos que ayudan a entender el problema');
      form.append(el('p', 'sa-notice', 'La otra parte puede ver el reclamo y responder. Compartí solo lo necesario. Un reclamo recibido no significa que ya se haya resuelto ni que Tratto garantice un reintegro.'));
      form.append(el('p', 'sa-help', 'Si hay peligro inmediato, comunicate con los servicios de emergencia de tu zona. Tratto no es un servicio de emergencias.'));
      retentionNotice(form);
      submit(form, 'Registrar reclamo', async () => {
        if (motive.value.trim().length < 3 || detail.value.trim().length < 10) throw new Error('Explicá el motivo y qué pasó con un poco más de detalle.');
        await mutate('servicio_abrir_reclamo', { p_match_id: Number(options.matchId), p_motivo: motive.value.trim(), p_detalle: detail.value.trim(), p_fotos: await evidence.get() }, 'Reclamo registrado. Podés seguir su estado y agregar información acá.');
      });
      return form;
    }
    function complaintCard(row) {
      const card = el('article', 'sa-agreement'); const top = el('div', 'sa-card-top');
      top.append(el('h3', 'sa-subtitle', row.motivo), el('span', 'sa-status', STATUS[row.estado] || 'Estado sin confirmar'));
      card.append(top, el('p', 'sa-date', 'Reclamo ' + row.id + ' · ' + stamp(row.created_at)), el('p', 'sa-copy', row.detalle)); photos(card, row.fotos, 'Foto aportada al reclamo');
      const events = state.events.filter(event => event.reclamo_id === row.id);
      if (events.length) {
        const list = el('ol', 'sa-events');
        events.forEach(event => {
          const item = el('li'); const who = !event.autor ? 'Soporte de Tratto' : event.autor === options.userId ? 'Vos' : 'La otra parte';
          item.append(el('p', 'sa-event-author', who + ' · ' + stamp(event.created_at)), el('p', 'sa-copy', event.texto || 'Cambio de estado registrado.'));
          photos(item, event.fotos, 'Foto agregada al reclamo'); list.append(item);
        });card.append(list);
      }
      if (!['resuelto', 'cerrado'].includes(row.estado)) {
        const add = details('Agregar información al reclamo'); const form = el('form', 'sa-form');
        const comment = field(form, 'texto', 'Información adicional', { type: 'textarea', required: true, max: 4000 });
        const evidence = photoField(form, 'fotos', 'Fotos adicionales');
        submit(form, 'Agregar al reclamo', async () => {
          if (comment.value.trim().length < 3) throw new Error('Agregá un mensaje que explique la información.');
          await mutate('servicio_comentar_reclamo', { p_id: row.id, p_texto: comment.value.trim(), p_fotos: await evidence.get() }, 'Información agregada al reclamo.');
        }); add.inner.append(form);card.append(add.box);
      }
      return card;
    }
    function render() {
      if (!state.alive) return;
      body.replaceChildren();
      const visits = state.agreements.filter(row => row.tipo === 'visita' && !['reemplazado','rechazado'].includes(row.estado));
      if (!visits.length) body.append(el('p', 'sa-empty', options.role === 'proveedor' ? 'Antes de ir, informá quién va y proponé el día y el horario.' : 'Todavía no hay una visita acordada. Pedile al proveedor que informe quién va a ir y proponga un horario.'));
      state.agreements.forEach(row => body.append(agreementCard(row)));
      if (options.role === 'proveedor') {
        const create = details('Proponer una visita', 'El cliente revisa y acepta antes de la visita.');
        create.inner.append(proposalForm('visita')); body.append(create.box);
        const extra = details('Proponer un trabajo adicional', 'Solo para tareas que no estaban incluidas en el presupuesto aceptado.');
        extra.inner.append(proposalForm('adicional'));body.append(extra.box);
        const withdrawal = details('Preparar una constancia de retiro', 'Completala y pedile al cliente que la revise antes de llevarte el equipo.');
        withdrawal.inner.append(proposalForm('retiro'));body.append(withdrawal.box);
      }
      const complaints = details('Problemas y reclamos' + (state.complaints.length ? ' · ' + state.complaints.length : ''), 'Acá queda el registro y las respuestas sobre este trabajo.');
      state.complaints.forEach(row => complaints.inner.append(complaintCard(row)));
      const open = details('Registrar un problema');open.inner.append(complaintForm());complaints.inner.append(open.box);body.append(complaints.box);
    }
    function unmount() {
      state.alive = false;
      if (state.timer) clearTimeout(state.timer);
      container.replaceChildren();
      if (active === controller) active = null;
    }
    controller.ready = refresh();
    return controller;
  }

  const api = { mount, unmount() { if (active) active.unmount(); }, safePhotoRef, safeImageUrl, money, dateOnly, errorText, receiptText };
  scope.TrattoAcuerdos = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
