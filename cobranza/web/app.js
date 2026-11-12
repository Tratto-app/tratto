// Las pantallas de Cobranza sin vueltas. Sin librerías: arma el HTML con una
// función chica (h) que siempre escribe los datos como texto, nunca como HTML.
// `pedir(metodo, ruta, cuerpo)` habla con el servidor; en la demo, el
// "servidor" corre acá mismo con datos de ejemplo.
import { formatearMonto, fechaLarga, fechaCorta, mostrarTelefono, partirTexto, leerFilas, leerPacientes, ahoraAR, nombreMes, diasEntre } from '../src/logica.js';
import { RUBROS } from '../src/rubros.js';
import { leerXlsx } from '../src/xlsx.js';

const ICONOS = {
  inicio: '<path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10v9.5h13V10"/>',
  avisos: '<path d="M6 16v-5a6 6 0 1 1 12 0v5l1.5 2h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>',
  clientes: '<circle cx="9" cy="8.5" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 5.5a3.5 3.5 0 0 1 0 6.5M18 14.5a6 6 0 0 1 3.5 5.5"/>',
  ajustes: '<circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/>',
  mas: '<path d="M12 5v14M5 12h14"/>',
  atras: '<path d="M15 5l-7 7 7 7"/>',
};
function icono(nombre) {
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('viewBox', '0 0 24 24');
  s.setAttribute('aria-hidden', 'true');
  s.innerHTML = ICONOS[nombre];
  return s;
}
function h(etiqueta, props, ...hijos) {
  const el = document.createElement(etiqueta);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (['value', 'checked', 'disabled', 'hidden', 'selected'].includes(k)) el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of hijos.flat(Infinity)) if (c != null && c !== false) el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  return el;
}
const plural = (n, uno, muchos) => `${n} ${n === 1 ? uno : muchos}`;
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
const cuando = (iso) => new Date(iso).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'America/Argentina/Buenos_Aires' });

