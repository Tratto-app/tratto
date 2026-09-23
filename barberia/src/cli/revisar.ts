/**
 * `npm run revisar` — dice qué falta para salir a producción.
 *
 * Pensado para la etapa de puesta en marcha, cuando hay diez credenciales dando
 * vueltas y es fácil perder cuál está cargada y cuál no. No inventa nada: mira
 * la configuración real, prueba las conexiones que puede probar, y lista lo que
 * falta con el nombre exacto de cada cosa.
 */
import {
  env,
  claveDelProveedor,
  driverBD,
  iaConfigurada,
  modeloEnUso,
  sheetsConfigurado,
  whatsappConfigurado,
} from '../config/env.js';
import { cargarConfigNegocio, revisarConfig, serviciosActivos } from '../config/negocio.js';
import { crearBaseDeDatos } from '../database/index.js';

type Estado = 'ok' | 'falta' | 'aviso';

interface Punto {
  estado: Estado;
  que: string;
  detalle?: string;
}

const SIMBOLO: Record<Estado, string> = { ok: '✅', falta: '❌', aviso: '⚠️ ' };

const grupos: Array<{ titulo: string; puntos: Punto[] }> = [];
function grupo(titulo: string, puntos: Punto[]) {
  grupos.push({ titulo, puntos });
}

// ---------------------------------------------------------------------------
// 1. Datos del negocio
// ---------------------------------------------------------------------------
const cfg = cargarConfigNegocio();
const negocioPuntos: Punto[] = [];

const camposNegocio: Array<[string, string]> = [
  ['nombre', cfg.negocio.nombre],
  ['dirección', cfg.negocio.direccion],
  ['teléfono', cfg.negocio.telefono],
  ['Instagram', cfg.negocio.instagram],
  ['link de Google Maps', cfg.negocio.maps],
];
const sinCargar = camposNegocio.filter(([, valor]) => !valor || valor.includes('PLACEHOLDER'));
negocioPuntos.push(
  sinCargar.length === 0
    ? { estado: 'ok', que: 'Datos de la barbería cargados' }
    : {
        estado: 'falta',
        que: `Faltan datos de la barbería: ${sinCargar.map(([campo]) => campo).join(', ')}`,
        detalle: 'Se cargan desde el panel o en config/negocio.json',
      },
);

const activos = serviciosActivos(cfg);
const sinPrecio = activos.filter((s) => s.precio <= 0);
negocioPuntos.push(
  sinPrecio.length === 0
    ? { estado: 'ok', que: `Precios cargados en los ${activos.length} servicios activos` }
    : {
        estado: 'falta',
        que: `${sinPrecio.length} servicio(s) sin precio: ${sinPrecio.map((s) => s.nombre).join(', ')}`,
        detalle: 'Mientras tanto el bot dice "a confirmar" en vez de inventar un número',
      },
);

negocioPuntos.push(
  cfg.resenas.activo && (!cfg.resenas.link_google_maps || cfg.resenas.link_google_maps.includes('PLACEHOLDER'))
    ? {
        estado: 'falta',
        que: 'Falta el link para dejar reseña en Google',
        detalle: 'Sin él no se manda el pedido de reseña ni se carga ningún descuento',
      }
    : { estado: 'ok', que: cfg.resenas.activo ? 'Link de reseñas cargado' : 'Reseñas desactivadas' },
);

negocioPuntos.push({
  estado: 'ok',
  que: `Zona horaria: ${cfg.negocio.timezone} · moneda ${cfg.negocio.moneda} · código de país +${cfg.negocio.codigo_pais}`,
  detalle: 'Revisá que coincidan con el país de la barbería',
});

for (const aviso of revisarConfig()) negocioPuntos.push({ estado: 'aviso', que: aviso });
grupo('Datos de la barbería', negocioPuntos);

