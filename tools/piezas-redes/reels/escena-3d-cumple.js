/* Escena del video 3D de animación de cumpleaños (comun-3d.js). Cada red tiene
   su HTML (video-3d-cumple-tt/ig/fb.html) que solo define window.RED.
   El living de tu casa a la tarde, con banderines, la torta y seis chicos que
   corren en círculo (el cartel dice veinte). Historia en escalera, graciosa:
   te disfrazás de payaso con un tomate de nariz y nadie se ríe; inflás los
   globos y te explotan en la cara (el perro se esconde abajo de la mesa);
   probás con un juego y los chicos te dejan atado con serpentina. Con el
   precio llega el animador y todos se van detrás de él en trencito (el perro
   también). Remate (cámara en el perro): vuelve, salta y se come tu nariz de
   tomate. */
window.ESCENA3D = (function () {
  let k, yo, perro, anim, peluca, nariz, gorroPerro, parlante, galera, globos = [], anillos = [], chicos = [], confeti;
  let etqChicos, etqRisas, etqSerp, etqNariz, card, chip, fin, url;
  const P = {};
  const YO = { x: 0, z: 0.2 };
  const MESA = { x: 2.35, z: -1.95 }, PUERTA = { x: 3.35, z: -2.75 };
  const PERRO1 = { x: -1.9, z: -0.7 };
  const TREN = { x: 1.0, z: -0.95, rx: 1.85, rz: 0.85 };
  const COLORES = ['#E0443A', '#3D6E9E', '#E3B23C', '#2B7E62', '#9B6FB0', '#E07A3A'];

  function tiempos() {
    P.f2 = k.frase(2, 4.3);
    P.f3 = k.frase(3, 8.4);
    P.f4 = k.frase(4, 12.4);
    P.f5 = k.frase(5, 15.6);
    P.f6 = k.frase(6, 21.8);
    P.payaso = k.palabra('payaso', 1, P.f2 + 1.1);
    P.nariz = k.palabra('nariz', 1, P.f2 + 2.6);
    P.globos = k.palabra('globos', 1, P.f3 + 0.7);
    P.explotan = k.palabra('explotan', 1, P.f3 + 1.5);
    P.pop = i => P.explotan + 0.05 + i * 0.42;            // los cuatro globos que explotan
    P.juego = k.palabra('juego', 1, P.f4 + 0.9);
    P.atado = k.palabra('atado', 1, P.f4 + 2.0);
    P.anima = k.palabra('animación', 1, P.f5 + 1.2);
    P.precio = k.palabra('sesenta', 1, P.f5 + 3.4);
    P.fin = k.finVoz(25.6);
    P.rem = P.f6 + 1.5;                                  // remate: el perro vuelve
    P.salto = P.rem + 1.15;                              // salta y se come la nariz
    P.cierre = Math.max(P.fin + 0.35, P.salto + 2.0);
  }

  function living() {
    const T = k.THREE, c = (w, h, d, col, x, y, z, s = true) => k.caja(w, h, d, col, x, y, z, k.escena, s);
    const piso = new T.Mesh(new T.PlaneGeometry(40, 40), k.mat('#B98A5E'));
    piso.rotation.x = -Math.PI / 2; piso.position.y = -0.01; piso.receiveShadow = true; k.escena.add(piso);
    for (let i = -10; i <= 10; i++) c(0.02, 0.004, 12, '#A6794F', i * 0.5, 0.0, -1, false);              // tablas del piso
    c(9.6, 3.4, 0.2, '#F2E3C6', 0, 1.7, -3.1);                                                      // pared del fondo
    c(0.2, 3.4, 8, '#EAD7B6', -4.3, 1.7, 0.9);                                                      // pared izquierda
    c(9.6, 0.12, 0.06, '#D8C3A0', 0, 0.06, -2.98, false); c(0.06, 0.12, 8, '#D8C3A0', -4.17, 0.06, 0.9, false);   // zócalos
    // ventana con cielo y la puerta por donde entra el animador
    c(2.0, 1.4, 0.04, '#A9D3E6', -1.2, 1.75, -2.98, false); c(2.16, 0.1, 0.1, '#F4F2EC', -1.2, 1.0, -2.95);
    c(0.06, 1.4, 0.06, '#F4F2EC', -1.2, 1.75, -2.95, false); c(2.16, 0.08, 0.08, '#F4F2EC', -1.2, 2.48, -2.95, false);
    c(1.0, 2.2, 0.06, '#2A2420', PUERTA.x, 1.1, -2.99, false);
    c(1.14, 0.1, 0.1, '#D8C3A0', PUERTA.x, 2.25, -2.95);
    const hoja = c(0.08, 2.18, 0.94, '#7A4E2D', PUERTA.x - 0.5, 1.1, -2.5); hoja.rotation.y = 0.1;
    // el sillón
    c(2.0, 0.45, 0.85, '#3D6E9E', -3.0, 0.3, -2.3); c(2.0, 0.7, 0.25, '#355F88', -3.0, 0.75, -2.65);
    c(0.25, 0.6, 0.85, '#355F88', -4.0, 0.42, -2.3); c(0.25, 0.6, 0.85, '#355F88', -2.0, 0.42, -2.3);
    // la mesa con la torta y los regalos
    c(1.6, 0.06, 0.9, '#8C5A2E', MESA.x, 0.76, MESA.z);
    [[-0.72, -0.38], [0.72, -0.38], [-0.72, 0.38], [0.72, 0.38]].forEach(([x, z]) => c(0.06, 0.74, 0.06, '#6E4524', MESA.x + x, 0.37, MESA.z + z));
    c(1.7, 0.02, 1.0, '#F4F2EC', MESA.x, 0.795, MESA.z, false);
    const torta = new T.Group(); torta.position.set(MESA.x - 0.25, 0.8, MESA.z);
    [[0.3, 0.16, '#F3B6C3'], [0.22, 0.14, '#F7D6DE']].forEach(([r, h, col], i) => {
      const m = new T.Mesh(new T.CylinderGeometry(r, r, h, 14), k.mat(col)); m.position.y = (i ? 0.16 : 0) + h / 2; m.castShadow = true; torta.add(m);
    });
    [-0.1, 0, 0.1].forEach((x, i) => { k.caja(0.02, 0.1, 0.02, COLORES[i], x, 0.35, 0, torta, false); k.caja(0.025, 0.035, 0.025, '#F2CF3B', x, 0.42, 0, torta, false); });
    k.escena.add(torta);
    [[0.45, 0.1, '#2B7E62'], [0.6, -0.2, '#9B6FB0']].forEach(([x, z, col]) => { c(0.26, 0.22, 0.26, col, MESA.x + x, 0.92, MESA.z + z); c(0.27, 0.04, 0.05, '#F2CF3B', MESA.x + x, 0.94, MESA.z + z, false); });
    // banderines sobre la pared del fondo
    c(8.4, 0.012, 0.012, '#5D6A64', 0, 2.78, -2.92, false);
    for (let i = 0; i < 21; i++) {
      const b = new T.Mesh(new T.ConeGeometry(0.15, 0.3, 3), k.mat(COLORES[i % 6]));
      b.rotation.set(Math.PI, 0, 0); b.scale.z = 0.15; b.position.set(-4 + i * 0.4, 2.62 - 0.06 * Math.sin(i * 0.8), -2.9); k.escena.add(b);
    }
    // globos de decoración en el rincón
    [[-3.7, 1.9, -2.6, 0], [-3.4, 2.15, -2.75, 1], [-3.9, 2.3, -2.4, 2]].forEach(([x, y, z, i]) => { const g = k.globo(COLORES[i + 3], { hilo: y - 0.2 }); g.position.set(x, y, z); });
    // una planta
    const mac = new T.Mesh(new T.CylinderGeometry(0.22, 0.17, 0.4, 8), k.mat('#B5583A')); mac.position.set(-3.8, 0.2, 0.6); mac.castShadow = true; k.escena.add(mac);
    const hojas = new T.Mesh(new T.IcosahedronGeometry(0.42, 0), k.mat('#3F7A4A')); hojas.position.set(-3.8, 0.8, 0.6); hojas.castShadow = true; k.escena.add(hojas);
  }

  // la peluca de payaso (bochas de colores) y la nariz de tomate
  function armarPeluca(padre) {
    const g = new k.THREE.Group();
    [[-0.26, 0.36, 0], [0.26, 0.36, 0], [-0.2, 0.52, -0.1], [0.2, 0.52, -0.1], [0, 0.58, 0.02], [-0.3, 0.2, -0.08], [0.3, 0.2, -0.08], [0, 0.46, -0.22]].forEach(([x, y, z], i) => {
      const b = new k.THREE.Mesh(new k.THREE.IcosahedronGeometry(0.15, 0), k.mat(COLORES[i % 6])); b.position.set(x, y, z); b.castShadow = true; g.add(b);
    });
    padre.add(g); return g;
  }
  function armarNariz(padre) {
    const g = new k.THREE.Group();
    const t = new k.THREE.Mesh(new k.THREE.IcosahedronGeometry(0.075, 1), k.mat('#D9362B')); g.add(t);
    k.caja(0.05, 0.02, 0.05, '#3F7A4A', 0, 0.075, 0, g, false);
    g.position.set(0, 0.2, 0.27); padre.add(g); return g;
  }
  // papelitos de colores para cada globo que explota
  function armarConfeti(n = 96) {
    const T = k.THREE;
    const malla = new T.InstancedMesh(new T.BoxGeometry(0.035, 0.035, 0.008), new T.MeshLambertMaterial({ flatShading: true }), n);
    const r = k.azar(77), ps = [];
    for (let i = 0; i < n; i++) { ps.push({ g: i % 4, vx: k.lerp(-1.6, 1.6, r()), vy: k.lerp(0.4, 2.2, r()), vz: k.lerp(-0.6, 1.8, r()), giro: r() * 6 }); malla.setColorAt(i, new T.Color(COLORES[i % 6])); }
    malla.frustumCulled = false; k.escena.add(malla);
    const m = new T.Matrix4(), q = new T.Quaternion(), e = new T.Euler(), p = new T.Vector3(), s = new T.Vector3();
    return {
      animar(t, momentos, punto) {
        for (let i = 0; i < n; i++) {
          const a = ps[i], edad = t - momentos[a.g];
          if (edad < 0 || edad > 1.4) { s.set(0, 0, 0); p.set(0, -9, 0); }
          else { s.set(1, 1, 1); p.set(punto.x + a.vx * edad * 0.8, Math.max(0.01, punto.y + a.vy * edad - 2.4 * edad * edad), punto.z + a.vz * edad * 0.8); }
          e.set(a.giro + t * 7, a.giro, t * 5); q.setFromEuler(e); m.compose(p, q, s); malla.setMatrixAt(i, m);
        }
        malla.instanceMatrix.needsUpdate = true;
      },
    };
  }

  function camara(t) {
    const cam = k.camara, V = (x, y, z) => new k.THREE.Vector3(x, y, z);
    let pos, mira;
    const z1 = (a, b, x0, x1) => k.lerp(a, b, k.suave((t - x0) / Math.max(0.3, x1 - x0)));
    if (t < P.f2) {                               // 1. los chicos corren alrededor tuyo, desde el rincón y alto
      const z = z1(1.0, 0.9, 0, P.f2);
      mira = V(0.3, 1.45, -0.5); pos = mira.clone().add(V(2.8 * z, 2.6 * z, 9.6 * z));
    } else if (t < P.f3) {                        // 2. el payaso: más cerca
      const z = z1(1, 0.92, P.f2, P.f3);
      mira = V(0.05, 1.45, -0.05); pos = mira.clone().add(V(-1.6 * z, 2.6 * z, 9.0 * z));
    } else if (t < P.f4) {                        // 3. los globos, desde la izquierda
      const z = z1(1, 0.9, P.f3, P.f4);
      mira = V(0.4, 1.45, -0.3); pos = mira.clone().add(V(-3.4 * z, 2.2 * z, 8.6 * z));
    } else if (t < P.f5) {                        // 4. la serpentina, desde arriba
      const z = z1(1, 0.92, P.f4, P.f5);
      mira = V(0.0, 1.25, 0.15); pos = mira.clone().add(V(1.6 * z, 3.6 * z, 7.6 * z));
    } else if (t < P.f6) {                        // 5. llega el animador: el trencito, abierto
      const z = z1(1, 0.95, P.f5, P.f6);
      mira = V(0.8, 1.45, -0.6); pos = mira.clone().add(V(2.6 * z, 2.2 * z, 10.2 * z));
    } else if (t < P.rem) {                       // 6. desde el otro lado
      const z = z1(1, 0.94, P.f6, P.rem);
      mira = V(0.5, 1.45, -0.4); pos = mira.clone().add(V(-2.4 * z, 1.9 * z, 9.6 * z));
    } else {                                      // 7. remate: vos y el perro, de cerca
      const g = k.suave((t - P.rem) / 0.7);
      mira = V(k.lerp(0.4, 0.15, g), k.lerp(1.45, 1.3, g), k.lerp(-0.3, 0.45, g));
      pos = mira.clone().add(V(k.lerp(-2.0, 3.4, g), k.lerp(1.9, 0.9, g), k.lerp(9.0, 5.6, g)));
    }
    cam.position.copy(pos); cam.lookAt(mira); cam.updateProjectionMatrix(); cam.updateMatrixWorld();
  }

  const mirar = (p, x, z) => Math.atan2(x - p.x, z - p.z);   // giro en y para mirar hacia (x, z)
  function ubicar(p, x, z, rot, y = 0) { p.position.set(x, y, z); p.rotation.set(0, rot, 0); }
  function sentar(p, y, ang) { const u = p.userData; u.cadera.position.y = y; u.piernaI.rotation.x = u.piernaD.rotation.x = ang; }
  // lugar en el trencito (n = 0 el animador, 1… los chicos, 7 el perro) en el segundo t
  function tren(n, t) {
    const f = -Math.PI / 2 + 0.25 + (t - (P.anima + 1.2)) * 0.95 - n * 0.42;
    const x = TREN.x + TREN.rx * Math.cos(f), z = TREN.z + TREN.rz * Math.sin(f);
    return { x, z, rot: Math.atan2(-TREN.rx * Math.sin(f), TREN.rz * Math.cos(f)) };
  }
  // dónde está cada chico en el círculo alrededor tuyo
  function ronda(i, t, r = 1.45, vel = 1.7) {
    const a = i * Math.PI / 3 + t * vel;
    return { x: YO.x + r * Math.sin(a), z: YO.z + r * Math.cos(a), rot: a + Math.PI / 2 };
  }

  return {
    get duracion() { return P.cierre + 2.8; },
    get cierre() { return P.cierre; },
    get efectos() {
      const r = x => +x.toFixed(2);
      return [
        { efecto: 'corneta', t: r(0.3), db: -16 }, { efecto: 'corneta', t: r(1.9), db: -18 },
        { efecto: 'latigazo', t: r(P.f2 - 0.2), db: -19 },
        { efecto: 'pop', t: r(P.payaso + 0.1), db: -15 },
        { efecto: 'pop', t: r(P.nariz), db: -14 },
        { efecto: 'tic', t: r(P.nariz + 0.7), db: -18 },
        { efecto: 'latigazo', t: r(P.f3 - 0.2), db: -19 },
        ...[0, 1, 2, 3].map(i => ({ efecto: 'golpe', t: r(P.pop(i)), db: -13 - i })),
        ...[0, 1, 2, 3].map(i => ({ efecto: 'pop', t: r(P.pop(i)), db: -11 })),
        { efecto: 'ladrido', t: r(P.pop(0) + 0.2), db: -15 },
        { efecto: 'latigazo', t: r(P.f4 - 0.2), db: -19 },
        { efecto: 'corneta', t: r(P.juego + 0.2), db: -17 },
        { efecto: 'latigazo', t: r(P.f5 - 0.2), db: -19 },
        { efecto: 'corneta', t: r(P.anima), db: -15 },
        { efecto: 'pop', t: r(P.precio - 0.15), db: -16 },
        { efecto: 'campanita', t: r(P.precio + 0.05), db: -18 },
        { efecto: 'sello', t: r(P.precio + 0.3), db: -18 },
        { efecto: 'latigazo', t: r(P.f6 - 0.2), db: -19 },
        { efecto: 'acierto', t: r(P.f6 + 0.6), db: -17 },
        { efecto: 'latigazo', t: r(P.rem - 0.2), db: -19 },
        { efecto: 'ladrido', t: r(P.salto - 0.35), db: -15 },
        { efecto: 'pop', t: r(P.salto + 0.12), db: -13 },
        { efecto: 'tic', t: r(P.salto + 0.5), db: -18 }, { efecto: 'tic', t: r(P.salto + 0.7), db: -18 },
        { efecto: 'golpe', t: r(P.cierre + 0.1), db: -14 },
      ];
    },
    armar(kit) {
      k = kit; tiempos();
      const T = k.THREE;
      k.sol.position.set(-6, 12, 8); k.sol.color.set('#FFF0D6');
      k.escena.background = new T.Color('#F2E3C6'); k.escena.fog.color.set('#F2E3C6');
      living();
      // vos (remera turquesa)
      yo = k.personaje({ ropa: '#2E9C9A', pantalon: '#34405A', pelo: '#2B1D16', piel: '#E2B48F', zapatillas: '#F2F2EE' });
      peluca = armarPeluca(yo.userData.cuello);
      nariz = armarNariz(yo.userData.cuello);
      // seis chicos con gorrito
      const pieles = ['#E2B48F', '#C9956E', '#F0C9A6', '#B5835A', '#E8BE9A', '#D9A27E'], pelos = ['#2B1D16', '#8C5A2E', '#E3B23C', '#2B1D16', '#5A3A22', '#1E2224'];
      for (let i = 0; i < 6; i++) {
        const ch = k.personaje({ ropa: COLORES[i], pantalon: i % 2 ? '#34405A' : '#5D6A64', piel: pieles[i], pelo: pelos[i], zapatillas: '#F2F2EE' });
        ch.scale.setScalar(0.62); k.gorrito(COLORES[(i + 2) % 6], ch.userData.cuello).position.set(0, 0.52, 0);
        chicos.push(ch);
      }
      // el perro (el testigo): blanco con orejas negras y gorrito
      perro = k.perro({ color: '#EDEAE2', oscuro: '#3A3A3A' });
      gorroPerro = k.gorrito('#E0443A', perro.userData.cuello); gorroPerro.position.set(0, 0.32, 0.06); gorroPerro.scale.setScalar(0.8);
      // el animador: camisa naranja, galera violeta y un parlante
      anim = k.personaje({ ropa: '#E07A3A', pantalon: '#3D6E9E', piel: '#C9956E', pelo: '#2B1D16', zapatillas: '#2A2E2C' });
      galera = new T.Group(); anim.userData.cuello.add(galera);
      k.caja(0.56, 0.04, 0.56, '#6B3F8A', 0, 0.5, 0, galera); k.caja(0.38, 0.36, 0.38, '#6B3F8A', 0, 0.7, 0, galera); k.caja(0.39, 0.06, 0.39, '#F2CF3B', 0, 0.56, 0, galera, false);
      parlante = new T.Group(); anim.userData.brazoI.add(parlante); parlante.position.set(0, -0.74, 0.05);
      k.caja(0.26, 0.34, 0.18, '#1E2224', 0, -0.05, 0, parlante); k.caja(0.16, 0.16, 0.02, '#5D6A64', 0, -0.02, 0.1, parlante, false);
      // los globos que inflás (uno por vez, en tu cara)
      for (let i = 0; i < 4; i++) globos.push(k.globo(COLORES[i], { hilo: false, radio: 0.22 }));
      // la serpentina: anillos de colores alrededor tuyo
      for (let i = 0; i < 9; i++) {
        const a = new T.Mesh(new T.TorusGeometry(0.43, 0.028, 5, 18), k.mat(COLORES[i % 6]));
        a.rotation.set(Math.PI / 2 + (i % 2 ? 0.12 : -0.12), 0, i * 0.7); a.position.set(YO.x, 0.32 + i * 0.15, YO.z); a.castShadow = true; k.escena.add(a); anillos.push(a);
      }
      confeti = armarConfeti();
      url = k.etiquetaUrl();
      etqChicos = k.etiqueta('Chicos: 20');
      etqRisas = k.etiqueta('Risas: 0');
      etqSerp = k.etiqueta('Serpentina: 47 metros');
      etqNariz = k.etiqueta('Nariz: 0');
      card = k.tarjeta(`<div class="sello">Precio<br>de<br>referencia</div>
        <div class="t-et">ANIMACIÓN INFANTIL (2 HORAS)</div>
        <div class="t-precio">$63.000<span>a</span>$130.000</div>
        <div class="t-nota">Noviembre 2026 · AMBA · por evento</div>`);
      chip = k.tarjeta(`<div class="ok">✓</div><div><div class="c1">Pedido publicado gratis</div><div class="c2">Animación y eventos · tu zona</div></div>`, 'chip3d');
      fin = k.cierre('Pedí presupuestos', 'de gente de tu zona');
    },
    animar(t) {
      const U = yo.userData, UP = perro.userData, UA = anim.userData;
      const V3 = k.THREE.Vector3;
      const atadoYa = k.clamp((t - (P.juego + 0.3)) / Math.max(0.5, P.atado + 0.3 - P.juego - 0.3));

      // ---- vos ----
      ubicar(yo, YO.x, YO.z, 0); U.cadera.position.set(0, 0.92, 0); U.cadera.rotation.set(0, 0, 0);
      peluca.visible = t >= P.payaso; peluca.scale.setScalar(Math.max(0.001, k.rebote((t - P.payaso) / 0.35)));
      nariz.visible = t >= P.nariz && t < P.salto + 0.1; nariz.scale.setScalar(Math.max(0.001, k.rebote((t - P.nariz) / 0.3)));
      if (t < P.f2) {                                       // los chicos te pasan por al lado: girás la cabeza
        k.pose(yo, { manosCabeza: t > 2.2 ? t : 0, cabezaY: 0.6 * Math.sin(t * 1.7) });
        if (t <= 2.2) { U.brazoI.rotation.set(-0.2, 0, 0.3); U.brazoD.rotation.set(-0.2, 0, -0.3); }
      } else if (t < P.f3) {                                // ¡ta-ráaan! el payaso… y nadie se ríe
        const ta = t > P.nariz + 0.15 && t < P.nariz + 0.9;
        if (ta) k.pose(yo, { festejo: (t - P.nariz) * 0.3 });
        else if (t > P.nariz + 0.9) { k.pose(yo, { cabezaX: 0.2 }); U.brazoI.rotation.set(0, 0, 0.12); U.brazoD.rotation.set(0, 0, -0.12); }
        else k.pose(yo, { saludo: t > P.payaso ? t : 0 });
      } else if (t < P.f4) {                                // inflás globos en la cara
        k.pose(yo, {});
        U.brazoI.rotation.set(-1.45, 0, 0.42); U.brazoD.rotation.set(-1.45, 0, -0.42); U.cuello.rotation.x = -0.05;
        const ult = [0, 1, 2, 3].reduce((a, i) => (t >= P.pop(i) ? P.pop(i) : a), -9);
        const e = t - ult;
        if (e >= 0 && e < 0.3) { U.cuello.rotation.x = -0.35 * (1 - e / 0.3); U.cadera.position.z = -0.08 * (1 - e / 0.3); }   // ¡pum!
        if (t > P.pop(3) + 0.3) { k.pose(yo, { manosCabeza: t }); }
      } else {                                              // atado con serpentina
        k.pose(yo, {});
        const a = atadoYa;
        U.brazoI.rotation.set(0, 0, k.lerp(0.5, 0.05, a)); U.brazoD.rotation.set(0, 0, k.lerp(-0.5, -0.05, a));
        U.cuello.rotation.y = a < 1 ? 0.5 * Math.sin(t * 5) : 0.35 * Math.sin(t * 1.3);
        if (a >= 1 && t < P.rem) { const s = Math.abs(Math.sin(t * 4.5)); yo.position.y = 0.06 * s; U.cadera.rotation.z = 0.06 * Math.sin(t * 4.5); }
        if (t >= P.rem) {                                   // mirás al perro… y se come tu nariz
          U.cuello.rotation.x = t < P.salto ? 0.35 : 0.12; U.cuello.rotation.y = 0;
          if (t > P.salto + 0.35) { U.cuello.rotation.z = 0.25; U.cuello.rotation.x = 0.05; }
        }
      }

      // ---- los globos: uno por vez delante de tu cara, se inflan y explotan ----
      const cara = new V3(YO.x, 1.68, YO.z + 0.42);
      globos.forEach((g, i) => {
        const desde = i === 0 ? P.globos : P.pop(i - 1) + 0.04, hasta = P.pop(i);
        g.visible = t >= desde && t < hasta;
        const u = k.clamp((t - desde) / Math.max(0.1, hasta - desde));
        g.scale.setScalar(k.lerp(0.25, 1.15, u) * (1 + 0.04 * Math.sin(t * 30) * u));
        g.position.set(cara.x, cara.y - 0.05 * u, cara.z + 0.15 * u); g.rotation.set(Math.PI / 2 - 0.2, 0, 0);
      });
      confeti.animar(t, [0, 1, 2, 3].map(P.pop), { x: cara.x, y: cara.y + 0.1, z: cara.z + 0.25 });

      // ---- la serpentina ----
      anillos.forEach((a, i) => {
        const aparece = k.clamp((atadoYa * anillos.length - i) / 1);
        a.visible = aparece > 0;
        a.scale.setScalar(Math.max(0.001, k.lerp(1.8, 1, aparece)));
        a.position.set(YO.x, 0.32 + i * 0.15 + yo.position.y, YO.z);
      });

      // ---- los chicos ----
      chicos.forEach((ch, i) => {
        const u = ch.userData;
        ch.rotation.set(0, 0, 0);
        if (t < P.f2) {                                     // corren en círculo alrededor tuyo
          const r = ronda(i, t); ubicar(ch, r.x, r.z, r.rot); k.pose(ch, { caminar: 1.3, paso: t * 2.6 + i * 0.3 });
          ch.position.y = 0.05 * Math.abs(Math.sin(t * 8 + i));
        } else if (t < P.f4) {                              // sentados adelante tuyo mirándote (sin reírse)
          const a = -0.75 + i * 0.3, px = YO.x + 1.55 * Math.sin(a), pz = YO.z + 1.55 * Math.cos(a);
          const llegar = k.suave((t - P.f2) / 0.5), r0 = ronda(i, P.f2);
          ubicar(ch, k.lerp(r0.x, px, llegar), k.lerp(r0.z, pz, llegar), mirar({ x: px, z: pz }, YO.x, YO.z));
          if (llegar < 1) k.pose(ch, { caminar: 1, paso: t * 2.6 });
          else {
            const ruido = t >= P.f3 && [0, 1, 2, 3].some(j => t >= P.pop(j) - 0.05 && t < P.pop(j) + 0.55);
            k.pose(ch, ruido ? { manosCabeza: t } : { brazosCruzados: true, cabezaZ: 0.12 * Math.sin(t + i) });
            sentar(ch, 0.3, -1.5);
          }
        } else if (t < P.anima + 0.4) {                     // te atan con serpentina corriendo alrededor
          const r = ronda(i, t, k.lerp(1.4, 0.95, k.suave((t - P.f4) / 0.6)), 2.4);
          ubicar(ch, r.x, r.z, r.rot); k.pose(ch, { caminar: 1.3, paso: t * 3 + i * 0.3 });
          u.brazoD.rotation.set(-0.3, 0, -1.2);
        } else {                                            // se van detrás del animador, en trencito
          const ini = P.anima + 0.4, llegar = k.suave((t - ini) / 0.9), r0 = ronda(i, ini, 0.95, 2.4), tr = tren(i + 1, Math.max(t, P.anima + 1.2));
          ubicar(ch, k.lerp(r0.x, tr.x, llegar), k.lerp(r0.z, tr.z, llegar), llegar < 1 ? mirar(ch.position, tr.x, tr.z) : tr.rot);
          k.pose(ch, t > P.f6 + 0.3 && i % 2 ? { festejo: t + i } : { caminar: 1, paso: t * 2.2 + i * 0.5 });
          if (!(t > P.f6 + 0.3 && i % 2)) { u.brazoI.rotation.set(-1.4, 0, 0.1); u.brazoD.rotation.set(-1.4, 0, -0.1); }   // las manos en los hombros del de adelante
        }
      });

      // ---- el animador ----
      anim.visible = t >= P.anima - 0.3;
      {
        const a = k.clamp((t - (P.anima - 0.3)) / 1.5), dest = tren(0, P.anima + 1.2);
        if (a < 1) { ubicar(anim, k.lerp(PUERTA.x, dest.x, a), k.lerp(PUERTA.z + 0.2, dest.z, a), mirar({ x: PUERTA.x, z: PUERTA.z }, dest.x, dest.z)); k.pose(anim, { caminar: 1, paso: t * 2 }); }
        else { const tr = tren(0, t); ubicar(anim, tr.x, tr.z, tr.rot); k.pose(anim, { caminar: 1, paso: t * 2.2 }); UA.brazoD.rotation.set(0, 0, -2.5 + 0.3 * Math.sin(t * 9)); }
        UA.brazoI.rotation.set(-0.5, 0, 0.1);
      }

      // ---- el perro (el testigo) ----
      perro.rotation.set(0, 0, 0); UP.cuerpo.position.y = 0.42;
      const debajo = { x: MESA.x - 0.2, z: MESA.z + 0.1 };
      if (t < P.f3) {                                       // sentado, mira el lío y al payaso
        ubicar(perro, PERRO1.x, PERRO1.z, mirar(PERRO1, YO.x, YO.z));
        k.posePerro(perro, { sentado: true, cola: t, cabezaY: t < P.f2 ? 0.4 * Math.sin(t * 1.7) : 0 });
        if (t > P.nariz + 0.2) UP.cuello.rotation.z = 0.45;                    // ladea la cabeza: ¿un tomate?
      } else if (t < P.anima + 1.2) {                       // con los globos, corre a esconderse abajo de la mesa
        const u = k.clamp((t - P.pop(0) - 0.1) / 0.7);
        ubicar(perro, k.lerp(PERRO1.x, debajo.x, u), k.lerp(PERRO1.z, debajo.z, u), u < 1 ? mirar(PERRO1, debajo.x, debajo.z) : mirar(debajo, YO.x, YO.z));
        if (u > 0 && u < 1) k.posePerro(perro, { caminar: 1.4, paso: t * 3.4, colaX: -1.2 });
        else if (u >= 1) { k.posePerro(perro, { cola: t > P.f4 ? t : 0, colaX: t > P.f4 ? -0.75 : -1.3 }); UP.cuerpo.position.y = t > P.f4 ? 0.42 : 0.3; }
        else k.posePerro(perro, { sentado: true });
      } else if (t < P.rem) {                               // se suma al final del trencito
        const ini = P.anima + 1.2, llegar = k.suave((t - ini) / 0.8), tr = tren(7, t);
        ubicar(perro, k.lerp(debajo.x, tr.x, llegar), k.lerp(debajo.z, tr.z, llegar), tr.rot);
        k.posePerro(perro, { caminar: 1, paso: t * 2.6, cola: t });
      } else {                                              // remate: vuelve, salta y se come tu nariz
        const p0 = tren(7, P.rem), dest = { x: YO.x + 0.05, z: YO.z + 0.62 }, u = k.suave((t - P.rem) / 0.85);
        ubicar(perro, k.lerp(p0.x, dest.x, u), k.lerp(p0.z, dest.z, u), u < 1 ? mirar(p0, dest.x, dest.z) : Math.PI);
        if (u < 1) k.posePerro(perro, { caminar: 1, paso: t * 2.6, cola: t });
        else if (t < P.salto - 0.2) k.posePerro(perro, { sentado: true, cabezaX: -0.5, cola: t });   // mira la nariz
        else if (t < P.salto + 0.4) {                       // ¡salto!
          const s = k.clamp((t - (P.salto - 0.2)) / 0.6); k.posePerro(perro, { cabezaX: -0.6 });
          perro.position.y = 1.0 * Math.sin(Math.PI * s); perro.rotation.x = -0.6 * Math.sin(Math.PI * s); perro.position.z = dest.z - 0.25 * Math.sin(Math.PI * s);
        } else { k.posePerro(perro, { sentado: true, cola: t, cabezaX: 0.1 }); UP.boca.rotation.x = 0.15 + 0.15 * Math.sin(t * 22); UP.cuello.rotation.y = 0.9 * k.suave((t - P.salto - 0.5) / 0.3); }
      }

      camara(t);

      // ---- carteles y textos ----
      const c0 = new V3(); chicos[1].getWorldPosition(c0);
      etqChicos.animar(t, 1.2, P.f2 + 0.05, { x: c0.x, y: 1.25, z: c0.z }, 90, -300);
      etqRisas.animar(t, P.nariz + 0.9, P.f3 + 0.05, { x: YO.x + 0.6, y: 0.9, z: YO.z + 1.3 }, 90, -320);
      etqSerp.animar(t, P.atado + 0.25, P.f5 + 0.05, { x: YO.x + 0.4, y: 1.0, z: YO.z }, 110, -260);
      const nz = new V3(); nariz.getWorldPosition(nz);
      etqNariz.animar(t, P.salto + 0.45, P.cierre + 0.2, { x: YO.x + 0.15, y: 1.75, z: YO.z + 0.3 }, 90, -260);
      k.mostrar(card, t, P.precio - 0.15, P.f6 - 0.05);
      k.mostrar(chip, t, P.f6 + 0.45, P.rem + 0.4);
      url.style.opacity = t < P.cierre ? 1 : 0;
      fin.animar(t, P.cierre);
    },
  };
})();
