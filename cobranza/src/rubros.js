// Las micro apps de nicho. Todas son la misma app con otro nombre, otras
// palabras y un par de comportamientos distintos:
//   avisos: 'deuda' → un aviso por cuota con vencimiento (antes, el día, +3, +7)
//           'saldo' → un aviso por cliente con el total, desde el día de cobro
//   inicio: 'deudas' → la lista de inicio muestra cada cuota
//           'clientes' → muestra cada cliente con su saldo
export const RUBROS = {
  cobranza: { id: 'cobranza', nombre: 'Cobranza sin vueltas', avisos: 'deuda', inicio: 'deudas', textos: {} },

  cuotas: {
    id: 'cuotas', nombre: 'Cuotas al día', archivo: 'cuotas-al-dia', color: '#1f5fbf',
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
    id: 'libreta', nombre: 'Libreta', titulo: 'Libreta de fiado', archivo: 'libreta', color: '#a4491b',
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
    id: 'control', nombre: 'Control al día', archivo: 'control-al-dia', color: '#0f766e',
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
    id: 'combi', nombre: 'Combi al día', archivo: 'combi-al-dia', color: '#b8860b',
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