// La contraseña se estira acá (600.000 vueltas) y al servidor solo viaja el resultado.
async function derivar(clave, salHex) {
  const sal = Uint8Array.from(salHex.match(/../g).map((b) => parseInt(b, 16)));
  const llave = await crypto.subtle.importKey('raw', new TextEncoder().encode(clave), 'PBKDF2', false, ['deriveBits']);
  return hex(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: sal, iterations: 600000 }, llave, 256));
}
function contraste(color) {
  const n = parseInt(color.slice(1), 16);
  const [r, g, b] = [n >> 16, (n >> 8) & 255, n & 255].map((v) => { const x = v / 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.42 ? '#17201c' : '#ffffff';
}
function chipDias(dias, vence) {
  if (dias > 0) return h('span', { class: 'chip mal' }, `hace ${plural(dias, 'día', 'días')}`);
  if (dias === 0) return h('span', { class: 'chip ojo' }, 'vence hoy');
  if (dias >= -3) return h('span', { class: 'chip ojo' }, `en ${plural(-dias, 'día', 'días')}`);
  return h('span', { class: 'chip' }, fechaCorta(vence).slice(0, 5));
}
const ESTADO_MSJ = { enviado: ['Enviado', ''], entregado: ['Entregado', 'bien'], leido: ['Leído', 'bien'], fallido: ['No llegó', 'mal'] };
const MEDIO = { efectivo: 'en efectivo', transferencia: 'por transferencia', mercadopago: 'por Mercado Pago' };

export function iniciar({ pedir, copia = null }) {
  const raiz = document.getElementById('app');
  const S = { instalada: true, sesion: false, demo: false, local: false, rubro: RUBROS.cobranza, sal: '', pendientes: 0, negocio: { nombre: '', color: '', logo: '' } };
  // Palabras de cada rubro (alumnos, pacientes, familias). Lo que el rubro no define usa estas.
  const BASE = {
    navClientes: 'Clientes', fichaTitulo: 'Ficha del cliente', tituloLista: 'Quién te debe', fab: 'Cargar deuda', falta: 'Falta cobrar',
    vacioTitulo: 'Nadie te debe nada', vacioTexto: 'Cuando cargues una deuda aparece acá, ordenada por días de atraso.', vacioBoton: 'Cargar la primera deuda',
    nuevaTitulo: 'Cargar una deuda', campoCliente: 'Cliente', ayudaCliente: 'Si ya existe, elegilo de la lista.', campoConcepto: 'Por qué te debe',
    ayudaConcepto: 'Así aparece en el mensaje: "tu pago de $ 15.000 por la cuota de marzo".', guardar: 'Guardar la deuda', loQueDebe: 'Lo que debe',
    cargarle: 'Cargarle una deuda', sinClientes: 'Todavía no hay clientes. Se crean al cargar una deuda.', grupo: '', nota: '', ayudaGrupo: '', ayudaNota: '',
  };
  const t = (clave) => S.rubro.textos[clave] ?? BASE[clave];
  let turno = 0;

  async function api(metodo, ruta, cuerpo) {
    const r = await pedir(metodo, ruta, cuerpo);
    if (r.estado === 401 && S.sesion) { S.sesion = false; pintar(); }
    if (r.estado >= 400) throw new Error(r.datos?.error || 'Algo falló. Probá de nuevo.');
    return r.datos;
  }

  // ── Avisos en pantalla ───────────────────────────────────────────────────
  function toast(texto, mal = false) {
    document.querySelector('.toast')?.remove();
    const t = h('div', { class: `toast${mal ? ' mal' : ''}`, role: 'status' }, texto);
    document.body.append(t);
    setTimeout(() => t.remove(), mal ? 5000 : 2800);
  }
  function modal(titulo, cuerpo, acciones = []) {
    const cerrar = () => velo.remove();
    const velo = h('div', { class: 'velo', onclick: (ev) => { if (ev.target === velo) cerrar(); } },
      h('div', { class: 'modal', role: 'dialog', 'aria-label': titulo },
        h('h3', null, titulo), cuerpo,
        h('div', { class: 'acciones' },
          acciones.map((a) => h('button', { class: `btn crece ${a.clase || 'sec'}`, type: 'button', onclick: async () => { cerrar(); await a.al?.(); } }, a.texto)),
          h('button', { class: 'btn crece sec', type: 'button', onclick: cerrar }, acciones.length ? 'Cancelar' : 'Cerrar'))));
    document.body.append(velo);
    return cerrar;
  }
  const hacer = (fn, exito) => async (ev) => {
    ev?.preventDefault?.();
    const boton = ev?.submitter || (ev?.currentTarget?.tagName === 'BUTTON' ? ev.currentTarget : null);
    if (boton) boton.disabled = true;
    try { const r = await fn(ev); if (exito) toast(typeof exito === 'function' ? exito(r) : exito); }
    catch (err) { toast(err.message, true); }
    finally { if (boton) boton.disabled = false; }
  };
  const campo = (titulo, control, ayuda) => h('label', { class: 'campo' }, h('span', null, titulo), control, ayuda && h('small', null, ayuda));
  const tilde = (id, texto, marcado, alCambiar) => h('label', { class: 'tilde' },
    h('input', { type: 'checkbox', id, checked: !!marcado, onchange: alCambiar }), h('span', null, texto));

  // ── Marco: cabecera, contenido y barra de secciones ──────────────────────
  function aplicarMarca() {
    const raizCss = document.documentElement.style;
    const color = S.negocio.color || S.rubro.color || '';
    if (/^#[0-9a-f]{6}$/i.test(color)) {
      raizCss.setProperty('--marca', color);
      raizCss.setProperty('--sobre-marca', contraste(color));
    } else { raizCss.removeProperty('--marca'); raizCss.removeProperty('--sobre-marca'); }
    document.title = S.negocio.nombre && S.negocio.nombre !== 'Mi negocio' ? `${S.negocio.nombre} · ${S.rubro.nombre}` : S.rubro.nombre;
  }
  function ruta() {
    const t = location.hash.replace(/^#\/?/, '');
    const m = t.match(/^(cliente|nueva)-(\d+)$/);
    if (m) return { vista: m[1], id: Number(m[2]) };
    return { vista: ['inicio', 'avisos', 'clientes', 'ajustes', 'nueva', 'importar'].includes(t) ? t : 'inicio', id: 0 };
  }
  const ir = (destino) => { if (location.hash.slice(1) === destino) pintar(); else location.hash = destino; };
  const titulo = (v) => ({ avisos: 'Avisos de hoy', clientes: t('navClientes'), ajustes: 'Ajustes', nueva: t('nuevaTitulo'), importar: 'Cargar una lista', cliente: t('fichaTitulo') })[v];
  const PADRE = { nueva: 'inicio', importar: 'nueva', cliente: 'clientes' };

  function marco(r, cuerpo) {
    const sub = r && PADRE[r.vista];
    const cab = h('header', { class: 'cab' }, h('div', { class: 'cab-in' },
      sub && h('button', { class: 'btn txt atras', type: 'button', 'aria-label': 'Volver', onclick: () => (history.length > 1 ? history.back() : ir(sub)) }, icono('atras')),
      !sub && (S.negocio.logo ? h('img', { src: S.negocio.logo, alt: '' }) : h('span', { class: 'inicial', 'aria-hidden': 'true' }, (S.negocio.nombre || 'C')[0].toUpperCase())),
      h('h1', null, (r && titulo(r.vista)) || S.negocio.nombre || S.rubro.nombre)));
    const banda = S.demo && h('div', { class: 'banda' }, h('div', { class: 'banda-in' }, 'Demo con datos de ejemplo. Nada de lo que toques acá se manda ni se cobra de verdad.'));
    const partes = [cab, banda, h('main', { class: 'cont' }, cuerpo)];
    if (r) {
      partes.push(h('nav', { class: 'nav', 'aria-label': 'Secciones' }, h('div', { class: 'nav-in' },
        [['inicio', 'Inicio'], ['avisos', 'Avisos'], ['clientes', t('navClientes')], ['ajustes', 'Ajustes']].map(([v, texto]) => h('button', {
          type: 'button', 'aria-current': (r.vista === v || PADRE[r.vista] === v || (v === 'inicio' && r.vista === 'importar')) ? 'page' : null, onclick: () => ir(v),
        }, icono(v), texto, v === 'avisos' && S.pendientes > 0 && h('span', { class: 'globo', 'aria-label': `${S.pendientes} pendientes` }, S.pendientes))))));
      if (r.vista === 'inicio' || r.vista === 'clientes') partes.push(h('button', { class: 'fab', type: 'button', onclick: () => ir('nueva') }, icono('mas'), t('fab')));
    }
    return partes.filter(Boolean);
  }
  async function pintar({ arriba = false } = {}) {
    const mio = ++turno;
    aplicarMarca();
    if (!S.sesion) { raiz.replaceChildren(...marco(null, vistaAcceso())); return; }
    const r = ruta();
    let cuerpo;
    try { cuerpo = await VISTAS[r.vista](r.id); } catch (err) { cuerpo = h('div', { class: 'alerta' }, err.message); }
    if (mio !== turno || !S.sesion) return;
    raiz.replaceChildren(...marco(r, cuerpo));
    if (arriba) window.scrollTo(0, 0);
  }

  // ── Entrar e instalar ────────────────────────────────────────────────────
  function vistaAcceso() {
    const entrar = hacer(async (ev) => {
      const f = new FormData(ev.target);
      await api('POST', '/api/entrar', { usuario: f.get('usuario'), derivada: await derivar(f.get('clave'), S.sal || '0'.repeat(32)) });
      await arrancar();
    });
    const instalar = hacer(async (ev) => {
      const f = new FormData(ev.target);
      if (String(f.get('clave')).length < 10) throw new Error('La contraseña tiene que tener 10 letras o más.');
      if (f.get('clave') !== f.get('clave2')) throw new Error('Las dos contraseñas no son iguales.');
      const sal = hex(crypto.getRandomValues(new Uint8Array(16)));
      await api('POST', '/api/instalar', { clave_instalacion: f.get('instalacion'), nombre: f.get('nombre'), usuario: f.get('usuario'), sal, derivada: await derivar(f.get('clave'), sal) });
      await arrancar();
    });
    if (!S.instalada) {
      return h('div', { class: 'acceso' }, h('form', { class: 'tarjeta', onsubmit: instalar },
        h('div', null, h('h2', null, 'Primera vez'), h('p', { class: 'tenue' }, 'Creá el acceso del dueño. Se hace una sola vez.')),
        campo('Clave de instalación', h('input', { name: 'instalacion', id: 'i-instalacion', required: true, autocomplete: 'off' }), 'La que se cargó en Cloudflare al instalar.'),
        campo('Nombre del negocio', h('input', { name: 'nombre', id: 'i-nombre', required: true, maxlength: 60 })),
        campo('Usuario', h('input', { name: 'usuario', id: 'i-usuario', required: true, minlength: 3, maxlength: 40, autocomplete: 'username', autocapitalize: 'none' })),
        campo('Contraseña', h('input', { name: 'clave', id: 'i-clave', type: 'password', required: true, minlength: 10, autocomplete: 'new-password' }), '10 letras o más.'),
        campo('Repetila', h('input', { name: 'clave2', id: 'i-clave2', type: 'password', required: true, autocomplete: 'new-password' })),
        h('button', { class: 'btn pri ancho', type: 'submit' }, 'Crear el acceso')));
    }
    return h('div', { class: 'acceso' }, h('form', { class: 'tarjeta', onsubmit: entrar },
      h('div', null, h('h2', null, S.negocio.nombre || 'Cobranza sin vueltas'), h('p', { class: 'tenue' }, 'Entrá para ver quién te debe.')),
      campo('Usuario', h('input', { name: 'usuario', id: 'e-usuario', required: true, autocomplete: 'username', autocapitalize: 'none' })),
      campo('Contraseña', h('input', { name: 'clave', id: 'e-clave', type: 'password', required: true, autocomplete: 'current-password' })),
      h('button', { class: 'btn pri ancho', type: 'submit' }, 'Entrar')));
  }

  // ── Inicio ───────────────────────────────────────────────────────────────
  // Solo en la versión del celular: bienvenida y recordatorio de guardar una copia.
  function avisosLocales(p) {
    if (!S.local || S.demo) return [];
    const partes = [];
    if (S.negocio.nombre === 'Mi negocio') {
      partes.push(h('div', { class: 'tarjeta' }, h('strong', null, `Bienvenido a ${S.rubro.nombre}`),
        h('p', { class: 'tenue' }, 'Empezá por poner el nombre de tu negocio y tus datos para transferir. Aparecen en los mensajes.'),
        h('button', { class: 'btn sec', type: 'button', onclick: () => ir('ajustes') }, 'Ir a Ajustes')));
    }
    const dias = p.ultima_copia ? diasEntre(p.ultima_copia, ahoraAR().fecha) : null;
    if (copia && p.clientes >= 3 && (dias === null || dias > 14)) {
      partes.push(h('div', { class: 'nota' }, dias === null ? 'Tus datos están solo en este celular y todavía no guardaste una copia. ' : `Hace ${dias} días que no guardás una copia de tus datos. `,
        h('button', { class: 'btn txt', type: 'button', onclick: () => ir('ajustes') }, 'Guardar una copia')));
    }
    return partes;
  }
  // Rubros con "que vuelvan": la lista de a quién le toca volver.
  function extraInicio(p) {
    const v = S.rubro.vuelta;
    if (!v) return [];
    return [
      h('div', { class: 'titulo' }, h('h2', null, v.titulo)),
      p.vuelta.length ? h('div', { class: 'lista' }, p.vuelta.map((x) => h('button', { class: 'fila', type: 'button', onclick: () => ir(`cliente-${x.cliente_id}`) },
        h('span', { class: 'quien' }, h('strong', null, x.cliente), h('span', null, x.avisos ? `Ya le escribiste ${plural(x.avisos, 'vez', 'veces')}` : 'Todavía no le escribiste')),
        h('span', { class: 'cuanto' }, h('span', { class: `chip ${x.dias > 30 ? 'mal' : 'ojo'}` }, x.dias ? `hace ${plural(x.dias, 'día', 'días')}` : 'le toca hoy')))))
        : p.clientes > 0 && h('div', { class: 'tarjeta vacio' }, h('strong', null, v.nadie), h('p', null, 'Cuando a alguien le toque volver, aparece acá y en Avisos.')),
    ];
  }

  async function vistaInicio() {
    const p = await api('GET', '/api/panel');
    S.pendientes = p.avisos.pendientes;
    const auto = p.modo === 'auto';
    const avisos = h('div', { class: 'tarjeta' }, h('div', { class: 'aviso-hoy' },
      h('div', null,
        h('strong', null, p.avisos.pendientes
          ? (auto ? `Hoy salen solos ${plural(p.avisos.pendientes, 'aviso', 'avisos')}` : `Hoy tenés ${plural(p.avisos.pendientes, 'aviso', 'avisos')} para mandar`)
          : (p.avisos.enviados_hoy ? 'Los avisos de hoy ya salieron' : 'Hoy no hay avisos para mandar')),
        h('p', { class: 'tenue chico' }, auto
          ? `Este mes salieron ${plural(p.mensajes_mes.auto, 'mensaje automático', 'mensajes automáticos')}. Esos los cobra Meta.`
          : (p.horario.abierto ? 'Cada uno sale desde tu WhatsApp con un toque.' : p.horario.motivo))),
      h('button', { class: `btn ${p.avisos.pendientes && !auto ? 'pri' : 'sec'}`, type: 'button', onclick: () => ir('avisos') }, 'Ver avisos')));
    const lista = p.deudores.length
      ? h('div', { class: 'lista' }, p.deudores.map((d) => h('button', { class: 'fila', type: 'button', onclick: () => ir(`cliente-${d.cliente_id}`) },
        h('span', { class: 'quien' }, h('strong', null, d.cliente), h('span', null, d.concepto)),
        h('span', { class: 'cuanto' }, h('span', { class: 'cifra' }, formatearMonto(d.monto)), chipDias(d.dias, d.vence)))))
      : h('div', { class: 'tarjeta vacio' }, h('strong', null, t('vacioTitulo')), h('p', null, t('vacioTexto')),
        h('button', { class: 'btn pri', type: 'button', onclick: () => ir('nueva') }, t('vacioBoton')));
    return [
      p.alerta && h('div', { class: 'alerta', role: 'alert' }, p.alerta),
      ...avisosLocales(p),
      h('section', { class: 'talon', 'aria-label': 'Resumen' },
        h('div', { class: 'talon-a' }, h('span', { class: 'eti' }, t('falta')), h('span', { class: 'cifra' }, formatearMonto(p.resumen.falta))),
        h('div', { class: 'troquel' }),
        h('div', { class: 'talon-b' },
          S.rubro.sinVencimiento
            ? h('div', null, h('span', { class: 'eti' }, 'Clientes que deben'), h('span', { class: 'cifra' }, String(p.por_cliente.length)))
            : h('div', null, h('span', { class: 'eti' }, `Vencido · ${plural(p.resumen.vencidas, 'deuda', 'deudas')}`), h('span', { class: `cifra${p.resumen.vencido ? ' mal' : ''}` }, formatearMonto(p.resumen.vencido))),
          h('div', null, h('span', { class: 'eti' }, 'Entró este mes'), h('span', { class: `cifra${p.resumen.entro ? ' bien' : ''}` }, formatearMonto(p.resumen.entro))))),
      avisos,
      ...extraInicio(p),
      (!S.rubro.vuelta || p.deudores.length > 0) && h('div', { class: 'titulo' }, h('h2', null, t('tituloLista')),
        p.deudores.length > 0 && h('span', { class: 'tenue chico' }, S.rubro.inicio === 'clientes' ? 'Primero los que más deben' : 'Primero los más atrasados')),
      S.rubro.vuelta && !p.deudores.length ? (p.clientes ? null : lista)
        : S.rubro.inicio === 'clientes' && p.por_cliente.length ? h('div', { class: 'lista' }, p.por_cliente.map((x) => h('button', { class: 'fila', type: 'button', onclick: () => ir(`cliente-${x.cliente_id}`) },
          h('span', { class: 'quien' }, h('strong', null, x.cliente), h('span', null, `${plural(x.cantidad, 'anotación', 'anotaciones')} · la primera hace ${plural(Math.max(x.dias, 0), 'día', 'días')}`)),
          h('span', { class: 'cuanto' }, h('span', { class: 'cifra' }, formatearMonto(x.saldo))))))
          : lista,
    ];
  }

  // ── Avisos de hoy ────────────────────────────────────────────────────────
  async function vistaAvisos() {
    const a = await api('GET', '/api/avisos');
    S.pendientes = a.lista.length;
    const auto = a.modo === 'auto';
    const marcar = async (it) => { await api('POST', '/api/avisos/enviado', { deuda_id: it.deuda_id, cliente_id: it.cliente_id, etapa: it.etapa }); await pintar(); };
    const boton = (it) => {
      if (!a.horario.abierto) return h('button', { class: 'btn wa ancho', type: 'button', disabled: true }, 'Enviar por WhatsApp');
      if (S.demo) {
        return h('button', { class: 'btn wa ancho', type: 'button', onclick: () => modal(`Así le llega a ${it.cliente}`,
          h('div', { class: 'celu' }, h('span', { class: 'eti' }, 'WhatsApp'), h('div', { class: 'burbuja' }, it.texto)),
          [{ texto: 'Listo, enviado', clase: 'pri', al: hacer(() => marcar(it), 'Marcado como enviado') }]) }, 'Enviar por WhatsApp');
      }
      return h('a', { class: 'btn wa ancho', href: it.wa, target: '_blank', rel: 'noopener', onclick: () => setTimeout(hacer(() => marcar(it), 'Marcado como enviado'), 600) }, 'Enviar por WhatsApp');
    };
    const pendientes = a.lista.map((it) => h('div', { class: 'tarjeta' },
      h('div', { class: 'estado' }, h('div', null, h('strong', null, it.cliente), h('p', { class: 'tenue chico' }, it.detalle)), h('span', { class: `chip ${['previo', 'dia', 'saldo', 'control'].includes(it.etapa) ? 'ojo' : 'mal'}` }, it.nombre_etapa)),
      h('div', { class: 'burbuja' }, it.texto),
      !auto && boton(it)));
    return [
      !a.horario.abierto && h('div', { class: 'nota' }, a.horario.motivo),
      auto && h('div', { class: 'tarjeta' }, h('div', { class: 'aviso-hoy' },
        h('div', null, h('strong', null, 'Modo automático'), h('p', { class: 'tenue chico' }, 'Salen solos por WhatsApp, de a tandas cada 15 minutos, de lunes a sábado de 9 a 20.')),
        h('button', { class: 'btn sec', type: 'button', disabled: !a.lista.length || !a.horario.abierto, onclick: hacer(async () => { const r = await api('POST', '/api/avisos/correr', {}); await pintar(); return r; }, (r) => r.motivo || `Salieron ${plural(r.enviados, 'aviso', 'avisos')}${r.fallidos ? ` y ${r.fallidos} no llegaron` : ''}.`) }, 'Mandar ahora'))),
      h('div', { class: 'titulo' }, h('h2', null, auto ? 'Por salir' : 'Para mandar'), h('span', { class: 'tenue chico' }, 'Uno por cliente por día')),
      pendientes.length ? pendientes : h('div', { class: 'tarjeta vacio' }, h('strong', null, 'No queda nada por mandar hoy'), h('p', null, S.rubro.avisos === 'saldo' ? 'Aparecen desde el día de cobro, una vez por semana y hasta tres veces por mes.' : 'Los avisos aparecen 3 días antes del vencimiento, el día, y a los 3 y 7 días de atraso.')),
      a.enviados.length > 0 && [
        h('div', { class: 'titulo' }, h('h2', null, 'Enviados hoy')),
        h('div', { class: 'lista' }, a.enviados.map((m) => h('button', { class: 'fila', type: 'button', onclick: () => ir(`cliente-${m.cliente_id}`) },
          h('span', { class: 'quien' }, h('strong', null, m.cliente), h('span', null, `${m.nombre_etapa} · ${m.canal === 'auto' ? 'automático' : 'con un toque'}${m.error ? ` · ${m.error}` : ''}`)),
          h('span', { class: `chip ${ESTADO_MSJ[m.estado]?.[1] || ''}` }, ESTADO_MSJ[m.estado]?.[0] || m.estado)))),
      ],
      a.sin_aviso.length > 0 && [
        h('div', { class: 'titulo' }, h('h2', null, 'No reciben avisos')),
        h('div', { class: 'lista' }, a.sin_aviso.map((s) => h('button', { class: 'fila', type: 'button', onclick: () => ir(`cliente-${s.cliente_id}`) },
          h('span', { class: 'quien' }, h('strong', null, s.cliente), h('span', null, s.motivo))))),
      ],
    ];
  }

  // ── Clientes y ficha ─────────────────────────────────────────────────────
  // Con grupos (clase, colegio y turno), la lista sale separada por grupo.
  const conGrupos = (items, fila) => {
    if (!S.rubro.agrupa || !items.some((x) => x.grupo)) return items.map(fila);
    const orden = [...items].sort((a, b) => (a.grupo || '~').localeCompare(b.grupo || '~', 'es') || a.nombre.localeCompare(b.nombre, 'es'));
    const salida = [];
    let actual = null;
    for (const x of orden) {
      const g = x.grupo || 'Sin grupo';
      if (g !== actual) { salida.push(h('div', { class: 'grupo' }, g)); actual = g; }
      salida.push(fila(x));
    }
    return salida;
  };

  async function vistaClientes() {
    const { clientes } = await api('GET', '/api/clientes');
    const lista = h('div', { class: 'lista' });
    const mostrar = (q) => {
      const t = q.toLowerCase().trim();
      const filtrados = clientes.filter((c) => !t || c.nombre.toLowerCase().includes(t) || (c.telefono || '').includes(t.replace(/\D/g, '') || '~'));
      lista.replaceChildren(...(filtrados.length ? conGrupos(filtrados, (c) => h('button', { class: 'fila', type: 'button', onclick: () => ir(`cliente-${c.id}`) },
        h('span', { class: 'quien' }, h('strong', null, c.nombre), h('span', null, [c.nota, c.telefono ? mostrarTelefono(c.telefono) : 'Sin celular'].filter(Boolean).join(' · '))),
        h('span', { class: 'cuanto' }, c.saldo ? h('span', { class: 'cifra' }, formatearMonto(c.saldo)) : h('span', { class: 'chip bien' }, 'Al día'),
          c.baja ? h('span', { class: 'chip mal' }, 'Pidió la baja') : c.vencidas ? h('span', { class: 'chip mal' }, plural(c.vencidas, 'vencida', 'vencidas')) : null)))
        : [h('div', { class: 'vacio' }, clientes.length ? 'Nadie con ese nombre.' : t('sinClientes'))]));
    };
    mostrar('');
    return [campo('Buscar', h('input', { id: 'buscar', type: 'search', placeholder: 'Nombre o celular', oninput: (ev) => mostrar(ev.target.value) })), lista];
  }

  async function vistaCliente(id) {
    const f = await api('GET', `/api/clientes/${id}`);
    const c = f.cliente;
    const cambiar = (cambios, exito) => hacer(async () => { await api('PATCH', `/api/clientes/${id}`, cambios); await pintar(); }, exito);
    const accionDeuda = (d, cuerpo, exito) => hacer(async () => { await api('PATCH', `/api/deudas/${d.id}`, cuerpo); await pintar(); }, exito);
    const copiar = async (link) => {
      try { await navigator.clipboard.writeText(link); toast('Link copiado'); }
      catch { modal('Link de pago', h('input', { value: link, readonly: true, onfocus: (ev) => ev.target.select() })); }
    };
    const cobrar = (d) => modal(`¿Cómo te pagó ${formatearMonto(d.monto)}?`, h('p', { class: 'tenue' }, d.concepto), [
      { texto: 'En efectivo', clase: 'pri', al: accionDeuda(d, { accion: 'pagar', medio: 'efectivo' }, 'Pago registrado') },
      { texto: 'Por transferencia', clase: 'pri', al: accionDeuda(d, { accion: 'pagar', medio: 'transferencia' }, 'Pago registrado') },
      S.demo && { texto: 'Simular pago por Mercado Pago', al: accionDeuda(d, { accion: 'pagar', medio: 'mercadopago' }, 'Así se marca sola cuando paga por el link') },
    ].filter(Boolean));
    const editar = (d) => {
      const concepto = h('input', { id: 'ed-concepto', value: d.concepto, maxlength: 120 });
      const monto = h('input', { id: 'ed-monto', value: formatearMonto(d.monto).replace('$ ', ''), inputmode: 'decimal' });
      const vence = h('input', { id: 'ed-vence', type: 'date', value: d.vence });
      modal('Corregir la deuda', h('div', { class: 'tarjeta', style: 'box-shadow:none;padding:0' }, campo('Concepto', concepto), campo('Monto', monto), campo('Vence', vence)),
        [{ texto: 'Guardar', clase: 'pri', al: hacer(async () => { await api('PATCH', `/api/deudas/${d.id}`, { accion: 'editar', concepto: concepto.value, monto: monto.value, vence: vence.value }); await pintar(); }, 'Deuda corregida') }]);
    };
    const datos = () => {
      const nombre = h('input', { id: 'cl-nombre', value: c.nombre, maxlength: 80 });
      const tel = h('input', { id: 'cl-tel', value: c.telefono ? mostrarTelefono(c.telefono).replace('+54 9 ', '') : '', inputmode: 'tel' });
      const mail = h('input', { id: 'cl-mail', value: c.mail || '', type: 'email' });
      const nota = h('input', { id: 'cl-nota', value: c.nota || '', maxlength: 120 });
      const grupo = h('input', { id: 'cl-grupo', value: c.grupo || '', maxlength: 60 });
      modal('Datos', h('div', { class: 'tarjeta', style: 'box-shadow:none;padding:0' }, campo('Nombre', nombre), campo('Celular', tel, 'Con código de área, sin 0 ni 15.'),
        t('nota') && campo(t('nota'), nota, t('ayudaNota')), t('grupo') && campo(t('grupo'), grupo, t('ayudaGrupo')), campo('Mail (opcional)', mail)),
        [{ texto: 'Guardar', clase: 'pri', al: hacer(async () => {
          await api('PATCH', `/api/clientes/${id}`, { nombre: nombre.value, telefono: tel.value, mail: mail.value, ...(t('nota') ? { nota: nota.value } : {}), ...(t('grupo') ? { grupo: grupo.value } : {}) });
          await pintar();
        }, 'Datos guardados') }]);
    };
    const pendientes = f.deudas.filter((d) => d.estado === 'pendiente');
    const saldo = pendientes.reduce((total, d) => total + d.monto, 0);
    const entrega = (todo) => {
      const monto = h('input', { id: 'en-monto', inputmode: 'decimal', placeholder: '5.000' });
      const pagar = (medio) => hacer(async () => {
        await api('POST', `/api/clientes/${id}/pago`, { monto: todo ? formatearMonto(saldo).replace('$ ', '') : monto.value, medio });
        await pintar();
      }, 'Pago registrado');
      modal(todo ? `¿Pagó los ${formatearMonto(saldo)}?` : 'Entrega a cuenta',
        todo ? h('p', { class: 'tenue' }, 'Queda como pagado todo lo que debe.') : campo('Cuánto entregó', monto, `Debe ${formatearMonto(saldo)}. Se descuenta de lo más viejo.`),
        [{ texto: 'En efectivo', clase: 'pri', al: pagar('efectivo') }, { texto: 'Por transferencia', clase: 'pri', al: pagar('transferencia') }]);
    };
    const filaAnotada = (d) => h('div', { class: 'fila' },
      h('span', { class: 'quien' }, h('strong', null, d.concepto), h('span', null, fechaCorta(d.vence))),
      h('span', { class: 'cuanto' }, h('span', { class: 'cifra' }, formatearMonto(d.monto)),
        h('button', { class: 'btn txt chico', type: 'button', onclick: accionDeuda(d, { accion: 'anular' }, 'Anotación borrada') }, 'Borrar')));
    const tarjetaControl = () => {
      const v = S.rubro.vuelta, hoy = ahoraAR().fecha;
      const meses = (m) => (m === 12 ? '1 año' : `${m} meses`);
      const cambiarFecha = () => {
        const ultima = h('input', { id: 'ct-ultima', type: 'date', value: c.ultima || hoy });
        const cada = h('select', { id: 'ct-cada' }, [3, 4, 6, 12].map((m) => h('option', { value: m, selected: m === (c.cada ?? v.cada) }, meses(m))), h('option', { value: 0, selected: c.cada === 0 }, 'No avisarle'));
        modal(v.campoUltima, h('div', { class: 'tarjeta', style: 'box-shadow:none;padding:0' }, campo('Fecha de la última visita', ultima, 'Si ya tiene turno, poné la fecha del turno.'), campo('Vuelve cada', cada)),
          [{ texto: 'Guardar', clase: 'pri', al: hacer(async () => { await api('PATCH', `/api/clientes/${id}`, { ultima: ultima.value, cada: Number(cada.value) }); await pintar(); }, 'Guardado') }]);
      };
      return h('div', { class: 'tarjeta' },
        h('div', { class: 'estado' },
          h('div', null, h('strong', null, v.campoUltima), h('p', { class: 'tenue chico' }, c.ultima ? `${fechaCorta(c.ultima)} · ${c.cada ? `vuelve cada ${meses(c.cada)}` : 'sin aviso'}` : 'Sin fecha cargada')),
          f.toca && h('span', { class: `chip ${f.toca <= hoy ? 'mal' : ''}` }, f.toca <= hoy ? 'Le toca volver' : `Le toca el ${fechaCorta(f.toca)}`)),
        h('div', { class: 'acciones' },
          h('button', { class: 'btn pri chico crece', type: 'button', onclick: hacer(async () => { await api('PATCH', `/api/clientes/${id}`, { ultima: hoy, cada: c.cada ?? v.cada }); await pintar(); }, 'Anotado: vino hoy') }, 'Vino hoy'),
          h('button', { class: 'btn sec chico crece', type: 'button', onclick: cambiarFecha }, 'Cambiar fecha')));
    };
    const resto = f.deudas.filter((d) => d.estado !== 'pendiente');
    return [
      h('div', { class: 'tarjeta' },
        h('div', { class: 'estado' },
          h('div', null, h('h2', null, c.nombre), h('p', { class: 'tenue' }, c.telefono ? mostrarTelefono(c.telefono) : 'Sin celular', c.mail ? ` · ${c.mail}` : ''),
            (c.nota || c.grupo) && h('p', { class: 'tenue chico' }, [c.nota, c.grupo].filter(Boolean).join(' · '))),
          h('button', { class: 'btn sec chico', type: 'button', onclick: datos }, 'Editar')),
        c.telefono && !S.demo && h('a', { class: 'btn wa', href: `https://wa.me/${c.telefono}`, target: '_blank', rel: 'noopener' }, 'Escribirle por WhatsApp'),
        c.baja ? h('div', { class: 'alerta' }, 'Pidió no recibir más avisos. ',
          h('button', { class: 'btn txt', type: 'button', onclick: cambiar({ baja: false }, 'Vuelve a recibir avisos') }, 'Volver a activarlo'))
          : [tilde('cl-acepta', 'Aceptó recibir recordatorios de pago por WhatsApp', c.acepta, (ev) => cambiar({ acepta: ev.target.checked }, 'Guardado')()),
            tilde('cl-pausa', 'Pausar los avisos a este cliente', c.pausado, (ev) => cambiar({ pausado: ev.target.checked }, ev.target.checked ? 'Avisos en pausa' : 'Avisos activos')())],
        !f.puede && !c.baja && f.motivo && h('p', { class: 'nota' }, f.motivo)),
      S.rubro.vuelta && tarjetaControl(),
      pendientes.length > 0 && (S.rubro.sinVencimiento || pendientes.length > 1) && h('div', { class: 'tarjeta' },
        h('div', null, h('span', { class: 'eti' }, 'Debe en total'), h('p', { class: 'cifra', style: 'font-size:1.6rem;font-weight:700' }, formatearMonto(saldo))),
        h('div', { class: 'acciones' },
          h('button', { class: 'btn pri chico crece', type: 'button', onclick: () => entrega(true) }, 'Pagó todo'),
          h('button', { class: 'btn sec chico crece', type: 'button', onclick: () => entrega(false) }, 'Entregó una parte'))),
      h('div', { class: 'titulo' }, h('h2', null, t('loQueDebe')), h('button', { class: 'btn sec chico', type: 'button', onclick: () => ir(`nueva-${id}`) }, t('cargarle'))),
      pendientes.length ? (S.rubro.sinVencimiento ? h('div', { class: 'lista' }, pendientes.map(filaAnotada)) : pendientes.map((d) => h('div', { class: 'tarjeta' },
        h('div', { class: 'estado' },
          h('div', null, h('strong', null, d.concepto), h('p', { class: 'tenue chico' }, `Vence el ${fechaLarga(d.vence)}${d.repite !== 'unico' ? ` · se repite cada ${d.repite === 'mensual' ? 'mes' : 'semana'}` : ''}`)),
          h('div', { class: 'cuanto' }, h('strong', { class: 'cifra' }, formatearMonto(d.monto)), ' ', chipDias(d.dias, d.vence))),
        h('div', { class: 'acciones' },
          h('button', { class: 'btn pri chico crece', type: 'button', onclick: () => cobrar(d) }, 'Ya me pagó'),
          !S.local && h('button', { class: 'btn sec chico crece', type: 'button', onclick: () => copiar(d.link) }, 'Copiar link de pago'),
          S.local && h('button', { class: 'btn sec chico crece', type: 'button', onclick: () => entrega(false) }, 'Entregó una parte')),
        h('div', { class: 'acciones' },
          h('button', { class: 'btn txt chico', type: 'button', onclick: () => editar(d) }, 'Corregir'),
          d.repite !== 'unico' && h('button', { class: 'btn txt chico', type: 'button', onclick: accionDeuda(d, { accion: 'no_repetir' }, 'No se repite más') }, 'No repetir más'),
          h('button', { class: 'btn txt chico', type: 'button', onclick: () => modal('¿Anular esta deuda?', h('p', { class: 'tenue' }, 'Deja de contarse y su link de pago deja de funcionar.'), [{ texto: 'Anular', clase: 'peligro', al: accionDeuda(d, { accion: 'anular' }, 'Deuda anulada') }]) }, 'Anular')))))
        : h('div', { class: 'tarjeta vacio' }, h('strong', null, 'Está al día')),
      resto.length > 0 && [
        h('div', { class: 'titulo' }, h('h2', null, 'Historial')),
        h('div', { class: 'lista' }, resto.map((d) => h('div', { class: 'fila' },
          h('span', { class: 'quien' }, h('strong', null, d.concepto), h('span', null, d.estado === 'pagada' ? `Pagó el ${fechaCorta(d.pagada_el)} ${MEDIO[d.medio] || ''}` : 'Anulada')),
          h('span', { class: 'cuanto' }, h('span', { class: 'cifra' }, formatearMonto(d.monto)),
            h('button', { class: 'btn txt chico', type: 'button', onclick: accionDeuda(d, { accion: 'reabrir' }, 'Volvió a quedar pendiente') }, 'Deshacer'))))),
      ],
      (f.mensajes.length > 0 || f.respuestas.length > 0) && [
        h('div', { class: 'titulo' }, h('h2', null, 'Mensajes')),
        h('div', { class: 'lista' },
          f.respuestas.map((r) => h('div', { class: 'fila' }, h('span', { class: 'quien' }, h('strong', null, `Respondió: ${r.texto}`), h('span', null, cuando(r.creado))))),
          f.mensajes.map((m) => h('div', { class: 'fila' },
            h('span', { class: 'quien' }, h('strong', null, m.nombre_etapa), h('span', null, `${cuando(m.creado)} · ${m.canal === 'auto' ? 'automático' : 'con un toque'}${m.error ? ` · ${m.error}` : ''}`)),
            h('span', { class: `chip ${ESTADO_MSJ[m.estado]?.[1] || ''}` }, ESTADO_MSJ[m.estado]?.[0] || m.estado)))),
      ],
      h('button', { class: 'btn txt', type: 'button', onclick: () => modal(`¿Borrar a ${c.nombre}?`, h('p', { class: 'tenue' }, 'Se borran sus datos, sus deudas y sus mensajes. No se puede deshacer.'),
        [{ texto: 'Borrar todo', clase: 'peligro', al: hacer(async () => { await api('DELETE', `/api/clientes/${id}`); ir('clientes'); }, 'Cliente borrado') }]) }, 'Borrar este cliente'),
    ];
  }

  // ── Cargar una deuda ─────────────────────────────────────────────────────
  async function vistaNueva(idCliente) {
    const hoy = ahoraAR().fecha;
    const R = S.rubro;
    let fijo = null, clientes = [];
    if (idCliente) fijo = (await api('GET', `/api/clientes/${idCliente}`)).cliente;
    else clientes = (await api('GET', '/api/clientes')).clientes;
    const conceptoDefecto = R.concepto ? R.concepto(nombreMes(hoy)) : '';
    const grupos = [...new Set(clientes.map((x) => x.grupo).filter(Boolean))];
    const nombre = h('input', { id: 'n-nombre', name: 'nombre', required: true, maxlength: 80, list: 'n-clientes', autocomplete: 'off' });
    const nuevo = h('div', { class: 'tarjeta', style: 'box-shadow:none;padding:0' },
      campo('Celular', h('input', { id: 'n-tel', name: 'telefono', inputmode: 'tel', placeholder: '11 5555-4444' }), 'Con código de área, sin 0 ni 15. Sin celular no recibe avisos.'),
      t('nota') && campo(t('nota'), h('input', { id: 'n-nota', name: 'nota', maxlength: 120 }), t('ayudaNota')),
      t('grupo') && campo(t('grupo'), h('input', { id: 'n-grupo', name: 'grupo', maxlength: 60, list: 'n-grupos' }), t('ayudaGrupo')),
      t('grupo') && h('datalist', { id: 'n-grupos' }, grupos.map((g) => h('option', { value: g }))),
      R.vuelta && h('div', { class: 'dos' },
        campo(R.vuelta.campoUltima, h('input', { id: 'n-ultima', name: 'ultima', type: 'date', value: hoy })),
        campo('Vuelve cada', h('select', { id: 'n-cada', name: 'cada' },
          [3, 4, 6, 12].map((m) => h('option', { value: m, selected: m === R.vuelta.cada }, m === 12 ? '1 año' : `${m} meses`)), h('option', { value: 0 }, 'No avisarle')))),
      tilde('n-acepta', R.vuelta ? 'Aceptó que le escriban por WhatsApp' : 'Aceptó recibir recordatorios de pago por WhatsApp', false));
    const elegido = () => clientes.find((x) => x.nombre.toLowerCase() === nombre.value.trim().toLowerCase());
    nombre.addEventListener('input', () => { nuevo.hidden = !!elegido(); });
    const campoConcepto = campo(t('campoConcepto'), h('input', { id: 'n-concepto', name: 'concepto', maxlength: 120, value: R.sinVencimiento ? '' : conceptoDefecto, placeholder: R.sinVencimiento ? 'pan, leche y fiambre' : 'la cuota de marzo' }), t('ayudaConcepto'));
    // En los rubros con "que vuelvan" lo principal es la persona: la cuota es opcional.
    const cuota = h('div', { class: 'tarjeta', style: 'box-shadow:none;padding:0', hidden: !!R.vuelta && !fijo },
      !R.sinVencimiento && campoConcepto,
      h('div', { class: R.sinVencimiento ? '' : 'dos' },
        campo('Monto', h('input', { id: 'n-monto', name: 'monto', inputmode: 'decimal', placeholder: '15.000' })),
        !R.sinVencimiento && campo('Vence', h('input', { id: 'n-vence', name: 'vence', type: 'date', value: hoy }))),
      R.sinVencimiento && campoConcepto,
      !R.sinVencimiento && campo('Se repite', h('select', { id: 'n-repite', name: 'repite' },
        h('option', { value: 'unico' }, 'No, es un pago único'), h('option', { value: 'mensual', selected: R.repite === 'mensual' }, 'Todos los meses'), h('option', { value: 'semanal' }, 'Todas las semanas'))));
    const guardar = hacer(async (ev) => {
      const f = new FormData(ev.target);
      const ya = fijo || elegido();
      const cliente = {
        nombre: f.get('nombre'), telefono: f.get('telefono'), nota: f.get('nota') || '', grupo: f.get('grupo') || '', acepta: !!document.getElementById('n-acepta')?.checked,
        ...(R.vuelta ? { ultima: f.get('ultima'), cada: Number(f.get('cada')) } : {}),
      };
      if (cuota.hidden) {
        const r = ya ? { id: ya.id } : await api('POST', '/api/clientes', cliente);
        ir(`cliente-${r.id}`);
        return;
      }
      if (!String(f.get('monto') || '').trim()) throw new Error('Falta el monto.');
      const deuda = { concepto: f.get('concepto') || conceptoDefecto, monto: f.get('monto'), vence: f.get('vence') || hoy, repite: f.get('repite') || 'unico' };
      const r = await api('POST', '/api/deudas', ya ? { ...deuda, cliente_id: ya.id } : { ...deuda, cliente });
      ir(`cliente-${r.cliente_id}`);
    }, 'Guardado');
    return [
      h('form', { class: 'tarjeta', onsubmit: guardar },
        fijo ? h('p', null, 'Para ', h('strong', null, fijo.nombre))
          : [campo(t('campoCliente'), nombre, t('ayudaCliente')), h('datalist', { id: 'n-clientes' }, clientes.map((x) => h('option', { value: x.nombre }))), nuevo],
        R.vuelta && !fijo && tilde('n-concuota', R.vuelta.conCuota, false, (ev) => { cuota.hidden = !ev.target.checked; }),
        cuota,
        h('button', { class: 'btn pri ancho', type: 'submit' }, R.vuelta && !fijo ? R.vuelta.guardar : t('guardar'))),
      !fijo && h('button', { class: 'btn sec', type: 'button', onclick: () => ir('importar') }, 'Tengo una lista: cargarla de una vez'),
    ];
  }

  async function vistaImportar() {
    const cfg = await api('GET', '/api/config');
    const texto = h('textarea', { id: 'imp-texto', placeholder: 'Ana Gómez; 11 5555-4444; Cuota marzo; 15.000; 10/03/2026; mensual' });
    const salida = h('div', { class: 'tarjeta', hidden: true });
    let leidas = [];
    const revisar = (filas) => {
      leidas = leerFilas(filas, { hoy: ahoraAR().fecha, area: cfg.codigo_area, venceDefecto: S.rubro.sinVencimiento ? ahoraAR().fecha : '', conceptoDefecto: S.rubro.sinVencimiento ? 'saldo anterior' : '' });
      const buenas = leidas.filter((f) => !f.errores.length);
      const acepta = tilde('imp-acepta', 'Todos estos clientes aceptaron recibir recordatorios por WhatsApp', false);
      const progreso = h('p', { class: 'tenue chico' });
      const cargar = hacer(async () => {
        const marcado = document.getElementById('imp-acepta').checked;
        let creadas = 0;
        const fallas = [];
        for (let i = 0; i < buenas.length; i += 10) {
          const tanda = buenas.slice(i, i + 10);
          const r = await api('POST', '/api/importar', { filas: tanda.map((f) => ({ nombre: f.datos.nombre, telefono: f.datos.telefono, mail: f.datos.mail, concepto: f.datos.concepto, monto_centavos: f.datos.monto, vence: f.datos.vence, repite: f.datos.repite, acepta: marcado })) });
          creadas += r.creadas;
          for (const e of r.errores) fallas.push(`Fila ${tanda[e.indice].linea}: ${e.error}`);
          progreso.textContent = `Cargadas ${creadas} de ${buenas.length}…`;
        }
        if (fallas.length) { modal('Algunas no se cargaron', h('p', { class: 'tenue' }, fallas.join(' ')), []); }
        ir('inicio');
        return creadas;
      }, (n) => `Se cargaron ${plural(n, 'deuda', 'deudas')}`);
      salida.hidden = false;
      salida.replaceChildren(...[
        h('strong', null, `${plural(buenas.length, 'deuda lista', 'deudas listas')} para cargar${leidas.length - buenas.length ? ` · ${plural(leidas.length - buenas.length, 'fila con error', 'filas con error')}` : ''}`),
        h('div', { class: 'tabla' }, h('table', null,
          h('thead', null, h('tr', null, ['Fila', 'Cliente', 'Celular', 'Concepto', 'Monto', 'Vence', 'Notas'].map((t) => h('th', null, t)))),
          h('tbody', null, leidas.map((f) => h('tr', { class: f.errores.length ? 'error' : null },
            h('td', null, f.linea), h('td', null, f.datos.nombre), h('td', null, f.datos.telefono ? mostrarTelefono(f.datos.telefono) : '—'), h('td', null, f.datos.concepto),
            h('td', null, f.datos.monto ? formatearMonto(f.datos.monto) : '—'), h('td', null, f.datos.vence ? fechaCorta(f.datos.vence) : '—'),
            h('td', null, [...f.errores, ...f.avisos].join('. '))))))),
        buenas.length > 0 && [acepta, progreso, h('button', { class: 'btn pri ancho', type: 'button', onclick: cargar }, `Cargar ${plural(buenas.length, 'deuda', 'deudas')}`)],
      ].flat().filter(Boolean));
      salida.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };
    const archivo = hacer(async (ev) => {
      const f = ev.target.files[0];
      if (!f) return;
      if (/\.xls$/i.test(f.name)) throw new Error('Ese es un Excel viejo (.xls). Guardalo como .xlsx o como CSV y probá de nuevo.');
      revisar(/\.xlsx$/i.test(f.name) ? await leerXlsx(await f.arrayBuffer()) : partirTexto(await f.text()));
    });
    return [
      h('div', { class: 'tarjeta' },
        h('p', null, 'Pegá tu lista o subí una planilla. Una deuda por renglón, en este orden:'),
        h('p', { class: 'chico' }, h('strong', null, 'nombre, celular, concepto, monto, vencimiento'), ' y, si querés, si se repite (mensual o semanal) y el mail.'),
        h('p', { class: 'tenue chico' }, 'Si la primera fila tiene títulos (Nombre, Celular, Monto…), los usa y el orden no importa.'),
        campo('Pegar la lista', texto),
        h('div', { class: 'acciones' },
          h('button', { class: 'btn pri crece', type: 'button', onclick: hacer(() => { if (!texto.value.trim()) throw new Error('Pegá la lista primero.'); revisar(partirTexto(texto.value)); }) }, 'Revisar la lista'),
          h('label', { class: 'btn sec crece' }, 'Subir Excel o CSV', h('input', { id: 'imp-archivo', type: 'file', accept: '.xlsx,.csv,.txt', hidden: true, onchange: archivo })))),
      salida,
    ];
  }

  // ── Ajustes ──────────────────────────────────────────────────────────────
  // Rubros con "que vuelvan": se carga la lista de personas con su última visita.
  async function vistaImportarPacientes() {
    const cfg = await api('GET', '/api/config');
    const texto = h('textarea', { id: 'imp-texto', placeholder: 'Ana Gómez; 11 5555-4444; 10/05/2026' });
    const salida = h('div', { class: 'tarjeta', hidden: true });
    const revisar = (filas) => {
      const leidas = leerPacientes(filas, { hoy: ahoraAR().fecha, area: cfg.codigo_area });
      const buenas = leidas.filter((f) => !f.errores.length);
      const cargar = hacer(async () => {
        const acepta = document.getElementById('imp-acepta').checked;
        for (const f of buenas) {
          await api('POST', '/api/clientes', { nombre: f.datos.nombre, telefono: f.datos.telefono, acepta, ...(f.datos.ultima ? { ultima: f.datos.ultima, cada: S.rubro.vuelta.cada } : {}) });
        }
        ir('clientes');
        return buenas.length;
      }, (n) => `Se cargaron ${n}`);
      salida.hidden = false;
      salida.replaceChildren(...[
        h('strong', null, `${buenas.length} para cargar${leidas.length - buenas.length ? ` · ${plural(leidas.length - buenas.length, 'fila con error', 'filas con error')}` : ''}`),
        h('div', { class: 'tabla' }, h('table', null,
          h('thead', null, h('tr', null, ['Fila', 'Nombre', 'Celular', S.rubro.vuelta.campoUltima, 'Notas'].map((x) => h('th', null, x)))),
          h('tbody', null, leidas.map((f) => h('tr', { class: f.errores.length ? 'error' : null },
            h('td', null, f.linea), h('td', null, f.datos.nombre), h('td', null, f.datos.telefono ? mostrarTelefono(f.datos.telefono) : '—'),
            h('td', null, f.datos.ultima ? fechaCorta(f.datos.ultima) : '—'), h('td', null, [...f.errores, ...f.avisos].join('. '))))))),
        buenas.length > 0 && [tilde('imp-acepta', 'Todos aceptaron que les escriban por WhatsApp', false),
          h('button', { class: 'btn pri ancho', type: 'button', onclick: cargar }, `Cargar ${buenas.length}`)],
      ].flat().filter(Boolean));
      salida.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };
    const archivo = hacer(async (ev) => {
      const f = ev.target.files[0];
      if (!f) return;
      if (/\.xls$/i.test(f.name)) throw new Error('Ese es un Excel viejo (.xls). Guardalo como .xlsx o como CSV y probá de nuevo.');
      revisar(/\.xlsx$/i.test(f.name) ? await leerXlsx(await f.arrayBuffer()) : partirTexto(await f.text()));
    });
    return [
      h('div', { class: 'tarjeta' },
        h('p', null, 'Pegá tu lista o subí una planilla. Una persona por renglón, en este orden:'),
        h('p', { class: 'chico' }, h('strong', null, `nombre, celular y fecha de ${S.rubro.vuelta.campoUltima.toLowerCase()}`)),
        campo('Pegar la lista', texto),
        h('div', { class: 'acciones' },
          h('button', { class: 'btn pri crece', type: 'button', onclick: hacer(() => { if (!texto.value.trim()) throw new Error('Pegá la lista primero.'); revisar(partirTexto(texto.value)); }) }, 'Revisar la lista'),
          h('label', { class: 'btn sec crece' }, 'Subir Excel o CSV', h('input', { id: 'imp-archivo', type: 'file', accept: '.xlsx,.csv,.txt', hidden: true, onchange: archivo })))),
      salida,
    ];
  }

  async function vistaAjustes() {
    const cfg = await api('GET', '/api/config');
    const guardar = (leer, exito = 'Guardado') => hacer(async (ev) => {
      const cambios = leer(ev);
      await api('POST', '/api/config', cambios);
      if ('nombre' in cambios) Object.assign(S.negocio, { nombre: cambios.nombre, color: cambios.color, logo: cambios.logo });
      await pintar();
    }, exito);
    const conexion = (ok, nombre, detalle, cual) => h('div', { class: 'estado' },
      h('div', null, h('strong', null, nombre), ' ', h('span', { class: `chip ${ok ? 'bien' : ''}` }, ok ? 'Conectado' : 'Sin conectar'), h('p', { class: 'tenue chico' }, detalle)),
      ok && cual && !S.demo && h('button', { class: 'btn sec chico', type: 'button', onclick: hacer(async () => { const r = await api('GET', `/api/probar?cual=${cual}`); if (!r.ok) throw new Error(r.detalle); return r; }, (r) => r.detalle) }, 'Probar'));

    let logo = cfg.logo;
    const vista = h('img', { src: logo || '', alt: '', hidden: !logo, style: 'width:56px;height:56px;border-radius:12px;object-fit:cover' });
    const elegirLogo = hacer(async (ev) => {
      const f = ev.target.files[0];
      if (!f) return;
      const img = await createImageBitmap(f);
      const escala = Math.min(1, 192 / Math.max(img.width, img.height));
      const lienzo = Object.assign(document.createElement('canvas'), { width: Math.round(img.width * escala), height: Math.round(img.height * escala) });
      lienzo.getContext('2d').drawImage(img, 0, 0, lienzo.width, lienzo.height);
      logo = lienzo.toDataURL('image/png');
      if (logo.length > 130000) logo = lienzo.toDataURL('image/jpeg', 0.85);
      vista.src = logo; vista.hidden = false;
    });
    const color = h('input', { id: 'aj-color', type: 'color', value: cfg.color || '#0b5d6b' });
    const negocio = h('form', { class: 'tarjeta', onsubmit: guardar(() => ({ nombre: document.getElementById('aj-nombre').value, color: color.value, logo: logo || '' }), 'Negocio guardado') },
      h('h2', null, 'Tu negocio'),
      campo('Nombre', h('input', { id: 'aj-nombre', value: cfg.nombre, required: true, maxlength: 60 }), 'Aparece arriba y en el link de pago que ve tu cliente.'),
      h('div', { class: 'estado' }, campo('Color', color), h('div', { class: 'acciones' }, vista,
        h('label', { class: 'btn sec chico' }, logo ? 'Cambiar logo' : 'Subir logo', h('input', { id: 'aj-logo', type: 'file', accept: 'image/*', hidden: true, onchange: elegirLogo })),
        logo && h('button', { class: 'btn txt chico', type: 'button', onclick: () => { logo = ''; vista.hidden = true; } }, 'Quitar'))),
      h('button', { class: 'btn pri', type: 'submit' }, 'Guardar'));

    const cobros = h('form', { class: 'tarjeta', onsubmit: guardar(() => ({ datos_transferencia: document.getElementById('aj-transf').value }), 'Datos de cobro guardados') },
      h('h2', null, 'Cómo te pagan'),
      conexion(cfg.conexiones.mp, 'Mercado Pago', cfg.conexiones.mp ? 'El link de pago cobra con tu cuenta y la deuda se marca pagada sola.' : 'Sin Mercado Pago, el link muestra tus datos para transferir.', 'mp'),
      campo('Datos para transferir', h('input', { id: 'aj-transf', value: cfg.datos_transferencia, maxlength: 300, placeholder: 'Alias: mi.negocio.mp · a nombre de…' }), 'Se muestran en el link de pago.'),
      h('button', { class: 'btn pri', type: 'submit' }, 'Guardar'));

    const modo = (valor, titulo, detalle, deshabilitado) => h('label', { class: 'tilde' },
      h('input', { type: 'radio', name: 'modo', id: `aj-modo-${valor}`, checked: cfg.modo === valor, disabled: deshabilitado, onchange: hacer(async () => { await api('POST', '/api/config', { modo: valor }); await pintar(); }, valor === 'auto' ? 'Modo automático activado' : 'Modo un toque activado') }),
      h('span', null, h('strong', null, titulo), h('br'), h('span', { class: 'tenue chico' }, detalle)));
    const listaPlantillas = h('div', { class: 'lista', hidden: true });
    const verPlantillas = (crear) => hacer(async () => {
      const r = await api(crear ? 'POST' : 'GET', '/api/whatsapp/plantillas', crear ? {} : undefined);
      const filas = crear ? r.creadas.map((p) => [p.nombre, p.ok ? 'En revisión' : p.error, p.ok ? 'ojo' : 'mal']) : r.plantillas.map((p) => [p.nombre, { APPROVED: 'Aprobado', PENDING: 'En revisión', REJECTED: 'Rechazado', FALTA: 'Falta crearlo' }[p.estado] || p.estado, p.estado === 'APPROVED' ? 'bien' : p.estado === 'PENDING' ? 'ojo' : 'mal']);
      if (!crear && r.error) throw new Error(r.error);
      listaPlantillas.hidden = false;
      listaPlantillas.replaceChildren(...filas.map(([n, e, clase]) => h('div', { class: 'fila' }, h('span', { class: 'quien' }, h('strong', null, n)), h('span', { class: `chip ${clase}` }, e))));
    });
    const avisos = h('form', { class: 'tarjeta', onsubmit: guardar(() => ({ codigo_area: document.getElementById('aj-area').value, mail_dueno: document.getElementById('aj-mail').value }), 'Avisos guardados') },
      h('h2', null, 'Avisos por WhatsApp'),
      modo('toque', 'Con un toque (gratis)', 'La app arma el mensaje y vos lo mandás desde tu WhatsApp.'),
      modo('auto', 'Automático', cfg.conexiones.whatsapp ? 'Salen solos desde el número del negocio. Meta cobra cada mensaje.' : 'Necesita conectar un número aparte con Meta (manual, parte B).', !cfg.conexiones.whatsapp),
      conexion(cfg.conexiones.whatsapp, 'WhatsApp de Meta', cfg.conexiones.whatsapp ? (cfg.conexiones.whatsapp_respuestas ? 'Recibe entregas, respuestas y pedidos de BAJA.' : 'Falta conectar las respuestas (WA_APP_SECRET y WA_VERIFY_TOKEN).') : 'Solo hace falta para el modo automático.', 'whatsapp'),
      cfg.conexiones.whatsapp && cfg.conexiones.whatsapp_plantillas && h('div', { class: 'acciones' },
        h('button', { class: 'btn sec chico crece', type: 'button', onclick: verPlantillas(true) }, 'Crear los 4 mensajes en Meta'),
        h('button', { class: 'btn sec chico crece', type: 'button', onclick: verPlantillas(false) }, 'Ver si están aprobados')),
      listaPlantillas,
      campo('Código de área de tus clientes', h('input', { id: 'aj-area', value: cfg.codigo_area, inputmode: 'numeric', maxlength: 5, placeholder: '11' }), 'Para los celulares que te pasan sin código de área.'),
      conexion(cfg.conexiones.mail, 'Mail de la mañana', 'En modo un toque, un mail a las 8:30 con los avisos del día.', cfg.mail_dueno ? 'mail' : null),
      campo('Tu mail', h('input', { id: 'aj-mail', type: 'email', value: cfg.mail_dueno, placeholder: 'vos@mail.com' })),
      h('button', { class: 'btn pri', type: 'submit' }, 'Guardar'));

    const cuenta = !S.demo && h('form', { class: 'tarjeta', onsubmit: hacer(async (ev) => {
      const f = new FormData(ev.target);
      if (String(f.get('nueva')).length < 10) throw new Error('La contraseña nueva tiene que tener 10 letras o más.');
      const sal = hex(crypto.getRandomValues(new Uint8Array(16)));
      await api('POST', '/api/clave', { actual: await derivar(f.get('actual'), S.sal), sal, derivada: await derivar(f.get('nueva'), sal) });
      S.sal = sal;
      ev.target.reset();
    }, 'Contraseña cambiada') },
      h('h2', null, 'Tu cuenta'), h('p', { class: 'tenue' }, `Usuario: ${cfg.usuario}`),
      campo('Contraseña actual', h('input', { id: 'aj-actual', name: 'actual', type: 'password', required: true, autocomplete: 'current-password' })),
      campo('Contraseña nueva', h('input', { id: 'aj-nueva', name: 'nueva', type: 'password', required: true, minlength: 10, autocomplete: 'new-password' })),
      h('div', { class: 'acciones' }, h('button', { class: 'btn pri crece', type: 'submit' }, 'Cambiar contraseña'),
        h('button', { class: 'btn sec crece', type: 'button', onclick: hacer(async () => { await api('POST', '/api/salir', {}); S.sesion = false; await pintar(); }) }, 'Salir')));
    // Versión del celular: sin cuentas que conectar; datos para transferir y copia de seguridad.
    const val = (idCampo) => document.getElementById(idCampo).value;
    const cobrosLocal = S.local && h('form', { class: 'tarjeta', onsubmit: guardar(() => ({
      datos_transferencia: val('ajl-transf'), codigo_area: val('ajl-area'), ...(S.rubro.avisos === 'saldo' ? { dia_cobro: Number(val('ajl-dia')) } : {}),
    }), 'Guardado') },
      h('h2', null, 'Cobros y avisos'),
      campo('Datos para transferir', h('input', { id: 'ajl-transf', value: cfg.datos_transferencia, maxlength: 300, placeholder: 'Alias: mi.negocio · a nombre de…' }), 'Van al final de cada mensaje de cobro.'),
      S.rubro.avisos === 'saldo' && campo('Día de cobro', h('input', { id: 'ajl-dia', type: 'number', min: 1, max: 28, value: cfg.dia_cobro }), 'Desde ese día del mes, la app te propone recordarle el saldo a cada cliente.'),
      campo('Código de área de tus clientes', h('input', { id: 'ajl-area', value: cfg.codigo_area, inputmode: 'numeric', maxlength: 5, placeholder: '11' }), 'Para los celulares que te pasan sin código de área.'),
      h('button', { class: 'btn pri', type: 'submit' }, 'Guardar'));
    const copiaSeg = S.local && copia && h('div', { class: 'tarjeta' },
      h('h2', null, 'Copia de seguridad'),
      h('p', { class: 'tenue' }, 'Tus datos están guardados solo en este celular. Guardá una copia cada tanto: si cambiás de celular o se borra el navegador, los recuperás con ese archivo.'),
      h('p', { class: 'chico' }, cfg.ultima_copia ? `Última copia: ${fechaCorta(cfg.ultima_copia)}` : 'Todavía no guardaste ninguna copia.'),
      h('div', { class: 'acciones' },
        h('button', { class: 'btn pri crece', type: 'button', onclick: hacer(async () => {
          await api('POST', '/api/config', { ultima_copia: ahoraAR().fecha });
          const enlace = h('a', { href: URL.createObjectURL(new Blob([copia.exportar()], { type: 'application/json' })), download: `copia-${S.rubro.archivo || 'app'}-${ahoraAR().fecha}.json` });
          document.body.append(enlace); enlace.click(); enlace.remove();
          await pintar();
        }, 'Copia guardada en tus descargas') }, 'Guardar una copia'),
        h('label', { class: 'btn sec crece' }, 'Recuperar una copia', h('input', { id: 'cp-archivo', type: 'file', accept: '.json,application/json', hidden: true, onchange: hacer(async (ev) => {
          const f = ev.target.files[0];
          if (!f) return;
          const contenido = await f.text();
          modal('¿Recuperar esta copia?', h('p', { class: 'tenue' }, 'Reemplaza todo lo que hay ahora en la app por lo que tiene la copia.'),
            [{ texto: 'Recuperar', clase: 'peligro', al: hacer(() => copia.importar(contenido)) }]);
        }) }))));
    return S.local ? [negocio, cobrosLocal, copiaSeg] : [negocio, cobros, avisos, cuenta];
  }

  const VISTAS = { inicio: vistaInicio, avisos: vistaAvisos, clientes: vistaClientes, cliente: vistaCliente, nueva: vistaNueva, importar: () => (S.rubro.vuelta ? vistaImportarPacientes() : vistaImportar()), ajustes: vistaAjustes };

  async function arrancar() {
    try {
      const e = await api('GET', '/api/estado');
      Object.assign(S, { instalada: e.instalada, sesion: e.sesion, demo: e.demo, local: !!e.local, rubro: RUBROS[e.rubro] || RUBROS.cobranza, sal: e.sal, negocio: e.negocio });
    } catch (err) { raiz.replaceChildren(h('main', { class: 'cont' }, h('div', { class: 'alerta' }, err.message))); return; }
    await pintar({ arriba: true });
  }
  window.addEventListener('hashchange', () => pintar({ arriba: true }));
  return arrancar();
}
