/* Escena del video 3D de arreglos generales (comun-3d.js). Cada red tiene su
   HTML (video-3d-arreglos-tt/ig/fb.html) que solo define window.RED.
   La cocina de tu casa, de día: la heladera con la lista de arreglos pegada
   (que no para de crecer), la mesada con la alacena arriba, el foco del techo
   y tu hijo adolescente (el testigo) que te filma con el celular. Historia en
   escalera, graciosa: cambiás el foco y se corta la luz de toda la casa (él te
   alumbra con la linterna del celular); colgás un cuadro y se cae con medio
   revoque; ajustás la puerta de la alacena y te queda en la mano, mientras la
   lista llega al piso. Con el precio llega la persona de arreglos y resuelve
   las tres cosas; la lista entra en un papelito. Remate (cámara en tu hijo):
   te muestra el celular, tu video ya tiene un millón de vistas. */
window.ESCENA3D = (function () {
  let k, yo, hijo, tec, valija, foco, focoLuz, linterna, cuadro, agujero, revoque = [], puertaD, puertaI, lista, listaPiso, papelito, tilde = [], cel, pantalla, chispas;
  let etqLista, etqRevoque, etqLista2, etqVistas, card, chip, fin, url;
  const P = {};
  const HELADERA = { x: -1.8, z: -2.15 }, FRENTE_H = -1.77;
  const MESADA = { x: 0.5, z: -2.25 };
  const ALACENA = { x: 0.5, y: 2.05, z: -2.42 };
  const FOCO = { x: 0.2, y: 2.42, z: -1.0 };
  const CUADRO = { x: 2.15, y: 1.55, z: -2.55 };
  const HIJO = { x: 2.85, z: -0.95 };
  const BASE = {};

  function tiempos() {
    P.f2 = k.frase(2, 4.3);
    P.f3 = k.frase(3, 8.6);
    P.f4 = k.frase(4, 12.0);
    P.f5 = k.frase(5, 15.4);
    P.f6 = k.frase(6, 22.4);
    P.corta = k.palabra('corta', 1, P.f2 + 1.6);       // se corta la luz
    P.cae = k.palabra('cae', 1, P.f3 + 1.3);           // se cae el cuadro
    P.mano = k.palabra('mano', 1, P.f4 + 2.2);         // la puerta en la mano
    P.visita = k.palabra('visita', 1, P.f5 + 0.9);     // entra la persona de arreglos
    P.precio = k.palabra('cuarenta', 1, P.f5 + 3.8);
    P.fix = i => P.visita + 1.1 + i * 1.0;            // los tres arreglos: puerta, cuadro, foco
    P.fin = k.finVoz(26.0);
    P.rem = P.f6 + 1.5;                               // remate: tu hijo
    P.vistas = P.rem + 1.0;
    P.cierre = Math.max(P.fin + 0.35, P.vistas + 2.0);
  }

  function cocina() {
    const T = k.THREE, c = (w, h, d, col, x, y, z, s = true) => k.caja(w, h, d, col, x, y, z, k.escena, s);
    const piso = new T.Mesh(new T.PlaneGeometry(40, 40), k.mat('#D8D2C4'));
    piso.rotation.x = -Math.PI / 2; piso.position.y = -0.01; piso.receiveShadow = true; k.escena.add(piso);
    for (let i = -8; i <= 8; i++) for (let j = 0; j < 8; j++) if ((i + j) % 2) c(0.5, 0.004, 0.5, '#C9C2B2', i * 0.5, 0.0, -2.35 + j * 0.5, false);
    c(9, 3.3, 0.2, '#F1E2B8', 0, 1.65, -2.7);                                                        // pared del fondo
    c(0.2, 3.3, 7, '#E9D6A8', -3.2, 1.65, 0.8);                                                       // pared izquierda
    for (let i = 0; i < 10; i++) for (let j = 0; j < 3; j++) c(0.2, 0.2, 0.02, (i + j) % 2 ? '#F4F2EC' : '#D9E6E0', MESADA.x - 0.9 + i * 0.2, 1.05 + j * 0.2, -2.59, false);   // azulejos
    // ventana a la izquierda con el día
    c(1.1, 1.1, 0.04, '#A9D3E6', -3.08, 1.7, -0.6, false); c(0.08, 1.24, 1.24, '#F4F2EC', -3.06, 1.7, -0.6);
    c(0.1, 0.06, 1.1, '#F4F2EC', -3.04, 1.7, -0.6, false);
    // la heladera
    c(0.85, 1.85, 0.75, '#EDEFEA', HELADERA.x, 0.925, HELADERA.z); c(0.86, 0.02, 0.76, '#C9CDCB', HELADERA.x, 1.3, HELADERA.z, false);
    c(0.05, 0.5, 0.05, '#AEB4B8', HELADERA.x + 0.33, 1.6, FRENTE_H - 0.03); c(0.05, 0.6, 0.05, '#AEB4B8', HELADERA.x + 0.33, 0.85, FRENTE_H - 0.03);
    [[-0.25, 1.72, '#E0443A'], [0.18, 1.78, '#3D6E9E']].forEach(([x, y, col]) => c(0.06, 0.06, 0.03, col, HELADERA.x + x, y, FRENTE_H - 0.005, false));   // imanes
    // la mesada y la alacena (con dos puertas)
    const m = k.mesada({ ancho: 2.0, mueble: '#E7E1D3', puertas: '#D8CFBC', tapa: '#3E4744' }); m.position.set(MESADA.x, 0, MESADA.z);
    c(1.8, 0.7, 0.36, '#D8CFBC', ALACENA.x, ALACENA.y, ALACENA.z);
    const hacerPuerta = (signo) => {
      const g = new T.Group(); k.escena.add(g);
      k.caja(0.88, 0.66, 0.04, '#E7E1D3', -signo * 0.44, 0, 0, g); k.caja(0.06, 0.18, 0.05, k.C.laton, -signo * 0.78, -0.12, 0.04, g, false);
      return g;
    };
    puertaI = hacerPuerta(-1); puertaI.position.set(ALACENA.x - 0.89, ALACENA.y, ALACENA.z + 0.2);
    puertaD = hacerPuerta(1); puertaD.position.set(ALACENA.x + 0.89, ALACENA.y, ALACENA.z + 0.2);
    // el foco: cable, pantalla y lamparita
    c(0.02, 0.5, 0.02, '#2A2E2C', FOCO.x, FOCO.y + 0.4, FOCO.z, false);
    const pant = new T.Mesh(new T.ConeGeometry(0.22, 0.18, 10, 1, true), k.mat('#2B7E62')); pant.position.set(FOCO.x, FOCO.y + 0.12, FOCO.z); pant.material.side = T.DoubleSide; k.escena.add(pant);
    foco = new T.Mesh(new T.IcosahedronGeometry(0.075, 1), new T.MeshBasicMaterial({ color: '#FFF2B8' })); foco.position.set(FOCO.x, FOCO.y, FOCO.z); k.escena.add(foco);
    focoLuz = new T.PointLight('#FFE7A8', 0, 6); focoLuz.position.set(FOCO.x, FOCO.y - 0.1, FOCO.z); k.escena.add(focoLuz);
    // el agujero que deja el cuadro
    agujero = new T.Group(); agujero.position.set(CUADRO.x, CUADRO.y + 0.05, CUADRO.z + 0.02); k.escena.add(agujero);
    k.caja(0.5, 0.34, 0.02, '#9C9384', 0, 0, 0, agujero, false); k.caja(0.3, 0.22, 0.025, '#7E7568', 0.05, -0.02, 0, agujero, false);
    // una puerta abierta a la derecha (por donde entra la persona de arreglos)
    c(0.2, 3.3, 3.2, '#F1E2B8', 3.6, 1.65, -1.2);
  }

  function armarCuadro() {
    const g = new k.THREE.Group();
    k.caja(0.62, 0.48, 0.04, '#8C5A2E', 0, 0, 0, g); k.caja(0.52, 0.38, 0.02, '#A9D3E6', 0, 0, 0.02, g, false);
    k.caja(0.3, 0.14, 0.022, '#3F7A4A', 0.05, -0.1, 0.022, g, false); k.caja(0.08, 0.08, 0.023, '#F2CF3B', -0.15, 0.1, 0.022, g, false);
    k.escena.add(g); return g;
  }
  function armarCel(padre) {
    const g = new k.THREE.Group();
    k.caja(0.09, 0.17, 0.02, '#1E2224', 0, 0, 0, g);
    pantalla = k.caja(0.075, 0.14, 0.005, '#8FD9BC', 0, 0, 0.012, g, false);
    padre.add(g); return g;
  }

  function camara(t) {
    const cam = k.camara, V = (x, y, z) => new k.THREE.Vector3(x, y, z);
    let pos, mira;
    const z1 = (a, b, x0, x1) => k.lerp(a, b, k.suave((t - x0) / Math.max(0.3, x1 - x0)));
    if (t < P.f2) {                               // 1. la lista de la heladera; tu hijo al costado
      const z = z1(1.0, 0.9, 0, P.f2);
      mira = V(-0.45, 1.55, -1.3); pos = mira.clone().add(V(-0.8 * z, 1.1 * z, 10.0 * z));
    } else if (t < P.f3) {                        // 2. el foco y el apagón
      const z = z1(1, 0.92, P.f2, P.f3);
      mira = V(0.6, 1.65, -0.9); pos = mira.clone().add(V(0.8 * z, 0.5 * z, 8.6 * z));
    } else if (t < P.f4) {                        // 3. el cuadro y el revoque
      const z = z1(1, 0.92, P.f3, P.f4);
      mira = V(1.5, 1.5, -1.5); pos = mira.clone().add(V(-1.4 * z, 0.9 * z, 8.4 * z));
    } else if (t < P.f5) {                        // 4. la puerta de la alacena; la lista llega al piso
      const z = z1(1, 0.94, P.f4, P.f5);
      mira = V(-0.1, 1.55, -1.3); pos = mira.clone().add(V(1.4 * z, 1.0 * z, 10.4 * z));
    } else if (t < P.f6) {                        // 5. la persona de arreglos, abierto
      const z = z1(1, 0.95, P.f5, P.f6);
      mira = V(0.4, 1.55, -1.2); pos = mira.clone().add(V(0.4 * z, 1.4 * z, 11.0 * z));
    } else if (t < P.rem) {                       // 6. desde la izquierda
      const z = z1(1, 0.94, P.f6, P.rem);
      mira = V(0.4, 1.5, -1.0); pos = mira.clone().add(V(-1.8 * z, 1.1 * z, 10.0 * z));
    } else {                                      // 7. remate: tu hijo y el celular, de cerca
      const g = k.suave((t - P.rem) / 0.7);
      mira = V(k.lerp(0.4, 2.8, g), k.lerp(1.5, 1.35, g), k.lerp(-1.0, -0.9, g));
      pos = mira.clone().add(V(k.lerp(-1.8, -0.9, g), k.lerp(1.1, 0.35, g), k.lerp(10.0, 4.8, g)));
    }
    cam.position.copy(pos); cam.lookAt(mira); cam.updateProjectionMatrix(); cam.updateMatrixWorld();
  }

  const mirar = (p, x, z) => Math.atan2(x - p.x, z - p.z);
  function ubicar(p, x, z, rot, y = 0) { p.position.set(x, y, z); p.rotation.set(0, rot, 0); }

  return {
    get duracion() { return P.cierre + 2.8; },
    get cierre() { return P.cierre; },
    get efectos() {
      const r = x => +x.toFixed(2);
      return [
        { efecto: 'tic', t: r(0.9), db: -18 }, { efecto: 'tic', t: r(2.1), db: -18 },
        { efecto: 'latigazo', t: r(P.f2 - 0.2), db: -19 },
        { efecto: 'pop', t: r(P.corta - 0.05), db: -12 },
        { efecto: 'falla', t: r(P.corta), db: -14 },
        { efecto: 'obturador', t: r(P.corta + 0.5), db: -16 },
        { efecto: 'latigazo', t: r(P.f3 - 0.2), db: -19 },
        { efecto: 'tic', t: r(P.f3 + 0.5), db: -14 }, { efecto: 'tic', t: r(P.f3 + 0.8), db: -14 }, { efecto: 'tic', t: r(P.f3 + 1.1), db: -14 },
        { efecto: 'crujido', t: r(P.cae - 0.05), db: -12 },
        { efecto: 'golpe', t: r(P.cae + 0.35), db: -12 },
        { efecto: 'latigazo', t: r(P.f4 - 0.2), db: -19 },
        { efecto: 'crujido', t: r(P.mano - 0.1), db: -13 },
        { efecto: 'chapa', t: r(P.mano + 0.05), db: -17 },
        { efecto: 'latigazo', t: r(P.f5 - 0.2), db: -19 },
        ...[0, 1, 2].map(i => ({ efecto: 'sello', t: r(P.fix(i)), db: -16 })),
        { efecto: 'pop', t: r(P.precio - 0.15), db: -16 },
        { efecto: 'campanita', t: r(P.precio + 0.05), db: -18 },
        { efecto: 'latigazo', t: r(P.f6 - 0.2), db: -19 },
        { efecto: 'acierto', t: r(P.f6 + 0.4), db: -17 },
        { efecto: 'latigazo', t: r(P.rem - 0.2), db: -19 },
        { efecto: 'recibido', t: r(P.vistas), db: -14 },
        { efecto: 'recibido', t: r(P.vistas + 0.5), db: -16 },
        { efecto: 'golpe', t: r(P.cierre + 0.1), db: -14 },
      ];
    },
    armar(kit) {
      k = kit; tiempos();
      const T = k.THREE;
      k.sol.position.set(-8, 11, 6); k.sol.color.set('#FFF4DF');
      k.escena.background = new T.Color('#F1E2B8'); k.escena.fog.color.set('#F1E2B8');
      BASE.sol = k.sol.intensity; BASE.cielo = k.cielo.intensity; BASE.fondo = k.escena.background.clone();
      cocina();
      cuadro = armarCuadro();
      for (let i = 0; i < 9; i++) revoque.push(k.caja(0.08 + (i % 3) * 0.04, 0.05 + (i % 2) * 0.04, 0.05, i % 2 ? '#CFC6B4' : '#B9AF9C', 0, -5, 0, k.escena));
      // la lista: una tira de papel que crece hacia abajo y después por el piso
      lista = k.caja(0.4, 1, 0.012, '#F6E39A', HELADERA.x, 1.55, FRENTE_H - 0.01, k.escena, false);
      listaPiso = k.caja(0.4, 0.012, 1, '#F6E39A', HELADERA.x, 0.012, FRENTE_H, k.escena, false);
      k.caja(0.02, 1, 0.014, '#E0443A', -0.15, 0, 0.004, lista, false);                         // el margen rojo del papel
      k.caja(0.02, 0.014, 1, '#E0443A', -0.15, 0.004, 0, listaPiso, false);
      papelito = new T.Group(); papelito.position.set(HELADERA.x, 1.5, FRENTE_H - 0.005); k.escena.add(papelito);
      k.caja(0.2, 0.24, 0.012, '#FCFBF8', 0, 0, 0, papelito, false);
      for (let i = 0; i < 3; i++) { tilde.push(k.caja(0.06, 0.025, 0.014, '#2B7E62', -0.05, 0.07 - i * 0.07, 0.003, papelito, false)); k.caja(0.08, 0.012, 0.014, '#5D6A64', 0.04, 0.07 - i * 0.07, 0.003, papelito, false); }
      // vos (camisa celeste)
      yo = k.personaje({ ropa: '#5B8DB8', pantalon: '#34405A', pelo: '#3A2A1E', piel: '#E2B48F', zapatillas: '#F2F2EE' });
      // tu hijo adolescente (el testigo): buzo gris, auriculares y el celular en la mano
      hijo = k.personaje({ ropa: '#4A4F55', pantalon: '#2E3F66', pelo: '#1E2224', piel: '#D9A27E', zapatillas: '#E0443A' });
      hijo.scale.setScalar(0.9);
      k.caja(0.06, 0.18, 0.18, '#E0443A', -0.26, 0.26, 0, hijo.userData.cuello, false); k.caja(0.06, 0.18, 0.18, '#E0443A', 0.26, 0.26, 0, hijo.userData.cuello, false);
      k.caja(0.5, 0.04, 0.06, '#1E2224', 0, 0.54, 0, hijo.userData.cuello, false);
      cel = armarCel(hijo.userData.brazoD); cel.position.set(0, -0.72, 0.08);
      linterna = new T.SpotLight('#FFFFFF', 0, 9, 0.5, 0.5); k.escena.add(linterna); k.escena.add(linterna.target);
      // la persona de arreglos: mameluco verde, gorra de latón y la valija de herramientas
      tec = k.personaje({ ropa: '#2B7E62', pantalon: '#2B7E62', zapatillas: '#2A2E2C', piel: '#C9956E', pelo: '#2B1D16', gorra: k.C.laton });
      valija = k.herramientas();
      chispas = k.humo(18, '#FFF2B8', 0.04);
      url = k.etiquetaUrl();
      etqLista = k.etiqueta('Lista: 37 arreglos');
      etqRevoque = k.etiqueta('Revoque: 50 % en el piso');
      etqLista2 = k.etiqueta('Lista: 43 arreglos');
      etqVistas = k.etiqueta('Tu video: 1.000.000 de vistas');
      card = k.tarjeta(`<div class="sello">Precio<br>de<br>referencia</div>
        <div class="t-et">VISITA DE 2 HORAS (HASTA 3 ARREGLOS)</div>
        <div class="t-precio">$46.000<span>a</span>$82.000</div>
        <div class="t-nota">Noviembre 2026 · AMBA · por trabajo</div>`);
      chip = k.tarjeta(`<div class="ok">✓</div><div><div class="c1">Pedido publicado gratis</div><div class="c2">Arreglos generales · tu zona</div></div>`, 'chip3d');
      fin = k.cierre('Pedí presupuestos', 'de gente de tu zona');
    },
    animar(t) {
      const U = yo.userData, UH = hijo.userData, UT = tec.userData, V3 = k.THREE.Vector3;

      // ---- la luz: apagón cuando cambiás el foco ----
      const apagon = t >= P.corta && t < P.f3 - 0.05;
      const f = apagon ? 0.08 : 1;
      k.sol.intensity = BASE.sol * f; k.cielo.intensity = BASE.cielo * (apagon ? 0.12 : 1);
      k.escena.background.copy(BASE.fondo).multiplyScalar(apagon ? 0.15 : 1); k.escena.fog.color.copy(k.escena.background);
      const focoAndando = t < P.corta - 0.05 || t >= P.fix(2);
      foco.material.color.set(focoAndando ? '#FFF2B8' : '#8E9490');
      foco.scale.setScalar(t >= P.fix(2) ? 1 + 0.3 * Math.exp(-(t - P.fix(2)) * 4) : 1);
      focoLuz.intensity = focoAndando ? 1.2 : 0;

      // ---- la lista de la heladera ----
      const crece = k.clamp(t / P.f5);                             // de 0,35 m al piso
      const largo = Math.min(1.42, k.lerp(0.3, 1.9, crece * crece));
      const enPiso = k.clamp((t - P.f4) / Math.max(0.5, P.mano + 0.6 - P.f4)) * 1.5;
      const achica = t >= P.fix(2) + 0.4;
      lista.visible = listaPiso.visible = !achica;
      lista.scale.y = largo; lista.position.y = 1.62 - largo / 2;
      listaPiso.visible = !achica && enPiso > 0.01; listaPiso.scale.z = Math.max(0.01, enPiso); listaPiso.position.z = FRENTE_H + enPiso / 2;
      papelito.visible = achica; papelito.scale.setScalar(Math.max(0.001, k.rebote((t - P.fix(2) - 0.4) / 0.35)));
      tilde.forEach((td, i) => { td.visible = t >= P.fix(2) + 0.6 + i * 0.15; });

      // ---- la alacena: la puerta derecha se sale ----
      puertaI.rotation.set(0, 0, 0);
      const suelta = t >= P.mano - 0.05 && t < P.fix(0);
      if (!suelta) { puertaD.position.set(ALACENA.x + 0.89, ALACENA.y, ALACENA.z + 0.2); puertaD.rotation.set(0, t > P.f4 && t < P.mano ? -0.25 - 0.08 * Math.sin(t * 20) : 0, 0); }

      // ---- el cuadro ----
      if (t < P.f3 + 0.2) { cuadro.position.set(1.75, 0.26, -1.88); cuadro.rotation.set(-0.25, 0, 0); }    // apoyado contra la mesada
      else if (t < P.cae) { cuadro.position.set(CUADRO.x, CUADRO.y, CUADRO.z + 0.05); cuadro.rotation.set(0, 0, 0.03 * Math.sin(t * 12)); }
      else if (t < P.fix(1)) {
        const u = k.clamp((t - P.cae) / 0.4);
        cuadro.position.set(CUADRO.x + 0.1 * u, Math.max(0.25, CUADRO.y - 1.4 * u * u), CUADRO.z + 0.05 + 0.35 * u); cuadro.rotation.set(-1.2 * u, 0, 0.5 * u);
      } else { cuadro.position.set(CUADRO.x, CUADRO.y, CUADRO.z + 0.05); cuadro.rotation.set(0, 0, 0); }
      agujero.visible = t >= P.cae && t < P.fix(1);
      revoque.forEach((r, i) => {
        const e = t - P.cae;
        if (e < 0 || t >= P.fix(1)) { r.position.set(0, -5, 0); return; }
        const u = k.clamp(e / 0.5), dx = (i % 3 - 1) * 0.18, dz = 0.1 + (i % 4) * 0.1;
        r.position.set(CUADRO.x + dx * (1 + u), Math.max(0.04, CUADRO.y - 1.5 * u * u), CUADRO.z + 0.1 + dz * u); r.rotation.set(i + u * 4, i, u * 3);
      });

      // ---- vos ----
      U.cadera.position.set(0, 0.92, 0); U.cadera.rotation.set(0, 0, 0); yo.visible = true;
      if (t < P.f2) {                                       // mirás la lista que crece
        const p = { x: -0.75, z: -0.8 }; ubicar(yo, p.x, p.z, mirar(p, HELADERA.x, HELADERA.z));
        k.pose(yo, t > 2.6 ? { manosCabeza: t } : { rascar: t });
      } else if (t < P.f3) {                                // cambiás el foco con los brazos arriba
        const s = k.suave((t - P.f2) / 0.45), p = { x: k.lerp(-0.75, FOCO.x, s), z: k.lerp(-0.8, FOCO.z + 0.05, s) };
        ubicar(yo, p.x, p.z, s < 1 ? mirar({ x: -0.75, z: -0.8 }, FOCO.x, FOCO.z) : 0);
        if (s < 1) k.pose(yo, { caminar: 1, paso: t * 2 });
        else if (t < P.corta) { k.pose(yo, { cabezaX: -0.5 }); U.brazoI.rotation.set(-0.2, 0, 2.9); U.brazoD.rotation.set(-0.2, 0, -2.75 + 0.1 * Math.sin(t * 14)); }
        else { k.pose(yo, { manosCabeza: t }); yo.position.y = t < P.corta + 0.3 ? 0.08 * Math.sin((t - P.corta) / 0.3 * Math.PI) : 0; }
      } else if (t < P.f4) {                                // colgás el cuadro a martillazos
        const s = k.suave((t - P.f3) / 0.45), dest = { x: CUADRO.x - 0.05, z: CUADRO.z + 0.85 };
        ubicar(yo, k.lerp(FOCO.x, dest.x, s), k.lerp(FOCO.z, dest.z, s), s < 1 ? mirar({ x: FOCO.x, z: FOCO.z }, dest.x, dest.z) : Math.PI);
        if (s < 1) k.pose(yo, { caminar: 1, paso: t * 2 });
        else if (t < P.cae) { k.pose(yo, { golpear: t, cabezaX: -0.2 }); U.brazoD.rotation.x -= 0.35; }
        else { const g = k.suave((t - P.cae - 0.3) / 0.3); yo.rotation.y = k.lerp(Math.PI, 0.3, g); k.pose(yo, { manosCabeza: t }); }
      } else if (t < P.f5) {                                // la puerta de la alacena
        const s = k.suave((t - P.f4) / 0.45), dest = { x: ALACENA.x + 0.55, z: -1.35 };
        ubicar(yo, k.lerp(CUADRO.x - 0.05, dest.x, s), k.lerp(CUADRO.z + 0.85, dest.z, s), s < 1 ? mirar({ x: CUADRO.x, z: CUADRO.z + 0.85 }, dest.x, dest.z) : Math.PI);
        if (s < 1) k.pose(yo, { caminar: 1, paso: t * 2 });
        else if (t < P.mano) { k.pose(yo, { cabezaX: -0.35 }); U.brazoD.rotation.set(-2.55, 0, -0.1 + 0.25 * Math.sin(t * 7)); U.brazoI.rotation.set(-2.3, 0, 0.2); }
        else { const g = k.suave((t - P.mano) / 0.4); yo.rotation.y = k.lerp(Math.PI, 0.15, g); k.pose(yo, { cabezaZ: 0.2 }); U.brazoI.rotation.set(-1.15, 0, 0.25); U.brazoD.rotation.set(-1.15, 0, -0.25); }
      } else {                                              // con la puerta en la mano, mirás cómo arregla todo
        const p = { x: -0.6, z: -0.55 }, s = k.suave((t - P.f5) / 0.5);
        ubicar(yo, k.lerp(ALACENA.x + 0.55, p.x, s), k.lerp(-1.35, p.z, s), mirar(p, 0.5, -1.4));
        if (t < P.fix(0)) { k.pose(yo, s < 1 ? { caminar: 1, paso: t * 2 } : {}); U.brazoI.rotation.set(-1.15, 0, 0.25); U.brazoD.rotation.set(-1.15, 0, -0.25); }
        else if (t < P.f6) k.pose(yo, { brazosCruzados: true, cabezaZ: 0.1 * Math.sin(t * 2) });
        else if (t < P.rem) { yo.rotation.y = 0.2; k.pose(yo, { festejo: t }); }
        else { yo.rotation.y = 0.5; k.pose(yo, { manosCabeza: t > P.vistas ? t : 0 }); }
      }
      // la puerta suelta, en tus manos
      if (suelta) {
        yo.updateMatrixWorld(true);
        const adelante = new V3(0, 1.25, 0.5).applyMatrix4(yo.matrixWorld);
        const u = k.clamp((t - P.mano) / 0.25), orig = new V3(ALACENA.x + 0.89, ALACENA.y, ALACENA.z + 0.2);
        puertaD.position.lerpVectors(orig, adelante, u); puertaD.rotation.set(0, yo.rotation.y - 0.2 * (1 - u), 0.15 * u);
      }

      // ---- tu hijo (el testigo): filma todo con el celular ----
      UH.cadera.position.set(0, 0.92, 0);
      const objetivo = t < P.f2 ? { x: HELADERA.x, z: HELADERA.z } : t < P.f3 ? { x: FOCO.x, z: FOCO.z } : t < P.f4 ? { x: CUADRO.x, z: CUADRO.z } : { x: yo.position.x, z: yo.position.z };
      if (t < P.rem) {
        ubicar(hijo, HIJO.x, HIJO.z, mirar(HIJO, objetivo.x, objetivo.z));
        k.pose(hijo, {});
        UH.brazoD.rotation.set(-1.55, 0, -0.05); UH.brazoI.rotation.set(-0.2, 0, 0.15); UH.cuello.rotation.x = 0.05;
        const risa = (t > P.corta + 0.2 && t < P.f3) || (t > P.cae + 0.4 && t < P.f4) || (t > P.mano + 0.3 && t < P.f5);
        if (risa) { const r = Math.sin(t * 26) * 0.07; UH.cuello.rotation.x = -0.25 + r; UH.cadera.rotation.x = -0.08 + r * 0.5; UH.brazoI.rotation.set(-1.6, 0, 0.55); }
        if (t >= P.f5 && t < P.rem) { UH.brazoD.rotation.set(-1.55, 0, -0.05); }
      } else {                                              // remate: te muestra el celular
        const g = k.suave((t - P.rem) / 0.4);
        ubicar(hijo, HIJO.x, HIJO.z, k.lerp(mirar(HIJO, yo.position.x, yo.position.z), 0.1, g));
        k.pose(hijo, {});
        const muestra = k.suave((t - P.vistas + 0.4) / 0.35);
        UH.brazoD.rotation.set(k.lerp(-1.55, -1.35, muestra), 0, -0.35 * muestra); UH.brazoI.rotation.set(0, 0, 0.12);
        if (t > P.vistas + 0.5) { UH.brazoI.rotation.set(0, 0, 2.6 + Math.sin(t * 10) * 0.3); }      // festeja
        cel.rotation.set(Math.PI / 2 * muestra, 0, 0); cel.scale.setScalar(1 + 1.8 * muestra);   // la pantalla, de frente a la cámara
      }
      if (t < P.rem) { cel.rotation.set(0, Math.PI, 0); cel.scale.setScalar(1); }   // la pantalla mira para su lado
      pantalla.material = k.mat(t >= P.vistas ? '#E0443A' : '#8FD9BC');
      // la linterna del celular en el apagón
      linterna.intensity = apagon ? 6 : 0;
      if (apagon) { hijo.updateMatrixWorld(true); const pc = new V3(); cel.getWorldPosition(pc); linterna.position.copy(pc); linterna.target.position.set(yo.position.x, 1.4, yo.position.z); linterna.target.updateMatrixWorld(); }

      // ---- la persona de arreglos ----
      tec.visible = valija.visible = t >= P.visita - 0.3 && t < P.rem + 1.5;
      {
        const entra = k.clamp((t - (P.visita - 0.3)) / 1.0), puntos = [{ x: ALACENA.x + 0.6, z: -1.45 }, { x: CUADRO.x - 0.2, z: -1.75 }, { x: FOCO.x + 0.1, z: FOCO.z + 0.25 }];
        let p, rot, pose = {};
        if (entra < 1) { p = { x: k.lerp(3.4, puntos[0].x, entra), z: k.lerp(-0.3, puntos[0].z, entra) }; rot = mirar({ x: 3.4, z: -0.3 }, puntos[0].x, puntos[0].z); pose = { caminar: 1, paso: t * 2 }; }
        else {
          const i = t < P.fix(0) ? 0 : t < P.fix(1) ? 1 : 2, desde = i ? P.fix(i - 1) : P.visita + 0.7, mov = k.suave((t - desde) / 0.35);
          const a = puntos[Math.max(0, i - 1)], b = puntos[i];
          p = { x: k.lerp(a.x, b.x, i ? mov : 1), z: k.lerp(a.z, b.z, i ? mov : 1) };
          rot = i === 2 ? 0 : Math.PI;
          pose = i && mov < 1 ? { caminar: 1, paso: t * 2.4 } : i === 2 ? {} : { llave: t };
          if (t >= P.f6) { rot = 0.3; pose = { saludo: t }; }
        }
        ubicar(tec, p.x, p.z, rot); k.pose(tec, pose);
        if (pose && !pose.caminar && !pose.saludo && t >= P.fix(1) && t < P.f6) { UT.brazoD.rotation.set(-2.7, 0, -0.1); UT.brazoI.rotation.set(-0.2, 0, 0.2); }   // arriba, al foco
        valija.position.set(p.x + 0.45, 0, p.z + 0.15); valija.rotation.y = 0.3;
      }
      const ch = t >= P.fix(0) - 0.2 ? (t < P.fix(1) - 0.2 ? { x: ALACENA.x + 0.89, y: ALACENA.y, z: ALACENA.z + 0.3 } : t < P.fix(2) - 0.2 ? { x: CUADRO.x, y: CUADRO.y, z: CUADRO.z + 0.2 } : { x: FOCO.x, y: FOCO.y - 0.1, z: FOCO.z }) : { x: 0, y: -5, z: 0 };
      const ultimo = [0, 1, 2].reduce((a, i) => (t >= P.fix(i) - 0.2 ? P.fix(i) - 0.2 : a), P.fix(0) - 0.2);
      chispas.animar(t, ultimo, ultimo + 0.9, ch);

      camara(t);

      // ---- carteles y textos ----
      etqLista.animar(t, 1.3, P.f2 + 0.05, { x: HELADERA.x, y: 1.4, z: FRENTE_H }, 80, -360);
      etqRevoque.animar(t, P.cae + 0.5, P.f4 + 0.05, { x: CUADRO.x, y: 0.15, z: CUADRO.z + 0.5 }, -120, -420);
      etqLista2.animar(t, P.mano + 0.5, P.f5 + 0.05, { x: HELADERA.x + 0.1, y: 0.05, z: FRENTE_H + Math.max(0.2, enPiso) }, 80, -380);
      const pc = new V3(); cel.getWorldPosition(pc);
      etqVistas.animar(t, P.vistas + 0.15, P.cierre + 0.2, { x: pc.x, y: pc.y + 0.12, z: pc.z }, -120, -330);
      k.mostrar(card, t, P.precio - 0.15, P.f6 - 0.05);
      k.mostrar(chip, t, P.f6 + 0.45, P.rem + 0.4);
      url.style.opacity = t < P.cierre ? 1 : 0;
      fin.animar(t, P.cierre);
    },
  };
})();
