/* Escena del video 3D de mandados y mensajería (comun-3d.js). Cada red tiene su
   HTML (video-3d-mandados-tt/ig/fb.html) que solo define window.RED.
   Una cuadra de barrio a la tarde: tu casa (color arena, puerta de madera), la
   de la vecina al lado (verde agua, con la puerta abierta) y la vecina sentada
   en la vereda con el mate (la testigo). Historia en escalera, graciosa: te
   olvidaste las llaves en lo de tu vieja y estás afuera; agarrás la bici y
   pinchás en la esquina; el monopatín se queda sin batería a los dos metros;
   te sentás en el cordón y te llueve encima (solo a vos: la vecina, al sol, se
   pone los anteojos). Con el precio llega la moto con las llaves y entrás.
   Remate (cámara en la vecina): se levanta para entrar, una ráfaga le cierra
   la puerta de un golpe y las llaves de ella quedan adentro. */
window.ESCENA3D = (function () {
  let k, yo, vecina, cadete, bici, mono, moto, puertaYo, puertaVec, silla, mate, anteojos, casco, nube, gotas, llaves, manoYo, manoCad;
  let hojas = [], etqRueda, etqBat, etqLluvia, etqVecina, card, chip, fin, url;
  const P = {};
  const VY = 0.18;                                   // alto de la vereda
  const PUERTA = { x: -0.2, z: -2.0 }, PUERTA_V = { x: 3.5, z: -2.0 };
  const YO_PUERTA = { x: -0.2, z: -1.45 };
  const SILLA = { x: 2.35, z: -1.4 };
  const ESQUINA = 4.7;                               // donde se pincha la goma
  const CORDON = { x: 0.15, z: -0.33 };              // donde te sentás
  const MOTO_F = { x: -0.55, z: 0.62 };              // donde frena la moto

  function tiempos() {
    P.f2 = k.frase(2, 4.2);
    P.f3 = k.frase(3, 7.4);
    P.f4 = k.frase(4, 11.0);
    P.f5 = k.frase(5, 14.4);
    P.f6 = k.frase(6, 20.6);
    P.pincha = k.palabra('pinchás', 1, P.f2 + 1.5);
    P.para = k.palabra('batería', 1, P.f3 + 1.9);   // el monopatín se apaga
    P.espera = k.palabra('esperar', 1, P.f4 + 1.4);
    P.llueve = k.palabra('llover', 1, P.f4 + 2.2);
    P.moto = k.palabra('moto', 1, P.f5 + 1.6);
    P.precio = k.palabra('dieciséis', 1, P.f5 + 3.6);
    P.fin = k.finVoz(24.5);
    P.cierre = P.fin + 0.35;
    P.rem = Math.min(P.f6 + 1.6, P.cierre - 2.5);   // remate: la vecina se levanta
    P.portazo = P.rem + 1.05;                       // la ráfaga le cierra la puerta
  }

  // una casa de frente (mira hacia +z) con un hueco para la puerta, que va en un grupo con la bisagra a la izquierda
  function casa(x0, x1, color, puertaX, colorPuerta, ventanaX, colorVentana) {
    const c = (w, h, d, col, x, y, z, s = true) => k.caja(w, h, d, col, x, y, z, k.escena, s);
    const zf = -2.0, alto = 3.3, pa = 0.95, ph = 2.15;
    const a = puertaX - pa / 2, b = puertaX + pa / 2;
    c(a - x0, alto, 0.3, color, (x0 + a) / 2, VY + alto / 2, zf - 0.15);
    c(x1 - b, alto, 0.3, color, (b + x1) / 2, VY + alto / 2, zf - 0.15);
    c(pa, alto - ph, 0.3, color, puertaX, VY + ph + (alto - ph) / 2, zf - 0.15);
    c(pa + 0.2, ph + 0.1, 0.06, '#2A2420', puertaX, VY + ph / 2, zf - 0.55, false);   // adentro, oscuro
    c(pa + 0.3, 0.08, 0.6, '#2A2420', puertaX, VY + 0.0, zf - 0.3, false);
    c(x1 - x0 + 0.1, 0.24, 0.5, '#D6D0C2', (x0 + x1) / 2, VY + alto + 0.1, zf - 0.1);   // cornisa
    c(0.14, ph + 0.12, 0.08, '#D6D0C2', a - 0.07, VY + ph / 2, zf + 0.02); c(0.14, ph + 0.12, 0.08, '#D6D0C2', b + 0.07, VY + ph / 2, zf + 0.02);
    c(pa + 0.28, 0.12, 0.08, '#D6D0C2', puertaX, VY + ph + 0.06, zf + 0.02);
    // ventana con reja
    c(1.2, 1.1, 0.05, colorVentana || '#A9C6D6', ventanaX, VY + 1.55, zf + 0.01, false);
    for (let i = 0; i < 6; i++) c(0.04, 1.14, 0.04, '#2A2E2C', ventanaX - 0.55 + i * 0.22, VY + 1.55, zf + 0.07, false);
    c(1.36, 0.08, 0.16, '#D6D0C2', ventanaX, VY + 0.98, zf + 0.06);
    // la puerta (grupo con la bisagra a la izquierda; se abre hacia adentro con rotation.y positivo)
    const g = new k.THREE.Group(); g.position.set(a, VY, zf - 0.04); k.escena.add(g);
    k.caja(pa, ph, 0.07, colorPuerta, pa / 2, ph / 2, 0, g);
    [[0.25, 1.55], [0.7, 1.55], [0.25, 0.62], [0.7, 0.62]].forEach(([x, y]) => k.caja(0.3, 0.55, 0.02, colorPuerta === '#7A4E2D' ? '#6A4226' : '#335E88', x, y, 0.045, g, false));
    k.caja(0.07, 0.07, 0.1, k.C.laton, pa - 0.12, 1.05, 0.07, g);
    return g;
  }

  function cuadra() {
    const T = k.THREE, c = (w, h, d, col, x, y, z, s = true) => k.caja(w, h, d, col, x, y, z, k.escena, s);
    const piso = new T.Mesh(new T.PlaneGeometry(90, 90), k.mat('#4E5356'));
    piso.rotation.x = -Math.PI / 2; piso.position.y = -0.02; piso.receiveShadow = true; k.escena.add(piso);
    for (let i = -6; i <= 6; i++) c(1.2, 0.01, 0.12, '#E8E6DE', i * 2.2, 0.0, 3.4, false);     // línea de la calle
    c(30, VY, 1.8, '#C7C9C2', 0, VY / 2, -1.1);                                                // vereda
    c(30, VY + 0.01, 0.14, '#B2AFA5', 0, VY / 2, -0.27);                                        // cordón
    for (let i = -14; i <= 14; i++) c(0.02, 0.005, 1.6, '#B6B8B1', i * 0.6 + 0.3, VY + 0.002, -1.15, false);
    puertaYo = casa(-3.2, 1.7, '#E3C9A0', PUERTA.x, '#7A4E2D', -1.6);
    puertaVec = casa(1.7, 6.4, '#A9CBBF', PUERTA_V.x, '#3D6E9E', 5.2, '#BFD3DD');
    c(0.12, 3.5, 0.34, '#CFC8B8', 1.7, VY + 1.75, -2.1);                                       // la medianera
    // la casa de más allá y la de más acá (para que la cuadra siga)
    c(4.5, 3.0, 0.3, '#D9A88A', -5.5, VY + 1.5, -2.15); c(4.5, 3.4, 0.3, '#E8E1C8', 8.7, VY + 1.7, -2.15);
    // edificios del fondo (la otra cuadra) y los cables de la luz
    [[-6.5, 4.2, 6.5, '#CDB9A4'], [-2.2, 3.6, 8.5, '#B9C3BD'], [2.4, 4.4, 6.0, '#D8C3A8'], [7.0, 4.0, 9.0, '#C3B6B0']].forEach(([x, w, h, col]) => {
      c(w, h, 3, col, x, h / 2, -7.5);
      for (let f = 1; f < h / 1.3; f++) for (let j = 0; j < 3; j++) c(0.55, 0.65, 0.05, '#9DB4C2', x - w / 3 + j * w / 3, f * 1.3, -5.98, false);
    });
    c(0.18, 5.2, 0.18, '#7E7468', -4.2, 2.6, -0.45); c(0.18, 5.2, 0.18, '#7E7468', 6.6, 2.6, -0.45);
    [4.7, 4.95].forEach((y, i) => { const cab = c(10.8, 0.025, 0.025, '#1E2224', 1.2, y - 0.12 * i, -0.45, false); cab.rotation.z = 0.004; });
    // macetas en la vereda de la vecina
    [[4.15, -1.75], [4.45, -1.78]].forEach(([x, z], i) => {
      const m = new T.Mesh(new T.CylinderGeometry(0.17, 0.13, 0.32, 8), k.mat('#B5583A')); m.position.set(x, VY + 0.16, z); m.castShadow = true; k.escena.add(m);
      const h = new T.Mesh(new T.IcosahedronGeometry(0.24 - i * 0.04, 0), k.mat(i ? '#4C8B55' : '#3F7A4A')); h.position.set(x, VY + 0.5, z); h.castShadow = true; k.escena.add(h);
    });
    // árbol en la vereda, a la izquierda
    c(0.26, 1.9, 0.26, '#6B4A2F', -2.6, VY + 0.95, -0.75);
    const copa = new T.Mesh(new T.IcosahedronGeometry(1.1, 0), k.mat('#3F7A4A')); copa.position.set(-2.6, VY + 2.5, -0.75); copa.castShadow = true; k.escena.add(copa);
    const copa2 = new T.Mesh(new T.IcosahedronGeometry(0.75, 0), k.mat('#4C8B55')); copa2.position.set(-2.1, VY + 3.0, -1.0); copa2.castShadow = true; k.escena.add(copa2);
    // el cartel de la esquina
    c(0.07, 2.6, 0.07, '#2A2E2C', ESQUINA + 0.55, VY + 1.3, -0.5);
    c(0.9, 0.24, 0.04, '#1E5D49', ESQUINA + 0.55, VY + 2.5, -0.5); c(0.8, 0.04, 0.045, '#F4F2EC', ESQUINA + 0.55, VY + 2.5, -0.5, false);
  }

  function armarSilla() {
    const g = new k.THREE.Group(), b = '#F4F2EC';
    k.caja(0.5, 0.05, 0.46, b, 0, 0.45, 0, g); k.caja(0.5, 0.5, 0.05, b, 0, 0.72, -0.22, g);
    [[-0.22, 0.2], [0.22, 0.2], [-0.22, -0.2], [0.22, -0.2]].forEach(([x, z]) => k.caja(0.05, 0.45, 0.05, b, x, 0.22, z, g));
    g.position.set(SILLA.x, VY, SILLA.z); g.rotation.y = -0.45; k.escena.add(g); return g;
  }
  function armarMate() {
    const T = k.THREE, g = new T.Group();
    const m = new T.Mesh(new T.IcosahedronGeometry(0.075, 1), k.mat('#7A5A3A')); m.scale.set(1, 1.15, 1); g.add(m);
    k.caja(0.1, 0.02, 0.1, '#C9A227', 0, 0.075, 0, g, false);
    const bo = k.caja(0.014, 0.2, 0.014, '#D9DCDD', 0.02, 0.15, 0, g, false); bo.rotation.z = -0.25;
    return g;
  }
  function armarLlaves() {
    const T = k.THREE, g = new T.Group();
    const aro = new T.Mesh(new T.TorusGeometry(0.05, 0.012, 5, 12), k.mat('#C9A227')); g.add(aro);
    k.caja(0.035, 0.16, 0.012, '#C9A227', 0.02, -0.11, 0, g, false); k.caja(0.035, 0.03, 0.012, '#C9A227', 0.045, -0.17, 0, g, false);
    k.caja(0.03, 0.12, 0.012, '#B9BEC2', -0.03, -0.09, 0.01, g, false);
    k.escena.add(g); return g;
  }
  // la nube gris que llueve solo arriba tuyo
  function armarNube() {
    const T = k.THREE, g = new T.Group();
    [[0, 0, 0, 0.42], [0.38, -0.05, 0.05, 0.32], [-0.36, -0.06, 0.0, 0.3], [0.12, 0.2, -0.05, 0.3]].forEach(([x, y, z, r]) => {
      const m = new T.Mesh(new T.IcosahedronGeometry(r, 0), k.mat('#8A9194')); m.position.set(x, y, z); m.castShadow = true; g.add(m);
    });
    g.position.set(CORDON.x, 2.75, CORDON.z + 0.05); k.escena.add(g); return g;
  }

  function camara(t) {
    const cam = k.camara, V = (x, y, z) => new k.THREE.Vector3(x, y, z);
    let pos, mira;
    const z1 = (a, b, x0, x1) => k.lerp(a, b, k.suave((t - x0) / Math.max(0.3, x1 - x0)));
    if (t < P.f2) {                               // 1. afuera de tu casa; la vecina mira
      const z = z1(1.0, 0.9, 0, P.f2);
      mira = V(1.0, 1.7, -1.3); pos = mira.clone().add(V(0.5 * z, 1.2 * z, 13.5 * z));
    } else if (t < P.f3) {                        // 2. la bici hasta la esquina
      const u = k.suave((t - P.f2 - 0.3) / Math.max(0.5, P.pincha - P.f2 - 0.3));
      mira = V(k.lerp(0.7, 3.5, u), 1.65, -0.8); pos = mira.clone().add(V(-1.2, 1.1, 12.8));
    } else if (t < P.f4) {                        // 3. el monopatín, desde la izquierda y más bajo
      const z = z1(1, 0.92, P.f3, P.f4);
      mira = V(0.8, 1.6, -0.9); pos = mira.clone().add(V(-3.4 * z, 0.6 * z, 11.8 * z));
    } else if (t < P.f5) {                        // 4. el cordón y la nube, de frente
      const z = z1(1, 0.88, P.f4, P.f5);
      mira = V(1.1, 1.75, -0.8); pos = mira.clone().add(V(0.3 * z, 1.4 * z, 11.4 * z));
    } else if (t < P.f6) {                        // 5. la moto con las llaves, desde la derecha
      const z = z1(1, 0.94, P.f5, P.f6);
      mira = V(-0.05, 1.6, -0.25); pos = mira.clone().add(V(3.2 * z, 1.3 * z, 11.6 * z));
    } else if (t < P.rem) {                       // 6. entrás a tu casa
      const z = z1(1, 0.93, P.f6, P.rem);
      mira = V(0.5, 1.7, -1.4); pos = mira.clone().add(V(1.2 * z, 1.2 * z, 11.2 * z));
    } else {                                      // 7. remate: la vecina y su puerta, más cerca
      const g = k.suave((t - P.rem) / 0.8);
      mira = V(k.lerp(1.5, 3.1, g), k.lerp(1.7, 1.65, g), -1.5);
      pos = mira.clone().add(V(k.lerp(1.2, -0.5, g), k.lerp(1.2, 0.7, g), k.lerp(11.2, 8.6, g)));
    }
    cam.position.copy(pos); cam.lookAt(mira); cam.updateProjectionMatrix(); cam.updateMatrixWorld();
  }

  const mirar = (p, x, z) => Math.atan2(x - p.x, z - p.z);   // giro en y para mirar hacia (x, z)
  function ubicar(p, x, z, rot, y = VY) { p.position.set(x, y, z); p.rotation.set(0, rot, 0); }
  // palmearse los bolsillos (no están las llaves)
  function bolsillos(p, t) {
    const u = p.userData, s = Math.abs(Math.sin(t * 9)) * 0.18;
    u.brazoI.rotation.set(-0.15 - s, 0, 0.32); u.brazoD.rotation.set(-0.15 - s, 0, -0.32); u.cuello.rotation.x = 0.35;
  }
  // sentado: cadera abajo y piernas hacia adelante
  function sentar(p, y, ang) { const u = p.userData; u.cadera.position.y = y; u.piernaI.rotation.x = u.piernaD.rotation.x = ang; }

  return {
    get duracion() { return P.cierre + 2.8; },
    get cierre() { return P.cierre; },
    get efectos() {
      const r = x => +x.toFixed(2);
      return [
        { efecto: 'tic', t: r(0.35), db: -15 }, { efecto: 'tic', t: r(0.6), db: -16 }, { efecto: 'tic', t: r(0.85), db: -16 },
        { efecto: 'latigazo', t: r(P.f2 - 0.2), db: -19 },
        { efecto: 'pinchazo', t: r(P.pincha), db: -13 },
        { efecto: 'crujido', t: r(P.pincha + 0.25), db: -17 },
        { efecto: 'latigazo', t: r(P.f3 - 0.2), db: -19 },
        { efecto: 'apagado', t: r(P.para - 0.05), db: -13 },
        { efecto: 'pop', t: r(P.para + 0.25), db: -17 },
        { efecto: 'latigazo', t: r(P.f4 - 0.2), db: -19 },
        { efecto: 'lluvia', t: r(P.llueve - 0.15), db: -15 },
        { efecto: 'latigazo', t: r(P.f5 - 0.2), db: -19 },
        { efecto: 'frenada', t: r(P.moto + 0.05), db: -18 },
        { efecto: 'bocina', t: r(P.moto + 0.45), db: -14 },
        { efecto: 'pop', t: r(P.precio - 0.15), db: -16 },
        { efecto: 'campanita', t: r(P.precio + 0.05), db: -18 },
        { efecto: 'sello', t: r(P.precio + 0.3), db: -18 },
        { efecto: 'latigazo', t: r(P.f6 - 0.2), db: -19 },
        { efecto: 'tic', t: r(P.f6 + 0.55), db: -15 },
        { efecto: 'acierto', t: r(P.f6 + 0.8), db: -17 },
        { efecto: 'latigazo', t: r(P.rem - 0.2), db: -19 },
        { efecto: 'golpe', t: r(P.portazo), db: -11 },
        { efecto: 'tic', t: r(P.portazo + 0.55), db: -15 }, { efecto: 'tic', t: r(P.portazo + 0.75), db: -16 },
        { efecto: 'golpe', t: r(P.cierre + 0.1), db: -14 },
      ];
    },
    armar(kit) {
      k = kit; tiempos();
      const T = k.THREE;
      k.sol.position.set(-7, 11, 9); k.sol.color.set('#FFE2B8');            // sol de la tarde, desde la izquierda
      k.escena.background = new T.Color('#F1D6B8'); k.escena.fog.color.set('#F1D6B8');
      cuadra();
      silla = armarSilla();
      bici = k.bici({ color: '#2B7E62' });
      mono = k.monopatin();
      moto = k.moto({ color: '#C8473A' });
      // vos (buzo mostaza)
      yo = k.personaje({ ropa: '#D9A23A', pantalon: '#34405A', pelo: '#3A2A1E', piel: '#D9A27E', zapatillas: '#F2F2EE' });
      manoYo = new T.Group(); manoYo.position.set(0, -0.68, 0.04); yo.userData.brazoD.add(manoYo);
      // la vecina (la testigo): pelo canoso, batón lila, pantuflas, con el mate
      vecina = k.personaje({ ropa: '#9B6FB0', pantalon: '#7A5890', pelo: '#D8D8D4', piel: '#E8BE9A', zapatillas: '#8C5A2E' });
      mate = armarMate(); vecina.userData.brazoD.add(mate); mate.position.set(0, -0.72, 0.08);
      anteojos = new T.Group(); vecina.userData.cuello.add(anteojos);
      k.caja(0.14, 0.09, 0.03, k.C.tinta, -0.1, 0.27, 0.24, anteojos, false); k.caja(0.14, 0.09, 0.03, k.C.tinta, 0.1, 0.27, 0.24, anteojos, false);
      k.caja(0.08, 0.025, 0.03, k.C.tinta, 0, 0.29, 0.24, anteojos, false);
      // el cadete de la moto, con casco
      cadete = k.personaje({ ropa: '#2E3F66', pantalon: '#2A2E2C', zapatillas: '#2A2E2C', piel: '#C9956E', pelo: '#2B1D16' });
      casco = new T.Group(); cadete.userData.cuello.add(casco);
      const bocha = new T.Mesh(new T.IcosahedronGeometry(0.33, 1), k.mat('#F4F2EC')); bocha.position.set(0, 0.32, -0.02); bocha.scale.set(1, 0.95, 1.02); bocha.castShadow = true; casco.add(bocha);
      k.caja(0.42, 0.17, 0.06, '#26302F', 0, 0.28, 0.28, casco, false); k.caja(0.5, 0.05, 0.5, '#C8473A', 0, 0.12, -0.02, casco, false);
      manoCad = new T.Group(); manoCad.position.set(0, -0.7, 0.04); cadete.userData.brazoD.add(manoCad);
      llaves = armarLlaves();
      nube = armarNube();
      gotas = k.lluvia({ zona: { x0: CORDON.x - 0.45, x1: CORDON.x + 0.4, z0: CORDON.z - 0.25, z1: CORDON.z + 0.35 }, alto: 2.5, cantidad: 110, gota: 0.28, semilla: 12 });
      for (let i = 0; i < 12; i++) {
        const h = k.caja(0.1, 0.02, 0.06, i % 2 ? '#4C8B55' : '#7FB24C', 0, -5, 0, k.escena, false); hojas.push(h);
      }
      url = k.etiquetaUrl();
      etqRueda = k.etiqueta('Aire en la rueda: 0 %');
      etqBat = k.etiqueta('Batería: 1 %');
      etqLluvia = k.etiqueta('Pronóstico: 0 % de lluvia');
      etqVecina = k.etiqueta('Llaves de la vecina: adentro');
      card = k.tarjeta(`<div class="sello">Precio<br>de<br>referencia</div>
        <div class="t-et">MANDADO O ENVÍO EN MOTO (HASTA 8 KM)</div>
        <div class="t-precio">$16.000<span>a</span>$27.000</div>
        <div class="t-nota">Noviembre 2026 · AMBA · por trabajo</div>`);
      chip = k.tarjeta(`<div class="ok">✓</div><div><div class="c1">Pedido publicado gratis</div><div class="c2">Mandados y mensajería · tu zona</div></div>`, 'chip3d');
      fin = k.cierre('Pedí presupuestos', 'de gente de tu zona');
    },
    animar(t) {
      const U = yo.userData, UV = vecina.userData, UC = cadete.userData, UB = bici.userData;
      const V3 = k.THREE.Vector3;

      // ---- tu puerta: tironeás y no abre; al final la abrís ----
      puertaYo.rotation.y = t < 1.0 ? 0.012 * Math.sin(t * 40) * (t > 0.3 ? 1 : 0)
        : t > P.f6 + 0.5 ? 1.15 * k.suave((t - P.f6 - 0.5) / 0.45) : 0;
      // la puerta de la vecina: abierta hasta que la ráfaga la cierra de un golpe
      const pz = k.clamp((t - (P.portazo - 0.14)) / 0.14), tb = t - P.portazo;
      puertaVec.rotation.y = t < P.portazo ? k.lerp(1.15, 0, pz * pz) : 0.04 * Math.sin(tb * 30) * Math.exp(-tb * 7);

      // ---- la bici ----
      UB.gomaD.scale.set(1, 1, 1); bici.rotation.set(0, 0, 0);
      const salida = P.f2 + 0.45, para = P.pincha + 0.2;
      if (t < salida) { bici.position.set(-1.05, VY, -0.55); }
      else if (t < P.f3 + 0.2) {
        const u = k.clamp((t - salida) / Math.max(0.5, P.pincha - salida)), x = k.lerp(-1.05, ESQUINA, u * (2 - u) * 0.15 + u * 0.85);
        const fr = t > P.pincha ? k.suave((t - P.pincha) / 0.2) : 0;
        bici.position.set(t < P.pincha ? x : ESQUINA + 0.35 * fr, VY, -0.55);
        UB.ruedaD.rotation.z = UB.ruedaT.rotation.z = -(Math.min(t, para) - salida) * 11;
        if (t > P.pincha) {
          UB.gomaD.scale.set(1, k.lerp(1, 0.5, k.suave((t - P.pincha) / 0.25)), 1);
          bici.rotation.z = -0.08 * fr + 0.05 * Math.sin((t - P.pincha) * 22) * Math.exp(-(t - P.pincha) * 5);
        }
      } else if (t < P.f4) {                                 // queda tirada en la esquina
        bici.position.set(ESQUINA + 0.35, VY + 0.27, -0.75); bici.rotation.set(-1.45, 0.25, 0);
        UB.gomaD.scale.set(1, 0.5, 1);
      } else bici.position.set(0, -9, 0);           // ya no está

      // ---- el monopatín ----
      const UM = mono.userData, arranca = P.f3 + 0.35, X0 = -0.95, X1 = X0 + 2.0;
      UM.luz.material = k.mat(t > P.para - 0.05 ? '#E0443A' : '#5BD46A');
      if (t < P.f3) mono.position.set(-1.9, VY, -1.7), mono.rotation.set(0, 0.2, 0);
      else {
        const u = k.clamp((t - arranca) / Math.max(0.4, P.para - arranca));
        mono.position.set(k.lerp(X0, X1, u), VY, -0.85); mono.rotation.set(0, 0, 0);
        UM.ruedas.forEach(r => { r.rotation.y = 0; });
      }

      // ---- la moto ----
      const llega = P.moto + 0.35, sale = P.f6 + 1.0;
      moto.visible = t >= P.f5 - 0.2 && t < P.rem + 1.0;
      let mx = MOTO_F.x;
      if (t < llega) { const u = k.clamp((t - (P.f5 - 0.2)) / (llega - P.f5 + 0.2)); mx = k.lerp(-8.5, MOTO_F.x, 1 - Math.pow(1 - u, 3)); }
      else if (t > sale) mx = MOTO_F.x + Math.pow(t - sale, 2) * 3.2;
      moto.position.set(mx, 0, MOTO_F.z); moto.rotation.set(0, 0, t > llega && t < llega + 0.35 ? 0.05 * Math.sin((t - llega) * 18) : 0);
      moto.userData.ruedas.forEach(r => { r.rotation.z = -mx * 3.3; });

      // ---- el cadete, arriba de la moto ----
      cadete.visible = moto.visible;
      ubicar(cadete, mx + moto.userData.asiento.x, MOTO_F.z, Math.PI / 2, 0);
      k.pose(cadete, {});
      UC.cadera.position.y = moto.userData.asiento.y + 0.06;
      UC.piernaI.rotation.x = UC.piernaD.rotation.x = -1.05;
      UC.brazoI.rotation.set(-0.95, 0, 0.1); UC.brazoD.rotation.set(-0.95, 0, -0.1);
      const da = k.suave((t - llega - 0.15) / 0.35) * (1 - k.suave((t - (P.precio + 0.2)) / 0.3));
      if (da > 0) { UC.brazoD.rotation.set(k.lerp(-0.95, -0.2, da), 0, k.lerp(-0.1, -1.35, da)); UC.cuello.rotation.y = -0.7 * da; }
      if (t > P.f6 + 0.2) { UC.brazoD.rotation.set(0, 0, -2.6 + Math.sin(t * 12) * 0.35); UC.cuello.rotation.y = -0.5; }   // saluda al irse

      // ---- vos ----
      yo.visible = true;
      U.cadera.position.set(0, 0.92, 0); U.cadera.rotation.set(0, 0, 0);
      if (t < P.f2) {                                         // tironeás la puerta; no tenés las llaves
        if (t < 1.0) { ubicar(yo, YO_PUERTA.x, YO_PUERTA.z, Math.PI); k.pose(yo, { empujar: true }); U.brazoD.rotation.x = -1.2 + 0.1 * Math.sin(t * 40); }
        else {
          const g = k.suave((t - 1.0) / 0.35);
          ubicar(yo, YO_PUERTA.x, YO_PUERTA.z + 0.15 * g, k.lerp(Math.PI, 0.25, g));
          if (t < P.f2 - 1.0) { k.pose(yo, {}); bolsillos(yo, t); }
          else k.pose(yo, { manosCabeza: t });
        }
      } else if (t < P.f3) {                                  // la bici
        if (t < salida) {
          const s = k.suave((t - P.f2) / 0.4);
          ubicar(yo, k.lerp(YO_PUERTA.x, -1.2, s), k.lerp(YO_PUERTA.z + 0.15, -0.6, s), Math.PI / 2);
          k.pose(yo, { caminar: 1, paso: t * 2 });
        } else if (t < para) {                                // pedaleando
          const p = bici.position;
          ubicar(yo, p.x + UB.asiento.x, p.z, Math.PI / 2, p.y);
          k.pose(yo, {});
          U.cadera.position.y = UB.asiento.y + 0.04; U.cadera.rotation.x = 0.2;
          const s = Math.sin((t - salida) * 9);
          U.piernaI.rotation.x = -0.75 + 0.45 * s; U.piernaD.rotation.x = -0.75 - 0.45 * s;
          U.brazoI.rotation.set(-0.85, 0, 0.12); U.brazoD.rotation.set(-0.85, 0, -0.12);
          if (t > P.pincha) { const f = k.suave((t - P.pincha) / 0.18); U.cadera.rotation.x = 0.2 + 0.4 * f; U.brazoI.rotation.x = U.brazoD.rotation.x = -0.85 - 0.9 * f; }
        } else {                                              // te bajás y te agarrás la cabeza
          const s = k.suave((t - para) / 0.3);
          ubicar(yo, ESQUINA + 0.2, k.lerp(-0.55, -1.1, s), k.lerp(Math.PI / 2, 0.4, s));
          k.pose(yo, { manosCabeza: t });
        }
      } else if (t < P.f4) {                                  // el monopatín
        if (t < arranca) {
          const s = k.suave((t - P.f3) / 0.35);
          ubicar(yo, k.lerp(-1.7, X0 - 0.1, s), k.lerp(-1.5, -0.85, s), Math.PI / 2);
          k.pose(yo, { caminar: 1, paso: t * 2 });
        } else {
          const p = mono.position, frena = k.clamp((t - P.para) / 0.25), rebota = t > P.para ? Math.exp(-(t - P.para) * 4) : 0;
          ubicar(yo, p.x - 0.12, p.z, Math.PI / 2, p.y + 0.18);
          k.pose(yo, {});
          U.brazoI.rotation.set(-0.6, 0, 0.12); U.brazoD.rotation.set(-0.6, 0, -0.12);
          U.piernaD.rotation.x = -0.12; U.piernaI.rotation.x = 0.12;
          if (t > P.para) {
            U.cadera.rotation.x = 0.55 * Math.sin(Math.min(1, frena) * Math.PI) * 0.9 + 0.1 * rebota;   // te vas para adelante
            if (t > P.para + 0.6) {                           // empujás con el pie: nada
              const e = Math.sin((t - P.para - 0.6) * 10);
              U.piernaI.rotation.x = 0.1 + 0.45 * Math.max(0, e); U.cadera.rotation.x = 0.05;
              U.cuello.rotation.x = 0.35;
            }
          }
        }
      } else if (t < P.f5 + 0.0) {                            // sentado en el cordón; te llueve encima
        ubicar(yo, CORDON.x, CORDON.z, 0);
        k.pose(yo, {});
        sentar(yo, 0.24, -1.32);
        const mira = k.suave((t - P.espera - 0.2) / 0.3);
        U.brazoI.rotation.set(-1.25, 0, 0.35); U.brazoD.rotation.set(-1.25, 0, -0.35);
        U.cuello.rotation.x = k.lerp(0.25, -0.55, mira);
        if (t > P.llueve + 0.4) { U.brazoI.rotation.set(-0.3, 0, 2.6); U.brazoD.rotation.set(-0.3, 0, -2.6); U.cuello.rotation.x = 0.2; }   // te tapás
      } else if (t < P.f6) {                                  // llega la moto: te parás y agarrás las llaves
        const s = k.suave((t - llega + 0.1) / 0.45);
        const px = k.lerp(CORDON.x, MOTO_F.x + 0.05, s * 0.6), pz = k.lerp(CORDON.z, -0.28, s);
        ubicar(yo, px, pz, k.lerp(0, mirar({ x: px, z: pz }, mx - 0.1, MOTO_F.z), s));
        if (t < llega - 0.1) { k.pose(yo, {}); sentar(yo, 0.24, -1.32); U.brazoI.rotation.set(-0.3, 0, 2.6); U.brazoD.rotation.set(-0.3, 0, -2.6); U.cuello.rotation.x = -0.3; }
        else {
          k.pose(yo, {});
          const r = k.suave((t - (P.precio - 0.6)) / 0.35);
          U.brazoD.rotation.set(-1.3 * r, 0, -0.1);
          if (t > P.precio + 0.2) k.pose(yo, { festejo: t });
        }
      } else {                                                // entrás a tu casa con las llaves
        const s = k.suave((t - P.f6) / 0.45), x0 = k.lerp(CORDON.x, MOTO_F.x + 0.05, 0.6);
        const entra = k.clamp((t - P.f6 - 1.65) / 0.5);
        ubicar(yo, k.lerp(x0, PUERTA.x, s), k.lerp(-0.28, -1.5, s) - 1.1 * entra, Math.PI);
        if (s < 1) k.pose(yo, { caminar: 1, paso: t * 2 });
        else if (t < P.f6 + 0.95) { k.pose(yo, {}); U.brazoD.rotation.set(-1.3, 0, -0.1); }
        else if (t < P.f6 + 1.65) { const g = k.suave((t - P.f6 - 0.95) / 0.25); yo.rotation.y = k.lerp(Math.PI, 0.2, g); k.pose(yo, { festejo: t }); }
        else k.pose(yo, { caminar: 1, paso: t * 2 });
        yo.visible = entra < 0.85;                            // ya adentro
      }

      // ---- la vecina (la testigo) ----
      vecina.rotation.set(0, 0, 0); anteojos.visible = t > P.llueve + 0.2 && t < P.rem + 0.4;
      const sorbo = (a, b) => t > a && t < b ? k.suave((t - a) / 0.25) * (1 - k.suave((t - b + 0.25) / 0.25)) : 0;
      if (t < P.rem) {
        ubicar(vecina, SILLA.x, SILLA.z + 0.03, -0.45);
        k.pose(vecina, {});
        sentar(vecina, 0.5, -1.0);
        let mateArriba = Math.max(sorbo(0.2, 1.3), sorbo(P.f4 + 0.3, P.f4 + 1.4), sorbo(P.llueve + 0.6, P.f5 - 0.2));
        UV.brazoD.rotation.set(k.lerp(-0.9, -2.15, mateArriba), 0, k.lerp(-0.15, -0.5, mateArriba)); UV.brazoI.rotation.set(-0.35, 0, 0.12);
        // a quién mira: a vos, a la bici, al monopatín…
        let objetivo = yo.position;
        if (t >= P.f2 && t < P.f3) objetivo = bici.position;
        if (t >= P.f5 && t < P.f6) objetivo = moto.position;
        const giro = k.clamp(mirar(vecina.position, objetivo.x, objetivo.z) - vecina.rotation.y, -1.2, 1.2);
        UV.cuello.rotation.y = giro;
        if (t > P.pincha + 0.15 && t < P.f3) {                // se ríe
          const r = Math.sin((t - P.pincha) * 26) * 0.08;
          UV.cuello.rotation.x = -0.35 + r; UV.cadera.rotation.x = -0.12 + r * 0.5; UV.brazoI.rotation.set(-1.1, 0, 0.5);
        }
        if (t > P.para + 0.3 && t < P.f4) k.pose(vecina, { aplaudir: (t - P.para) * 0.45, cabezaY: giro }), sentar(vecina, 0.5, -1.0);   // aplauso lento
        if (t > P.llueve + 0.2 && t < P.f5) UV.cuello.rotation.x = -0.25;   // al sol, con los anteojos
      } else {                                                // remate: se levanta, va a entrar… y la puerta se le cierra
        const sube = k.suave((t - P.rem) / 0.35), u = k.clamp((t - P.rem - 0.35) / Math.max(0.4, P.portazo - P.rem - 0.25));
        const px = k.lerp(SILLA.x + 0.1, PUERTA_V.x - 0.05, u), pz = k.lerp(SILLA.z + 0.25, PUERTA_V.z + 0.6, u);
        ubicar(vecina, px, pz, u >= 1 ? Math.PI : u > 0 ? mirar({ x: SILLA.x, z: SILLA.z }, PUERTA_V.x, PUERTA_V.z) : k.lerp(-0.45, 0.6, sube));
        if (t < P.rem + 0.35) { k.pose(vecina, {}); sentar(vecina, k.lerp(0.5, 0.92, sube), k.lerp(-1.0, 0, sube)); }
        else if (u < 1) k.pose(vecina, { caminar: 0.8, paso: t * 1.8 });
        else if (t < P.portazo + 0.45) { k.pose(vecina, { cabezaX: -0.1 }); UV.cadera.position.z = -0.06 * Math.exp(-(t - P.portazo) * 5); }   // ¡pum!
        else if (t < P.portazo + 1.0) { k.pose(vecina, { empujar: true }); UV.brazoD.rotation.x = -1.15 + 0.1 * Math.sin(t * 40); }
        else if (t < P.portazo + 1.7) { vecina.rotation.y = 0.15; k.pose(vecina, {}); bolsillos(vecina, t); }
        else { vecina.rotation.y = 0.25; k.pose(vecina, { manosCabeza: t }); }
      }
      silla.rotation.y = -0.45;

      // ---- las llaves: en la mano del cadete, después en la tuya ----
      llaves.visible = t > llega - 0.2 && t < P.rem + 0.6;
      cadete.updateMatrixWorld(true); yo.updateMatrixWorld(true);
      const pc = new V3(), py = new V3(); manoCad.getWorldPosition(pc); manoYo.getWorldPosition(py);
      const pasa = k.suave((t - (P.precio - 0.3)) / 0.3);
      llaves.position.set(k.lerp(pc.x, py.x, pasa), k.lerp(pc.y, py.y, pasa) + 0.08 * Math.sin(Math.PI * pasa), k.lerp(pc.z, py.z, pasa));
      llaves.rotation.set(0, 0, Math.sin(t * 6) * 0.25);

      // ---- la nube y la lluvia (solo arriba tuyo) ----
      const nb = k.rebote((t - P.espera) / 0.4) * (1 - k.suave((t - llega) / 0.4));
      nube.visible = t > P.espera && t < llega + 0.4;
      nube.scale.setScalar(Math.max(0.001, nb)); nube.position.x = CORDON.x + 0.05 * Math.sin(t * 2);
      gotas.animar(t, t > P.llueve - 0.1 && t < llega ? 0.95 : 0);

      // ---- la ráfaga de hojas que cierra la puerta ----
      hojas.forEach((h, i) => {
        const e = t - (P.portazo - 0.6) - i * 0.04;
        if (e < 0 || e > 1.3) { h.position.set(0, -5, 0); return; }
        h.position.set(k.lerp(1.2, 5.0, e / 1.3) + (i % 3) * 0.25, VY + 0.25 + (i % 4) * 0.33 + 0.15 * Math.sin(e * 9 + i), -1.6 + (i % 5) * 0.18);
        h.rotation.set(e * 9 + i, e * 7, e * 5);
      });

      camara(t);

      // ---- carteles y textos ----
      const r0 = new V3(); UB.ruedaD.getWorldPosition(r0);
      etqRueda.animar(t, P.pincha + 0.2, P.f3 + 0.05, { x: r0.x, y: r0.y, z: r0.z }, -90, -300);
      etqBat.animar(t, P.para + 0.15, P.f4 + 0.05, { x: mono.position.x + 0.31, y: 0.95 + VY, z: mono.position.z }, 60, -300);
      etqLluvia.animar(t, P.llueve + 0.1, P.f5 + 0.05, { x: nube.position.x + 0.3, y: nube.position.y + 0.2, z: nube.position.z }, 30, -170);
      etqVecina.animar(t, P.portazo + 1.0, P.cierre + 0.2, { x: PUERTA_V.x + 0.35, y: VY + 1.1, z: PUERTA_V.z + 0.05 }, -120, -330);
      k.mostrar(card, t, P.precio - 0.15, P.f6 - 0.05);
      k.mostrar(chip, t, P.f6 + 0.6, P.rem + 0.4);
      url.style.opacity = t < P.cierre ? 1 : 0;
      fin.animar(t, P.cierre);
    },
  };
})();
