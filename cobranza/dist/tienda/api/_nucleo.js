// src/rubros.js
var RUBROS = {
  cobranza: { id: "cobranza", nombre: "Cobranza sin vueltas", avisos: "deuda", inicio: "deudas", textos: {} },
  cuotas: {
    id: "cuotas",
    nombre: "Cuotas al d\xEDa",
    archivo: "cuotas-al-dia",
    color: "#1f5fbf",
    precio: 29e3,
    venta: {
      para: "Para academias, escuelas de danza y f\xFAtbol, y profes",
      quienes: "alumnos",
      titular: "Sab\xE9 qui\xE9n te debe la cuota y reclamala con un toque",
      bajada: "Carg\xE1s a tus alumnos una vez. Cada ma\xF1ana la app te muestra a qui\xE9n escribirle y te deja el WhatsApp listo para mandar.",
      puntos: [
        ["La cuota del mes que viene se crea sola", "Carg\xE1s la cuota una vez y la app la repite todos los meses."],
        ["El mensaje nombra al chico", '"Hola Laura, hoy vence la cuota de marzo de Sofi." Le llega a la mam\xE1 o al pap\xE1.'],
        ["Sab\xE9s cu\xE1nto falta cobrar", "El total, lo vencido y lo que entr\xF3 en el mes, siempre a la vista."]
      ]
    },
    avisos: "deuda",
    inicio: "deudas",
    repite: "mensual",
    notaEnMensaje: true,
    agrupa: true,
    concepto: (mes) => `la cuota de ${mes}`,
    textos: {
      navClientes: "Alumnos",
      fichaTitulo: "Ficha del alumno",
      tituloLista: "Qui\xE9n debe la cuota",
      fab: "Cargar cuota",
      vacioTitulo: "Nadie debe la cuota",
      vacioTexto: "Carg\xE1 a cada alumno con su cuota. Si se repite todos los meses, la del mes que viene se crea sola.",
      vacioBoton: "Cargar la primera cuota",
      nuevaTitulo: "Cargar una cuota",
      campoCliente: "A qui\xE9n le escrib\xEDs",
      ayudaCliente: "El alumno, o la mam\xE1 o el pap\xE1 si es chico. Si ya existe, elegilo de la lista.",
      campoConcepto: "Qu\xE9 se cobra",
      guardar: "Guardar la cuota",
      loQueDebe: "Cuotas que debe",
      cargarle: "Cargarle una cuota",
      grupo: "Clase o grupo",
      ayudaGrupo: "Por ejemplo: Danza jazz, martes y jueves.",
      nota: "Nombre del alumno",
      ayudaNota: 'Solo si le escrib\xEDs a la mam\xE1 o al pap\xE1. Aparece en el mensaje: "la cuota de marzo de Sofi".',
      sinClientes: "Todav\xEDa no hay alumnos. Se crean al cargar una cuota."
    }
  },
  libreta: {
    id: "libreta",
    nombre: "Libreta",
    titulo: "Libreta de fiado",
    archivo: "libreta",
    color: "#a4491b",
    precio: 19e3,
    venta: {
      para: "Para almacenes y kioscos",
      quienes: "clientes",
      titular: "La libreta de fiado, en el celular",
      bajada: "Anot\xE1s cada fiado en dos toques. La app suma sola, te dice cu\xE1nto te deben en total y te arma el mensaje para reclamarlo.",
      puntos: [
        ["Se anota en dos toques", "Cliente y monto. M\xE1s r\xE1pido que buscar la hoja en el cuaderno."],
        ["Entregas a cuenta", "Si te deja una parte, se descuenta de lo m\xE1s viejo y queda anotado lo que falta."],
        ["Reclam\xE1s sin vueltas", "Desde el d\xEDa de cobro, la app te propone el mensaje con el saldo de cada uno."]
      ]
    },
    avisos: "saldo",
    inicio: "clientes",
    sinVencimiento: true,
    concepto: () => "compra",
    textos: {
      tituloLista: "Qui\xE9n tiene fiado",
      fab: "Anotar fiado",
      vacioTitulo: "La libreta est\xE1 en blanco",
      vacioTexto: "Anot\xE1 cada fiado en la cuenta del cliente. La app suma y te dice cu\xE1nto te deben en total.",
      vacioBoton: "Anotar el primer fiado",
      nuevaTitulo: "Anotar un fiado",
      campoConcepto: "Qu\xE9 llev\xF3 (opcional)",
      ayudaConcepto: "Para acordarte despu\xE9s. No hace falta.",
      guardar: "Anotar",
      loQueDebe: "Lo que tiene anotado",
      cargarle: "Anotarle",
      falta: "Total fiado",
      sinClientes: "Todav\xEDa no hay clientes. Se crean al anotar un fiado."
    }
  },
  control: {
    id: "control",
    nombre: "Control al d\xEDa",
    archivo: "control-al-dia",
    color: "#0f766e",
    precio: 59e3,
    venta: {
      para: "Para odont\xF3logos y consultorios",
      quienes: "pacientes",
      titular: "Que tus pacientes vuelvan al control",
      bajada: "La app te avisa cada ma\xF1ana a qui\xE9n le toca volver y te deja el mensaje de WhatsApp listo. Tambi\xE9n lleva las cuotas de ortodoncia.",
      puntos: [
        ["El sill\xF3n no queda vac\xEDo", "A los 6 meses del \xFAltimo control, el paciente aparece en tu lista con el mensaje armado."],
        ["Insiste sin molestar", "Si no responde, te lo vuelve a proponer a los 14 d\xEDas, hasta tres veces."],
        ["Sin historia cl\xEDnica", "Guarda solo nombre, celular y fechas. Nada sensible."]
      ]
    },
    avisos: "deuda",
    inicio: "deudas",
    repite: "mensual",
    concepto: (mes) => `la cuota de ortodoncia de ${mes}`,
    // "Que vuelvan": cada paciente tiene la fecha de su última visita y cada cuántos meses vuelve.
    vuelta: {
      cada: 6,
      campoUltima: "\xDAltimo control",
      titulo: "Les toca el control",
      nadie: "Nadie tiene el control vencido",
      conCuota: "Paga un tratamiento en cuotas (ortodoncia, implantes)",
      guardar: "Guardar el paciente"
    },
    textos: {
      navClientes: "Pacientes",
      fichaTitulo: "Ficha del paciente",
      tituloLista: "Cuotas que te deben",
      fab: "Cargar paciente",
      vacioTitulo: "Todav\xEDa no cargaste pacientes",
      vacioTexto: "Carg\xE1 a cada paciente con la fecha de su \xFAltimo control. Cuando le toque volver, aparece en Avisos con el mensaje listo.",
      vacioBoton: "Cargar el primer paciente",
      nuevaTitulo: "Cargar un paciente",
      campoCliente: "Paciente",
      campoConcepto: "Qu\xE9 se cobra",
      guardar: "Guardar la cuota",
      loQueDebe: "Cuotas que debe",
      cargarle: "Cargarle una cuota",
      sinClientes: "Todav\xEDa no hay pacientes."
    }
  },
  combi: {
    id: "combi",
    nombre: "Combi al d\xEDa",
    archivo: "combi-al-dia",
    color: "#b8860b",
    precio: 29e3,
    venta: {
      para: "Para transportes escolares",
      quienes: "familias",
      titular: "Cobr\xE1 la cuota de la combi sin escribir uno por uno",
      bajada: "Carg\xE1s a cada familia con su cuota mensual. La app te muestra qui\xE9n se atras\xF3 y te deja el WhatsApp listo.",
      puntos: [
        ["Por colegio y turno", "Las familias quedan ordenadas por recorrido."],
        ["El mensaje nombra a los chicos", '"Hola Laura, hoy vence la combi de marzo de Sofi y Tom\xE1s."'],
        ["La cuota se repite sola", "La del mes siguiente se crea sin que hagas nada."]
      ]
    },
    avisos: "deuda",
    inicio: "deudas",
    repite: "mensual",
    notaEnMensaje: true,
    agrupa: true,
    concepto: (mes) => `la combi de ${mes}`,
    textos: {
      navClientes: "Familias",
      fichaTitulo: "Ficha de la familia",
      tituloLista: "Qui\xE9n debe la cuota",
      fab: "Cargar cuota",
      vacioTitulo: "Nadie debe la cuota",
      vacioTexto: "Carg\xE1 a cada familia con su cuota mensual. La del mes que viene se crea sola.",
      vacioBoton: "Cargar la primera familia",
      nuevaTitulo: "Cargar una cuota",
      campoCliente: "Mam\xE1, pap\xE1 o responsable",
      ayudaCliente: "A qui\xE9n le escrib\xEDs para cobrar. Si ya existe, elegilo de la lista.",
      campoConcepto: "Qu\xE9 se cobra",
      guardar: "Guardar la cuota",
      loQueDebe: "Cuotas que debe",
      cargarle: "Cargarle una cuota",
      grupo: "Colegio y turno",
      ayudaGrupo: "Por ejemplo: San Jos\xE9, turno ma\xF1ana.",
      nota: "Chicos que viajan",
      ayudaNota: 'Aparece en el mensaje: "la combi de marzo de Sofi y Tom\xE1s".',
      sinClientes: "Todav\xEDa no hay familias. Se crean al cargar una cuota."
    }
  }
};