// ---------------------------------------------------------------------------
// 2. WhatsApp
// ---------------------------------------------------------------------------
const whatsappPuntos: Punto[] = [
  env.WHATSAPP_PHONE_NUMBER_ID
    ? { estado: 'ok', que: 'WHATSAPP_PHONE_NUMBER_ID' }
    : { estado: 'falta', que: 'WHATSAPP_PHONE_NUMBER_ID', detalle: 'WhatsApp → Configuración de la API' },
  env.WHATSAPP_ACCESS_TOKEN
    ? { estado: 'ok', que: 'WHATSAPP_ACCESS_TOKEN' }
    : { estado: 'falta', que: 'WHATSAPP_ACCESS_TOKEN', detalle: 'Usá uno permanente, no el de 24 h de la pantalla' },
  env.WHATSAPP_VERIFY_TOKEN
    ? { estado: 'ok', que: 'WHATSAPP_VERIFY_TOKEN' }
    : { estado: 'falta', que: 'WHATSAPP_VERIFY_TOKEN', detalle: 'Lo inventás vos; se lo repetís a Meta al conectar el webhook' },
  env.WHATSAPP_APP_SECRET
    ? { estado: 'ok', que: 'WHATSAPP_APP_SECRET' }
    : { estado: 'falta', que: 'WHATSAPP_APP_SECRET', detalle: 'Sin esto no se puede validar la firma de los webhooks' },
  env.BARBERO_WHATSAPP
    ? { estado: 'ok', que: 'BARBERO_WHATSAPP' }
    : { estado: 'aviso', que: 'BARBERO_WHATSAPP sin cargar', detalle: 'No vas a recibir avisos ni el balance de los domingos' },
];

if (cfg.recordatorios.activos) {
  whatsappPuntos.push(
    process.env.WHATSAPP_PLANTILLA_RECORDATORIO
      ? { estado: 'ok', que: 'Plantilla del recordatorio de 24 h' }
      : {
          estado: 'aviso',
          que: 'Sin plantilla para el recordatorio de 24 h',
          detalle: 'Se intenta como texto y Meta lo va a rechazar fuera de la ventana de 24 h',
        },
  );
}
if (cfg.resenas.activo) {
  whatsappPuntos.push(
    process.env.WHATSAPP_PLANTILLA_RESENA
      ? { estado: 'ok', que: 'Plantilla del pedido de reseña' }
      : {
          estado: 'aviso',
          que: 'Sin plantilla para el pedido de reseña',
          detalle: 'Sale una hora después del corte: casi siempre va a estar fuera de la ventana',
        },
  );
}
grupo('WhatsApp', whatsappPuntos);

// ---------------------------------------------------------------------------
// 3. Inteligencia artificial
// ---------------------------------------------------------------------------
grupo('Inteligencia artificial', [
  claveDelProveedor
    ? { estado: 'ok', que: `${env.AI_PROVEEDOR} configurado`, detalle: `Modelo: ${modeloEnUso}` }
    : {
        estado: 'aviso',
        que: `Sin clave de ${env.AI_PROVEEDOR}`,
        detalle: 'El bot atiende igual en modo menú: se pueden reservar turnos sin IA',
      },
  iaConfigurada
    ? { estado: 'ok', que: 'IA habilitada' }
    : { estado: 'aviso', que: 'IA apagada', detalle: 'AI_HABILITADA=false o falta la clave' },
]);

// ---------------------------------------------------------------------------
// 4. Google Sheets
// ---------------------------------------------------------------------------
const googlePuntos: Punto[] = [
  env.GOOGLE_SPREADSHEET_ID
    ? { estado: 'ok', que: 'GOOGLE_SPREADSHEET_ID' }
    : { estado: 'aviso', que: 'Sin planilla configurada', detalle: 'Los turnos se guardan igual en la base de datos' },
];
if (env.GOOGLE_SPREADSHEET_ID) {
  const conOAuth = Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET && env.GOOGLE_REFRESH_TOKEN);
  const conCuenta = Boolean(env.GOOGLE_SERVICE_ACCOUNT_JSON);
  googlePuntos.push(
    conOAuth || conCuenta
      ? { estado: 'ok', que: `Credenciales de Google (${conCuenta ? 'cuenta de servicio' : 'OAuth'})` }
      : { estado: 'falta', que: 'Faltan las credenciales de Google', detalle: 'OAuth o GOOGLE_SERVICE_ACCOUNT_JSON' },
  );
}
grupo('Google Sheets', googlePuntos);

