/* Escena del video 3D de pintura (comun-3d.js). Cada red tiene su HTML
   (video-3d-pintura-tt/ig/fb.html) que solo define window.RED.
   Una pieza con la pared de atrás para pintar (12 franjas que cambian de color
   cada una por su lado), un mueble tapado con nylon y la puerta a la cocina.
   Historia en escalera, graciosa: el perro era blanco; abrís la lata y el
   rodillo salpica (el perro queda dálmata, con lunares verdes), pisás la
   bandeja y dejás huellas hasta la cocina, y la segunda mano deja la pared a
   rayas como una cebra. Llega el pintor, la deja pareja de punta a punta, y el
   perro sigue con los lunares. Testigo: el perro. */
window.ESCENA3D = (function () {
  let k, yo, rodYo, perro, pintor, rodPintor, lataP, bandeja, salpica, manta, etqBlanco, etqCebra, etqDalmata;
  let card, chip, fin, url, VIEJA, VERDE, zapVerde, zapBlanca;
  const franjas = [], manchas = [], lunares = [], huellas = [];
  const P = {};
  function tiempos() {
    P.f2 = k.frase(2, 3.4);        // abrís la lata y el rodillo salpica
    P.f3 = k.frase(3, 6.6);        // pisás la bandeja y las huellas
    P.f4 = k.frase(4, 9.8);        // la segunda mano: la pared a rayas
    P.f5 = k.frase(5, 13.4);       // el precio
    P.f6 = k.frase(6, 18.8);       // pedilo gratis
    P.pintaste = k.palabra('pintaste', 1, 1.6);
    P.corte1 = Math.min(Math.max(1.0, P.pintaste + 0.05), P.f2 - 0.9);   // del perro a la pieza
    P.entra = P.corte1 - 0.25;     // entrás con el rodillo
    P.lata = k.palabra('lata', 1, P.f2 + 0.7);
    P.rodillo = k.palabra('rodillo', 1, P.f2 + 1.4);
    P.salpica = k.palabra('salpica', 1, P.rodillo + 0.5);
    P.bandeja = k.palabra('bandeja', 1, P.f3 + 0.5);
    P.huellas0 = P.bandeja + 0.5;  // salís caminando a la cocina
    P.cebra = k.palabra('cebra', 1, P.f5 - 0.6);
    P.c0 = P.f4 + 0.15;            // la segunda mano: de izquierda a derecha
    P.c1 = Math.max(P.c0 + 1.2, P.cebra - 0.15);
    P.precio = k.palabra('ciento', 1, P.f5 + 2.3);
    P.fin = k.finVoz(24);
    P.cierre = P.fin + 0.35;
    P.m0 = P.f5 + 0.1;             // entra el pintor
    P.m1 = P.m0 + 1.3;             // llega a la punta derecha de la pared
    P.p0 = P.m1 + 0.2;             // empieza a pintar
    P.parejo = Math.min(P.p0 + 2.2, P.f6 - 0.25);   // termina en la punta izquierda
  }
  const ZF = -2.0, H = 2.6, X0 = -1.8, ANCHO = 0.3, N = 12;
  const XS0 = -1.45, XS1 = 1.45;                     // de punta a punta, pintando
  const PUERTA = { x: 2.55, z: 0.25 }, PUERTA_IN = { x: 2.3, z: 0.25 };
  const YO_PARED = { x: 0.15, z: -1.075 }, BANDEJA = { x: 0.15, z: -0.4 }, LATA = { x: 0.75, z: -1.5 };
  const YO_FIN = { x: -0.3, z: 0.9 };
  const PERRO_A = { x: -0.95, z: -0.7 }, PERRO_B = { x: 0.85, z: 0.45 };
  const PINTOR_A = { x: 2.75, z: 0.25 }, PINTOR_DER = { x: XS1, z: YO_PARED.z };
  const PRIMERA = [5, 4, 3], MANO1 = [0.6, 0.8, 0.5];   // la primera mano: tres franjas, desparejas

  function casa() {
    const T = k.THREE, c = (w, h, d, col, x, y, z, s = true) => k.caja(w, h, d, col, x, y, z, k.escena, s);
    const piso = new T.Mesh(new T.PlaneGeometry(80, 80), k.mat('#9EA6A0'));
    piso.rotation.x = -Math.PI / 2; piso.position.y = -0.04; piso.receiveShadow = true; k.escena.add(piso);
    // piso de madera en la pieza, baldosas en la cocina
    c(3.8, 0.1, 3.8, '#B98A5E', 0, -0.03, -0.1, false);
    for (let i = 1; i < 7; i++) c(0.02, 0.012, 3.8, '#A57A50', -1.9 + i * 0.54, 0.025, -0.1, false);
    for (let i = 0; i < 5; i++) for (let j = 0; j < 5; j++) c(0.38, 0.1, 0.38, (i + j) % 2 ? '#EDEAE2' : '#C9C2B4', 2.1 + i * 0.4, -0.03, -0.55 + j * 0.4, false);
    // la pared de atrás (la que se pinta): una placa y adelante las 12 franjas
    c(3.8, H, 0.16, '#CFC3A4', 0, H / 2, ZF - 0.08);
    for (let i = 0; i < N; i++) {
      const f = c(ANCHO + 0.002, H - 0.12, 0.02, '#D8CDB0', X0 + (i + 0.5) * ANCHO, H / 2 + 0.04, ZF + 0.01, false);
      f.material = f.material.clone(); franjas.push(f);
    }
    c(3.6, 0.1, 0.04, '#F2EFE6', 0, 0.05, ZF + 0.03);                 // zócalo
    c(3.8, 0.06, 0.1, '#F2EFE6', 0, H - 0.03, ZF + 0.03, false);      // moldura
    // manchas de humedad en la pared vieja (desaparecen cuando se pinta esa franja)
    [[2, 1.9, 0.34, 0.26], [6, 1.15, 0.26, 0.2], [9, 1.7, 0.3, 0.36]].forEach(([i, y, w, h]) => {
      manchas.push({ i, m: c(w, h, 0.01, '#BCAA82', X0 + (i + 0.5) * ANCHO, y, ZF + 0.026, false) });
    });
    // pared izquierda con ventana
    c(0.16, H, 3.0, '#E2D9C2', -1.98, H / 2, -0.55);
    c(0.04, 1.0, 0.9, '#9FC0D4', -1.89, 1.55, -0.65); c(0.12, 0.06, 1.0, '#D2CDC0', -1.86, 1.02, -0.65);
    c(0.05, 1.0, 0.04, '#D2CDC0', -1.88, 1.55, -0.65, false);
    // pared derecha con la puerta a la cocina (z de -0,25 a 0,75)
    c(0.16, H, 1.75, '#E2D9C2', 1.98, H / 2, -1.125);
    c(0.16, H, 0.4, '#E2D9C2', 1.98, H / 2, 0.95);
    c(0.16, 0.5, 1.0, '#E2D9C2', 1.98, H - 0.25, 0.25);
    c(0.2, 2.12, 0.06, '#F2EFE6', 1.98, 1.06, -0.27, false); c(0.2, 2.12, 0.06, '#F2EFE6', 1.98, 1.06, 0.77, false);
    c(0.2, 0.05, 3.0, '#8C877C', -1.98, H + 0.02, -0.55, false); c(0.2, 0.05, 3.2, '#8C877C', 1.98, H + 0.02, -0.45, false);
    c(4.1, 0.05, 0.2, '#8C877C', 0, H + 0.02, ZF - 0.08, false);
    // la cocina del otro lado: pared, heladera y un pedazo de mesada
    c(1.9, H, 0.12, '#D3E6E0', 2.95, H / 2, -0.75); c(0.12, H, 2.0, '#D3E6E0', 3.9, H / 2, 0.25);
    c(0.7, 1.8, 0.65, '#EEF0EE', 3.45, 0.9, -0.35);
    c(0.04, 0.5, 0.05, '#9AA3A6', 3.12, 1.45, -0.02, false);
    // el mueble tapado con nylon, la alfombra enrollada y unos diarios en el piso
    c(0.95, 0.75, 1.25, '#7A5B3E', -1.3, 0.38, 1.45);
    manta = c(1.05, 0.82, 1.35, '#CFE0EA', -1.3, 0.41, 1.45);
    manta.material = manta.material.clone(); manta.material.transparent = true; manta.material.opacity = 0.8;
    c(1.1, 0.012, 0.75, '#E9E4D6', 0.2, 0.03, -1.45, false); c(0.8, 0.012, 0.6, '#E2DCCB', -0.6, 0.032, -1.55, false);
    const rollo = new T.Mesh(new T.CylinderGeometry(0.12, 0.12, 1.3, 10), k.mat(k.C.verdeVivo));
    rollo.rotation.x = Math.PI / 2; rollo.position.set(-1.72, 0.12, -1.2); rollo.castShadow = true; k.escena.add(rollo);
  }

  // cuánto verde tiene la franja i en el segundo t (0: la pared vieja; 1: verde parejo)
  function cuanto(i, t) {
    const x = X0 + (i + 0.5) * ANCHO;
    let a = 0;
    const j = PRIMERA.indexOf(i);
    if (j >= 0) a = MANO1[j] * k.suave((t - P.rodillo - j * 0.3) / 0.5);
    // la segunda mano: una franja sí y otra no (la cebra)
    const p2 = P.c0 + k.clamp((x - XS0) / (XS1 - XS0)) * (P.c1 - P.c0) + 0.08;
    if (t > p2) { const s = k.suave((t - p2) / 0.2); a = i % 2 === 0 ? k.lerp(a, 1, s) : k.lerp(a, 0.18, s); }
    // el pintor: de derecha a izquierda, parejo
    const p3 = P.p0 + k.clamp((XS1 - x) / (XS1 - XS0)) * (P.parejo - P.p0) + 0.05;
    if (t > p3) a = k.lerp(a, 1, k.suave((t - p3) / 0.2));
    return a;
  }

  function camara(t) {
    const cam = k.camara, V = (x, y, z) => new k.THREE.Vector3(x, y, z);
    let pos, mira;
    if (t < P.corte1) {                          // 1a. el perro blanco, de cerca
      const z = k.lerp(1, 0.86, k.suave(t / P.corte1));
      mira = V(PERRO_A.x - 0.22, 0.5, PERRO_A.z); pos = mira.clone().add(V(0.9 * z, 0.5 * z, 2.8 * z));
    } else if (t < P.f2) {                       // 1b. la pieza: entrás con el rodillo
      const z = k.lerp(1, 0.94, k.suave((t - P.corte1) / (P.f2 - P.corte1)));
      const u = k.suave((t - P.corte1) / (P.f2 - P.corte1));
      mira = V(k.lerp(0.7, -0.4, u), 0.95, -0.8); pos = mira.clone().add(V(1.2 * z, 1.9 * z, 6.8 * z));
    } else if (t < P.f3) {                       // 2. pintás y el rodillo salpica al perro
      const z = k.lerp(1, 0.9, k.suave((t - P.f2) / (P.f3 - P.f2)));
      mira = V(-0.35, 1.15, -1.3); pos = mira.clone().add(V(0.8 * z, 1.3 * z, 6.2 * z));
    } else if (t < P.f4) {                       // 3. desde arriba: la bandeja y las huellas hasta la cocina
      const z = k.lerp(1, 0.94, k.suave((t - P.f3) / (P.f4 - P.f3)));
      mira = V(0.9, 0.3, -0.3); pos = mira.clone().add(V(0.2 * z, 6.0 * z, 7.6 * z));
    } else if (t < P.f5) {                       // 4. de frente: la pared a rayas
      const z = k.lerp(1, 0.95, k.suave((t - P.f4) / (P.f5 - P.f4)));
      mira = V(0, 1.15, -1.0); pos = mira.clone().add(V(0, 0.7 * z, 9.4 * z));
    } else if (t < P.precio + 1.4) {             // 5a. entra el pintor
      const a = k.suave((t - P.f5) / (P.precio + 1.4 - P.f5));
      mira = V(k.lerp(1.4, 0.7, a), 1.0, -0.4); pos = mira.clone().add(V(-1.0, 2.2, k.lerp(8.2, 7.6, a)));
    } else if (t < P.f6) {                       // 5b. la deja pareja (la pared arriba de la tarjeta)
      const z = k.lerp(1, 0.95, k.suave((t - P.precio - 1.4) / Math.max(0.5, P.f6 - P.precio - 1.4)));
      mira = V(0, 0.45, -1.0); pos = mira.clone().add(V(0.3 * z, 1.5 * z, 10.2 * z));
    } else {                                     // 6. remate: el perro, que sigue dálmata
      const u = k.suave((t - P.f6) / Math.min(2.2, Math.max(1, P.cierre - P.f6 - 0.6)));
      mira = V(k.lerp(0, PERRO_B.x, u), k.lerp(0.45, 0.2, u), k.lerp(-1.0, PERRO_B.z, u));
      pos = mira.clone().add(V(k.lerp(0.3, 0.4, u), k.lerp(1.5, 0.8, u), k.lerp(10.2, 5.2, u)));
    }
    cam.position.copy(pos); cam.lookAt(mira); cam.updateProjectionMatrix(); cam.updateMatrixWorld();
  }
  function andar(p, A, B, t, t0, t1) {
    const u = k.clamp((t - t0) / (t1 - t0)), d = Math.hypot(B.x - A.x, B.z - A.z);
    p.position.set(k.lerp(A.x, B.x, u), 0, k.lerp(A.z, B.z, u));
    return { andando: t > t0 && t < t1, rumbo: Math.atan2(B.x - A.x, B.z - A.z), paso: u * d / 1.1, u };
  }

  return {
    get duracion() { return P.cierre + 2.8; },
    get cierre() { return P.cierre; },
    // efectos (sonido.py): la tapa, las salpicaduras, la bandeja, los pasos, los cortes, el precio y el logo
    get efectos() {
      const r = x => +x.toFixed(2), paso = (P.f4 - 0.1 - P.huellas0) / 4;
      return [
        { efecto: 'latigazo', t: r(P.corte1 - 0.2), db: -21 },
        { efecto: 'latigazo', t: r(P.f2 - 0.2), db: -19 },
        { efecto: 'pop', t: r(P.lata + 0.1), db: -15 },
        { efecto: 'lluvia', t: r(P.salpica - 0.1), db: -31 },
        { efecto: 'pop', t: r(P.salpica + 0.2), db: -21 }, { efecto: 'pop', t: r(P.salpica + 0.65), db: -21 }, { efecto: 'pop', t: r(P.salpica + 1.1), db: -21 },
        { efecto: 'latigazo', t: r(P.f3 - 0.2), db: -19 },
        { efecto: 'golpe', t: r(P.bandeja), db: -17 },
        ...[0, 1, 2, 3].map(i => ({ efecto: 'tic', t: r(P.huellas0 + 0.2 + i * paso), db: -18 })),
        { efecto: 'latigazo', t: r(P.f4 - 0.2), db: -19 },
        { efecto: 'pop', t: r(P.cebra - 0.15), db: -16 },
        { efecto: 'latigazo', t: r(P.f5 - 0.2), db: -19 },
        { efecto: 'pop', t: r(P.precio - 0.15), db: -16 },
        { efecto: 'campanita', t: r(P.precio + 0.05), db: -18 },
        { efecto: 'sello', t: r(P.precio + 0.3), db: -18 },
        { efecto: 'latigazo', t: r(P.f6 - 0.2), db: -19 },
        { efecto: 'pop', t: r(P.f6 + 0.25), db: -16 },
        { efecto: 'golpe', t: r(P.cierre + 0.1), db: -14 },
      ];
    },
    armar(kit) {
      k = kit; tiempos();
      const T = k.THREE;
      k.sol.position.set(4, 15, 10);
      VIEJA = new T.Color('#D8CDB0'); VERDE = new T.Color(k.C.verdeVivo);
      casa();
      // vos (remera vieja y gorrito de diario) con el rodillo; el perro blanco; el pintor de blanco
      yo = k.personaje({ ropa: '#6E8FB0', pantalon: '#3C4A66', pelo: '#3A2418', gorra: '#E6E1D3' });
      rodYo = k.rodillo(yo.userData.brazoD);
      zapBlanca = yo.userData.piernaD.children[1].material; zapVerde = k.mat(k.C.verdeVivo);
      perro = k.perro({ color: '#F2F0EA', oscuro: '#D6D1C4' });
      pintor = k.personaje({ ropa: '#F4F2EC', pantalon: '#E9E6DE', zapatillas: '#2A2E2C', piel: '#C9956E', pelo: '#2B1D16', gorra: k.C.verde });
      rodPintor = k.rodillo(pintor.userData.brazoD, k.C.verdeVivo);
      lataP = k.lata(k.C.verdeVivo); lataP.position.set(LATA.x, 0.03, LATA.z);
      bandeja = k.bandejaPintura(k.C.verdeVivo); bandeja.position.set(BANDEJA.x, 0.03, BANDEJA.z); bandeja.rotation.y = 0.2;
      salpica = k.chorro(150, 23, k.C.verdeVivo);
      // los lunares del perro: aparecen de a uno con las salpicaduras
      const az = k.azar(19), U = perro.userData;
      const caras = [
        () => [U.cuerpo, -0.186, k.lerp(-0.1, 0.12, az()), k.lerp(-0.33, 0.33, az()), 'x'],
        () => [U.cuerpo, 0.186, k.lerp(-0.1, 0.12, az()), k.lerp(-0.33, 0.33, az()), 'x'],
        () => [U.cuerpo, k.lerp(-0.14, 0.14, az()), 0.166, k.lerp(-0.33, 0.33, az()), 'y'],
        () => [U.cuello, az() < 0.5 ? -0.176 : 0.176, k.lerp(0.04, 0.28, az()), k.lerp(-0.06, 0.2, az()), 'x'],
        () => [U.cuello, k.lerp(-0.13, 0.13, az()), 0.326, k.lerp(-0.06, 0.2, az()), 'y'],
        () => [U.cuello, az() < 0.5 ? k.lerp(-0.15, -0.12, az()) : k.lerp(0.12, 0.15, az()), k.lerp(0.04, 0.3, az()), 0.256, 'z'],
      ];
      const orden = [0, 1, 4, 2, 3, 5, 0, 1, 2, 4, 3, 1, 0, 5, 2, 4, 1, 0, 3, 2];
      orden.forEach((cara, n) => {
        const [padre, x, y, z, eje] = caras[cara](), s = k.lerp(0.06, 0.1, az());
        const dims = eje === 'x' ? [0.012, s, s * 1.2] : eje === 'y' ? [s, 0.012, s * 1.2] : [s, s * 0.9, 0.012];
        lunares.push({ m: k.caja(...dims, k.C.verdeVivo, x, y, z, padre, false), n });
      });
      // las huellas verdes de la bandeja a la cocina
      for (let i = 0; i < 9; i++) huellas.push(k.caja(0.11, 0.006, 0.21, k.C.verdeVivo, 0, 0.03, 0, k.escena, false));
      url = k.etiquetaUrl();
      etqBlanco = k.etiqueta('Perro: blanco (por ahora)');
      etqCebra = k.etiqueta('Pared: modo cebra');
      etqDalmata = k.etiqueta('Perro: ahora es dálmata');
      card = k.tarjeta(`<div class="sello">Precio<br>de<br>referencia</div>
        <div class="t-et">PINTAR UNA HABITACIÓN CHICA (3 X 3 M)</div>
        <div class="t-precio">$115.000<span>a</span>$178.000</div>
        <div class="t-nota">Noviembre 2026 · AMBA · por trabajo</div>`);
      chip = k.tarjeta(`<div class="ok">✓</div><div><div class="c1">Pedido publicado gratis</div><div class="c2">Pintura · tu zona</div></div>`, 'chip3d');
      fin = k.cierre('Pedí presupuestos', 'de gente de tu zona');
    },
    animar(t) {
      const T = k.THREE;
      // la pared: cada franja con su verde; las manchas se van cuando se pinta su franja
      for (let i = 0; i < N; i++) franjas[i].material.color.copy(VIEJA).lerp(VERDE, cuanto(i, t));
      for (const m of manchas) m.m.visible = cuanto(m.i, t) < 0.35;

      // la lata: la tapa salta, da una vuelta en el aire y cae al lado del perro
      const tapa = lataP.userData.tapa, e = t - P.lata - 0.08;
      if (e < 0) { tapa.position.set(0, 0.25, 0); tapa.rotation.set(0, 0, 0); }
      else if (e < 0.6) { const u = e / 0.6; tapa.position.set(0.6 * u, 0.25 + Math.sin(u * Math.PI) * 1.0 - 0.24 * u, 0.45 * u); tapa.rotation.set(u * 9, 0, u * 4); }
      else { tapa.position.set(0.6, 0.01, 0.45); tapa.rotation.set(0, 0, 0); }

      // vos: entrás, pintás, pisás la bandeja, salís a la cocina, volvés con la segunda mano y mirás la cebra
      yo.visible = t >= P.entra;
      rodYo.userData.rollo.material.color.set(t > P.lata + 0.35 ? k.C.verdeVivo : '#F4F2EC');
      const verdes = t > P.bandeja;
      yo.userData.piernaD.children[1].material = verdes ? zapVerde : zapBlanca;
      yo.userData.piernaI.children[1].material = verdes ? zapVerde : zapBlanca;
      if (t < P.f2) {
        const a = andar(yo, PUERTA, YO_PARED, t, P.entra, P.f2 - 0.15);
        if (a.andando) { yo.rotation.y = a.rumbo; k.pose(yo, { caminar: 1, paso: a.paso }); }
        else { yo.rotation.y = Math.PI; k.pose(yo, {}); }
      } else if (t < P.f3) {
        yo.position.set(YO_PARED.x, 0, YO_PARED.z); yo.rotation.y = Math.PI;
        if (t < P.rodillo - 0.1) k.pose(yo, { cabezaX: 0.35, cabezaY: 0.5 });
        else k.pose(yo, { pintar: t, vel: 9 });
      } else if (t < P.f4) {
        if (t < P.bandeja) {                     // para atrás, sin mirar
          const u = k.clamp((t - P.f3) / Math.max(0.25, P.bandeja - P.f3));
          yo.position.set(YO_PARED.x, 0, k.lerp(YO_PARED.z, BANDEJA.z, u)); yo.rotation.y = Math.PI;
          k.pose(yo, { caminar: 0.6, paso: -u * 1.2, cabezaX: -0.2 });
        } else if (t < P.huellas0) {             // ¡la bandeja!
          const e2 = t - P.bandeja;
          yo.position.set(BANDEJA.x, 0, BANDEJA.z); yo.rotation.y = Math.PI + Math.sin(e2 * 22) * 0.18;
          k.pose(yo, { manosCabeza: t, salto: Math.abs(Math.sin(e2 * 10)) * 0.12, cabezaX: 0.35 });
        } else {
          const a = andar(yo, BANDEJA, PUERTA_IN, t, P.huellas0, P.f4 - 0.1);
          yo.rotation.y = a.rumbo; k.pose(yo, a.andando ? { caminar: 1, paso: a.paso } : {});
        }
      } else if (t < P.f5) {
        if (t < P.cebra) {
          const u = k.clamp((t - P.c0) / (P.c1 - P.c0));
          yo.position.set(k.lerp(XS0, XS1, u), 0, YO_PARED.z); yo.rotation.y = Math.PI;
          k.pose(yo, { caminar: 0.35, paso: u * 6, pintar: t, vel: 11 });
        } else {
          const a = andar(yo, { x: XS1, z: YO_PARED.z }, YO_FIN, t, P.cebra, P.cebra + 0.9);
          if (a.andando) { yo.rotation.y = a.rumbo; k.pose(yo, { caminar: 1, paso: a.paso }); }
          else { yo.rotation.y = 0.2; k.pose(yo, { manosCabeza: t }); }
        }
      } else {
        yo.position.set(YO_FIN.x, 0, YO_FIN.z);
        yo.rotation.y = t < P.parejo + 0.3 ? 3.3 : k.lerp(3.3, 6.0, k.suave((t - P.parejo - 0.3) / 0.4));
        k.pose(yo, t > P.parejo + 0.3 ? { festejo: t } : { brazosCruzados: true });
      }

      // las salpicaduras: salen del rodillo mientras pintás
      const rp = new T.Vector3(); rodYo.userData.rollo.getWorldPosition(rp);
      const fuerza = t >= P.rodillo && t < P.f3 - 0.1 ? 0.85 : (t >= P.c0 && t < P.cebra ? 0.25 : 0);
      salpica.animar(t, yo.visible ? fuerza : 0, { x: rp.x, y: rp.y, z: rp.z + 0.05 }, 0.45, 0.9);

      // el perro (el testigo): blanco y feliz; los lunares le aparecen de a uno; mira la cebra; al final, orgulloso
      const dur = Math.max(0.6, P.f3 - 0.15 - P.salpica);
      for (const l of lunares) {
        const t0 = P.salpica + 0.1 + l.n / lunares.length * dur, s = k.rebote((t - t0) / 0.18);
        l.m.visible = t >= t0; l.m.scale.setScalar(Math.max(0.001, Math.min(1.15, s)));
      }
      if (t < P.f4) {
        perro.position.set(PERRO_A.x, 0, PERRO_A.z);
        if (t < P.entra + 0.3) { perro.rotation.y = -0.15; k.posePerro(perro, { sentado: true, cola: t }); }
        else {
          perro.rotation.y = k.lerp(-0.15, 0.55, k.suave((t - P.entra - 0.3) / 0.4));
          let bob = 0;
          for (const l of lunares) { const e3 = t - (P.salpica + 0.1 + l.n / lunares.length * dur); if (e3 >= 0 && e3 < 0.25) bob = Math.sin(e3 / 0.25 * Math.PI) * 0.3; }
          const sigue = t > P.huellas0 ? k.clamp((t - P.huellas0) / (P.f4 - P.huellas0)) : 0;
          k.posePerro(perro, { sentado: true, cabezaX: -bob, cabezaY: 0.9 * sigue, cola: t < P.salpica ? t : 0 });
        }
      } else if (t < P.f6 - 0.1) {
        perro.position.set(PERRO_B.x, 0, PERRO_B.z); perro.rotation.y = Math.PI - 0.25;
        const ladea = t > P.cebra ? Math.sin((t - P.cebra) * 3) * 0.45 : 0;
        k.posePerro(perro, { sentado: true, cabezaY: ladea, cola: t * 0.6 });
      } else {
        perro.position.set(PERRO_B.x, 0, PERRO_B.z);
        perro.rotation.y = k.lerp(Math.PI - 0.25, 0.25, k.suave((t - P.f6 + 0.1) / 0.5));
        k.posePerro(perro, { sentado: true, cabezaX: -0.12, cola: t * 1.4 });
      }

      // las huellas: aparecen a medida que caminás a la cocina
      const rumbo = Math.atan2(PUERTA_IN.x - BANDEJA.x, PUERTA_IN.z - BANDEJA.z);
      huellas.forEach((h, i) => {
        const u = (i + 0.6) / huellas.length, t0 = P.huellas0 + u * (P.f4 - 0.1 - P.huellas0), lado = i % 2 ? 0.09 : -0.09;
        h.visible = t >= t0;
        h.position.set(k.lerp(BANDEJA.x, PUERTA_IN.x, u) + Math.cos(rumbo) * lado, 0.03, k.lerp(BANDEJA.z, PUERTA_IN.z, u) - Math.sin(rumbo) * lado);
        h.rotation.y = rumbo;
      });
      bandeja.rotation.set(t > P.bandeja && t < P.huellas0 ? Math.sin((t - P.bandeja) * 30) * 0.08 : 0, 0.2, 0);

      // el pintor: entra, va a la punta derecha y la deja pareja hasta la izquierda
      pintor.visible = t >= P.m0 - 0.05;
      if (t < P.m1) {
        const a = andar(pintor, PINTOR_A, PINTOR_DER, t, P.m0, P.m1);
        pintor.rotation.y = a.rumbo; k.pose(pintor, a.andando ? { caminar: 1, paso: a.paso } : {});
      } else if (t < P.parejo) {
        const u = k.clamp((t - P.p0) / (P.parejo - P.p0));
        pintor.position.set(k.lerp(XS1, XS0, u), 0, YO_PARED.z); pintor.rotation.y = Math.PI;
        k.pose(pintor, t > P.p0 ? { caminar: 0.3, paso: u * 5, pintar: t, vel: 13 } : {});
      } else {
        pintor.position.set(XS0, 0, YO_PARED.z);
        pintor.rotation.y = k.lerp(Math.PI, 0.4, k.suave((t - P.parejo) / 0.4));
        k.pose(pintor, t > P.parejo + 0.4 ? { saludo: t } : {});
      }

      camara(t);
      // carteles y textos
      etqBlanco.animar(t, 0.35, P.corte1 + 0.15, { x: perro.position.x, y: 0.55, z: perro.position.z }, -10, -150);
      etqCebra.animar(t, P.cebra - 0.2, P.f5 - 0.05, { x: 0.15, y: 2.15, z: ZF + 0.03 }, 60, -260);
      etqDalmata.animar(t, P.f6 + 0.9, P.cierre + 0.15, { x: perro.position.x, y: 0.6, z: perro.position.z }, -10, -190);
      k.mostrar(card, t, P.precio - 0.15, P.f6 - 0.05);
      k.mostrar(chip, t, P.f6 + 0.25, P.cierre + 0.2);
      url.style.opacity = t < P.cierre ? 1 : 0;
      fin.animar(t, P.cierre);
    },
  };
})();
