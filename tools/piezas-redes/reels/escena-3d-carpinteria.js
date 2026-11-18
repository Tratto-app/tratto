/* Escena del video 3D de carpintería (comun-3d.js). Cada red tiene su HTML
   (video-3d-carpinteria-tt/ig/fb.html) que solo define window.RED.
   Un dormitorio con un ropero de dos puertas: la de la derecha se sale cada vez
   que la abrís. La abuela teje en su mecedora y mira todo.
   Historia en escalera, graciosa: la puerta se cae al abrirla; la pegás con cinta
   y a los dos minutos se despega y se vuelve a caer; la atás con una media y
   queda colgando torcida; la sostenés con el pie y al final la sostiene tu
   abuela. Con el precio llega el carpintero, la ajusta con el taladro y la
   puerta abre y cierra sola de suave. Remate: la abuela vuelve a su mecedora,
   se sienta y se le sale el apoyabrazos; mira al carpintero. Testigo: la abuela. */
window.ESCENA3D = (function () {
  let k, yo, abuela, carp, tal, puerta, tiras = [], media, mecedora, apoyaI, tejido, cinta;
  let card, chip, fin, url, etqBisagra, etqCinta, etqAbuela, etqMece;
  const P = {};
  const H = 2.7, PARED = -2.0;
  const BIS = { x: 0.5, z: -1.30 };                     // bisagra de la puerta derecha (borde derecho)
  const NUDO = { x: -0.18, y: 1.25, z: -1.27 };          // donde la media ata las dos manijas
  const YO_PUERTA = { x: -0.32, z: -0.74 }, YO_ATRAS = { x: -0.5, z: -0.22 }, YO_CAMA = { x: -0.92, z: -0.15 }, YO_FIN = { x: -0.7, z: -0.45 }, YO_PIE = { x: 0.12, z: -0.55 };
  const MEC = { x: 1.45, z: -1.05 }, MEC_ROT = -1.3, ABU_PUERTA = { x: 0.15, z: -0.86 }, CARP = { x: 0.82, z: -0.92 }, MEC_FRENTE = { x: 1.05, z: -0.9 };

  function tiempos() {
    P.f2 = k.frase(2, 3.1);
    P.f3 = k.frase(3, 6.4);
    P.f4 = k.frase(4, 9.6);
    P.f5 = k.frase(5, 13.4);
    P.f6 = k.frase(6, 17.6);
    P.sale = Math.min(k.palabra('sale', 1, 1.2), P.f2 - 1.2);
    P.cinta = k.palabra('cinta', 1, P.f2 + 0.7);
    P.despega = k.palabra('despega', 1, P.f2 + 1.6);
    P.media = k.palabra('media', 1, P.f3 + 0.8);
    P.pie = k.palabra('pie', 1, P.f4 + 0.9);
    P.abuela = Math.max(P.pie + 0.6, k.palabra('abuela', 1, P.f4 + 2.6) - 0.15);
    P.precio = k.palabra('veintidós', 1, P.f5 + 1.8);
    P.arreglo = P.f5 + 1.7;                                  // el carpintero termina
    P.fin = k.finVoz(22);
    P.cierre = P.fin + 0.35;
    P.rem = Math.min(P.f6 + 1.6, P.cierre - 1.45);           // remate: la abuela y la mecedora
    P.cae = P.rem + 0.75;
  }

  function cuarto() {
    const T = k.THREE, c = (w, h, d, col, x, y, z, s = true) => k.caja(w, h, d, col, x, y, z, k.escena, s);
    const piso = new T.Mesh(new T.PlaneGeometry(80, 80), k.mat('#9EA6A0'));
    piso.rotation.x = -Math.PI / 2; piso.position.y = -0.04; piso.receiveShadow = true; k.escena.add(piso);
    c(4.4, 0.1, 3.8, '#B98A5E', 0, -0.03, -0.1, false);                         // piso de madera
    for (let i = 1; i < 9; i++) c(0.02, 0.012, 3.8, '#A57A50', -2.2 + i * 0.49, 0.025, -0.1, false);
    c(1.8, 0.012, 1.2, '#7FA7C2', 0.2, 0.03, -0.2, false);                      // alfombra
    c(1.6, 0.014, 1.0, '#9BBCD2', 0.2, 0.032, -0.2, false);
    c(4.4, H, 0.16, '#E3DED6', 0, H / 2, PARED);                                 // pared del fondo
    c(0.16, H, 3.4, '#DDD6CC', -2.2, H / 2, -0.4);                               // pared izquierda
    c(4.4, 0.1, 0.04, '#F2EFE6', 0, 0.05, PARED + 0.1);
    // ventana a la derecha del ropero
    c(0.9, 0.8, 0.06, '#F4F2EC', 1.45, 1.65, PARED + 0.09);
    const vidrio = new T.Mesh(new T.PlaneGeometry(0.76, 0.66), new T.MeshBasicMaterial({ color: '#CFE8F5' }));
    vidrio.position.set(1.45, 1.65, PARED + 0.125); k.escena.add(vidrio);
    c(0.04, 0.66, 0.02, '#F4F2EC', 1.45, 1.65, PARED + 0.13, false);
    // la cama (a la izquierda) con su mesa de luz
    c(1.2, 0.36, 2.0, '#8C6440', -1.5, 0.18, -0.6); c(1.14, 0.18, 1.94, '#F4F2EC', -1.5, 0.45, -0.6);
    c(1.16, 0.06, 1.3, '#C8553D', -1.5, 0.56, -0.3); c(0.5, 0.14, 0.32, '#F7F5EF', -1.5, 0.6, -1.4);
    c(1.2, 0.8, 0.08, '#8C6440', -1.5, 0.6, -1.62);
    c(0.45, 0.5, 0.4, '#A57A50', -0.62, 0.25, -1.65);
    const pie = new T.Mesh(new T.CylinderGeometry(0.03, 0.05, 0.3, 8), k.mat('#3A4A52')); pie.position.set(-0.62, 0.65, -1.65); k.escena.add(pie);
    const pant = new T.Mesh(new T.CylinderGeometry(0.1, 0.15, 0.18, 10), k.mat('#F2D27A')); pant.position.set(-0.62, 0.86, -1.65); pant.castShadow = true; k.escena.add(pant);
  }

  // el ropero: cuerpo, la puerta izquierda fija y la ropa colgada adentro
  function ropero() {
    const c = (w, h, d, col, x, y, z, s = true) => k.caja(w, h, d, col, x, y, z, k.escena, s);
    const cx = -0.2, cz = -1.61;
    c(1.44, 2.25, 0.04, '#8A6440', cx, 1.125, -1.9);                            // fondo
    c(0.04, 2.25, 0.62, '#9C7048', -0.92, 1.125, cz); c(0.04, 2.25, 0.62, '#9C7048', 0.52, 1.125, cz);
    c(1.48, 0.06, 0.64, '#9C7048', cx, 2.25, cz); c(1.44, 0.08, 0.6, '#7E5434', cx, 0.04, cz);
    c(1.36, 2.1, 0.02, '#6B4A2E', cx, 1.12, -1.87, false);                       // adentro, oscuro
    c(1.36, 0.03, 0.03, '#C3CBCD', cx, 1.95, -1.6, false);                       // el caño
    [['#C8553D', -0.75], ['#4C9ED9', -0.5], ['#3F7F4E', 0.05], ['#E3B23C', 0.28]].forEach(([col, x]) => {
      c(0.22, 0.7, 0.08, col, x, 1.55, -1.6);                                  // la ropa colgada
      c(0.18, 0.02, 0.02, '#C3CBCD', x, 1.92, -1.6, false);
    });
    c(0.68, 2.1, 0.04, '#B98A5E', -0.555, 1.11, -1.30);                          // puerta izquierda (fija)
    c(0.03, 0.22, 0.04, '#C9A227', -0.27, 1.25, -1.26);                          // su manija
    [0.5, 1.1, 1.7].forEach(y => c(0.04, 0.12, 0.02, '#C9A227', -0.885, y, -1.285, false)); // sus bisagras
  }

  // la puerta derecha: un grupo centrado en el medio de la puerta
  function armarPuerta() {
    const T = k.THREE, g = new T.Group();
    k.caja(0.68, 2.1, 0.04, '#B98A5E', 0, 0, 0, g);
    k.caja(0.56, 0.9, 0.006, '#A57A50', 0, 0.45, 0.023, g, false); k.caja(0.56, 0.9, 0.006, '#A57A50', 0, -0.52, 0.023, g, false);
    k.caja(0.03, 0.22, 0.04, '#C9A227', -0.29, 0.14, 0.04, g);                  // manija
    k.escena.add(g); g.rotation.order = 'YXZ'; return g;
  }
  // puerta colgada de la bisagra, abierta un ángulo a (0 = cerrada)
  function puertaColgada(a, temblor = 0) {
    puerta.rotation.set(temblor, a, 0);
    puerta.position.set(BIS.x - 0.35 * Math.cos(a), 1.11, BIS.z + 0.35 * Math.sin(a));
  }
  // la puerta se cae hacia adelante desde su borde de abajo (fi: 0 parada, 1,5 en el piso)
  function puertaCayendo(a, fi, adelante = 0) {
    const bx = BIS.x - 0.35 * Math.cos(a) + Math.sin(a) * adelante, bz = BIS.z + 0.35 * Math.sin(a) + Math.cos(a) * adelante;
    puerta.rotation.set(fi, a, 0);
    puerta.position.set(bx + Math.sin(a) * 1.05 * Math.sin(fi), 0.06 + 1.05 * Math.cos(fi) + 0.02 * Math.sin(fi), bz + Math.cos(a) * 1.05 * Math.sin(fi));
  }
  // colgando de la media, torcida
  function puertaDeLaMedia(psi) {
    puerta.rotation.set(0, 0, psi);
    puerta.position.set(NUDO.x + 0.3 * Math.cos(psi), NUDO.y + 0.3 * Math.sin(psi) - 0.14 * Math.cos(psi), -1.29);
  }

  function armarMecedora() {
    const T = k.THREE, g = new T.Group(), b = (w, h, d, col, x, y, z) => k.caja(w, h, d, col, x, y, z, g);
    b(0.56, 0.06, 0.52, '#8C5A3A', 0, 0.45, 0); b(0.5, 0.06, 0.46, '#C8553D', 0, 0.49, 0);       // asiento y almohadón
    b(0.56, 0.75, 0.05, '#8C5A3A', 0, 0.85, -0.25);                                                // respaldo
    [-0.25, 0.25].forEach(x => { b(0.04, 0.42, 0.04, '#7A4A2E', x, 0.24, 0.2); b(0.04, 0.42, 0.04, '#7A4A2E', x, 0.24, -0.2); });
    [-0.27, 0.27].forEach(x => { const r = b(0.05, 0.04, 0.8, '#7A4A2E', x, 0.03, 0); r.rotation.x = 0; });   // patines
    b(0.05, 0.05, 0.46, '#8C5A3A', -0.29, 0.66, 0); b(0.04, 0.2, 0.04, '#8C5A3A', -0.29, 0.56, 0.2);  // apoyabrazos del fondo (fijo)
    apoyaI = new T.Group(); k.caja(0.05, 0.05, 0.46, '#8C5A3A', 0, 0, 0, apoyaI); k.caja(0.04, 0.2, 0.04, '#8C5A3A', 0, -0.1, 0.2, apoyaI);
    k.escena.add(apoyaI);
    g.position.set(MEC.x, 0, MEC.z); g.rotation.y = MEC_ROT; k.escena.add(g);
    return g;
  }

  function camara(t) {
    const cam = k.camara, V = (x, y, z) => new k.THREE.Vector3(x, y, z);
    let pos, mira;
    const z1 = (a, b, x0, x1) => k.lerp(a, b, k.suave((t - x0) / Math.max(0.3, x1 - x0)));
    if (t < P.f2) {                               // 1. el dormitorio: abrís el ropero y la puerta se cae
      const z = z1(1, 0.9, 0, P.f2);
      mira = V(0.3, 1.0, -0.7); pos = mira.clone().add(V(0.6 * z, 0.9 * z, 7.3 * z));
    } else if (t < P.f3) {                        // 2. la cinta en la bisagra
      const z = z1(1, 0.86, P.f2, P.f3);
      mira = V(0.45, 1.15, -1.2); pos = mira.clone().add(V(-1.9 * z, 0.3 * z, 4.6 * z));
    } else if (t < P.f4) {                        // 3. la media: la puerta colgando torcida, la abuela se ríe
      const z = z1(1, 0.9, P.f3, P.f4);
      mira = V(0.25, 1.15, -0.85); pos = mira.clone().add(V(1.1 * z, 0.35 * z, 5.2 * z));
    } else if (t < P.abuela) {                    // 4a. la sostenés con el pie
      const z = z1(1, 0.9, P.f4, P.abuela);
      mira = V(0.05, 0.9, -0.9); pos = mira.clone().add(V(-2.05 * z, 2.2 * z, 3.7 * z));
    } else if (t < P.f5) {                        // 4b. la sostiene la abuela; vos, sentado en la cama
      const z = z1(1, 0.92, P.abuela, P.f5);
      mira = V(-0.1, 1.0, -0.9); pos = mira.clone().add(V(0.6 * z, 0.6 * z, 5.8 * z));
    } else if (t < P.f6) {                        // 5. el precio: el carpintero la ajusta con el taladro
      const z = z1(1, 0.95, P.f5, P.f6);
      mira = V(0.4, 1.3, -1.0); pos = mira.clone().add(V(0.4 * z, 0.4 * z, 7.0 * z));
    } else if (t < P.rem) {                       // 6. la puerta abre y cierra de suave
      const z = z1(1, 0.92, P.f6, P.rem);
      mira = V(0.1, 1.2, -1.0); pos = mira.clone().add(V(-1.6 * z, 0.5 * z, 6.4 * z));
    } else {                                      // 7. remate: la abuela en la mecedora
      const z = z1(1, 0.86, P.rem, P.cierre);
      mira = V(MEC.x - 0.45, 0.8, MEC.z + 0.2); pos = mira.clone().add(V(-2.2 * z, 0.8 * z, 3.6 * z));
    }
    cam.position.copy(pos); cam.lookAt(mira); cam.updateProjectionMatrix(); cam.updateMatrixWorld();
  }
  function andar(p, A, B, t, t0, t1) {
    const u = k.clamp((t - t0) / (t1 - t0)), d = Math.hypot(B.x - A.x, B.z - A.z);
    p.position.set(k.lerp(A.x, B.x, u), 0, k.lerp(A.z, B.z, u));
    return { andando: t > t0 && t < t1, rumbo: Math.atan2(B.x - A.x, B.z - A.z), paso: u * d / 0.95, u };
  }
  function sentar(p, y = 0.6) { const u = p.userData; u.cadera.position.y = y; u.piernaI.rotation.x = u.piernaD.rotation.x = -1.45; }

  return {
    get duracion() { return P.cierre + 2.8; },
    get cierre() { return P.cierre; },
    get efectos() {
      const r = x => +x.toFixed(2);
      return [
        { efecto: 'golpe', t: r(P.sale + 0.62), db: -15 },
        { efecto: 'latigazo', t: r(P.f2 - 0.2), db: -19 },
        { efecto: 'tic', t: r(P.cinta + 0.1), db: -20 }, { efecto: 'tic', t: r(P.cinta + 0.4), db: -20 }, { efecto: 'tic', t: r(P.cinta + 0.7), db: -20 },
        { efecto: 'golpe', t: r(P.despega + 0.95), db: -15 },
        { efecto: 'latigazo', t: r(P.f3 - 0.2), db: -19 },
        { efecto: 'pop', t: r(P.media + 0.2), db: -18 },
        { efecto: 'latigazo', t: r(P.f4 - 0.2), db: -19 },
        { efecto: 'latigazo', t: r(P.abuela - 0.2), db: -19 },
        { efecto: 'latigazo', t: r(P.f5 - 0.2), db: -19 },
        { efecto: 'motor', t: r(P.f5 + 0.3), db: -26 },
        { efecto: 'pop', t: r(P.precio - 0.15), db: -16 },
        { efecto: 'campanita', t: r(P.precio + 0.05), db: -18 },
        { efecto: 'sello', t: r(P.precio + 0.3), db: -18 },
        { efecto: 'latigazo', t: r(P.f6 - 0.2), db: -19 },
        { efecto: 'acierto', t: r(P.f6 + 0.7), db: -17 },
        { efecto: 'latigazo', t: r(P.rem - 0.2), db: -19 },
        { efecto: 'pop', t: r(P.cae), db: -14 },
        { efecto: 'golpe', t: r(P.cae + 0.35), db: -18 },
        { efecto: 'golpe', t: r(P.cierre + 0.1), db: -14 },
      ];
    },
    armar(kit) {
      k = kit; tiempos();
      const T = k.THREE;
      k.sol.position.set(-5, 14, 9);
      const luz2 = new T.DirectionalLight('#FFF4DF', 0.8); luz2.position.set(6, 10, 8); k.escena.add(luz2);
      cuarto(); ropero();
      puerta = armarPuerta();
      // la cinta: tres tiras grises sobre la bisagra
      [0.5, 1.1, 1.7].forEach(y => tiras.push(k.caja(0.26, 0.1, 0.012, '#D5D9DB', BIS.x, y, BIS.z + 0.035, k.escena, false)));
      // la media: roja con rayas, atada entre las dos manijas, y la punta colgando
      media = new T.Group(); k.escena.add(media);
      k.caja(0.2, 0.06, 0.06, '#D9412E', 0, 0, 0, media, false); k.caja(0.04, 0.065, 0.065, '#F4F2EC', -0.05, 0, 0, media, false); k.caja(0.04, 0.065, 0.065, '#F4F2EC', 0.05, 0, 0, media, false);
      const punta = k.caja(0.06, 0.2, 0.05, '#D9412E', 0.06, -0.12, 0.02, media, false); punta.rotation.z = 0.2;
      k.caja(0.07, 0.05, 0.06, '#F4F2EC', 0.08, -0.22, 0.02, media, false);
      media.position.set(NUDO.x, NUDO.y, NUDO.z + 0.03);
      // el rollo de cinta en tu mano
      // vos (remera mostaza)
      yo = k.personaje({ ropa: '#D9A441', pantalon: '#3C4A66', pelo: '#2B1D16', zapatillas: '#F2F2EE' });
      cinta = new T.Mesh(new T.TorusGeometry(0.07, 0.03, 6, 12), k.mat('#B9BDBF')); cinta.position.set(0, -0.72, 0.05); yo.userData.brazoD.add(cinta);
      // la abuela: bajita, pelo blanco con rodete, anteojos y vestido lila; teje en la mecedora
      abuela = k.personaje({ ropa: '#9B7BB5', pantalon: '#8A6AA5', zapatillas: '#5A3E2B', pelo: '#E4E2DC', piel: '#E8B998' });
      abuela.scale.setScalar(0.84);
      const UA = abuela.userData;
      k.caja(0.22, 0.18, 0.18, '#E4E2DC', 0, 0.62, -0.14, UA.cuello, false);                 // rodete
      [-0.1, 0.1].forEach(x => {
        k.caja(0.14, 0.025, 0.02, '#5A4A3A', x, 0.33, 0.235, UA.cuello, false); k.caja(0.14, 0.025, 0.02, '#5A4A3A', x, 0.21, 0.235, UA.cuello, false);
        k.caja(0.025, 0.12, 0.02, '#5A4A3A', x - 0.06, 0.27, 0.235, UA.cuello, false); k.caja(0.025, 0.12, 0.02, '#5A4A3A', x + 0.06, 0.27, 0.235, UA.cuello, false);
      });
      tejido = new T.Group(); abuela.add(tejido);
      k.caja(0.3, 0.22, 0.03, '#D9412E', 0, 0, 0, tejido, false);
      const ag1 = k.caja(0.012, 0.012, 0.4, '#C3CBCD', -0.08, 0.12, 0, tejido, false); ag1.rotation.y = 0.6;
      const ag2 = k.caja(0.012, 0.012, 0.4, '#C3CBCD', 0.08, 0.12, 0, tejido, false); ag2.rotation.y = -0.6;
      const ovillo = new T.Mesh(new T.SphereGeometry(0.08, 8, 6), k.mat('#D9412E')); ovillo.position.set(0.25, -0.45, 0.25); tejido.add(ovillo);
      mecedora = armarMecedora();
      // el carpintero (gorra verde), con el taladro
      carp = k.personaje({ ropa: '#8A6A4A', pantalon: '#4D5A6B', zapatillas: '#2A2E2C', piel: '#C9956E', pelo: '#2B1D16', gorra: k.C.verde });
      tal = k.taladro(carp.userData.brazoD);
      url = k.etiquetaUrl();
      etqBisagra = k.etiqueta('Bisagra: 1 tornillo de 3');
      etqCinta = k.etiqueta('Cinta: dura 2 minutos');
      etqAbuela = k.etiqueta('Abuela: modo bisagra');
      etqMece = k.etiqueta('Mecedora: la que sigue');
      card = k.tarjeta(`<div class="sello">Precio<br>de<br>referencia</div>
        <div class="t-et">AJUSTE O ARREGLO DE PUERTA O MUEBLE</div>
        <div class="t-precio">$22.000<span>a</span>$41.000</div>
        <div class="t-nota">Noviembre 2026 · AMBA · por trabajo</div>`);
      chip = k.tarjeta(`<div class="ok">✓</div><div><div class="c1">Pedido publicado gratis</div><div class="c2">Carpintería · tu zona</div></div>`, 'chip3d');
      fin = k.cierre('Pedí presupuestos', 'de gente de tu zona');
    },
    animar(t) {
      const T = k.THREE, U = yo.userData, UA = abuela.userData, UC = carp.userData;
      const cae = (x0, dur) => { const u = k.clamp((t - x0) / dur); return 1.5 * u * u; };

      // ---- la puerta ----
      if (t < P.sale) puertaColgada(t < 0.45 ? 0 : 0.9 * k.suave((t - 0.45) / Math.max(0.3, P.sale - 0.5)));
      else if (t < P.f2) puertaCayendo(0.9, cae(P.sale, 0.62), 0.05 * k.clamp((t - P.sale) / 0.3));
      else if (t < P.despega) puertaColgada(0);
      else if (t < P.f3) {                       // se despega: arranca despacio y se va de golpe
        const u = k.clamp((t - P.despega) / 0.95);
        puertaCayendo(0, 1.5 * u * u * u, 0.02);
      } else if (t < P.f4) {                     // colgando de la media, torcida, se hamaca
        const e = t - P.f3;
        puertaDeLaMedia(-0.42 + Math.sin(e * 4.2) * 0.07 * Math.exp(-e * 0.4));
      } else if (t < P.arreglo) {                // sostenida: con el pie tiembla, con la abuela menos
        const tiembla = t < P.abuela ? Math.sin(t * 23) * 0.03 : Math.sin(t * 17) * 0.012;
        puertaColgada(0, tiembla);
      } else if (t < P.f6 + 0.2) puertaColgada(0);
      else {                                     // ajustada: abre y cierra de suave
        const e = t - P.f6 - 0.2;
        puertaColgada(e < 2.8 ? 1.0 * Math.sin(Math.PI * e / 2.8) ** 2 : 0);
      }
      // la cinta y la media
      tiras.forEach((m, i) => {
        m.visible = t >= P.cinta + i * 0.3 && t < P.despega + 0.35 && t < P.f3;
        const s = k.clamp((t - P.despega) / 0.3);
        m.scale.set(1 + s * 0.8, 1, 1); m.rotation.z = s * (i % 2 ? 0.5 : -0.4);
      });
      media.visible = t >= P.media && t < P.f4;
      media.rotation.z = Math.sin((t - P.f3) * 4.2) * 0.05;

      // ---- vos ----
      cinta.visible = t >= P.f2 && t < P.despega;
      yo.visible = true;
      if (t < P.f2) {                            // abrís y la puerta se te viene encima: saltás para atrás
        if (t < P.sale + 0.1) {
          yo.position.set(YO_PUERTA.x, 0, YO_PUERTA.z); yo.rotation.y = Math.PI;
          k.pose(yo, { cabezaX: 0.05 }); U.brazoI.rotation.set(-1.25 + 0.4 * k.suave((t - 0.45) / 0.6), 0, 0.15);
        } else {
          const e = t - P.sale - 0.1, u = k.suave(e / 0.35);
          yo.position.set(k.lerp(YO_PUERTA.x, YO_ATRAS.x, u), 0, k.lerp(YO_PUERTA.z, YO_ATRAS.z, u)); yo.rotation.y = Math.PI;
          k.pose(yo, { manosCabeza: t, salto: e < 0.4 ? Math.sin(e / 0.4 * Math.PI) * 0.18 : 0 });
        }
      } else if (t < P.f3) {                     // con la cinta, al costado de la bisagra
        yo.position.set(1.05, 0, -0.98); yo.rotation.y = -Math.PI / 2 - 0.2;
        if (t < P.despega) k.pose(yo, { envolver: t, cabezaX: 0.1 });
        else { k.pose(yo, { manosCabeza: t }); yo.position.x = 0.92 + 0.25 * k.suave((t - P.despega - 0.6) / 0.4); }
      } else if (t < P.f4) {                     // la media: la atás y te quedás mirando, orgulloso
        yo.position.set(-0.45, 0, -0.72); yo.rotation.y = Math.PI - 0.45;
        if (t < P.media + 0.5) k.pose(yo, { envolver: t * 1.3 });
        else { k.pose(yo, { brazosCruzados: true, cabezaZ: 0.18 }); yo.rotation.y = Math.PI - 0.3; }
      } else if (t < P.abuela) {                 // con el pie: en una pierna, haciendo equilibrio
        yo.position.set(YO_PIE.x, 0, YO_PIE.z); yo.rotation.y = Math.PI;
        const w = Math.sin(t * 6) * 0.12;
        k.pose(yo, { cabezaX: -0.1 });
        U.piernaD.rotation.x = -1.2; U.cadera.rotation.z = w * 0.4; U.cadera.position.y = 0.9;
        U.brazoI.rotation.set(0, 0, 1.3 + w); U.brazoD.rotation.set(0, 0, -1.3 + w);
      } else if (t < P.f6) {                     // sentado en la cama, mirando el celular
        yo.position.set(YO_CAMA.x, 0, YO_CAMA.z); yo.rotation.y = Math.PI / 2;
        k.pose(yo, { cabezaX: 0.35 }); sentar(yo, 0.62);
        U.brazoD.rotation.set(-1.1, 0, -0.2); U.brazoI.rotation.set(-1.1, 0, 0.2);
      } else {                                   // festejo
        yo.position.set(YO_FIN.x, 0, YO_FIN.z); yo.rotation.y = 0.35;
        k.pose(yo, { festejo: t });
      }

      // ---- la abuela (el testigo) ----
      const sentada = () => {
        abuela.position.set(MEC.x - 0.06 * Math.cos(MEC_ROT), 0, MEC.z + 0.06 * Math.sin(MEC_ROT)); abuela.rotation.y = MEC_ROT;
        sentar(abuela, 0.62);
      };
      tejido.visible = t < P.f4 || t >= P.rem;
      tejido.position.set(0, 1.0, 0.42); tejido.rotation.set(-0.5, 0, 0);
      if (t < P.f2) {                            // teje; con el golpe, salta en la mecedora
        k.pose(abuela, { cabezaX: 0.25 }); sentada();
        const s = t > P.sale + 0.6 ? Math.max(0, Math.sin((t - P.sale - 0.6) * 9)) * (t < P.sale + 1.0 ? 0.12 : 0) : 0;
        UA.cadera.position.y = 0.62 + s;
        UA.brazoI.rotation.set(-1.0 + Math.sin(t * 9) * 0.08, 0, 0.25); UA.brazoD.rotation.set(-1.0 - Math.sin(t * 9) * 0.08, 0, -0.25);
        if (t > P.sale + 0.6) UA.cuello.rotation.set(-0.05, 0.5, 0);
      } else if (t < P.f3) {                     // niega con la cabeza
        k.pose(abuela, { cabezaY: 0.5 + Math.sin(t * 7) * 0.35, cabezaX: 0.05 }); sentada();
        UA.brazoI.rotation.set(-1.0, 0, 0.25); UA.brazoD.rotation.set(-1.0, 0, -0.25);
      } else if (t < P.f4) {                     // se ríe: los hombros le saltan
        k.pose(abuela, { cabezaY: 0.45, cabezaX: -0.3 }); sentada();
        UA.cadera.position.y = 0.62 + Math.abs(Math.sin(t * 14)) * 0.035;
        UA.brazoI.rotation.set(-1.6, 0, 0.6); UA.brazoD.rotation.set(-1.6, 0, -0.6);
      } else if (t < P.abuela) {                 // te mira desde la mecedora, con las manos en la cabeza
        k.pose(abuela, { manosCabeza: t }); sentada();
      } else if (t < P.arreglo + 0.3) {          // la sostiene ella, con las dos manos
        abuela.position.set(ABU_PUERTA.x, 0, ABU_PUERTA.z); abuela.rotation.y = Math.PI;
        k.pose(abuela, { empujar: true, cabezaX: -0.1, cabezaY: Math.sin(t * 1.3) * 0.15 });
      } else if (t < P.rem) {                    // suelta, se estira y se va a su mecedora
        const a = andar(abuela, ABU_PUERTA, MEC_FRENTE, t, P.arreglo + 0.9, P.rem - 0.2);
        abuela.rotation.y = a.andando ? a.rumbo : Math.PI;
        k.pose(abuela, a.andando ? { caminar: 0.7, paso: a.paso * 1.4 } : { festejo: t * 0.5 });
      } else {                                   // remate: se sienta, se le sale el apoyabrazos y mira al carpintero
        k.pose(abuela, { cabezaX: 0.2 }); sentada();
        UA.brazoI.rotation.set(-1.0 + Math.sin(t * 9) * 0.08, 0, 0.25); UA.brazoD.rotation.set(-1.0, 0, -0.25);
        if (t > P.cae + 0.25) { UA.cuello.rotation.set(-0.05, -0.9 * k.suave((t - P.cae - 0.25) / 0.3), 0); UA.brazoI.rotation.set(-0.3, 0, 0.5); }
      }
      // la mecedora se hamaca cuando está sentada
      const hamaca = (t < P.f4 || t >= P.rem) ? Math.sin(t * 2.4) * 0.05 : 0;
      mecedora.rotation.z = hamaca;
      // el apoyabrazos izquierdo: en su lugar; en el remate se sale y cae al piso
      {
        const ang = mecedora.rotation.y, lx = 0.29, ly = 0.66;
        const px = MEC.x + Math.cos(ang) * lx, pz = MEC.z - Math.sin(ang) * lx;
        if (t < P.cae) { apoyaI.position.set(px, ly, pz); apoyaI.rotation.set(0, ang, 0); }
        else {
          const e = Math.min(t - P.cae, 0.42);
          apoyaI.position.set(px + Math.cos(ang) * 0.25 * e / 0.42, Math.max(0.03, ly - 4.9 * e * e), pz - Math.sin(ang) * 0.25 * e / 0.42);
          apoyaI.rotation.set(0, ang, 1.3 * e / 0.42);
        }
      }

      // ---- el carpintero ----
      carp.visible = t >= P.f5 - 0.01;
      if (t < P.arreglo) {
        carp.position.set(CARP.x, 0, CARP.z); carp.rotation.y = Math.PI + 0.35;
        k.pose(carp, { taladrar: t, alto: -0.35 - 0.25 * Math.sin((t - P.f5) * 2.5) });
      } else if (t < P.rem) {
        carp.position.set(CARP.x + 0.15, 0, CARP.z + 0.15);
        carp.rotation.y = k.lerp(Math.PI + 0.35, -0.4, k.suave((t - P.arreglo) / 0.4));
        k.pose(carp, t > P.f6 ? { saludo: t } : {});
      } else {                                   // en el remate, lo mira la abuela: se rasca la cabeza
        carp.position.set(0.72, 0, -1.6); carp.rotation.y = 0.95;
        k.pose(carp, t > P.cae + 0.5 ? { rascar: t } : {});
      }

      camara(t);
      // ---- carteles y textos ----
      etqBisagra.animar(t, 0.5, P.f2 + 0.05, { x: BIS.x, y: 1.75, z: BIS.z }, -30, -110);
      etqCinta.animar(t, P.cinta + 0.5, P.f3 + 0.05, { x: BIS.x, y: 1.1, z: BIS.z + 0.03 }, -10, -330);
      const ha = new T.Vector3(); UA.cabeza.getWorldPosition(ha);
      etqAbuela.animar(t, P.abuela + 0.3, P.f5 + 0.05, { x: ha.x, y: ha.y - 0.5, z: ha.z }, -100, 90);
      etqMece.animar(t, P.cae + 0.3, P.cierre + 0.15, { x: MEC.x, y: 0.9, z: MEC.z }, -20, -230);
      k.mostrar(card, t, P.precio - 0.15, P.f6 - 0.05);
      k.mostrar(chip, t, P.f6 + 0.25, P.cierre + 0.2);
      url.style.opacity = t < P.cierre ? 1 : 0;
      fin.animar(t, P.cierre);
    },
  };
})();
