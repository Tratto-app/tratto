/* Escena del video 3D de cerrajería (comun-3d.js). Cada red tiene su HTML
   (video-3d-cerrajeria-tt/ig/fb.html) que solo define window.RED.
   El baño de tu casa, de día, visto como una casa de muñecas (sin la pared de
   adelante): la puerta a la derecha, el inodoro abajo de la ventanita, el
   lavatorio con el espejo y el gato (testigo de adentro) sentado al lado de la
   pileta. Afuera, el patio, la medianera y el vecino (testigo de afuera).
   Historia en escalera, graciosa: te encerrás y la manija te queda en la mano;
   pasás una tarjeta por la puerta y se dobla; probás con una hebilla y se
   queda adentro de la cerradura; salís por la ventanita y quedás trabado por
   la mitad (afuera, el vecino te saca fotos con flash). Con el precio llega la
   persona de cerrajería y abre la puerta en un segundo; vos te caés para
   adentro. Remate (cámara en el vecino): se le cierra la puerta de su casa con
   él afuera. */
window.ESCENA3D = (function () {
  let k, yo, gato, vecino, cerr, valija, puerta, manija, manijaSuelta, tarjeta, tarjA, tarjB, hebilla, puertaVec, flash, flashLuz, cel;
  let etqTarjeta, etqHebilla, etqVentana, etqVecino, card, chip, fin, url;
  const P = {};
  const FONDO = { z: -1.7 }, IZQ = { x: -1.8 }, DER = { x: 1.3 }, ALTO = 2.7;
  const PUERTA = { x0: 0.13, ancho: 0.84, alto: 2.05 };          // en la pared del fondo; bisagra en x0, se abre hacia adentro
  const VENT = { z: -0.9, y: 1.5, ancho: 0.74, alto: 0.54 };      // en la pared izquierda, da al patio
  const INODORO = { x: -1.45, z: VENT.z };
  const PILETA = { x: -0.7, z: -1.45 };
  const GATO = { x: -0.15, y: 0.86, z: -1.45 };                   // sobre la mesada de la pileta
  const MEDIANERA = { x: -3.4, alto: 1.3 };
  const VECINO = { x: -3.75, z: VENT.z };
  const CASA_VEC = { x: -5.35 };
  const PICAPORTE = { x: PUERTA.x0 + PUERTA.ancho - 0.12, y: 1.0, z: FONDO.z + 0.12 };

  function tiempos() {
    P.f2 = k.frase(2, 3.6);
    P.f3 = k.frase(3, 7.0);
    P.f4 = k.frase(4, 10.6);
    P.f5 = k.frase(5, 14.0);
    P.f6 = k.frase(6, 20.6);
    P.manija = k.palabra('manija', 1, 2.2);
    P.dobla = k.palabra('dobla', 1, P.f2 + 2.0);
    P.hebilla = k.palabra('hebilla', 1, P.f3 + 1.0);
    P.rompe = k.palabra('adentro', 1, P.f3 + 2.1);
    P.ventana = k.palabra('ventanita', 1, P.f4 + 0.8);
    P.trabado = k.palabra('trabado', 1, P.f4 + 1.9);
    P.camina = Math.min(P.f4 - 0.2, P.rompe + 0.9);   // dejás la puerta y vas al inodoro
    P.afuera = P.ventana + 0.35;                      // la cámara sale al patio
    P.llega = Math.min(P.f5 + 0.2, k.palabra('romperla', 1, P.f5 + 1.8) - 1.4);
    P.abre = k.palabra('romperla', 1, P.f5 + 1.8) + 0.2;
    P.cae = P.abre + 0.35;                            // te caés para adentro
    P.precio = k.palabra('cuarenta', 1, P.f5 + 3.3);
    P.fin = k.finVoz(24.5);
    P.rem = P.f6 + 1.5;                               // remate: el vecino
    P.portazo = P.rem + 0.9;
    P.cierre = Math.max(P.fin + 0.35, P.portazo + 2.4);
  }

  function bano() {
    const T = k.THREE, c = (w, h, d, col, x, y, z, s = true) => k.caja(w, h, d, col, x, y, z, k.escena, s);
    const piso = new T.Mesh(new T.PlaneGeometry(40, 40), k.mat('#9DBF7A'));      // pasto alrededor
    piso.rotation.x = -Math.PI / 2; piso.position.y = -0.02; piso.receiveShadow = true; k.escena.add(piso);
    for (let i = 0; i < 9; i++) for (let j = 0; j < 9; j++) c(0.36, 0.02, 0.32, (i + j) % 2 ? '#F2EEE6' : '#2F5D73', -1.62 + i * 0.36, 0.0, -1.44 + j * 0.32, false);
    const pared = '#EAF2F1';
    // pared del fondo con el hueco de la puerta (atrás, el pasillo)
    const xa = IZQ.x - 0.1, xb = DER.x + 0.1, pa = PUERTA.x0, pb = PUERTA.x0 + PUERTA.ancho;
    c(pa - xa, ALTO, 0.2, pared, (xa + pa) / 2, ALTO / 2, FONDO.z);
    c(xb - pb, ALTO, 0.2, pared, (pb + xb) / 2, ALTO / 2, FONDO.z);
    c(PUERTA.ancho, ALTO - PUERTA.alto, 0.2, pared, (pa + pb) / 2, (PUERTA.alto + ALTO) / 2, FONDO.z);
    c(0.06, PUERTA.alto, 0.24, '#F4F2EC', pa - 0.03, PUERTA.alto / 2, FONDO.z); c(0.06, PUERTA.alto, 0.24, '#F4F2EC', pb + 0.03, PUERTA.alto / 2, FONDO.z);
    c(3.6, 0.02, 1.1, '#C9B79A', 0.4, 0.0, -2.35, false);                         // el pasillo de madera
    c(3.6, ALTO, 0.2, '#F1E2B8', 0.4, ALTO / 2, -2.95);                            // la pared del pasillo
    c(0.5, 0.65, 0.03, '#3F7A4A', 0.55, 1.55, -2.84, false); c(0.56, 0.71, 0.02, '#C9A227', 0.55, 1.55, -2.845, false);   // un cuadrito
    // azulejos del fondo hasta 1,2 m (menos donde está la puerta)
    for (let i = 0; i < 16; i++) for (let j = 0; j < 6; j++) {
      const x = xa + 0.2 + i * 0.2; if (x > pa - 0.12 && x < pb + 0.12) continue;
      c(0.19, 0.19, 0.02, (i + j) % 2 ? '#CFE6E2' : '#B7D8D2', x, 0.12 + j * 0.2, FONDO.z + 0.11, false);
    }
    // pared izquierda con el hueco de la ventanita
    const za = -1.8, zb = 1.1, va = VENT.z - VENT.ancho / 2, vb = VENT.z + VENT.ancho / 2, vy0 = VENT.y - VENT.alto / 2, vy1 = VENT.y + VENT.alto / 2;
    c(0.2, ALTO, va - za, pared, IZQ.x, ALTO / 2, (za + va) / 2);
    c(0.2, ALTO, zb - vb, pared, IZQ.x, ALTO / 2, (vb + zb) / 2);
    c(0.2, vy0, VENT.ancho, pared, IZQ.x, vy0 / 2, VENT.z);
    c(0.2, ALTO - vy1, VENT.ancho, pared, IZQ.x, (vy1 + ALTO) / 2, VENT.z);
    c(0.24, 0.05, VENT.ancho + 0.08, '#F4F2EC', IZQ.x, vy0 - 0.02, VENT.z); c(0.24, 0.05, VENT.ancho + 0.08, '#F4F2EC', IZQ.x, vy1 + 0.02, VENT.z);
    for (let i = 0; i < 13; i++) for (let j = 0; j < 6; j++) {
      const z = za + 0.12 + i * 0.2; if (j > 4 && z > va - 0.1 && z < vb + 0.1) continue;
      c(0.02, 0.19, 0.19, (i + j) % 2 ? '#CFE6E2' : '#B7D8D2', IZQ.x + 0.11, 0.12 + j * 0.2, z, false);
    }
    // el toallero con la toalla verde, a la derecha de la puerta
    c(0.5, 0.03, 0.03, '#AEB4B8', 1.15, 1.35, FONDO.z + 0.14, false); c(0.42, 0.55, 0.04, '#2B7E62', 1.15, 1.1, FONDO.z + 0.15, false);
    // el inodoro (abajo de la ventanita, mirando al centro del baño)
    c(0.55, 0.42, 0.42, '#FCFBF8', INODORO.x + 0.05, 0.21, INODORO.z); c(0.5, 0.05, 0.46, '#F2EEE6', INODORO.x + 0.07, 0.45, INODORO.z);
    c(0.2, 0.38, 0.48, '#FCFBF8', INODORO.x - 0.24, 0.62, INODORO.z);
    // la pileta con mesada y el espejo
    c(1.0, 0.08, 0.5, '#E7E1D3', PILETA.x + 0.2, 0.82, PILETA.z); c(0.95, 0.78, 0.46, '#D8CFBC', PILETA.x + 0.2, 0.39, PILETA.z);
    c(0.42, 0.05, 0.32, '#FCFBF8', PILETA.x, 0.87, PILETA.z + 0.02, false); c(0.04, 0.18, 0.04, '#AEB4B8', PILETA.x, 0.96, PILETA.z - 0.16, false);
    c(0.6, 0.7, 0.03, '#BFE3F0', PILETA.x, 1.6, FONDO.z + 0.12, false); c(0.66, 0.76, 0.02, '#C9A227', PILETA.x, 1.6, FONDO.z + 0.11, false);
    const luz = new T.PointLight('#FFF2D6', 2.2, 7, 1.4); luz.position.set(-0.2, 2.4, -0.6); k.escena.add(luz);

    // ---- afuera (a la izquierda): el patio, la medianera y la casa del vecino ----
    for (let i = 0; i < 3; i++) for (let j = 0; j < 10; j++) c(0.5, 0.02, 0.5, (i + j) % 2 ? '#B9AF9C' : '#A89E8A', -2.15 - i * 0.5, 0.01, -2.1 + j * 0.5, false);
    c(0.2, MEDIANERA.alto, 4.4, '#D7C3A0', MEDIANERA.x, MEDIANERA.alto / 2, -1.0); c(0.26, 0.06, 4.4, '#B5653A', MEDIANERA.x, MEDIANERA.alto + 0.03, -1.0);
    const m = new T.Mesh(new T.CylinderGeometry(0.2, 0.15, 0.32, 12), k.mat('#B5653A')); m.position.set(-2.6, 0.16, 0.4); m.castShadow = true; k.escena.add(m);
    c(0.4, 0.5, 0.4, '#3F7A4A', -2.6, 0.55, 0.4);
    // la casa del vecino: pared, ventana, alerito y la puerta (bisagra del lado del fondo)
    c(0.2, 2.9, 5.2, '#F2CF9B', CASA_VEC.x, 1.45, -0.6); c(0.05, 0.7, 0.9, '#A9D3E6', CASA_VEC.x + 0.11, 1.6, 0.8, false);
    c(0.4, 0.06, 1.0, '#B5653A', CASA_VEC.x + 0.2, 2.25, VECINO.z);
    c(0.02, 2.08, 0.92, '#3B2A20', CASA_VEC.x + 0.105, 1.04, VECINO.z, false);
    puertaVec = new T.Group(); puertaVec.position.set(CASA_VEC.x + 0.12, 0, VECINO.z - 0.43); k.escena.add(puertaVec);
    k.caja(0.05, 2.02, 0.86, '#2B7E62', 0, 1.01, 0.43, puertaVec); k.caja(0.08, 0.06, 0.06, k.C.laton, 0.05, 1.0, 0.76, puertaVec, false);
  }

  function armarPuerta() {
    const T = k.THREE;
    puerta = new T.Group(); puerta.position.set(PUERTA.x0, 0, FONDO.z + 0.02); k.escena.add(puerta);
    k.caja(PUERTA.ancho - 0.02, PUERTA.alto - 0.03, 0.05, '#F4F2EC', PUERTA.ancho / 2, (PUERTA.alto - 0.03) / 2, 0, puerta);
    k.caja(0.5, 0.5, 0.06, '#E7E1D3', PUERTA.ancho / 2, 1.5, 0.01, puerta, false);
    k.caja(0.06, 0.12, 0.06, '#8E9490', PUERTA.ancho - 0.12, 1.0, 0.035, puerta, false);       // la cerradura
    k.caja(0.04, 0.04, 0.06, '#1E2224', PUERTA.ancho - 0.12, 0.98, 0.05, puerta, false);      // el ojo de la llave
    manija = new T.Group(); manija.position.set(PUERTA.ancho - 0.12, 1.08, 0.06); puerta.add(manija);
    k.caja(0.04, 0.04, 0.04, k.C.laton, 0, 0, 0, manija, false); k.caja(0.16, 0.035, 0.04, k.C.laton, -0.07, 0, 0.03, manija, false);
    manijaSuelta = new T.Group();
    k.caja(0.04, 0.04, 0.04, k.C.laton, 0, 0, 0, manijaSuelta, false); k.caja(0.16, 0.035, 0.04, k.C.laton, 0.07, 0, 0, manijaSuelta, false);
    tarjeta = new T.Group();
    tarjA = new T.Group(); tarjeta.add(tarjA); k.caja(0.09, 0.006, 0.11, '#3D6E9E', 0, 0, 0.055, tarjA, false); k.caja(0.06, 0.007, 0.02, '#C9A227', 0, 0, 0.03, tarjA, false);
    tarjB = new T.Group(); tarjB.position.z = 0.11; tarjeta.add(tarjB); k.caja(0.09, 0.006, 0.06, '#3D6E9E', 0, 0, 0.03, tarjB, false);
    hebilla = new T.Group();
    k.caja(0.012, 0.012, 0.16, '#2A2E2C', 0, 0, 0.08, hebilla, false);
  }

  function camara(t) {
    const cam = k.camara, V = (x, y, z) => new k.THREE.Vector3(x, y, z);
    let pos, mira;
    const z1 = (a, b, x0, x1) => k.lerp(a, b, k.suave((t - x0) / Math.max(0.3, x1 - x0)));
    if (t < P.f2) {                               // 1. el baño de frente: la puerta, la manija en la mano y el gato
      const z = z1(1.0, 0.92, 0, P.f2);
      mira = V(0.15, 1.35, -1.0); pos = mira.clone().add(V(-0.4 * z, 0.8 * z, 8.2 * z));
    } else if (t < P.f3) {                        // 2. la tarjeta, cerca de la puerta, desde la derecha
      const z = z1(1, 0.92, P.f2, P.f3);
      mira = V(0.85, 1.45, -1.35); pos = mira.clone().add(V(-1.1 * z, 0.1 * z, 5.2 * z));
    } else if (t < P.camina) {                    // 3. la hebilla, de cerca
      const z = z1(1, 0.93, P.f3, P.f4);
      mira = V(0.95, 1.4, -1.35); pos = mira.clone().add(V(-0.6 * z, 0.15 * z, 4.8 * z));
    } else if (t < P.afuera) {                    // 4a. al inodoro y a la ventanita
      const z = z1(1, 0.95, P.camina, P.afuera);
      mira = V(-0.8, 1.3, -0.85); pos = mira.clone().add(V(0.8 * z, 0.8 * z, 7.6 * z));
    } else if (t < P.f5) {                        // 4b. desde afuera: el torso en el patio, las piernas adentro y el vecino
      const z = z1(1, 0.93, P.afuera, P.f5);
      mira = V(-3.0, 1.4, -0.85); pos = mira.clone().add(V(0.5 * z, 0.5 * z, 8.8 * z));
    } else if (t < P.f6) {                        // 5. adentro, abierto: llega la persona de cerrajería y abre
      const z = z1(1, 0.95, P.f5, P.f6);
      mira = V(-0.1, 1.3, -1.0); pos = mira.clone().add(V(0.3 * z, 0.8 * z, 8.4 * z));
    } else if (t < P.rem) {                       // 6. desde la derecha
      const z = z1(1, 0.94, P.f6, P.rem);
      mira = V(0.0, 1.3, -0.9); pos = mira.clone().add(V(1.1 * z, 0.8 * z, 7.8 * z));
    } else {                                      // 7. remate: el vecino, afuera de su casa
      const g = k.suave((t - P.rem) / 0.6);
      mira = V(k.lerp(0.0, -4.45, g), k.lerp(1.3, 1.35, g), k.lerp(-0.9, VECINO.z, g));
      pos = mira.clone().add(V(k.lerp(1.1, 2.6, g), k.lerp(0.8, 0.6, g), k.lerp(7.8, 5.6, g)));
    }
    cam.position.copy(pos); cam.lookAt(mira); cam.updateProjectionMatrix(); cam.updateMatrixWorld();
  }

  const mirar = (p, x, z) => Math.atan2(x - p.x, z - p.z);
  function ubicar(p, x, z, rot, y = 0) { p.position.set(x, y, z); p.rotation.set(0, rot, 0); }
  function ruta(t, t0, t1, pts) {
    const largos = pts.slice(1).map((b, i) => Math.hypot(b.x - pts[i].x, b.z - pts[i].z)), total = largos.reduce((a, b) => a + b, 0);
    const u = k.suave((t - t0) / Math.max(0.2, t1 - t0));
    let d = u * total, i = 0;
    while (i < largos.length - 1 && d > largos[i]) { d -= largos[i]; i++; }
    const A = pts[i], B = pts[i + 1], f = largos[i] ? Math.min(1, d / largos[i]) : 1;
    return { x: k.lerp(A.x, B.x, f), z: k.lerp(A.z, B.z, f), andando: t > t0 && t < t1, rumbo: Math.atan2(B.x - A.x, B.z - A.z), paso: u * total / 0.95, u };
  }

  return {
    get duracion() { return P.cierre + 2.8; },
    get cierre() { return P.cierre; },
    get efectos() {
      const r = x => +x.toFixed(2);
      return [
        { efecto: 'tic', t: r(0.6), db: -18 }, { efecto: 'tic', t: r(1.3), db: -18 },
        { efecto: 'crujido', t: r(P.manija - 0.1), db: -13 },
        { efecto: 'latigazo', t: r(P.f2 - 0.2), db: -19 },
        { efecto: 'crujido', t: r(P.dobla - 0.05), db: -15 },
        { efecto: 'apagado', t: r(P.dobla + 0.05), db: -17 },
        { efecto: 'latigazo', t: r(P.f3 - 0.2), db: -19 },
        { efecto: 'tic', t: r(P.hebilla + 0.2), db: -15 }, { efecto: 'tic', t: r(P.hebilla + 0.45), db: -15 }, { efecto: 'tic', t: r(P.hebilla + 0.7), db: -15 },
        { efecto: 'chapa', t: r(P.rompe - 0.05), db: -16 },
        { efecto: 'maullido', t: r(P.rompe + 0.4), db: -17 },
        { efecto: 'latigazo', t: r(P.f4 - 0.2), db: -19 },
        { efecto: 'golpe', t: r(P.trabado), db: -16 },
        { efecto: 'obturador', t: r(P.trabado + 0.35), db: -13 }, { efecto: 'obturador', t: r(P.trabado + 0.85), db: -13 },
        { efecto: 'latigazo', t: r(P.f5 - 0.2), db: -19 },
        { efecto: 'sello', t: r(P.abre - 0.1), db: -15 },
        { efecto: 'golpe', t: r(P.cae + 0.3), db: -13 },
        { efecto: 'pop', t: r(P.precio - 0.15), db: -16 },
        { efecto: 'campanita', t: r(P.precio + 0.05), db: -18 },
        { efecto: 'latigazo', t: r(P.f6 - 0.2), db: -19 },
        { efecto: 'acierto', t: r(P.f6 + 0.4), db: -17 },
        { efecto: 'latigazo', t: r(P.rem - 0.2), db: -19 },
        { efecto: 'golpe', t: r(P.portazo), db: -11 },
        { efecto: 'crujido', t: r(P.portazo + 0.8), db: -15 }, { efecto: 'crujido', t: r(P.portazo + 1.2), db: -15 },
        { efecto: 'golpe', t: r(P.cierre + 0.1), db: -14 },
      ];
    },
    armar(kit) {
      k = kit; tiempos();
      const T = k.THREE;
      k.sol.position.set(6, 12, 8); k.sol.color.set('#FFF6E4');
      k.escena.background = new T.Color('#BFDDF0'); k.escena.fog.color.set('#BFDDF0');
      bano(); armarPuerta();
      // vos (buzo naranja)
      yo = k.personaje({ ropa: '#E07A2E', pantalon: '#34405A', pelo: '#3A2A1E', piel: '#E2B48F', zapatillas: '#F2F2EE' });
      yo.userData.brazoD.add(manijaSuelta); yo.userData.brazoD.add(tarjeta); yo.userData.brazoD.add(hebilla);
      // el gato (testigo de adentro)
      gato = k.gato({ color: '#F2A65A', oscuro: '#C9733A' }); gato.scale.setScalar(0.55);
      // el vecino (testigo de afuera): musculosa, celular en la mano
      vecino = k.personaje({ ropa: '#3D6E9E', pantalon: '#6B6F73', pelo: '#8E9490', piel: '#D9A27E', zapatillas: '#2A2E2C' });
      cel = new T.Group(); vecino.userData.brazoD.add(cel); cel.position.set(0, -0.7, 0.1);
      k.caja(0.09, 0.17, 0.02, '#1E2224', 0, 0, 0, cel, false);
      flash = k.caja(0.03, 0.03, 0.01, '#FFFFFF', 0.025, 0.06, -0.012, cel, false);
      flashLuz = new T.PointLight('#FFFFFF', 0, 4, 1.5); k.escena.add(flashLuz);
      // la persona de cerrajería: campera verde, gorra de latón y la valija
      cerr = k.personaje({ ropa: '#2B7E62', pantalon: '#2E3F66', zapatillas: '#2A2E2C', piel: '#C9956E', pelo: '#2B1D16', gorra: k.C.laton });
      valija = k.herramientas();
      url = k.etiquetaUrl();
      etqTarjeta = k.etiqueta('Tarjeta: doblada en 3');
      etqHebilla = k.etiqueta('Hebilla: 0 % salió');
      etqVentana = k.etiqueta('Ventana: 40 cm · Vos: 55 cm');
      etqVecino = k.etiqueta('Vecino: afuera');
      card = k.tarjeta(`<div class="sello">Precio<br>de<br>referencia</div>
        <div class="t-et">ABRIR UNA PUERTA SIN ROMPERLA</div>
        <div class="t-precio">$40.000<span>a</span>$69.000</div>
        <div class="t-nota">Noviembre 2026 · AMBA · por trabajo</div>`);
      chip = k.tarjeta(`<div class="ok">✓</div><div><div class="c1">Pedido publicado gratis</div><div class="c2">Cerrajería · tu zona</div></div>`, 'chip3d');
      fin = k.cierre('Pedí presupuestos', 'de gente de tu zona');
    },
    animar(t) {
      const U = yo.userData, UG = gato.userData, UV = vecino.userData, UC = cerr.userData, V3 = k.THREE.Vector3;

      // ---- la puerta del baño: cerrada hasta que la abre la persona de cerrajería (hacia adentro) ----
      puerta.rotation.y = -1.4 * k.suave(k.clamp((t - P.abre) / 0.45));
      manija.visible = t < P.manija;
      manijaSuelta.visible = t >= P.manija && t < P.f2 - 0.1;
      manijaSuelta.position.set(0, -0.72, 0.08); manijaSuelta.rotation.set(0, 0, 0);

      // ---- vos ----
      U.cadera.position.set(0, 0.92, 0); U.cadera.rotation.set(0, 0, 0); yo.visible = true;
      const enPuerta = { x: PICAPORTE.x + 0.42, z: FONDO.z + 0.5 };
      const alPicaporte = mirar(enPuerta, PICAPORTE.x, PICAPORTE.z);
      tarjeta.visible = t >= P.f2 - 0.1 && t < P.f3 - 0.1; hebilla.visible = t >= P.f3 - 0.1 && t < P.camina;
      if (t < P.f2) {                                       // tirás de la manija… y te queda en la mano; te das vuelta con ella
        if (t < P.manija) {
          ubicar(yo, enPuerta.x, enPuerta.z, alPicaporte);
          k.pose(yo, { cabezaX: 0.1 }); U.brazoD.rotation.set(-1.35 - 0.12 * Math.abs(Math.sin(t * 9)), 0, -0.1); U.cadera.rotation.x = -0.15 * Math.abs(Math.sin(t * 9));
        } else {
          const g = k.suave((t - P.manija) / 0.45);
          ubicar(yo, enPuerta.x, enPuerta.z + 0.12 * Math.sin(Math.PI * Math.min(1, g * 1.5)), k.lerp(alPicaporte, 0.35, g));
          k.pose(yo, { cabezaX: 0.3 * g }); U.brazoD.rotation.set(-1.25, 0, 0.15); U.brazoI.rotation.set(-0.3, 0, 0.5 * g);
        }
      } else if (t < P.f3) {                                // la tarjeta por la rendija
        ubicar(yo, enPuerta.x, enPuerta.z, alPicaporte);
        if (t < P.dobla) { k.pose(yo, { cabezaX: 0.3 }); U.cadera.rotation.x = 0.3; U.brazoD.rotation.set(-1.25 + 0.06 * Math.sin(t * 14), 0, -0.05); }
        else { k.pose(yo, { cabezaX: 0.2 }); U.brazoD.rotation.set(-1.4, 0, 0.1); U.brazoI.rotation.set(-0.4, 0, 0.9); yo.rotation.y = k.lerp(alPicaporte, 0.5, k.suave((t - P.dobla) / 0.4)); }
      } else if (t < P.camina) {                            // la hebilla en la cerradura
        ubicar(yo, enPuerta.x, enPuerta.z, alPicaporte);
        if (t < P.rompe) { k.pose(yo, { cabezaX: 0.35 }); U.cadera.rotation.x = 0.35; U.brazoD.rotation.set(-1.2, 0, -0.08 + 0.12 * Math.sin(t * 24)); }
        else { yo.rotation.y = k.lerp(alPicaporte, 0.2, k.suave((t - P.rompe) / 0.4)); k.pose(yo, { manosCabeza: t }); }
      } else if (t < P.abre + 0.35) {                       // al inodoro y por la ventanita
        const A = enPuerta, B = { x: INODORO.x + 0.12, z: INODORO.z };
        if (t < P.ventana - 0.1) {
          const m = ruta(t, P.camina, P.ventana - 0.45, [A, { x: -0.6, z: -0.6 }, B]);
          ubicar(yo, m.x, m.z, m.andando ? m.rumbo : -Math.PI / 2, 0.42 * k.clamp((t - (P.ventana - 0.55)) / 0.3));
          k.pose(yo, m.andando ? { caminar: 1, paso: m.paso } : {});
        } else {
          const e = k.suave((t - P.ventana + 0.1) / 0.55);            // el cuerpo se va acostando hacia la ventanita
          ubicar(yo, k.lerp(B.x, IZQ.x, e), INODORO.z, -Math.PI / 2, k.lerp(0.42, VENT.y - 0.92, e));
          k.pose(yo, {});
          U.cadera.rotation.x = 1.45 * e;
          U.brazoI.rotation.set(-2.6 - 0.3 * Math.sin(t * 9), 0, -0.25); U.brazoD.rotation.set(-2.6 + 0.3 * Math.sin(t * 9 + 1), 0, 0.25);
          const pat = t > P.trabado ? Math.sin(t * 15) * 0.5 : 0;     // trabado: patalea
          U.piernaI.rotation.x = 0.1 + pat; U.piernaD.rotation.x = 0.1 - pat;
          if (t > P.trabado) U.cuello.rotation.set(-0.3, 0.3 * Math.sin(t * 5), 0);
        }
      } else {                                              // te caés para adentro; después festejás
        const g = k.clamp((t - P.abre - 0.35) / 0.35), sitio = { x: -0.85, z: -0.45 };
        if (t < P.cae + 0.5) {
          ubicar(yo, k.lerp(IZQ.x, sitio.x, g), k.lerp(INODORO.z, sitio.z, g), k.lerp(-Math.PI / 2, 0.3, g), Math.max(0, (VENT.y - 0.92) * (1 - g * g)));
          k.pose(yo, { manosCabeza: t }); U.cadera.rotation.x = 1.45 * (1 - g);
        } else if (t < P.f6) {
          ubicar(yo, sitio.x, sitio.z, 0.35);
          k.pose(yo, { cabezaZ: 0.2 }); U.cadera.position.y = 0.45; U.piernaI.rotation.x = U.piernaD.rotation.x = -1.45;   // sentado en el piso
          U.brazoI.rotation.set(-0.3, 0, 0.5); U.brazoD.rotation.set(-0.3, 0, -0.5);
        } else {
          ubicar(yo, sitio.x + 0.1, sitio.z, 0.4);
          k.pose(yo, t < P.rem ? { festejo: t } : { saludo: t });
        }
      }
      // la tarjeta: en la mano; se dobla
      tarjeta.position.set(0, -0.75, 0.04); tarjeta.rotation.set(0, 0, 0);
      tarjB.rotation.x = t >= P.dobla ? -2.6 * k.rebote((t - P.dobla) / 0.3) : 0;
      tarjA.rotation.x = t >= P.dobla ? 0.5 * k.clamp((t - P.dobla) / 0.3) : 0;
      // la hebilla: se parte y queda la punta adentro
      hebilla.position.set(0, -0.76, 0.06); hebilla.rotation.set(0, 0, 0);
      hebilla.scale.z = t >= P.rompe ? 0.45 : 1;

      // ---- el gato (testigo de adentro), sobre la mesada ----
      UG.cuello.rotation.set(0, 0, 0);
      ubicar(gato, GATO.x, GATO.z, mirar(GATO, yo.position.x, yo.position.z), GATO.y);
      k.posePerro(gato, { sentado: true, cola: t > P.manija ? t * 0.6 : 0, cabezaX: t > P.ventana ? -0.45 : -0.1 });
      if (t >= P.dobla + 0.1 && t < P.f3) UG.cuello.rotation.z = 0.4;                          // ladea la cabeza
      if (t >= P.rompe + 0.2 && t < P.camina) gato.rotation.y += Math.PI * 0.85;                   // te da la espalda, aburrido
      if (t >= P.trabado && t < P.abre) UG.cuello.rotation.y = 0.35 * Math.sin(t * 15);       // sigue las patadas con la cabeza

      // ---- el vecino (testigo de afuera) ----
      UV.cadera.position.set(0, 0.92, 0); UV.cadera.rotation.set(0, 0, 0);
      flashLuz.intensity = 0; flash.material.color.set('#9EA3A6');
      if (t < P.rem) {
        ubicar(vecino, VECINO.x, VECINO.z, Math.PI / 2);
        if (t < P.trabado) k.pose(vecino, { brazosCruzados: true });
        else {
          k.pose(vecino, {}); UV.brazoD.rotation.set(-1.7, 0, -0.1); UV.brazoI.rotation.set(-0.3 + 0.2 * Math.sin(t * 26), 0, 0.4);
          UV.cadera.rotation.x = -0.12 + 0.06 * Math.sin(t * 26);                          // se ríe
          if ([P.trabado + 0.35, P.trabado + 0.85].some(x => t >= x && t < x + 0.12)) { flashLuz.intensity = 9; flash.material.color.set('#FFFFFF'); }
        }
      } else {                                              // remate: retrocede mirando el celular y se le cierra la puerta
        const g = k.suave((t - P.rem) / 0.8), xx = k.lerp(VECINO.x, CASA_VEC.x + 0.62, g);
        if (t < P.portazo + 0.2) {
          ubicar(vecino, xx, VECINO.z, Math.PI / 2);
          k.pose(vecino, g < 1 ? { caminar: 0.6, paso: t * 1.5 } : {});
          UV.brazoD.rotation.set(-1.5, 0, -0.1); UV.cuello.rotation.x = 0.35; UV.cadera.rotation.x = -0.08 + 0.05 * Math.sin(t * 26);
        } else {                                            // se da vuelta y prueba el picaporte
          const gg = k.suave((t - P.portazo - 0.2) / 0.35);
          ubicar(vecino, CASA_VEC.x + 0.62, VECINO.z, k.lerp(Math.PI / 2, -Math.PI / 2, gg));
          if (gg < 1) k.pose(vecino, { manosCabeza: t });
          else if (t < P.portazo + 1.6) { k.pose(vecino, { empujar: true }); UV.cadera.rotation.x = 0.1 * Math.sin(t * 18); }
          else { vecino.rotation.y = Math.PI / 2 - 0.3; k.pose(vecino, { manosCabeza: t }); }
        }
      }
      vecino.updateMatrixWorld(true); { const pf = new V3(); flash.getWorldPosition(pf); flashLuz.position.copy(pf); }
      // la puerta del vecino: abierta para adentro, y se cierra de un portazo
      puertaVec.rotation.y = t < P.portazo - 0.15 ? -1.3 : -1.3 * (1 - k.clamp((t - P.portazo + 0.15) / 0.15));

      // ---- la persona de cerrajería: llega por el pasillo y abre ----
      cerr.visible = valija.visible = t >= P.llega - 0.1;
      {
        const afuera = { x: PUERTA.x0 + PUERTA.ancho / 2, z: FONDO.z - 0.55 }, adentro = { x: 0.35, z: -0.95 };
        let pose = {};
        if (t < P.abre) {
          const m = ruta(t, P.llega, P.abre - 0.45, [{ x: 2.3, z: -2.3 }, afuera]);
          ubicar(cerr, m.x, m.z, m.andando ? m.rumbo : 0);
          pose = m.andando ? { caminar: 1, paso: m.paso } : { llave: t };
        } else {
          const m = ruta(t, P.abre + 0.3, P.abre + 1.0, [afuera, adentro]);
          ubicar(cerr, m.x, m.z, m.andando ? m.rumbo : mirar(adentro, yo.position.x, yo.position.z));
          pose = m.andando ? { caminar: 1, paso: m.paso } : t >= P.f6 ? { saludo: t } : {};
        }
        k.pose(cerr, pose);
        valija.position.set(cerr.position.x + 0.35, 0, cerr.position.z + 0.25); valija.rotation.y = 0.4;
      }

      camara(t);

      // ---- carteles y textos ----
      yo.updateMatrixWorld(true);
      const pt = new V3(); tarjeta.getWorldPosition(pt);
      etqTarjeta.animar(t, P.dobla + 0.3, P.f3 + 0.05, { x: PICAPORTE.x, y: PICAPORTE.y - 0.1, z: PICAPORTE.z }, -10, -330);
      etqHebilla.animar(t, P.rompe + 0.3, P.camina + 0.05, { x: PICAPORTE.x, y: PICAPORTE.y, z: PICAPORTE.z }, 60, -380);
      etqVentana.animar(t, P.trabado + 0.2, P.f5 + 0.05, { x: IZQ.x - 0.1, y: VENT.y + 0.3, z: VENT.z }, -60, -360);
      etqVecino.animar(t, P.portazo + 0.5, P.cierre + 0.2, { x: vecino.position.x, y: 1.95, z: vecino.position.z }, 40, -170);
      k.mostrar(card, t, P.precio - 0.15, P.f6 - 0.05);
      k.mostrar(chip, t, P.f6 + 0.45, P.rem + 0.4);
      url.style.opacity = t < P.cierre ? 1 : 0;
      fin.animar(t, P.cierre);
    },
  };
})();