// tienda/nucleo.js
var APPS = Object.fromEntries(Object.values(RUBROS).filter((r) => r.archivo && r.precio).map((r) => [r.id, r]));
var json = (datos, estado = 200) => new Response(JSON.stringify(datos), { status: estado, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });
var aHex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
async function firma(secreto, texto) {
  const clave = await crypto.subtle.importKey("raw", new TextEncoder().encode(secreto), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return aHex(await crypto.subtle.sign("HMAC", clave, new TextEncoder().encode(texto))).slice(0, 40);
}
function iguales(a, b) {
  let r = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) r |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return r === 0;
}
async function licenciaDe(env, app, pago) {
  const base = `${app}.${pago}`;
  return `${btoa(base).replace(/=+$/, "")}.${await firma(env.LICENCIA_SECRETO, base)}`;
}
async function leerLicencia(env, codigo) {
  const [datos, sello] = String(codigo || "").split(".");
  let base = "";
  try {
    base = atob(datos || "");
  } catch {
    return null;
  }
  const [app, pago] = base.split(".");
  if (!APPS[app] || !/^\d+$/.test(pago || "") || !sello || !env.LICENCIA_SECRETO) return null;
  return iguales(await firma(env.LICENCIA_SECRETO, base), sello) ? { app, pago } : null;
}
async function mercadoPago(e, ruta, opciones = {}) {
  const r = await e.salir(`https://api.mercadopago.com${ruta}`, { ...opciones, headers: { Authorization: `Bearer ${e.env.MP_ACCESS_TOKEN}`, "Content-Type": "application/json" } });
  let datos = {};
  try {
    datos = await r.json();
  } catch {
    datos = {};
  }
  return { ok: r.ok, estado: r.status, datos };
}
function pagoValido(pago, rubro) {
  return pago?.status === "approved" && String(pago.external_reference || "").startsWith(`${rubro.id}:`) && Number(pago.transaction_amount) >= rubro.precio;
}
async function manejarTienda(request, e) {
  const url = new URL(request.url);
  const conectada = !!(e.env.MP_ACCESS_TOKEN && e.env.LICENCIA_SECRETO);
  try {
    if (url.pathname === "/api/comprar") {
      const rubro = APPS[url.searchParams.get("app")];
      if (!rubro) return new Response("Esa app no existe.", { status: 404 });
      if (!conectada) return new Response("La tienda todav\xEDa no est\xE1 conectada a Mercado Pago.", { status: 503 });
      const referencia = `${rubro.id}:${aHex(crypto.getRandomValues(new Uint8Array(10)))}`;
      const { ok, datos } = await mercadoPago(e, "/checkout/preferences", {
        method: "POST",
        body: JSON.stringify({
          items: [{ title: `${rubro.titulo || rubro.nombre} (pago \xFAnico)`, quantity: 1, unit_price: rubro.precio, currency_id: "ARS" }],
          external_reference: referencia,
          back_urls: { success: `${url.origin}/gracias.html?app=${rubro.id}`, pending: `${url.origin}/gracias.html?app=${rubro.id}`, failure: `${url.origin}/${rubro.archivo}/?pago=no` },
          auto_return: "approved",
          binary_mode: true,
          // se aprueba o se rechaza en el momento: la app se entrega al instante
          // Sin efectivo (Rapipago, Pago Fácil): tarda días en acreditarse y la app se promete al instante.
          payment_methods: { excluded_payment_types: [{ id: "ticket" }, { id: "atm" }] }
        })
      });
      if (!ok || !datos.init_point) return new Response("Mercado Pago no pudo armar el cobro. Prob\xE1 de nuevo en un rato.", { status: 502 });
      return new Response(null, { status: 302, headers: { Location: datos.init_point, "Cache-Control": "no-store" } });
    }
    if (url.pathname === "/api/activar") {
      const rubro = APPS[url.searchParams.get("app")];
      const pagoId = url.searchParams.get("pago") || "";
      if (!rubro || !/^\d{4,20}$/.test(pagoId)) return json({ ok: false, motivo: "datos" }, 400);
      if (!conectada) return json({ ok: false, motivo: "tienda" }, 503);
      const { ok, datos: pago } = await mercadoPago(e, `/v1/payments/${pagoId}`);
      if (!ok) return json({ ok: false, motivo: "no_encontrado" }, 404);
      const ref = url.searchParams.get("ref") || "";
      const mail = (url.searchParams.get("mail") || "").trim().toLowerCase();
      const esSuyo = ref && iguales(ref, String(pago.external_reference || "")) || mail && mail === String(pago.payer?.email || "").toLowerCase();
      if (!esSuyo) return json({ ok: false, motivo: "no_encontrado" }, 404);
      if (["pending", "in_process", "authorized"].includes(pago.status)) return json({ ok: false, motivo: "pendiente" });
      if (!pagoValido(pago, rubro)) return json({ ok: false, motivo: "no_aprobado" });
      return json({ ok: true, app: rubro.id, licencia: await licenciaDe(e.env, rubro.id, pagoId), abrir: `/${rubro.archivo}/app.html` });
    }
    if (url.pathname === "/api/verificar") {
      const lic = await leerLicencia(e.env, url.searchParams.get("licencia"));
      if (!lic) return json({ ok: false });
      try {
        const { ok, datos: pago } = await mercadoPago(e, `/v1/payments/${lic.pago}`);
        if (ok && !pagoValido(pago, APPS[lic.app])) return json({ ok: false });
      } catch {
      }
      return json({ ok: true, app: lic.app });
    }
    return null;
  } catch (err) {
    console.error("tienda:", err?.stack || err);
    return json({ ok: false, motivo: "error" }, 500);
  }
}
export {
  APPS,
  leerLicencia,
  licenciaDe,
  manejarTienda
};
