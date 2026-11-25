/* Escena del video 3D de catering y pastelería (comun-3d.js). Cada red tiene
   su HTML (video-3d-torta-tt/ig/fb.html) que solo define window.RED.
   El patio de tu casa, de noche, con la guirnalda de luces: la mesa con el
   mantel a cuadros, tu suegra sentada en la punta y el perro (el testigo)
   sentado al costado, que no le saca los ojos de encima a la torta. Historia en
   escalera, graciosa: sacás la torta del horno y se hunde en el medio; le tapás
   el pozo con crema y se inclina como la torre de Pisa (el perro inclina la
   cabeza igual); la sostenés con las velas y se prende fuego el mantel. Con el
   precio, tu torta se resbala de la mesa y cae al piso, y llega la pastelera
   con una torta artesanal de dos pisos. Remate (cámara en el perro): se come
   la tuya del piso, feliz. */
window.ESCENA3D = (function () {
  let k, yo, suegra, pastelera, perro, caja, torta, pivote, bizco, pozo, crema, manga, artesanal, plato, mancha;
  let velas = [], llamas = [], fuego, luzFuego, humoFuego, humoApaga, migas;
  let etqAltura, etqPisa, etqMantel, etqPerro, card, chip, fin, url;
  const P = {};
  const MESA = { x: 0, y: 0.76, z: -0.8, ancho: 2.1, fondo: 0.9 };
  const TORTA = { x: -0.2, z: -0.85 };
  const YO = { x: -0.2, z: -1.55 };
  const PUERTA = { x: -1.95, z: -2.35 };
  const SUEGRA = { x: 1.42, z: -0.8 };
  const PERRO = { x: -0.95, z: -0.05 };
  const PISO = { x: -0.15, z: 0.08 };               // donde cae tu torta
  const PERRO_COME = { x: 0.5, z: 0.1 };             // a la derecha de tu torta, mirando hacia ella
  const YO2 = { x: -0.75, z: -1.55 };                // te corrés cuando se cae la torta
  const FUEGO = { x: TORTA.x + 0.6, z: TORTA.z + 0.32 };

  function tiempos() {
    P.f2 = k.frase(2, 4.0);
    P.f3 = k.frase(3, 7.2);
    P.f4 = k.frase(4, 11.4);
    P.f5 = k.frase(5, 15.0);
    P.f6 = k.frase(6, 21.0);
    P.deja = P.f2 - 0.35;                              // apoyás la torta en la mesa
    P.hunde = k.palabra('hunde', 1, P.f2 + 1.3);
    P.crema = k.palabra('crema', 1, P.f3 + 1.0);
    P.inclina = k.palabra('inclina', 1, P.f3 + 2.0);
    P.velas = k.palabra('velas', 1, P.f4 + 0.9);
    P.fuego = k.palabra('fuego', 1, P.f4 + 2.0);
    P.cae = P.f5 + 0.25;                               // "Tranqui": se apaga el fuego y tu torta se cae
    P.llega = Math.min(k.palabra('artesanal', 1, P.f5 + 1.6) - 0.6, P.f5 + 0.55);
    P.precio = k.palabra('veintidós', 1, P.f5 + 3.0);
    P.pone = P.precio + 0.4;                           // la pastelera deja la torta artesanal
    P.fin = k.finVoz(25.5);
    P.rem = P.f6 + 1.5;                                // remate: el perro
    P.come = P.rem + 0.6;
    P.cierre = Math.max(P.fin + 0.35, P.come + 2.4);
  }

  const cil = (rA, rB, h, color, padre, basico = false, lados = 24) => {
    const T = k.THREE, m = new T.Mesh(new T.CylinderGeometry(rA, rB, h, lados), basico ? new T.MeshBasicMaterial({ color }) : k.mat(color));
    m.castShadow = !basico; padre.add(m); return m;
  };

  function patioNoche() {
    const T = k.THREE, c = (w, h, d, col, x, y, z, s = true) => k.caja(w, h, d, col, x, y, z, k.escena, s);
    const piso = new T.Mesh(new T.PlaneGeometry(40, 40), k.mat('#8F877A'));
    piso.rotation.x = -Math.PI / 2; piso.position.y = -0.01; piso.receiveShadow = true; k.escena.add(piso);
    for (let i = -7; i <= 7; i++) for (let j = 0; j < 7; j++) if ((i + j) % 2) c(0.6, 0.004, 0.6, '#7F786C', i * 0.6, 0.0, -2.3 + j * 0.6, false);
    c(9, 3.3, 0.2, '#D6C29A', 0, 1.65, -2.75);                                            // pared de la casa
    c(0.2, 2.2, 7, '#B8A684', -3.3, 1.1, 0.6);                                             // medianera
    // la puerta de la cocina, con luz adentro
    c(0.95, 2.1, 0.04, '#FFE2A8', PUERTA.x, 1.05, -2.64, false); c(1.1, 0.08, 0.1, '#6B4430', PUERTA.x, 2.12, -2.62);
    c(0.08, 2.1, 0.1, '#6B4430', PUERTA.x - 0.52, 1.05, -2.62); c(0.08, 2.1, 0.1, '#6B4430', PUERTA.x + 0.52, 1.05, -2.62);
    // la ventana encendida
    c(1.2, 0.9, 0.04, '#FFD98A', 1.3, 1.65, -2.64, false); c(1.32, 0.06, 0.1, '#F4F2EC', 1.3, 2.12, -2.62); c(1.32, 0.06, 0.1, '#F4F2EC', 1.3, 1.18, -2.62);
    c(0.05, 0.9, 0.06, '#F4F2EC', 1.3, 1.65, -2.61, false);
    // plantas en macetas a la derecha
    [[2.7, -2.2], [3.1, -1.4]].forEach(([x, z], i) => {
      const m = new T.Mesh(new T.CylinderGeometry(0.22, 0.16, 0.36, 12), k.mat('#B5653A')); m.position.set(x, 0.18, z); m.castShadow = true; k.escena.add(m);
      c(0.5, 0.5 + i * 0.25, 0.5, '#3F7A4A', x, 0.55 + i * 0.12, z); c(0.34, 0.3, 0.34, '#4E9157', x + 0.05, 0.9 + i * 0.25, z + 0.05);
    });
    // la mesa con el mantel a cuadros
    c(MESA.ancho, 0.06, MESA.fondo, '#7A5236', MESA.x, MESA.y - 0.04, MESA.z);
    [[-0.95, -0.38], [0.95, -0.38], [-0.95, 0.38], [0.95, 0.38]].forEach(([x, z]) => c(0.07, MESA.y - 0.07, 0.07, '#5C3D28', MESA.x + x, (MESA.y - 0.07) / 2, MESA.z + z));
    c(MESA.ancho + 0.1, 0.012, MESA.fondo + 0.1, '#F4F2EC', MESA.x, MESA.y, MESA.z, false);
    c(MESA.ancho + 0.1, 0.26, 0.012, '#F4F2EC', MESA.x, MESA.y - 0.13, MESA.z + MESA.fondo / 2 + 0.05, false);   // caída del mantel
    for (let i = 0; i < 6; i++) {
      c(0.1, 0.014, MESA.fondo + 0.1, '#C8433A', MESA.x - 0.9 + i * 0.36, MESA.y + 0.001, MESA.z, false);
      c(0.1, 0.26, 0.014, '#C8433A', MESA.x - 0.9 + i * 0.36, MESA.y - 0.13, MESA.z + MESA.fondo / 2 + 0.052, false);
    }
    for (let j = 0; j < 3; j++) c(MESA.ancho + 0.1, 0.014, 0.1, '#C8433A', MESA.x, MESA.y + 0.0012, MESA.z - 0.3 + j * 0.3, false);
    // platos y vasos
    [[0.75, -0.8], [0.35, -0.5], [-0.85, -0.55]].forEach(([x, z]) => {
      const p = cil(0.13, 0.11, 0.02, '#FCFBF8', k.escena); p.position.set(x, MESA.y + 0.02, z);
    });
    [[0.85, -0.55], [0.55, -1.05]].forEach(([x, z]) => {
      const v = cil(0.045, 0.04, 0.13, '#BFE3F0', k.escena); v.position.set(x, MESA.y + 0.07, z);
    });
    // la silla de tu suegra
    c(0.46, 0.05, 0.46, '#6B4430', SUEGRA.x, 0.46, SUEGRA.z); c(0.05, 0.55, 0.46, '#6B4430', SUEGRA.x + 0.22, 0.74, SUEGRA.z);
    [[-0.19, -0.19], [0.19, -0.19], [-0.19, 0.19], [0.19, 0.19]].forEach(([x, z]) => c(0.05, 0.44, 0.05, '#5C3D28', SUEGRA.x + x, 0.22, SUEGRA.z + z));
    // la guirnalda de luces: dos tiras que cuelgan sobre la mesa
    const colores = ['#FFF2B8', '#FFD98A', '#C9A227', '#FFE7A8'];
    [[[-2.6, 2.55, -2.5], [2.6, 2.55, -2.5]], [[-2.6, 2.45, -2.5], [2.2, 2.6, 0.9]]].forEach(([a, b], s) => {
      for (let i = 0; i <= 22; i++) {
        const u = i / 22, x = k.lerp(a[0], b[0], u), z = k.lerp(a[2], b[2], u), y = k.lerp(a[1], b[1], u) - 0.45 * Math.sin(Math.PI * u);
        const f = new T.Mesh(new T.IcosahedronGeometry(0.045, 0), new T.MeshBasicMaterial({ color: colores[(i + s) % 4] }));
        f.position.set(x, y, z); k.escena.add(f);
      }
    });
    [[-0.7, 2.15, -0.9], [0.8, 2.2, -0.7], [-1.6, 2.3, -1.9]].forEach(([x, y, z]) => {
      const l = new T.PointLight('#FFD9A0', 3.2, 6, 1.4); l.position.set(x, y, z); k.escena.add(l);
    });
  }

  function armarTorta() {
    const T = k.THREE;
    torta = new T.Group(); k.escena.add(torta);
    plato = cil(0.36, 0.33, 0.025, '#FCFBF8', torta); plato.position.y = 0.012;
    pivote = new T.Group(); pivote.position.set(0.28, 0.025, 0); torta.add(pivote);       // gira sobre el borde derecho
    const cuerpo = new T.Group(); cuerpo.position.set(-0.28, 0, 0); pivote.add(cuerpo);
    bizco = new T.Group(); cuerpo.add(bizco);
    const b = cil(0.27, 0.28, 0.2, '#C98B4A', bizco); b.position.y = 0.1;
    const tapa = cil(0.27, 0.27, 0.02, '#A86B34', bizco); tapa.position.y = 0.205;
    pozo = cil(0.2, 0.12, 0.09, '#5E3A22', bizco); pozo.position.y = 0.17;
    crema = new T.Group(); crema.position.y = 0.2; cuerpo.add(crema);
    const c1 = cil(0.25, 0.27, 0.06, '#FBF7EE', crema); c1.position.y = 0.03;
    const c2 = new T.Mesh(new T.ConeGeometry(0.22, 0.42, 16), k.mat('#FBF7EE')); c2.position.y = 0.27; c2.castShadow = true; crema.add(c2);
    const c3 = new T.Mesh(new T.TorusGeometry(0.17, 0.045, 8, 18), k.mat('#F4EEDF')); c3.rotation.x = Math.PI / 2; c3.position.y = 0.12; crema.add(c3);
    const c4 = new T.Mesh(new T.TorusGeometry(0.11, 0.04, 8, 16), k.mat('#F4EEDF')); c4.rotation.x = Math.PI / 2; c4.position.y = 0.28; crema.add(c4);
    const guinda = new T.Mesh(new T.IcosahedronGeometry(0.04, 1), k.mat('#C8433A')); guinda.position.y = 0.5; crema.add(guinda);
    // las velas que la sostienen (del mantel al costado de la torta), con la mecha abajo
    const cols = ['#E58BB1', '#7DB7E8', '#F2CF3B', '#8FD9BC', '#E58BB1'];
    for (let i = 0; i < 5; i++) {
      const g = new T.Group(); k.escena.add(g);
      const v = cil(0.024, 0.024, 0.4, cols[i], g); v.position.y = 0.2;
      for (let r = 0; r < 3; r++) { const s = cil(0.026, 0.026, 0.025, '#FCFBF8', g); s.position.y = 0.08 + r * 0.12; }
      const ll = new T.Mesh(new T.ConeGeometry(0.03, 0.09, 8), new T.MeshBasicMaterial({ color: '#FFB238' })); ll.position.y = -0.02; ll.rotation.x = Math.PI; g.add(ll);
      velas.push(g); llamas.push(ll);
    }
    // la manga de crema (en tu mano derecha)
    manga = new T.Group();
    const mg = new T.Mesh(new T.ConeGeometry(0.07, 0.28, 10), k.mat('#F4F2EC')); mg.rotation.x = Math.PI; mg.position.y = -0.14; manga.add(mg);
    const pico = new T.Mesh(new T.ConeGeometry(0.02, 0.05, 6), k.mat('#C9A227')); pico.rotation.x = Math.PI; pico.position.y = -0.3; manga.add(pico);
  }

  function armarArtesanal() {
    const T = k.THREE;
    artesanal = new T.Group(); k.escena.add(artesanal);
    const p = cil(0.38, 0.35, 0.025, '#C9A227', artesanal); p.position.y = 0.012;
    const a1 = cil(0.3, 0.3, 0.2, '#FBF7EE', artesanal); a1.position.y = 0.125;
    const a2 = cil(0.2, 0.2, 0.17, '#FBF7EE', artesanal); a2.position.y = 0.31;
    for (let i = 0; i < 18; i++) {
      const a = i / 18 * Math.PI * 2, s = new T.Mesh(new T.IcosahedronGeometry(0.03, 0), k.mat('#8FD9BC'));
      s.position.set(Math.cos(a) * 0.3, 0.04, Math.sin(a) * 0.3); artesanal.add(s);
      if (i % 2 === 0) { const s2 = new T.Mesh(new T.IcosahedronGeometry(0.025, 0), k.mat('#2B7E62')); s2.position.set(Math.cos(a) * 0.2, 0.23, Math.sin(a) * 0.2); artesanal.add(s2); }
    }
    [[0.06, 0.02], [-0.07, 0.05], [0.0, -0.08]].forEach(([x, z]) => { const f = new T.Mesh(new T.IcosahedronGeometry(0.035, 1), k.mat('#C8433A')); f.position.set(x, 0.42, z); artesanal.add(f); });
    const v = cil(0.014, 0.014, 0.16, '#C9A227', artesanal); v.position.set(0.09, 0.47, 0.06);
    const ll = new T.Mesh(new T.ConeGeometry(0.025, 0.07, 8), new T.MeshBasicMaterial({ color: '#FFD23F' })); ll.position.set(0.09, 0.59, 0.06); artesanal.add(ll);
    // la caja de la pastelería (con cinta de latón)
    caja = new T.Group(); k.escena.add(caja);
    k.caja(0.5, 0.36, 0.5, '#FCFBF8', 0, 0.18, 0, caja); k.caja(0.06, 0.37, 0.51, k.C.laton, 0, 0.18, 0, caja, false); k.caja(0.51, 0.37, 0.06, k.C.laton, 0, 0.18, 0, caja, false);
  }

  function camara(t) {
    const cam = k.camara, V = (x, y, z) => new k.THREE.Vector3(x, y, z);
    let pos, mira;
    const z1 = (a, b, x0, x1) => k.lerp(a, b, k.suave((t - x0) / Math.max(0.3, x1 - x0)));
    if (t < P.f2) {                               // 1. el patio: salís con la torta; tu suegra y el perro
      const z = z1(1.0, 0.9, 0, P.f2);
      mira = V(0.05, 1.4, -1.0); pos = mira.clone().add(V(-0.5 * z, 1.5 * z, 10.2 * z));
    } else if (t < P.f3) {                        // 2. la torta se hunde; el perro, de costado
      const z = z1(1, 0.9, P.f2, P.f3);
      mira = V(-0.35, 1.3, -0.85); pos = mira.clone().add(V(-0.6 * z, 1.9 * z, 7.6 * z));
    } else if (t < P.f4) {                        // 3. la crema y la torre de Pisa, desde la derecha y abajo
      const z = z1(1, 0.92, P.f3, P.f4);
      mira = V(0.0, 1.3, -0.85); pos = mira.clone().add(V(-0.3 * z, 0.9 * z, 9.0 * z));
    } else if (t < P.f5) {                        // 4. las velas y el mantel prendido fuego
      const z = z1(1, 0.94, P.f4, P.f5);
      mira = V(0.15, 1.3, -0.8); pos = mira.clone().add(V(-0.6 * z, 1.4 * z, 8.4 * z));
    } else if (t < P.f6) {                        // 5. abierto: tu torta al piso y llega la pastelera
      const z = z1(1, 0.95, P.f5, P.f6);
      mira = V(-0.25, 1.4, -0.9); pos = mira.clone().add(V(0.3 * z, 1.7 * z, 10.4 * z));
    } else if (t < P.rem) {                       // 6. desde la derecha
      const z = z1(1, 0.94, P.f6, P.rem);
      mira = V(0.1, 1.4, -0.6); pos = mira.clone().add(V(1.2 * z, 1.3 * z, 9.6 * z));
    } else {                                      // 7. remate: el perro y tu torta en el piso, de cerca
      const g = k.suave((t - P.rem) / 0.7);
      mira = V(k.lerp(0.1, PISO.x + 0.25, g), k.lerp(1.4, 0.55, g), k.lerp(-0.6, 0.1, g));
      pos = mira.clone().add(V(k.lerp(1.2, -1.3, g), k.lerp(1.3, 0.7, g), k.lerp(9.6, 3.6, g)));
    }
    cam.position.copy(pos); cam.lookAt(mira); cam.updateProjectionMatrix(); cam.updateMatrixWorld();
  }

  const mirar = (p, x, z) => Math.atan2(x - p.x, z - p.z);
  function ubicar(p, x, z, rot, y = 0) { p.position.set(x, y, z); p.rotation.set(0, rot, 0); }
  function sentar(p) { const u = p.userData; u.cadera.position.y = 0.6; u.piernaI.rotation.x = u.piernaD.rotation.x = -1.45; }
  // caminando por los puntos pts entre t0 y t1 (a velocidad pareja)
  function ruta(t, t0, t1, pts) {
    const largos = pts.slice(1).map((b, i) => Math.hypot(b.x - pts[i].x, b.z - pts[i].z)), total = largos.reduce((a, b) => a + b, 0);
    const u = k.suave((t - t0) / Math.max(0.2, t1 - t0));
    let d = u * total, i = 0;
    while (i < largos.length - 1 && d > largos[i]) { d -= largos[i]; i++; }
    const A = pts[i], B = pts[i + 1], f = largos[i] ? Math.min(1, d / largos[i]) : 1;
    return { x: k.lerp(A.x, B.x, f), z: k.lerp(A.z, B.z, f), andando: t > t0 && t < t1, rumbo: Math.atan2(B.x - A.x, B.z - A.z), paso: u * total / 0.95, u };
  }
  const tramo = (t, t0, t1, A, B) => ruta(t, t0, t1, [A, B]);

  return {
    get duracion() { return P.cierre + 2.8; },
    get cierre() { return P.cierre; },
    get efectos() {
      const r = x => +x.toFixed(2);
      return [
        { efecto: 'tic', t: r(0.8), db: -18 }, { efecto: 'tic', t: r(1.9), db: -18 },
        { efecto: 'sello', t: r(P.deja), db: -18 },
        { efecto: 'latigazo', t: r(P.f2 - 0.2), db: -19 },
        { efecto: 'apagado', t: r(P.hunde - 0.1), db: -13 },
        { efecto: 'golpe', t: r(P.hunde + 0.15), db: -17 },
        { efecto: 'latigazo', t: r(P.f3 - 0.2), db: -19 },
        { efecto: 'pinchazo', t: r(P.crema - 0.3), db: -22 },
        { efecto: 'crujido', t: r(P.inclina - 0.05), db: -13 },
        { efecto: 'crujido', t: r(P.inclina + 0.35), db: -15 },
        { efecto: 'latigazo', t: r(P.f4 - 0.2), db: -19 },
        ...[0, 1, 2, 3, 4].map(i => ({ efecto: 'tic', t: r(P.velas - 0.4 + i * 0.16), db: -16 })),
        { efecto: 'fuego', t: r(P.fuego - 0.1), db: -14 },
        { efecto: 'ladrido', t: r(P.fuego + 0.25), db: -13 }, { efecto: 'ladrido', t: r(P.fuego + 0.55), db: -14 },
        { efecto: 'latigazo', t: r(P.f5 - 0.2), db: -19 },
        { efecto: 'pinchazo', t: r(P.cae - 0.1), db: -18 },
        { efecto: 'golpe', t: r(P.cae + 0.45), db: -12 },
        { efecto: 'pop', t: r(P.precio - 0.15), db: -16 },
        { efecto: 'campanita', t: r(P.precio + 0.05), db: -18 },
        { efecto: 'latigazo', t: r(P.f6 - 0.2), db: -19 },
        { efecto: 'acierto', t: r(P.f6 + 0.4), db: -17 },
        { efecto: 'latigazo', t: r(P.rem - 0.2), db: -19 },
        { efecto: 'ladrido', t: r(P.come + 1.3), db: -15 },
        { efecto: 'golpe', t: r(P.cierre + 0.1), db: -14 },
      ];
    },
    armar(kit) {
      k = kit; tiempos();
      const T = k.THREE;
      k.sol.intensity = 0.45; k.sol.position.set(-5, 12, 7); k.sol.color.set('#BFD0FF');
      k.cielo.intensity = 0.7;
      k.escena.background = new T.Color('#1F2A44'); k.escena.fog.color.set('#1F2A44');
      patioNoche();
      armarTorta(); armarArtesanal();
      mancha = cil(0.16, 0.16, 0.004, '#2A2420', k.escena); mancha.position.set(FUEGO.x, MESA.y + 0.009, FUEGO.z);
      // el fuego del mantel: llamas, su luz y el humo
      fuego = new T.Group(); fuego.position.set(FUEGO.x, MESA.y + 0.01, FUEGO.z); k.escena.add(fuego);
      [[0, 0, 1], [0.12, 0.04, 0.8], [-0.1, 0.03, 0.75], [0.05, -0.08, 0.7], [0.2, -0.02, 0.6]].forEach(([x, z, s], i) => {
        const g = new T.Group(); g.position.set(x * 1.3, 0, z * 1.3); g.userData.s = s * 1.5; g.userData.i = i; fuego.add(g);
        const a = new T.Mesh(new T.ConeGeometry(0.08, 0.3, 8), new T.MeshBasicMaterial({ color: '#FF7A1F' })); a.position.y = 0.15; g.add(a);
        const b = new T.Mesh(new T.ConeGeometry(0.045, 0.18, 8), new T.MeshBasicMaterial({ color: '#FFD23F' })); b.position.y = 0.1; g.add(b);
      });
      luzFuego = new T.PointLight('#FF8A2A', 0, 4, 1.5); luzFuego.position.set(FUEGO.x, MESA.y + 0.4, FUEGO.z); k.escena.add(luzFuego);
      humoFuego = k.humo(16, '#5E6166', 0.1);
      humoApaga = k.humo(14, '#B9BEC2', 0.12);
      migas = k.humo(10, '#C98B4A', 0.03);
      // tu suegra (sentada en la punta, brazos cruzados)
      suegra = k.personaje({ ropa: '#7A4E8C', pantalon: '#3A3346', pelo: '#C9C4BC', piel: '#E8BE9C', zapatillas: '#3A2A1E' });
      // vos (remera roja)
      yo = k.personaje({ ropa: '#C8433A', pantalon: '#34405A', pelo: '#3A2A1E', piel: '#E2B48F', zapatillas: '#F2F2EE' });
      yo.userData.brazoD.add(manga);
      // la pastelera: chaqueta blanca y gorra de latón
      pastelera = k.personaje({ ropa: '#F4F2EC', pantalon: '#2A2E2C', zapatillas: '#2A2E2C', piel: '#C9956E', pelo: '#2B1D16', gorra: k.C.laton });
      // el perro (el testigo)
      perro = k.perro({ color: '#D9B27A', oscuro: '#8C5A2E' });
      url = k.etiquetaUrl();
      etqAltura = k.etiqueta('Altura: −4 cm');
      etqPisa = k.etiqueta('Pisa: 4° · Tu torta: 17°');
      etqMantel = k.etiqueta('Mantel: 0 % ignífugo');
      etqPerro = k.etiqueta('Al perro le encantó: 10/10');
      card = k.tarjeta(`<div class="sello">Precio<br>de<br>referencia</div>
        <div class="t-et">TORTA ARTESANAL (POR KILO)</div>
        <div class="t-precio">$22.000<span>a</span>$49.000</div>
        <div class="t-nota">Noviembre 2026 · AMBA · por kilo</div>`);
      chip = k.tarjeta(`<div class="ok">✓</div><div><div class="c1">Pedido publicado gratis</div><div class="c2">Catering y pastelería · tu zona</div></div>`, 'chip3d');
      fin = k.cierre('Pedí presupuestos', 'de gente de tu zona');
    },
    animar(t) {
      const U = yo.userData, US = suegra.userData, UP = pastelera.userData, UD = perro.userData, V3 = k.THREE.Vector3;

      // ---- tu torta: la llevás, se hunde, crema, se inclina, velas, se cae ----
      const hund = k.clamp((t - P.hunde + 0.05) / 0.35);
      bizco.scale.set(1 + 0.05 * hund, 1 - 0.26 * hund + 0.08 * Math.sin(hund * Math.PI), 1 + 0.05 * hund);
      pozo.visible = t >= P.hunde - 0.05; pozo.scale.set(Math.max(0.01, hund), 1, Math.max(0.01, hund));
      const cr = k.clamp((t - P.crema + 0.7) / Math.max(0.5, P.inclina - 0.2 - (P.crema - 0.7)));
      crema.visible = cr > 0.01; crema.scale.set(Math.max(0.05, Math.min(1, cr * 1.6)), Math.max(0.01, cr), Math.max(0.05, Math.min(1, cr * 1.6)));
      const incl = t < P.inclina ? 0 : k.rebote((t - P.inclina) / 0.6);
      pivote.rotation.z = -0.3 * incl + (t > P.inclina && t < P.velas ? 0.03 * Math.sin(t * 9) : 0);
      manga.visible = t >= P.f3 - 0.1 && t < P.inclina + 0.2;

      if (t < P.deja) {                                     // en tus manos
        yo.updateMatrixWorld(true);
        const adelante = new V3(0, 1.08, 0.42).applyMatrix4(yo.matrixWorld);
        torta.position.copy(adelante); torta.rotation.set(0, 0, 0);
      } else if (t < P.cae) {
        torta.position.set(TORTA.x, MESA.y + 0.006, TORTA.z); torta.rotation.set(0, 0, 0);
      } else {                                              // se resbala por el frente y cae al piso
        const u = k.clamp((t - P.cae) / 0.5);
        const x = k.lerp(TORTA.x, PISO.x, u), z = k.lerp(TORTA.z, PISO.z, u), y = Math.max(0.0, MESA.y + 0.006 + 0.15 * Math.sin(Math.PI * u * 0.6) - 0.95 * u * u);
        torta.position.set(x, y, z); torta.rotation.set(0.5 * Math.sin(Math.PI * u), 0, 0);
        const splat = k.clamp((t - P.cae - 0.45) / 0.2);
        torta.scale.set(1 + 0.25 * splat, 1 - 0.35 * splat, 1 + 0.25 * splat);
        if (t >= P.come) { const s = 1 - 0.55 * k.clamp((t - P.come) / 2.2); torta.scale.set((1.25) * s, 0.65 * s, 1.25 * s); }
      }
      if (t < P.cae) torta.scale.set(1, 1, 1);
      migas.animar(t, P.come, P.come + 2.0, { x: PISO.x - 0.05, y: 0.1, z: PISO.z + 0.05 });

      // ---- las velas: van apareciendo apoyadas del mantel al costado que se cae ----
      pivote.updateMatrixWorld(true);
      velas.forEach((g, i) => {
        const aparece = P.velas - 0.45 + i * 0.16;
        g.visible = t >= aparece && t < P.cae;
        if (!g.visible) return;
        const zz = TORTA.z + (i - 2) * 0.12;
        const abajo = new V3(TORTA.x + 0.6 + (i % 2) * 0.06, MESA.y + 0.02, zz + 0.1), arriba = new V3(TORTA.x + 0.28, MESA.y + 0.22 + (i % 3) * 0.04, zz);
        const dir = arriba.clone().sub(abajo).normalize();
        g.position.copy(abajo); g.quaternion.setFromUnitVectors(new V3(0, 1, 0), dir);
        g.scale.setScalar(k.rebote((t - aparece) / 0.25));
        llamas[i].scale.setScalar(1 + 0.25 * Math.sin(t * 23 + i));
      });

      // ---- el fuego del mantel ----
      const prende = t >= P.fuego - 0.1 && t < P.cae;
      fuego.visible = prende || (t >= P.cae && t < P.cae + 0.35);
      const tam = t < P.cae ? k.clamp((t - P.fuego + 0.1) / 0.6) : 1 - k.clamp((t - P.cae) / 0.3);
      fuego.children.forEach(g => { const s = g.userData.s * Math.max(0.01, tam) * (1 + 0.22 * Math.sin(t * 19 + g.userData.i * 2)); g.scale.set(s, s * (1 + 0.15 * Math.sin(t * 27 + g.userData.i)), s); });
      luzFuego.intensity = fuego.visible ? 5 * tam * (0.85 + 0.15 * Math.sin(t * 31)) : 0;
      mancha.visible = t >= P.fuego + 0.4;
      humoFuego.animar(t, P.fuego + 0.1, P.cae, { x: FUEGO.x, y: MESA.y + 0.35, z: FUEGO.z });
      humoApaga.animar(t, P.cae - 0.05, P.cae + 0.9, { x: FUEGO.x, y: MESA.y + 0.1, z: FUEGO.z });

      // ---- vos ----
      U.cadera.position.set(0, 0.92, 0); U.cadera.rotation.set(0, 0, 0); yo.visible = true;
      if (t < P.deja) {                                     // salís de la cocina con la torta
        const m = tramo(t, 0.3, P.deja - 0.25, PUERTA, YO);
        ubicar(yo, m.x, m.z, m.u < 1 ? m.rumbo : 0);
        k.pose(yo, m.andando ? { caminar: 0.6, paso: m.paso } : {});
        U.brazoI.rotation.set(-1.25, 0, 0.2); U.brazoD.rotation.set(-1.25, 0, -0.2); U.cuello.rotation.x = -0.1;
      } else if (t < P.f3) {                                // ¡ta-ta-tán! y se hunde
        ubicar(yo, YO.x, YO.z, 0);
        if (t < P.hunde) { k.pose(yo, {}); const a = k.suave((t - P.deja) / 0.4); U.brazoI.rotation.set(0, 0, 0.3 + 1.9 * a); U.brazoD.rotation.set(0, 0, -0.3 - 1.9 * a); U.cuello.rotation.x = -0.15; }
        else k.pose(yo, { manosCabeza: t, cabezaX: 0.25 });
      } else if (t < P.f4) {                                // la crema con la manga; se inclina
        ubicar(yo, YO.x, YO.z, 0);
        if (t < P.inclina) { k.pose(yo, { cabezaX: 0.35 }); U.brazoD.rotation.set(-1.35 + 0.15 * Math.sin(t * 9), 0, -0.05 + 0.18 * Math.sin(t * 6)); U.brazoI.rotation.set(-0.9, 0, 0.25); }
        else { k.pose(yo, { cabezaZ: -0.3 }); U.cadera.rotation.z = -0.12 * incl; U.brazoI.rotation.set(-0.3, 0, 1.2); U.brazoD.rotation.set(-0.3, 0, -1.2); }
      } else if (t < P.f5) {                                // las velas; el mantel se prende
        ubicar(yo, YO.x + 0.25, YO.z, 0);
        if (t < P.fuego) { k.pose(yo, { llave: t, cabezaX: 0.3 }); }
        else { k.pose(yo, { manosCabeza: t }); yo.position.z = YO.z - 0.15 * k.clamp((t - P.fuego) / 0.3); yo.position.y = t < P.fuego + 0.3 ? 0.1 * Math.sin((t - P.fuego) / 0.3 * Math.PI) : 0; }
      } else {                                              // tu torta al piso; te corrés y festejás la artesanal
        const m = tramo(t, P.cae + 0.25, P.cae + 0.95, { x: YO.x + 0.25, z: YO.z - 0.15 }, YO2);
        ubicar(yo, m.x, m.z, m.andando ? m.rumbo : 0.25);
        if (m.andando) k.pose(yo, { caminar: 1, paso: m.paso });
        else if (t < P.pone) k.pose(yo, { manosCabeza: t, cabezaX: 0.3 });
        else if (t < P.rem) k.pose(yo, { festejo: t });
        else { yo.rotation.y = -0.5; k.pose(yo, { brazosCruzados: true, cabezaZ: 0.15 }); }
      }
      // la manga en tu mano derecha
      manga.position.set(0, -0.72, 0.05); manga.rotation.set(-0.3, 0, 0);

      // ---- tu suegra: sentada en la punta; se para con el fuego ----
      US.cadera.rotation.set(0, 0, 0);
      ubicar(suegra, SUEGRA.x, SUEGRA.z, -Math.PI / 2);
      const parada = t >= P.fuego + 0.15 && t < P.f6;
      if (!parada) {
        k.pose(suegra, t < P.f6 ? { brazosCruzados: true } : { aplaudir: t }); sentar(suegra);
        if (t >= P.hunde + 0.2 && t < P.f3) US.cuello.rotation.z = 0.25;                          // levanta una ceja
        if (t >= P.inclina + 0.1 && t < P.fuego) { US.cadera.rotation.z = 0.18 * incl; US.cuello.rotation.z = 0.3; }  // se inclina con la torta
      } else {
        const g = k.clamp((t - P.fuego - 0.15) / 0.25);
        k.pose(suegra, t < P.cae + 0.4 ? { manosCabeza: t } : { brazosCruzados: true }); suegra.position.z = SUEGRA.z + 0.4 * g;
      }

      // ---- el perro (el testigo) ----
      UD.cuello.rotation.z = 0; UD.colaVel = t >= P.rem ? 26 : 15;
      if (t < P.fuego) {                                    // sentado, mirando la torta
        ubicar(perro, PERRO.x, PERRO.z, mirar(PERRO, TORTA.x, TORTA.z));
        k.posePerro(perro, { sentado: true, cola: t > P.deja ? t : 0, cabezaX: -0.25 });
        if (t >= P.hunde + 0.1 && t < P.inclina) UD.cuello.rotation.z = 0.35;                       // ladea la cabeza
        if (t >= P.inclina) UD.cuello.rotation.z = -0.32 * incl;                                    // la inclina igual que la torta
      } else if (t < P.cae + 0.6) {                         // se para y ladra, para atrás
        const g = k.clamp((t - P.fuego) / 0.3);
        ubicar(perro, PERRO.x - 0.3 * g, PERRO.z, mirar(PERRO, FUEGO.x, FUEGO.z));
        k.posePerro(perro, { aullar: t, cola: 0 });
      } else if (t < P.rem) {                               // va hasta tu torta y espera, moviendo la cola
        const m = ruta(t, P.cae + 0.6, P.cae + 2.6, [{ x: PERRO.x - 0.3, z: PERRO.z }, { x: -1.3, z: 0.55 }, { x: PERRO_COME.x + 0.1, z: 0.55 }, PERRO_COME]);
        ubicar(perro, m.x, m.z, m.u < 1 ? m.rumbo : mirar(PERRO_COME, PISO.x, PISO.z));
        k.posePerro(perro, m.andando ? { caminar: 1, paso: m.paso } : { sentado: true, cola: t, cabezaX: 0.3 });
      } else {                                              // remate: se la come, feliz
        ubicar(perro, PERRO_COME.x, PERRO_COME.z, mirar(PERRO_COME, PISO.x, PISO.z));
        const come = t >= P.come;
        k.posePerro(perro, { cola: t, cabezaX: come ? 0.55 + 0.18 * Math.sin(t * 14) : 0.2 });
        if (t > P.come + 1.2 && t < P.come + 1.6) UD.cuello.rotation.x = -0.4;                   // levanta la cabeza: ¡guau!
      }

      // ---- la pastelera: entra con la caja y deja la torta artesanal ----
      pastelera.visible = t >= P.llega - 0.1;
      const lugar = { x: TORTA.x + 0.8, z: -1.42 };
      {
        const m = ruta(t, P.llega, P.pone - 0.35, [PUERTA, { x: lugar.x, z: -2.2 }, lugar]);
        ubicar(pastelera, m.x, m.z, m.u < 1 ? m.rumbo : mirar(lugar, TORTA.x, TORTA.z));
        if (m.andando) k.pose(pastelera, { caminar: 1, paso: m.paso, empujar: true });
        else if (t < P.pone + 0.3) k.pose(pastelera, { empujar: true, cabezaX: 0.2 });
        else if (t < P.rem) k.pose(pastelera, { saludo: t });
        else k.pose(pastelera, { aplaudir: t });
        if (m.andando) { UP.brazoI.rotation.set(-1.15, 0, 0.12); UP.brazoD.rotation.set(-1.15, 0, -0.12); }
      }
      // la caja en sus manos; al dejarla aparece la torta artesanal
      caja.visible = t >= P.llega - 0.1 && t < P.pone + 0.25;
      if (caja.visible) {
        pastelera.updateMatrixWorld(true);
        const enManos = new V3(0, 0.82, 0.5).applyMatrix4(pastelera.matrixWorld), enMesa = new V3(TORTA.x, MESA.y + 0.01, TORTA.z);
        const u = k.clamp((t - (P.pone - 0.35)) / 0.35);
        caja.position.lerpVectors(enManos, enMesa, u); caja.rotation.y = pastelera.rotation.y;
        if (t > P.pone) { caja.position.y += 0.6 * k.clamp((t - P.pone) / 0.25); }
        caja.scale.setScalar(t > P.pone ? 1 - k.clamp((t - P.pone) / 0.25) * 0.9 : 1);
      }
      artesanal.visible = t >= P.pone;
      artesanal.position.set(TORTA.x, MESA.y + 0.006, TORTA.z);
      artesanal.scale.setScalar(Math.max(0.001, k.rebote((t - P.pone) / 0.4)));

      camara(t);

      // ---- carteles y textos ----
      pivote.updateMatrixWorld(true);
      const tope = new V3(0, 0.62, 0); crema.localToWorld(tope);
      etqAltura.animar(t, P.hunde + 0.3, P.f3 + 0.05, { x: TORTA.x, y: MESA.y + 0.24, z: TORTA.z }, -120, -330);
      etqPisa.animar(t, P.inclina + 0.35, P.f4 + 0.05, { x: tope.x, y: tope.y - 0.1, z: tope.z }, -40, -380);
      etqMantel.animar(t, P.fuego + 0.4, P.f5 + 0.1, { x: FUEGO.x, y: MESA.y + 0.05, z: FUEGO.z + 0.1 }, -100, -300);
      const cabeza = new V3(0, 0.3, 0.3); UD.cuello.localToWorld(cabeza);
      etqPerro.animar(t, P.come + 0.6, P.cierre + 0.2, { x: cabeza.x, y: cabeza.y + 0.1, z: cabeza.z }, -40, -300);
      k.mostrar(card, t, P.precio - 0.15, P.f6 - 0.05);
      k.mostrar(chip, t, P.f6 + 0.45, P.rem + 0.4);
      url.style.opacity = t < P.cierre ? 1 : 0;
      fin.animar(t, P.cierre);
    },
  };
})();
