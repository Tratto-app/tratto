// Las micro apps de nicho. Todas son la misma app con otro nombre, otras
// palabras y un par de comportamientos distintos:
//   avisos: 'deuda' → un aviso por cuota con vencimiento (antes, el día, +3, +7)
//           'saldo' → un aviso por cliente con el total, desde el día de cobro
//   inicio: 'deudas' → la lista de inicio muestra cada cuota
//           'clientes' → muestra cada cliente con su saldo
export const RUBROS = {
  cobranza: { id: 'cobranza', nombre: 'Cobranza sin vueltas', avisos: 'deuda', inicio: 'deudas', textos: {} },

  cuotas: {
    id: 'cuotas', nombre: 'Cuotas al día', archivo: 'cuotas-al-dia', color: '#1f5fbf', precio: 29000,
    venta: {
      para: 'Para academias, escuelas de danza y fútbol, y profes', quienes: 'alumnos',
      titular: 'Sabé quién te debe la cuota y reclamala con un toque',
      bajada: 'Cargás a tus alumnos una vez. Cada mañana la app te muestra a quién escribirle y te deja el WhatsApp listo para mandar.',
      puntos: [
        ['La cuota del mes que viene se crea sola', 'Cargás la cuota una vez y la app la repite todos los meses.'],
        ['El mensaje nombra al chico', '"Hola Laura, hoy vence la cuota de marzo de Sofi." Le llega a la mamá o al papá.'],
        ['Sabés cuánto falta cobrar', 'El total, lo vencido y lo que entró en el mes, siempre a la vista.'],
      ],
    },
    avisos: 'deuda', inicio: 'deudas', repite: 'mensual', notaEnMensaje: true, agrupa: true,
    concepto: (mes) => `la cuota de ${mes}`,
    textos: {
      navClientes: 'Alumnos', fichaTitulo: 'Ficha del alumno', tituloLista: 'Quién debe la cuota', fab: 'Cargar cuota',
      vacioTitulo: 'Nadie debe la cuota', vacioTexto: 'Cargá a cada alumno con su cuota. Si se repite todos los meses, la del mes que viene se crea sola.',
      vacioBoton: 'Cargar la primera cuota', nuevaTitulo: 'Cargar una cuota', campoCliente: 'A quién le escribís',
      ayudaCliente: 'El alumno, o la mamá o el papá si es chico. Si ya existe, elegilo de la lista.',
      campoConcepto: 'Qué se cobra', guardar: 'Guardar la cuota', loQueDebe: 'Cuotas que debe', cargarle: 'Cargarle una cuota',
      grupo: 'Clase o grupo', ayudaGrupo: 'Por ejemplo: Danza jazz, martes y jueves.',
      nota: 'Nombre del alumno', ayudaNota: 'Solo si le escribís a la mamá o al papá. Aparece en el mensaje: "la cuota de marzo de Sofi".',
      sinClientes: 'Todavía no hay alumnos. Se crean al cargar una cuota.',
    },
  },

  libreta: {
    id: 'libreta', nombre: 'Libreta', titulo: 'Libreta de fiado', archivo: 'libreta', color: '#a4491b', precio: 19000,
    venta: {
      para: 'Para almacenes y kioscos', quienes: 'clientes',
      titular: 'La libreta de fiado, en el celular',
      bajada: 'Anotás cada fiado en dos toques. La app suma sola, te dice cuánto te deben en total y te arma el mensaje para reclamarlo.',
      puntos: [
        ['Se anota en dos toques', 'Cliente y monto. Más rápido que buscar la hoja en el cuaderno.'],
        ['Entregas a cuenta', 'Si te deja una parte, se descuenta de lo más viejo y queda anotado lo que falta.'],
        ['Reclamás sin vueltas', 'Desde el día de cobro, la app te propone el mensaje con el saldo de cada uno.'],
      ],
    },
    avisos: 'saldo', inicio: 'clientes', sinVencimiento: true,
    concepto: () => 'compra',
    textos: {
      tituloLista: 'Quién tiene fiado', fab: 'Anotar fiado', vacioTitulo: 'La libreta está en blanco',
      vacioTexto: 'Anotá cada fiado en la cuenta del cliente. La app suma y te dice cuánto te deben en total.',
      vacioBoton: 'Anotar el primer fiado', nuevaTitulo: 'Anotar un fiado', campoConcepto: 'Qué llevó (opcional)',
      ayudaConcepto: 'Para acordarte después. No hace falta.', guardar: 'Anotar', loQueDebe: 'Lo que tiene anotado', cargarle: 'Anotarle',
      falta: 'Total fiado', sinClientes: 'Todavía no hay clientes. Se crean al anotar un fiado.',
    },
  },

  control: {
    id: 'control', nombre: 'Control al día', archivo: 'control-al-dia', color: '#0f766e', precio: 59000,
    venta: {
      para: 'Para odontólogos y consultorios', quienes: 'pacientes',
      titular: 'Tus pacientes vuelven al control. Vos solo tocás enviar',
      bajada: 'Cada mañana la app te muestra a quién le toca el control y te deja el WhatsApp escrito con su nombre. Lo mandás desde tu celular con un toque. También lleva las cuotas de ortodoncia e implantes.',
      sellos: ['Pago único', 'Se abre al instante', 'Sin historia clínica'],
      puntos: [
        ['El sillón no queda vacío', 'A los 6 meses del último control, el paciente aparece en tu lista con el mensaje armado.'],
        ['Insiste sin molestar', 'Si no responde, te lo vuelve a proponer a los 14 días, hasta tres veces.'],
        ['Sin historia clínica', 'Guarda solo nombre, celular y fechas. Nada sensible.'],
      ],
      // Lo que recibe el paciente: el texto sale de textoControl (src/logica.js), el mismo que arma la app.
      chat: {
        titulo: 'Esto es lo que le llega a tu paciente',
        bajada: 'Sale de tu WhatsApp, con tu número. El paciente sabe que sos vos y te contesta a vos.',
        negocio: 'Consultorio Dra. Acosta', paciente: 'Marta Gómez', meses: 6,
        respuesta: '¡Sí! ¿Tenés algo el jueves a la tarde?',
      },
      manana: {
        titulo: 'Así es tu mañana con Control al día',
        pasos: [
          ['8:50', 'Abrís la app', 'Te muestra los pacientes a los que hoy les toca el control.'],
          ['8:52', 'Tocás enviar', 'El mensaje ya está escrito con el nombre de cada uno. Sale de tu WhatsApp.'],
          ['14 días después', 'La app insiste por vos', 'Si alguno no respondió, te lo vuelve a mostrar, hasta tres veces. Cuando viene, tocás "Vino hoy" y el plazo vuelve a empezar.'],
        ],
      },
      calculo: {
        titulo: '¿Cuánto vale un paciente que vuelve?',
        bajada: 'Poné tus números. Es una cuenta, no una promesa.',
        cantidad: 'Pacientes por mes que vuelven gracias al aviso', cantidadInicial: 4, cantidadMax: 20,
        precio: 'Lo que cobrás un control', precioInicial: 40000,
        resultado: 'por mes en turnos que hoy se te escapan',
      },
      extras: {
        titulo: 'Pensada para un consultorio',
        items: [
          ['Tu lista de pacientes, de una', 'Pegás la lista o subís el Excel que ya tenés: nombre, celular y fecha del último control.'],
          ['Cuotas de ortodoncia e implantes', 'Te avisa quién tiene la cuota vencida y le arma el recordatorio.'],
          ['Nada de historia clínica', 'Solo nombre, celular y fechas. Nada sensible.'],
          ['Tus datos, en tu celular', 'No los ve nadie más. La app te recuerda guardar una copia por si cambiás de celular.'],
          ['iPhone y Android', 'Se abre en el navegador y queda como ícono en la pantalla de inicio. No hay que bajar nada.'],
          ['Sin cuota mensual', 'La pagás una vez y es tuya.'],
        ],
      },
      preguntas: [
        ['¿Puedo cargar los pacientes que ya tengo?', 'Sí. Pegás la lista o subís un Excel con nombre, celular y fecha del último control, y la app los carga todos juntos.'],
        ['¿Cada cuánto avisa?', 'A los 6 meses del último control, o cada cuánto le pongas a cada paciente.'],
      ],
    },
    avisos: 'deuda', inicio: 'deudas', repite: 'mensual',
    concepto: (mes) => `la cuota de ortodoncia de ${mes}`,
    // "Que vuelvan": cada paciente tiene la fecha de su última visita y cada cuántos meses vuelve.
    vuelta: {
      cada: 6, campoUltima: 'Último control', titulo: 'Les toca el control', nadie: 'Nadie tiene el control vencido',
      conCuota: 'Paga un tratamiento en cuotas (ortodoncia, implantes)', guardar: 'Guardar el paciente',
    },
    textos: {
      navClientes: 'Pacientes', fichaTitulo: 'Ficha del paciente', tituloLista: 'Cuotas que te deben', fab: 'Cargar paciente',
      vacioTitulo: 'Todavía no cargaste pacientes',
      vacioTexto: 'Cargá a cada paciente con la fecha de su último control. Cuando le toque volver, aparece en Avisos con el mensaje listo.',
      vacioBoton: 'Cargar el primer paciente', nuevaTitulo: 'Cargar un paciente', campoCliente: 'Paciente',
      campoConcepto: 'Qué se cobra', guardar: 'Guardar la cuota', loQueDebe: 'Cuotas que debe', cargarle: 'Cargarle una cuota',
      sinClientes: 'Todavía no hay pacientes.',
    },
  },

  combi: {
    id: 'combi', nombre: 'Combi al día', archivo: 'combi-al-dia', color: '#b8860b', precio: 29000,
    venta: {
      para: 'Para transportes escolares', quienes: 'familias',
      titular: 'Cobrá la cuota de la combi sin escribir uno por uno',
      bajada: 'Cargás a cada familia con su cuota mensual. La app te muestra quién se atrasó y te deja el WhatsApp listo.',
      puntos: [
        ['Por colegio y turno', 'Las familias quedan ordenadas por recorrido.'],
        ['El mensaje nombra a los chicos', '"Hola Laura, hoy vence la combi de marzo de Sofi y Tomás."'],
        ['La cuota se repite sola', 'La del mes siguiente se crea sin que hagas nada.'],
      ],
    },
    avisos: 'deuda', inicio: 'deudas', repite: 'mensual', notaEnMensaje: true, agrupa: true,
    concepto: (mes) => `la combi de ${mes}`,
    textos: {
      navClientes: 'Familias', fichaTitulo: 'Ficha de la familia', tituloLista: 'Quién debe la cuota', fab: 'Cargar cuota',
      vacioTitulo: 'Nadie debe la cuota', vacioTexto: 'Cargá a cada familia con su cuota mensual. La del mes que viene se crea sola.',
      vacioBoton: 'Cargar la primera familia', nuevaTitulo: 'Cargar una cuota', campoCliente: 'Mamá, papá o responsable',
      ayudaCliente: 'A quién le escribís para cobrar. Si ya existe, elegilo de la lista.',
      campoConcepto: 'Qué se cobra', guardar: 'Guardar la cuota', loQueDebe: 'Cuotas que debe', cargarle: 'Cargarle una cuota',
      grupo: 'Colegio y turno', ayudaGrupo: 'Por ejemplo: San José, turno mañana.',
      nota: 'Chicos que viajan', ayudaNota: 'Aparece en el mensaje: "la combi de marzo de Sofi y Tomás".',
      sinClientes: 'Todavía no hay familias. Se crean al cargar una cuota.',
    },
  },
};
