/* Escena del video 3D de clases de canto (comun-3d.js). Cada red tiene su HTML
   (video-3d-canto-tt/ig/fb.html) que solo define window.RED.
   Casa en corte, como una casa de muñecas: el cuarto del vecino, el baño con la
   ducha y el living. Historia en escalera: cantás en la ducha, el vecino golpea
   la pared, el perro te hace los coros, el tutorial te deja afónico; llega la profe. */
window.ESCENA3D = (function () {
  let k, yo, yo2, vecino, profe, perro, piano, celu, cuadro, paredVecino, agua, vapor, tos;
  let notasMal, notasMal2, notasPerro, notasBien, notasTeclado, card, chip, fin, url, etqAfin, etqToc, etqAuu, etqVoz;
  const P = {};
  function tiempos() {
    P.f2 = k.frase(2, 2.6);        // el vecino golpea la pared
    P.f3 = k.frase(3, 4.6);        // el perro te hace los coros
    P.f4 = k.frase(4, 6.4);        // el tutorial y afónico
    P.f5 = k.frase(5, 10.0);       // tranqui: el precio
    P.f6 = k.frase(6, 16.0);       // pedilo gratis
    P.afonico = k.palabra('afónico', 1, k.palabra('afonico', 1, P.f4 + 2.2));
    P.precio = k.palabra('diecisiete', 1, k.palabra('17', 1, P.f5 + 2.5));
    P.fin = k.finVoz(19.5);
    P.cierre = P.fin + 0.35;
    P.m0 = P.f5 + 0.1;             // entra la profe
    P.m1 = P.m0 + 1.5;             // llega al teclado
    // golpes del vecino: el puño toca la pared cada 0,35 s
    P.golpes = [];
    for (let g = P.f2 + 0.175; g < P.f3 + 0.3; g += Math.PI / 9) P.golpes.push(g);
  }
  const ZF = -2.1, ZFRENTE = 1.5, H = 2.6;
  const DUCHA = { x: -2.25, z: -1.25 }, YO = { x: -2.25, z: -1.12 }, VECINO = { x: -3.95, z: -0.85 };
  const PERRO = { x: 0.8, z: 0.75 }, CELU = { x: 1.6, z: -0.65 }, YO2 = { x: 1.6, z: 0.4 };
  const PROFE_A = { x: 5.6, z: 0.8 }, PROFE = { x: 3.35, z: -0.62 }, TECLADO = { x: 3.35, z: -0.12 }, ALUMNO = { x: 2.2, z: -0.05 };

  function casa() {
    const T = k.THREE, c = (w, h, d, col, x, y, z, s = true) => k.caja(w, h, d, col, x, y, z, k.escena, s);
    const piso = new T.Mesh(new T.PlaneGeometry(80, 80), k.mat('#AEB5AB'));
    piso.rotation.x = -Math.PI / 2; piso.position.y = -0.04; piso.receiveShadow = true; k.escena.add(piso);
    // pisos: madera clara (vecino), baldosas (baño), madera (living)
    c(3.8, 0.1, 3.6, '#C9B08C', -5.1, -0.03, -0.3, false);
    for (let i = 0; i < 8; i++) for (let j = 0; j < 9; j++) c(0.38, 0.1, 0.38, (i + j) % 2 ? '#E4EDEF' : '#D3E0E4', -3.0 + i * 0.4, -0.03, ZF + 0.2 + j * 0.4, false);
    c(5.2, 0.1, 3.6, '#B98A5E', 2.6, -0.03, -0.3, false);
    for (let i = 1; i < 9; i++) c(0.02, 0.012, 3.6, '#A57A50', i * 0.58, 0.025, -0.3, false);
    // pared del fondo, un color por ambiente; azulejos en el baño
    c(3.8, H, 0.16, '#E8D9BF', -5.1, H / 2, ZF - 0.08);
    c(3.2, H, 0.16, '#CFE6EC', -1.6, H / 2, ZF - 0.08);
    c(5.2, H, 0.16, '#DCE8E1', 2.6, H / 2, ZF - 0.08);
    for (let i = 1; i < 8; i++) c(0.015, 1.9, 0.02, '#B5D2DA', -3.2 + i * 0.4, 0.95, ZF + 0.005, false);
    for (let j = 1; j < 5; j++) c(3.2, 0.015, 0.02, '#B5D2DA', -1.6, j * 0.4, ZF + 0.005, false);
    // tabiques (con la puerta del baño al living) y paredes de los costados
    const largo = ZFRENTE - ZF, medio = (ZF + ZFRENTE) / 2;
    paredVecino = c(0.16, H, largo, '#EDE6D6', -3.2, H / 2, medio);
    c(0.16, H, 2.2, '#EDE6D6', 0, H / 2, ZF + 1.1);
    c(0.16, H, 0.4, '#EDE6D6', 0, H / 2, 1.3);
    c(0.16, 0.5, 1.0, '#EDE6D6', 0, H - 0.25, 0.6);
    c(0.16, H, largo, '#EDE6D6', -7.0, H / 2, medio);
    c(0.16, H, 1.9, '#EDE6D6', 5.2, H / 2, ZF + 0.95);
    [[-3.2, medio, largo], [0, ZF + 1.1, 2.2], [0, 1.3, 0.4], [-7, medio, largo], [5.2, ZF + 0.95, 1.9]]
      .forEach(([x, z, l]) => c(0.2, 0.05, l, '#8C877C', x, H + 0.02, z, false));
    c(12.4, 0.05, 0.2, '#8C877C', -0.9, H + 0.02, ZF - 0.08, false);
    // cuarto del vecino: cama, mesa de luz con velador y un cuadro
    c(1.9, 0.35, 1.2, '#7A5B3E', -5.5, 0.18, -1.45);
    c(1.8, 0.16, 1.1, '#F0EEE8', -5.5, 0.42, -1.45);
    c(0.45, 0.1, 0.8, '#FCFBF8', -6.2, 0.55, -1.45);
    c(1.2, 0.05, 1.12, '#5B7FA6', -5.1, 0.52, -1.45);
    c(0.45, 0.5, 0.4, '#8E6C4A', -6.6, 0.25, -0.4);
    c(0.08, 0.3, 0.08, '#2A2E2C', -6.6, 0.65, -0.4); c(0.3, 0.22, 0.3, '#F2D27A', -6.6, 0.9, -0.4);
    c(0.9, 0.6, 0.04, k.C.verdeVivo, -4.9, 1.75, ZF + 0.02);
    // baño: ducha, cortina corrida, inodoro, lavatorio y espejo
    c(1.2, 0.08, 1.3, '#F4F6F5', DUCHA.x, 0.04, DUCHA.z);
    c(0.05, 1.45, 0.05, '#B8C0C2', DUCHA.x, 1.62, ZF + 0.06);
    c(0.05, 0.05, 0.5, '#B8C0C2', DUCHA.x, 2.35, ZF + 0.3);
    const flor = new T.Mesh(new T.CylinderGeometry(0.17, 0.12, 0.06, 10), k.mat('#C9D1D3'));
    flor.position.set(DUCHA.x, 2.3, ZF + 0.56); flor.rotation.x = 0.35; flor.castShadow = true; k.escena.add(flor);
    c(0.04, 0.04, 1.4, '#B8C0C2', DUCHA.x - 0.62, 2.25, DUCHA.z, false);
    c(0.08, 1.9, 0.5, k.C.verdeLuz, DUCHA.x - 0.62, 1.25, DUCHA.z - 0.42);
    c(0.4, 0.42, 0.52, '#F4F6F5', -0.5, 0.21, -1.55); c(0.46, 0.4, 0.18, '#F4F6F5', -0.5, 0.62, -1.92);
    c(0.42, 0.05, 0.5, '#E3E8E8', -0.5, 0.44, -1.5);
    c(0.18, 0.8, 0.18, '#F4F6F5', -1.25, 0.4, -1.9); c(0.6, 0.16, 0.42, '#F4F6F5', -1.25, 0.86, -1.85);
    c(0.6, 0.7, 0.03, '#BFD6DE', -1.25, 1.6, ZF + 0.02);
    // cuadrito del baño colgado en la pared que da al vecino: se tuerce con los golpes
    cuadro = new T.Group(); cuadro.position.set(-3.1, 2.05, -0.15); k.escena.add(cuadro);
    k.caja(0.04, 0.44, 0.56, k.C.latonOsc, 0, -0.22, 0, cuadro); k.caja(0.045, 0.34, 0.46, '#F2D27A', 0.004, -0.22, 0, cuadro, false);
    // living: sillón, almohadón, alfombra, ventana, planta y la cucha
    c(1.7, 0.42, 0.75, '#2E5E7E', 4.05, 0.21, -1.6); c(1.7, 0.6, 0.2, '#2E5E7E', 4.05, 0.62, -1.9);
    c(0.2, 0.55, 0.75, '#27506B', 3.25, 0.32, -1.6); c(0.2, 0.55, 0.75, '#27506B', 4.85, 0.32, -1.6);
    c(0.55, 0.14, 0.3, k.C.laton, 3.7, 0.5, -1.62);
    c(2.8, 0.02, 1.9, k.C.verdeVivo, 2.5, 0.03, 0.05, false);
    c(1.3, 1.0, 0.04, '#A9C6D6', 1.6, 1.65, ZF + 0.02); c(1.42, 0.06, 0.12, '#D2CDC0', 1.6, 1.12, ZF + 0.06);
    c(0.35, 0.4, 0.35, '#B5583A', 4.85, 0.2, -0.55);
    const copa = new T.Mesh(new T.IcosahedronGeometry(0.42, 0), k.mat('#3F7A4A'));
    copa.position.set(4.85, 0.85, -0.55); copa.castShadow = true; k.escena.add(copa);
    c(0.8, 0.12, 0.7, '#9C4A30', 1.05, 0.06, 1.05, false);
  }

  function camara(t) {
    const cam = k.camara, V = (x, y, z) => new k.THREE.Vector3(x, y, z);
    let pos, mira;
    if (t < P.f2) {                              // 1. cantando en la ducha, de cerca
      const z = k.lerp(1, 0.84, k.suave(t / P.f2));
      mira = V(YO.x + 0.15, 1.3, YO.z); pos = mira.clone().add(V(1.3 * z, 0.7 * z, 5.6 * z));
    } else if (t < P.f3) {                       // 2. corte de la casa: el vecino golpea la pared
      const u = k.suave((t - P.f2) / (P.f3 - P.f2));
      mira = V(k.lerp(-2.95, -3.15, u), 1.25, -0.8); pos = mira.clone().add(V(k.lerp(0.5, 0.2, u), 2.6, 8.0));
    } else if (t < P.f4) {                       // 3. el perro hace los coros, desde abajo
      const z = k.lerp(1, 0.88, k.suave((t - P.f3) / (P.f4 - P.f3)));
      mira = V(PERRO.x - 0.1, 0.75, PERRO.z); pos = mira.clone().add(V(1.5 * z, 0.95 * z, 4.0 * z));
    } else if (t < P.f5) {                       // 4. el tutorial, de costado
      const z = k.lerp(1, 0.9, k.suave((t - P.f4) / (P.f5 - P.f4)));
      mira = V(1.6, 1.2, -0.1); pos = mira.clone().add(V(3.6 * z, 1.0 * z, 3.8 * z));
    } else if (t < P.precio + 1.4) {             // 5a. entra la profe
      const a = k.suave((t - P.f5) / (P.precio + 1.4 - P.f5));
      mira = V(k.lerp(3.5, 2.9, a), 1.05, -0.2); pos = mira.clone().add(V(0.5, 3.0, k.lerp(9.6, 9.0, a)));
    } else if (t < P.f6) {                       // 5b. la clase, de cerca
      const z = k.lerp(1, 0.92, k.suave((t - P.precio - 1.4) / Math.max(0.5, P.f6 - P.precio - 1.4)));
      mira = V(2.75, 1.35, -0.3); pos = mira.clone().add(V(-0.6 * z, 0.9 * z, 4.8 * z));
    } else {                                     // 6. paneo: la clase, el perro y el vecino que aplaude
      const u = k.suave((t - P.f6) / Math.min(2.4, Math.max(1, P.cierre - P.f6 - 0.6)));
      mira = V(k.lerp(2.6, -4.3, u), 1.15, -0.6); pos = mira.clone().add(V(0.4, 2.8, 7.6));
    }
    cam.position.copy(pos); cam.lookAt(mira); cam.updateProjectionMatrix(); cam.updateMatrixWorld();
  }
  // camina de A a B entre t0 y t1 (posición, rumbo y paso)
  function andar(p, A, B, t, t0, t1) {
    const u = k.clamp((t - t0) / (t1 - t0)), d = Math.hypot(B.x - A.x, B.z - A.z);
    p.position.set(k.lerp(A.x, B.x, u), 0, k.lerp(A.z, B.z, u));
    return { andando: t > t0 && t < t1, rumbo: Math.atan2(B.x - A.x, B.z - A.z), paso: u * d / 1.1 };
  }

  return {
    get duracion() { return P.cierre + 2.8; },
    get cierre() { return P.cierre; },
    // efectos (sonido.py): la ducha, los golpes en la pared, cortes, el teclado, el precio, el chip y el logo
    get efectos() {
      const r = x => +x.toFixed(2);
      return [
        { efecto: 'lluvia', t: 0.05, db: -27 },
        { efecto: 'lluvia', t: r(P.f2), db: -29 },
        { efecto: 'pop', t: r(0.6), db: -18 },
        { efecto: 'latigazo', t: r(P.f2 - 0.2), db: -19 },
        ...P.golpes.slice(0, 6).map(g => ({ efecto: 'golpe', t: r(g), db: -17 })),
        { efecto: 'latigazo', t: r(P.f3 - 0.2), db: -19 },
        { efecto: 'pop', t: r(P.f3 + 0.3), db: -17 },
        { efecto: 'latigazo', t: r(P.f4 - 0.2), db: -19 },
        { efecto: 'pop', t: r(P.afonico), db: -17 },
        { efecto: 'latigazo', t: r(P.f5 - 0.2), db: -19 },
        { efecto: 'pop', t: r(P.m1 - 0.3), db: -17 },
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
      k.sol.position.set(3, 15, 10);              // luz más de frente: los tabiques no tapan los ambientes
      casa();
      // vos, en toalla y con gorro de baño; el shampoo hace de micrófono
      yo = k.personaje({ ropa: '#E2B48F', pantalon: '#E2B48F', zapatillas: '#E2B48F' });
      k.caja(0.68, 0.34, 0.42, '#FCFBF8', 0, -0.06, 0, yo.userData.cadera);
      k.caja(0.53, 0.17, 0.5, k.C.verdeLuz, 0, 0.53, 0, yo.userData.cuello);
      k.caja(0.12, 0.26, 0.12, '#5FB3A1', 0, -0.8, 0.02, yo.userData.brazoD);
      k.caja(0.13, 0.06, 0.13, '#F2F2EE', 0, -0.66, 0.02, yo.userData.brazoD, false);
      yo2 = k.personaje({ ropa: '#7E5AA6', pantalon: '#2E3F66' });       // vos, ya vestido
      vecino = k.personaje({ ropa: '#7FA7C9', pantalon: '#7FA7C9', pelo: '#9A958E', zapatillas: '#3B3F45' });
      profe = k.personaje({ ropa: k.C.verdeVivo, pantalon: '#2A2E2C', piel: '#C9956E', pelo: '#3A2418' });
      k.caja(0.5, 0.5, 0.14, '#3A2418', 0, 0.22, -0.22, profe.userData.cuello);
      perro = k.perro();
      piano = k.teclado(); celu = k.celular();
      celu.position.set(CELU.x, 0, CELU.z);
      agua = k.lluvia({ zona: { x0: DUCHA.x - 0.3, x1: DUCHA.x + 0.3, z0: ZF + 0.35, z1: ZF + 1.0 }, alto: 2.25, gota: 0.16, cantidad: 220 });
      vapor = k.humo(16, '#F4F7F6'); tos = k.humo(10, '#B8C0C2');
      notasMal = k.notas(12, k.C.tinta, 5); notasMal2 = k.notas(8, '#5D6A64', 21); notasPerro = k.notas(8, '#5D6A64', 9);
      notasBien = k.notas(12, k.C.laton, 13); notasTeclado = k.notas(10, k.C.verdeVivo, 17);
      url = k.etiquetaUrl();
      etqAfin = k.etiqueta('Afinación: dudosa');
      etqToc = k.etiqueta('¡Toc, toc, toc!');
      etqAuu = k.etiqueta('Auuuuu');
      etqVoz = k.etiqueta('Voz: 0 %');
      card = k.tarjeta(`<div class="sello">Precio<br>de<br>referencia</div>
        <div class="t-et">CLASE DE CANTO · 1 HORA</div>
        <div class="t-precio">$17.000<span>a</span>$32.000</div>
        <div class="t-nota">Noviembre 2026 · AMBA · por clase</div>`);
      chip = k.tarjeta(`<div class="ok">✓</div><div><div class="c1">Pedido publicado gratis</div><div class="c2">Clases de canto · tu zona</div></div>`, 'chip3d');
      fin = k.cierre('Pedí presupuestos', 'de gente de tu zona');
    },
    animar(t) {
      // la ducha corre hasta que vas al tutorial
      agua.animar(t, t < P.f4 ? 1 : 0);
      vapor.animar(t, 0, P.f4, { x: DUCHA.x, y: 1.95, z: DUCHA.z });

      // vos en la ducha: cantás con el shampoo; con los golpes mirás la pared y cantás más fuerte
      yo.visible = t < P.f4;
      yo.position.set(YO.x, 0.08, YO.z);
      yo.rotation.y = 0.25 + Math.sin(t * 1.4) * 0.15;
      const miraPared = t > P.f2 + 0.15 && t < P.f2 + 1.0;
      k.pose(yo, { cantar: t, drama: t < P.f2 ? 1 : 1.35, cabezaY: miraPared ? -0.9 : 0, salto: Math.abs(Math.sin(t * 5)) * 0.04 });
      notasMal.animar(t, 0.3, P.f4 - 0.1, { x: YO.x + 0.2, y: 1.85, z: YO.z + 0.25 }, { tambaleo: 1.6, vida: 1.4 });

      // el vecino: golpea la pared, espera de brazos cruzados y al final aplaude
      vecino.position.set(VECINO.x, 0, VECINO.z);
      if (t < P.f6) {
        vecino.rotation.y = Math.PI / 2;
        k.pose(vecino, t >= P.f2 - 0.1 && t < P.f3 + 0.3 ? { golpear: t - P.f2 } : { brazosCruzados: true, cabezaY: 0.2 });
      } else {
        vecino.rotation.y = k.lerp(Math.PI / 2, 0.2, k.suave((t - P.f6) / 0.5));
        k.pose(vecino, { aplaudir: t, salto: Math.abs(Math.sin(t * 6)) * 0.05 });
      }
      // la pared tiembla con cada golpe y el cuadrito se tuerce
      let dx = 0, n = 0;
      for (const g of P.golpes) if (t >= g) { n++; const e = t - g; dx += 0.025 * Math.exp(-e * 14) * Math.cos(e * 70); }
      paredVecino.position.x = -3.2 + dx;
      cuadro.rotation.x = Math.min(0.32, n * 0.07) + dx * 3;

      // el perro: mira al baño, se suma al canto, mira el tutorial y en la clase mueve la cola
      perro.position.set(PERRO.x, 0, PERRO.z);
      if (t < P.f3) { perro.rotation.y = -1.2; k.posePerro(perro, { sentado: true, cabezaX: -0.1 }); }
      else if (t < P.f4 + 0.3) { perro.rotation.y = k.lerp(-1.2, 0.25, k.suave((t - P.f3) / 0.3)); k.posePerro(perro, { sentado: true, aullar: t }); }
      else if (t < P.m1) { perro.rotation.y = 0.6; k.posePerro(perro, { sentado: true, cabezaY: 0.5, cabezaX: Math.sin(t * 3) * 0.1 }); }
      else { perro.rotation.y = 0.9; k.posePerro(perro, { sentado: true, cola: t, cabezaX: -0.15 + Math.sin(t * 4) * 0.08 }); }
      notasPerro.animar(t, P.f3 + 0.2, P.f4 + 0.2, { x: PERRO.x, y: 0.95, z: PERRO.z + 0.2 }, { tambaleo: 1.6, vida: 1.1, escala: 0.6 });

      // vos, ya vestido: el tutorial del celular, la nota alta y te quedás sin voz; después la clase
      yo2.visible = t >= P.f4;
      if (t < P.f5) {
        yo2.position.set(YO2.x, 0, YO2.z); yo2.rotation.y = Math.PI;
        if (t < P.afonico - 0.15) k.pose(yo2, { cantar: t, drama: 1.5, salto: k.suave((t - P.afonico + 0.9) / 0.5) * 0.12 });
        else k.pose(yo2, { garganta: t });
      } else {
        const a = andar(yo2, YO2, ALUMNO, t, P.f5, P.f5 + 0.9);
        if (a.andando) { yo2.rotation.y = a.rumbo; k.pose(yo2, { caminar: 1, paso: a.paso }); }
        else { yo2.rotation.y = 0.75; k.pose(yo2, t > P.m1 ? { cantar: t, drama: 0.55 } : {}); }
      }
      notasMal2.animar(t, P.f4 + 0.3, P.afonico, { x: YO2.x, y: 1.85, z: YO2.z - 0.25 }, { tambaleo: 1.8, vida: 1.1 });
      tos.animar(t, P.afonico, P.f5 - 0.1, { x: YO2.x, y: 1.7, z: YO2.z - 0.3 });

      // la profe entra con el teclado y da la clase
      profe.visible = t >= P.m0 - 0.05;
      const pr = andar(profe, PROFE_A, PROFE, t, P.m0, P.m1);
      if (pr.andando) { profe.rotation.y = pr.rumbo; k.pose(profe, { caminar: 1, paso: pr.paso }); }
      else { profe.rotation.y = 0; k.pose(profe, t > P.m1 ? { tocar: t } : {}); }
      piano.visible = t >= P.m1 - 0.35;
      piano.position.set(TECLADO.x, 0, TECLADO.z);
      piano.scale.setScalar(Math.max(0.001, k.rebote((t - (P.m1 - 0.35)) / 0.4)));
      notasTeclado.animar(t, P.m1, P.cierre + 0.5, { x: TECLADO.x, y: 1.0, z: TECLADO.z + 0.1 }, { tambaleo: 0.3, vida: 1.6 });
      notasBien.animar(t, P.m1 + 0.2, P.cierre + 0.5, { x: ALUMNO.x + 0.15, y: 1.9, z: ALUMNO.z + 0.2 }, { tambaleo: 0.25, vida: 1.6 });

      camara(t);
      // carteles y textos
      etqAfin.animar(t, 0.6, P.f2 - 0.05, { x: YO.x + 0.1, y: 2.15, z: YO.z }, 130, 40);
      etqToc.animar(t, P.golpes[0] || P.f2 + 0.2, P.f3 - 0.05, { x: -3.32, y: 1.55, z: VECINO.z }, -60, -260);
      etqAuu.animar(t, P.f3 + 0.3, P.f4 - 0.05, { x: PERRO.x, y: 1.05, z: PERRO.z + 0.35 }, 150, -40);
      etqVoz.animar(t, P.afonico, P.f5 - 0.05, { x: YO2.x, y: 2.05, z: YO2.z - 0.1 }, -140, 20);
      k.mostrar(card, t, P.precio - 0.15, P.f6 - 0.05);
      k.mostrar(chip, t, P.f6 + 0.25, P.cierre + 0.2);
      url.style.opacity = t < P.cierre ? 1 : 0;
      fin.animar(t, P.cierre);
    },
  };
})();