// ---------------------------------------------------------------------------
// 5. Base de datos y panel
// ---------------------------------------------------------------------------
const sistemaPuntos: Punto[] = [];
try {
  const db = crearBaseDeDatos();
  await db.migrar();
  await db.query('SELECT 1');
  await db.cerrar();
  sistemaPuntos.push(
    driverBD === 'postgres'
      ? { estado: 'ok', que: 'PostgreSQL conectado y con el esquema al día' }
      : {
          estado: 'aviso',
          que: 'Usando SQLite',
          detalle: 'Anda bien para un local con una sola instancia; en la nube usá PostgreSQL',
        },
  );
} catch (e) {
  sistemaPuntos.push({
    estado: 'falta',
    que: 'No se pudo conectar a la base de datos',
    detalle: e instanceof Error ? e.message : String(e),
  });
}

sistemaPuntos.push(
  env.DASHBOARD_PASSWORD && env.DASHBOARD_PASSWORD.length >= 10
    ? { estado: 'ok', que: 'Contraseña del panel' }
    : {
        estado: 'falta',
        que: 'DASHBOARD_PASSWORD floja o sin cargar',
        detalle: 'Mínimo 10 caracteres: es lo único que protege tu agenda',
      },
  env.SESSION_SECRET && env.SESSION_SECRET.length >= 32
    ? { estado: 'ok', que: 'SESSION_SECRET' }
    : { estado: 'falta', que: 'SESSION_SECRET flojo o sin cargar', detalle: 'Generalo con: openssl rand -hex 32' },
);
grupo('Base de datos y panel', sistemaPuntos);

// ---------------------------------------------------------------------------
// Salida
// ---------------------------------------------------------------------------
const linea = (t: string) => console.log(t);
linea('');
linea(`  ${cfg.negocio.nombre.replace('PLACEHOLDER - ', '')} — revisión previa`);
linea('  ' + '─'.repeat(58));

let faltan = 0;
let avisos = 0;
for (const g of grupos) {
  linea('');
  linea(`  ${g.titulo.toUpperCase()}`);
  for (const p of g.puntos) {
    if (p.estado === 'falta') faltan++;
    if (p.estado === 'aviso') avisos++;
    linea(`   ${SIMBOLO[p.estado]} ${p.que}`);
    if (p.detalle && p.estado !== 'ok') linea(`      ↳ ${p.detalle}`);
  }
}

linea('');
linea('  ' + '─'.repeat(58));
if (faltan === 0 && avisos === 0) {
  linea('  ✅ Todo listo para atender clientes reales.');
} else if (faltan === 0) {
  linea(`  ✅ Se puede salir a producción. ${avisos} aviso(s) para mirar.`);
} else {
  linea(`  ❌ Faltan ${faltan} cosa(s) para salir a producción${avisos ? `, y hay ${avisos} aviso(s)` : ''}.`);
  linea('     Las marcadas con ❌ son las que bloquean.');
}
linea('');

if (!whatsappConfigurado) {
  linea('  Sin WhatsApp configurado podés probar todo el bot en /test-chat.');
  linea('');
}
if (!sheetsConfigurado && env.GOOGLE_SPREADSHEET_ID) {
  linea('  Ojo: hay planilla pero faltan credenciales, así que no se va a escribir nada.');
  linea('');
}

process.exitCode = faltan > 0 ? 1 : 0;
