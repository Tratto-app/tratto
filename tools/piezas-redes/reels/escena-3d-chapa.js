/* Escena del video 3D de chapa y pintura (comun-3d.js). Cada red tiene su HTML
   (video-3d-chapa-tt/ig/fb.html) que solo define window.RED.
   El estacionamiento del súper: el auto celeste, el poste amarillo, la fila de
   carritos y el perro del estacionamiento (el testigo). Historia en escalera,
   graciosa: le das al poste y te queda un bollo en la puerta; le pegás una
   calcomanía de carita feliz y el bollo la deja triste; lo tapás con una maceta
   y el perro se come la planta; probás con un imán gigante y se te pegan todos
   los carritos del súper (el perro sale corriendo). Con el precio llega el
   chapista y pinta la puerta. Remate (cámara en el perro): la puerta queda
   nueva… y un último carrito viene solo, despacito, y le hace otro bollo; el
   perro se tapa los ojos. */
window.ESCENA3D = (function () {
  let k, auto, puerta, poste, yo, perro, chap, pistola, bollo, bollo2, calco, boca, lagrima, maceta, hojas, iman, brillo, niebla;
  let carros = [], almohadillas = [], etqCarita, etqHojas, etqCarros, etqBollos, card, chip, fin, url;
  const P = {};
  const DENT = { x: 0.1, y: 0.63, z: 0.88 };                 // el bollo, en el mundo (puerta cerrada)
  const POSTE = { x: 0.98, z: 1.04 };
  const PERRO1 = { x: -1.25, z: 1.9 }, PERRO_PLANTA = { x: -0.52, z: 1.42 }, PERRO_F5 = { x: -1.05, z: 2.5 };
  const YO1 = { x: -0.5, z: 1.42 };
  const CORRAL = { x: 3.35, z: 2.7, paso: 0.26 };
  // dónde quedan pegados los 7 carritos (x, y, z, giro en y, inclinación)
  const PEGADOS = [
    [0.12, 0.0, 1.31, 0, 0], [-0.52, 0.0, 1.34, 0.12, 0], [0.76, 0.0, 1.33, -0.1, 0],
    [0.16, 0.6, 1.38, 0.05, 0.14], [-0.25, 0.06, 2.16, 0.2, 0], [0.56, 0.08, 2.14, -0.18, 0], [0.18, 0.72, 2.22, 0.02, -0.2],
  ];

  function tiempos() {
    P.f2 = k.frase(2, 4.2);
    P.f3 = k.frase(3, 8.4);
    P.f4 = k.frase(4, 12.2);
    P.f5 = k.frase(5, 16.6);
    P.f6 = k.frase(6, 22.6);
    P.choque = 0.85;
    P.pegas = k.palabra('pegás', 1, P.f2 + 0.2);
    P.deja = k.palabra('deja', 1, P.f3 - 1.0);
    P.triste = k.palabra('triste', 1, P.f3 - 0.6);
    P.perro = k.palabra('perro', 1, P.f3 + 1.6);
    P.come = k.palabra('come', 1, P.perro + 0.4);
    P.iman = k.palabra('imán', 1, P.f4 + 1.0);
    P.pegan = k.palabra('pegan', 1, P.f4 + 2.0);
    P.llegada = i => P.pegan + 0.05 + i * 0.2;              // cuándo llega cada carrito
    P.precio = k.palabra('ciento', 1, P.f5 + 2.0);
    P.listo = P.f6 - 0.15;                                  // termina de pintar
    P.fin = k.finVoz(27.2);
    P.cierre = P.fin + 0.35;
    P.rem = Math.min(P.f6 + 1.5, P.cierre - 2.2);            // remate: el último carrito
    P.tic = P.rem + 1.2;                                    // le toca la puerta
  }

  function estacionamiento() {
    const T = k.THREE, c = (w, h, d, col, x, y, z, s = true) => k.caja(w, h, d, col, x, y, z, k.escena, s);
    const piso = new T.Mesh(new T.PlaneGeometry(90, 90), k.mat('#5E6264'));
    piso.rotation.x = -Math.PI / 2; piso.position.y = -0.02; piso.receiveShadow = true; k.escena.add(piso);
    // líneas de los lugares (atrás del auto) y una senda peatonal a la derecha
    for (let i = -3; i <= 3; i++) c(0.08, 0.01, 2.6, '#F2F2EE', i * 2.6 + 1.3, 0.0, -2.5, false);
    c(16, 0.01, 0.08, '#F2F2EE', 0, 0.0, -1.2, false);
    for (let i = 0; i < 6; i++) c(0.4, 0.01, 2.0, '#E8E6DE', 2.6 + i * 0.7, 0.0, 4.4, false);
    // la vereda y el súper al fondo
    c(26, 0.16, 1.6, '#C7C9C2', 0, 0.08, -4.6);
    c(26, 3.6, 0.3, '#E9E4D8', 0, 1.8, -5.5);
    for (let i = -4; i <= 4; i++) { c(2.2, 1.9, 0.05, '#A9C6D6', i * 2.8, 1.25, -5.33, false); c(0.12, 2.0, 0.08, '#C9C4B6', i * 2.8 + 1.4, 1.25, -5.31, false); }
    for (let i = 0; i < 18; i++) c(1.4, 0.12, 1.0, i % 2 ? '#F4F2EC' : '#C8473A', -12 + i * 1.4, 2.5, -4.95);   // el toldo a rayas
    c(6.4, 0.9, 0.2, k.C.verde, 0, 3.25, -5.3); c(5.6, 0.14, 0.05, k.C.laton, 0, 3.1, -5.18, false); c(3.6, 0.3, 0.05, '#F4F2EC', 0, 3.38, -5.18, false);
    // canteros con árboles
    [[-6.5, -3.4], [6.2, -3.4]].forEach(([x, z]) => {
      c(1.0, 0.3, 1.0, '#B9B2A5', x, 0.15, z); c(0.18, 1.2, 0.18, '#6B4A2F', x, 0.85, z);
      const copa = new T.Mesh(new T.IcosahedronGeometry(0.8, 0), k.mat('#3F7A4A')); copa.position.set(x, 1.95, z); copa.castShadow = true; k.escena.add(copa);
    });
    // el corral de los carritos (barandas de metal)
    c(2.6, 0.05, 0.05, '#7E868A', CORRAL.x + 0.95, 0.9, CORRAL.z - 0.38); c(2.6, 0.05, 0.05, '#7E868A', CORRAL.x + 0.95, 0.9, CORRAL.z + 0.38);
    [CORRAL.x - 0.4, CORRAL.x + 2.3].forEach(x => [-0.38, 0.38].forEach(dz => c(0.06, 0.9, 0.06, '#7E868A', x, 0.45, CORRAL.z + dz)));
    // otro auto estacionado atrás
    const otro = k.auto({ color: '#E3B23C' }); otro.position.set(-4.6, 0, -2.6); otro.rotation.y = Math.PI / 2;
  }

  // la calcomanía: carita amarilla con ojos y una boca de 5 puntos que pasa de sonrisa a tristeza
  function armarCalco() {
    const T = k.THREE, g = new T.Group();
    const disco = new T.Mesh(new T.CylinderGeometry(0.13, 0.13, 0.012, 16), k.mat('#F2CF3B')); disco.rotation.x = Math.PI / 2; g.add(disco);
    k.caja(0.03, 0.045, 0.01, k.C.tinta, -0.045, 0.035, 0.01, g, false); k.caja(0.03, 0.045, 0.01, k.C.tinta, 0.045, 0.035, 0.01, g, false);
    boca = [-2, -1, 0, 1, 2].map(i => k.caja(0.026, 0.02, 0.01, k.C.tinta, i * 0.026, -0.05, 0.01, g, false));
    lagrima = k.caja(0.02, 0.03, 0.012, '#7FC3E8', 0.045, 0.0, 0.012, g, false);
    g.position.set(-0.45, 0.63, 0.06); puerta.add(g); return g;
  }

  function armarMaceta() {
    const T = k.THREE, g = new T.Group();
    const m = new T.Mesh(new T.CylinderGeometry(0.2, 0.15, 0.36, 8), k.mat('#B5583A')); m.position.y = 0.18; m.castShadow = true; g.add(m);
    const borde = new T.Mesh(new T.CylinderGeometry(0.22, 0.22, 0.06, 8), k.mat('#A04B30')); borde.position.y = 0.36; g.add(borde);
    k.caja(0.03, 0.42, 0.03, '#3F7F4E', 0, 0.58, 0, g, false);
    hojas = [[-0.1, 0.5], [0.11, 0.56], [-0.06, 0.7], [0.08, 0.76], [-0.02, 0.88], [0.04, 0.98]].map(([x, y], i) => {
      const h = new T.Mesh(new T.IcosahedronGeometry(0.11 - i * 0.006, 0), k.mat(i % 2 ? '#4C8B55' : '#3F7A4A'));
      h.position.set(x, y, 0.02); h.scale.set(1.3, 0.8, 0.9); h.castShadow = true; g.add(h); return h;
    });
    g.position.set(DENT.x, 0, 1.22); k.escena.add(g); return g;
  }

  // imán de herradura gigante, rojo con las puntas plateadas (la U abierta hacia abajo)
  function armarIman() {
    const g = new k.THREE.Group();
    k.caja(0.52, 0.15, 0.13, '#C8473A', 0, 0.2, 0, g);
    k.caja(0.15, 0.36, 0.13, '#C8473A', -0.185, -0.03, 0, g); k.caja(0.15, 0.36, 0.13, '#C8473A', 0.185, -0.03, 0, g);
    k.caja(0.15, 0.1, 0.135, '#D9DCDD', -0.185, -0.26, 0, g); k.caja(0.15, 0.1, 0.135, '#D9DCDD', 0.185, -0.26, 0, g);
    k.escena.add(g); return g;
  }

  function armarBollo(sx, sy) {
    const T = k.THREE, g = new T.Group();
    const h = new T.Mesh(new T.IcosahedronGeometry(1, 0), k.mat('#3E6A92')); h.scale.set(sx, sy, 0.03); g.add(h);
    [[-0.3, 0.2, 0.5], [0.25, -0.1, -0.6], [0.05, 0.35, 0.1]].forEach(([x, y, r]) => {
      const l = k.caja(sx * 0.9, 0.012, 0.01, '#2C4E6E', x * sx, y * sy, 0.03, g, false); l.rotation.z = r;
    });
    puerta.add(g); return g;
  }

  // la pistola de pintar, en la mano derecha del chapista
  function armarPistola() {
    const T = k.THREE, g = new T.Group();
    k.caja(0.07, 0.16, 0.07, '#2A2E2C', 0, 0, 0, g, false);
    k.caja(0.09, 0.08, 0.22, '#B9BEC2', 0, -0.08, 0.08, g, false);
    const vaso = new T.Mesh(new T.CylinderGeometry(0.06, 0.05, 0.12, 8), k.mat('#D9DCDD')); vaso.position.set(0, 0.0, 0.12); g.add(vaso);
    const pico = new T.Group(); pico.position.set(0, -0.08, 0.22); g.add(pico); g.userData.pico = pico;
    return g;
  }

  function armarBrillo() {
    const g = new k.THREE.Group();
    [[-0.62, 0.78], [-0.25, 0.5], [-0.12, 0.86]].forEach(([x, y]) => {
      const s = new k.THREE.Group(); s.position.set(x, y, 0.08);
      k.caja(0.16, 0.025, 0.01, '#FCFBF8', 0, 0, 0, s, false); k.caja(0.025, 0.16, 0.01, '#FCFBF8', 0, 0, 0, s, false);
      g.add(s);
    });
    puerta.add(g); return g;
  }

  function camara(t) {
    const cam = k.camara, V = (x, y, z) => new k.THREE.Vector3(x, y, z);
    let pos, mira;
    const z1 = (a, b, x0, x1) => k.lerp(a, b, k.suave((t - x0) / Math.max(0.3, x1 - x0)));
    if (t < P.f2) {                               // 1. el auto entra y le da al poste
      const z = z1(1.05, 0.9, 0, P.f2), m = k.suave(t / 1.2);
      mira = V(k.lerp(-0.6, -0.1, m), 0.85, 1.0); pos = mira.clone().add(V(2.4 * z, 1.5 * z, 7.4 * z));
    } else if (t < P.f3) {                        // 2. la calcomanía (el perro mira)
      const z = z1(1, 0.9, P.f2, P.f3);
      mira = V(-0.15, 0.85, 1.25); pos = mira.clone().add(V(1.8 * z, 0.8 * z, 8.0 * z));
    } else if (t < P.f4) {                        // 3. la maceta y el perro, desde abajo
      const z = z1(1, 0.92, P.f3, P.f4);
      mira = V(-0.1, 0.62, 1.4); pos = mira.clone().add(V(0.5 * z, 0.8 * z, 5.8 * z));
    } else if (t < P.f5) {                        // 4. el imán y los carritos, desde arriba
      const z = z1(1, 0.95, P.f4, P.f5);
      mira = V(0.0, 0.75, 1.65); pos = mira.clone().add(V(1.6 * z, 3.2 * z, 8.4 * z));
    } else if (t < P.f6) {                        // 5. el precio: el chapista pinta la puerta
      const z = z1(1, 0.93, P.f5, P.f6);
      mira = V(0.35, 0.75, 1.25); pos = mira.clone().add(V(-0.6 * z, 1.0 * z, 7.6 * z));
    } else if (t < P.rem) {                       // 6. la puerta nueva
      const z = z1(1, 0.93, P.f6, P.rem);
      mira = V(0.05, 0.8, 1.35); pos = mira.clone().add(V(1.2 * z, 0.8 * z, 8.0 * z));
    } else {                                      // 7. remate: el último carrito; termina en el perro
      const g = k.suave((t - P.tic - 0.25) / 0.9);
      mira = V(k.lerp(0.5, -0.45, g), k.lerp(0.7, 0.5, g), k.lerp(1.6, 1.9, g));
      pos = mira.clone().add(V(k.lerp(-0.6, 0.5, g), k.lerp(1.1, 0.8, g), k.lerp(7.0, 5.6, g)));
    }
    cam.position.copy(pos); cam.lookAt(mira); cam.updateProjectionMatrix(); cam.updateMatrixWorld();
  }

  const mirar = (p, x, z) => Math.atan2(x - p.x, z - p.z);   // giro en y para mirar hacia (x, z)
  function ubicar(p, x, z, rot) { p.position.set(x, 0, z); p.rotation.set(0, rot, 0); }

  return {
    get duracion() { return P.cierre + 2.8; },
    get cierre() { return P.cierre; },
    get efectos() {
      const r = x => +x.toFixed(2);
      const carritos = PEGADOS.map((_, i) => ({ efecto: 'chapa', t: r(P.llegada(i)), db: -15 + (i % 3) }));
      const hojasE = [0, 2, 4].map(i => ({ efecto: 'tic', t: r(P.come + 0.15 + i * 0.18), db: -19 }));
      return [
        { efecto: 'frenada', t: r(0.2), db: -18 },
        { efecto: 'crujido', t: r(P.choque), db: -13 },
        { efecto: 'chapa', t: r(P.choque + 0.02), db: -16 },
        { efecto: 'latigazo', t: r(P.f2 - 0.2), db: -19 },
        { efecto: 'pop', t: r(P.pegas + 0.45), db: -15 },
        { efecto: 'tic', t: r(P.deja), db: -17 },
        { efecto: 'latigazo', t: r(P.f3 - 0.2), db: -19 },
        { efecto: 'pop', t: r(P.f3 + 0.25), db: -16 },
        ...hojasE,
        { efecto: 'latigazo', t: r(P.f4 - 0.2), db: -19 },
        { efecto: 'sello', t: r(P.iman + 0.3), db: -14 },
        ...carritos,
        { efecto: 'ladrido', t: r(P.llegada(0) + 0.15), db: -14 },
        { efecto: 'ladrido', t: r(P.llegada(0) + 0.45), db: -16 },
        { efecto: 'latigazo', t: r(P.f5 - 0.2), db: -19 },
        { efecto: 'pop', t: r(P.precio - 0.15), db: -16 },
        { efecto: 'campanita', t: r(P.precio + 0.05), db: -18 },
        { efecto: 'sello', t: r(P.precio + 0.3), db: -18 },
        { efecto: 'latigazo', t: r(P.f6 - 0.2), db: -19 },
        { efecto: 'acierto', t: r(P.f6 + 0.1), db: -17 },
        { efecto: 'latigazo', t: r(P.rem - 0.2), db: -19 },
        { efecto: 'chapa', t: r(P.tic), db: -12 },
        { efecto: 'golpe', t: r(P.tic + 0.4), db: -16 },
        { efecto: 'golpe', t: r(P.cierre + 0.1), db: -14 },
      ];
    },
    armar(kit) {
      k = kit; tiempos();
      const T = k.THREE;
      k.sol.position.set(6, 15, 9);
      k.escena.background = new T.Color('#BFD6E6'); k.escena.fog.color.set('#BFD6E6');
      estacionamiento();
      auto = k.auto({ color: '#5B8DB8' }); puerta = auto.userData.puerta;
      poste = k.poste(); poste.position.set(POSTE.x, 0, POSTE.z);
      bollo = armarBollo(0.22, 0.13); bollo.position.set(-0.45, 0.63, 0.052);
      bollo2 = armarBollo(0.13, 0.08); bollo2.position.set(-0.2, 0.5, 0.052);
      calco = armarCalco();
      maceta = armarMaceta();
      iman = armarIman();
      brillo = armarBrillo();
      for (let i = 0; i < 8; i++) carros.push(k.carrito());
      // vos (campera terracota)
      yo = k.personaje({ ropa: '#C8553D', pantalon: '#34405A', pelo: '#5A3A22', piel: '#D9A27E', zapatillas: '#F2F2EE' });
      // el perro del estacionamiento (el testigo), color crema
      perro = k.perro({ color: '#DCC6A2', oscuro: '#9C7A52' });
      almohadillas = [0, 1].map(i => k.caja(0.12, 0.1, 0.12, '#8A6440', 0, -0.26, 0, perro.userData.patas[i]));
      // el chapista (mameluco azul y gorra), con la pistola de pintar
      chap = k.personaje({ ropa: '#2E5E8C', pantalon: '#2E5E8C', zapatillas: '#2A2E2C', piel: '#C9956E', pelo: '#2B1D16', gorra: k.C.laton });
      pistola = armarPistola(); chap.userData.brazoD.add(pistola); pistola.position.set(0, -0.68, 0.06);
      niebla = k.humo(28, '#7FA9CF', 0.05);
      url = k.etiquetaUrl();
      etqCarita = k.etiqueta('Tristeza: 100 %');
      etqHojas = k.etiqueta('Hojas: 0');
      etqCarros = k.etiqueta('Carritos: 7');
      etqBollos = k.etiqueta('Bollos: 2');
      card = k.tarjeta(`<div class="sello">Precio<br>de<br>referencia</div>
        <div class="t-et">PINTURA DE UN PAÑO (PUERTA O GUARDABARROS)</div>
        <div class="t-precio">$173.000<span>a</span>$498.000</div>
        <div class="t-nota">Noviembre 2026 · AMBA · por trabajo</div>`);
      chip = k.tarjeta(`<div class="ok">✓</div><div><div class="c1">Pedido publicado gratis</div><div class="c2">Chapa y pintura · tu zona</div></div>`, 'chip3d');
      fin = k.cierre('Pedí presupuestos', 'de gente de tu zona');
    },
    animar(t) {
      const U = yo.userData, UP = perro.userData, UC = chap.userData;

      // ---- el auto: entra frenando y roza el poste ----
      const a = k.clamp(t / P.choque), roce = t >= P.choque - 0.05 && t < P.choque + 0.25;
      auto.position.set(k.lerp(-6.5, 0, 1 - Math.pow(1 - a, 3)), 0, roce ? 0.02 : 0);
      auto.userData.ruedas.forEach(r => { r.rotation.z = -k.lerp(0, 20, 1 - Math.pow(1 - a, 3)); });
      const tb = t - P.choque;
      poste.rotation.set(0, 0, tb > 0 ? 0.16 * Math.sin(tb * 18) * Math.exp(-tb * 3.5) : 0);
      // la puerta: se abre para que bajes y la cerrás
      const abre = k.suave((t - 1.25) / 0.35) * (1 - k.suave((t - 2.45) / 0.3));
      puerta.rotation.y = 1.0 * abre;
      // el bollo: aparece con el choque y se va mientras el chapista pinta
      const arreglo = k.suave((t - (P.f5 + 0.6)) / Math.max(0.6, P.listo - P.f5 - 1.0));
      bollo.visible = t >= P.choque && arreglo < 1;
      bollo.scale.setScalar(1 - arreglo);
      bollo2.visible = t >= P.tic;
      bollo2.scale.setScalar(k.rebote((t - P.tic) / 0.25));
      brillo.visible = t >= P.listo - 0.2 && t < P.tic;
      brillo.children.forEach((s, i) => { const b = 0.5 + 0.5 * Math.sin(t * 7 + i * 2); s.scale.setScalar(0.4 + 0.8 * b); s.rotation.z = t * 1.5 + i; });

      // ---- la calcomanía ----
      const pega = P.pegas + 0.45;
      calco.visible = t >= pega && t < P.f5;
      calco.scale.setScalar(k.rebote((t - pega) / 0.3));
      const tr = k.suave((t - P.deja) / 0.3);                 // de sonrisa a tristeza
      boca.forEach((b, i) => { const x = (i - 2) * 0.026; b.position.y = k.lerp(-0.07 + 7 * x * x, -0.035 - 7 * x * x, tr); });
      calco.rotation.z = -0.12 * tr;
      lagrima.visible = tr > 0.5;
      lagrima.position.y = 0.0 - 0.07 * k.clamp((t - P.deja - 0.3) / 0.8);

      // ---- la maceta: el perro se come la planta ----
      maceta.visible = t >= P.f3 + 0.25 && t < P.f4;
      maceta.scale.setScalar(k.rebote((t - P.f3 - 0.25) / 0.3));
      hojas.forEach((h, i) => { h.visible = t < P.come + 0.15 + i * 0.18; });
      const ultimaHoja = P.come + 0.15 + 5 * 0.18;

      // ---- el imán ----
      iman.visible = t >= P.f4 && t < P.f5;
      const sn = k.suave((t - P.iman - 0.15) / 0.15);
      const mano = { x: YO1.x - 0.35 + 0.55, y: 1.05, z: 1.62 };
      iman.position.set(k.lerp(mano.x, DENT.x, sn), k.lerp(mano.y, DENT.y + 0.04, sn), k.lerp(mano.z, DENT.z + 0.08, sn));
      iman.rotation.set(0, 0, sn < 1 ? 0.2 * (1 - sn) : 0.05 * Math.sin((t - P.iman) * 30) * Math.exp(-(t - P.iman - 0.3) * 6));

      // ---- los carritos ----
      carros.forEach((c, i) => {
        const x0 = CORRAL.x + i * CORRAL.paso, z0 = CORRAL.z;
        c.position.set(x0, 0, z0); c.rotation.set(0, Math.PI, 0);
        if (i < 7 && t >= P.f4 && t < P.f5) {
          const [x, y, z, ry, rx] = PEGADOS[i], llega = P.llegada(i), u = k.clamp((t - (llega - 0.45)) / 0.45);
          if (u > 0) {
            const e = u * u;
            c.position.set(k.lerp(x0, x, e), k.lerp(0, y, e) + 0.35 * Math.sin(Math.PI * u), k.lerp(z0, z, e));
            c.rotation.set(rx * e, k.lerp(Math.PI, Math.PI / 2 + ry, e), 0);
            if (u >= 1) c.rotation.z = 0.05 * Math.sin((t - llega) * 25) * Math.exp(-(t - llega) * 6);
          }
        }
        if (i === 7 && t >= P.rem) {                       // el último: viene solo, despacito
          const u = k.suave((t - P.rem) / (P.tic - P.rem));
          c.position.set(k.lerp(x0, 0.2, u), 0, k.lerp(z0, 1.31, u)); c.rotation.set(0, k.lerp(Math.PI, Math.PI / 2, k.suave(u * 1.4)), 0);
        }
      });

      // ---- vos ----
      yo.visible = t >= 1.45;
      U.cadera.position.set(0, 0.92, 0);
      if (t < P.f2) {                                       // bajás del auto y ves el bollo
        const s = k.suave((t - 1.45) / 0.6);
        ubicar(yo, k.lerp(0.2, YO1.x, s), k.lerp(1.05, YO1.z, s), mirar(YO1, DENT.x, DENT.z));
        if (t < 2.05) k.pose(yo, { caminar: 1, paso: t * 1.6 });
        else k.pose(yo, { manosCabeza: t });
      } else if (t < P.f3) {                                // la calcomanía
        ubicar(yo, YO1.x, YO1.z, mirar(YO1, DENT.x, DENT.z));
        if (t < P.pegas + 0.65) {
          const v = k.suave((t - P.pegas) / 0.45);
          k.pose(yo, { cabezaX: 0.2 }); U.brazoD.rotation.set(-1.55 * v - 0.1, 0, -0.1); U.brazoI.rotation.set(-0.2, 0, 0.1);
          yo.position.x += 0.18 * v; yo.position.z -= 0.14 * v;
        } else if (t < P.deja) {                            // la mirás orgulloso
          k.pose(yo, { brazosCruzados: true, cabezaZ: 0.15 });
        } else k.pose(yo, { cabezaX: 0.15, cabezaZ: -0.25 * k.suave((t - P.deja) / 0.4) });   // ¿triste?
      } else if (t < P.f4) {                                // ponés la maceta y mirás al perro
        const s = k.suave((t - P.f3) / 0.3);
        const yx = k.lerp(YO1.x + 0.15, 1.55, s), yz = k.lerp(YO1.z - 0.1, 1.8, s);
        ubicar(yo, yx, yz, s < 1 ? mirar(YO1, DENT.x, DENT.z) : mirar({ x: yx, z: yz }, -0.3, 1.4));
        if (t < P.f3 + 0.3) k.pose(yo, { empujar: true, cabezaX: 0.3 });
        else if (t < P.come + 0.4) k.pose(yo, { brazosCruzados: true });
        else k.pose(yo, { manosCabeza: t });
      } else if (t < P.f5) {                                // el imán; después, los carritos
        const atras = k.suave((t - P.llegada(0)) / 0.5);
        ubicar(yo, k.lerp(YO1.x - 0.35, -1.45, atras), k.lerp(YO1.z + 0.2, 1.95, atras), mirar(YO1, DENT.x, DENT.z) + 0.3 * atras);
        if (t < P.iman + 0.3) k.pose(yo, { empujar: true, cabezaX: 0.1 });
        else if (t < P.llegada(0)) k.pose(yo, { festejo: t });
        else k.pose(yo, { manosCabeza: t });
      } else if (t < P.f6) {                                // mirás cómo pinta, esperanzado
        ubicar(yo, -1.3, 1.9, mirar({ x: -1.3, z: 1.9 }, 0.6, 1.4));
        k.pose(yo, { brazosCruzados: true, cabezaZ: 0.1 * Math.sin(t * 2) });
      } else if (t < P.rem) {                               // la puerta nueva: festejás
        ubicar(yo, -0.6, 1.5, 0.45);
        k.pose(yo, { festejo: t });
      } else {                                              // el último carrito… otro bollo
        ubicar(yo, 1.9, 1.35, mirar({ x: 1.9, z: 1.35 }, DENT.x, DENT.z) - (t < P.tic ? 0.9 * k.suave((t - P.rem - 0.3) / 0.4) : 0));
        if (t < P.tic) k.pose(yo, { cabezaX: 0.05 });
        else k.pose(yo, { manosCabeza: t });
      }

      // ---- el perro (el testigo) ----
      perro.rotation.set(0, 0, 0);
      [[-0.11, 0.27], [0.11, 0.27], [-0.11, -0.27], [0.11, -0.27]].forEach(([x, z], i) => UP.patas[i].position.set(x, -0.14, z));
      almohadillas.forEach(a => { a.visible = t >= P.tic + 0.4; });
      if (t < P.f3) {                                       // sentado, mira el choque y la calcomanía
        ubicar(perro, PERRO1.x, PERRO1.z, mirar(PERRO1, DENT.x, DENT.z));
        k.posePerro(perro, { sentado: true, cola: t < P.deja ? t : 0, cabezaY: 0 });
        if (t >= P.choque && t < P.choque + 0.5) perro.position.y = 0.25 * Math.sin((t - P.choque) / 0.5 * Math.PI);
        if (t >= P.f2) UP.cuello.rotation.z = t > P.deja ? -0.5 * k.suave((t - P.deja) / 0.4) : 0.35 * k.suave((t - P.pegas - 0.5) / 0.4);
      } else if (t < P.f4) {                                // va a la maceta y se come la planta
        const ini = Math.max(P.f3 + 0.3, P.perro - 0.5), u = k.clamp((t - ini) / Math.max(0.4, P.come - ini));
        if (u < 1) {
          ubicar(perro, k.lerp(PERRO1.x, PERRO_PLANTA.x, u), k.lerp(PERRO1.z, PERRO_PLANTA.z, u), Math.PI / 2);
          k.posePerro(perro, { caminar: 1, paso: (t - ini) * 2.2, cola: t });
        } else {
          ubicar(perro, PERRO_PLANTA.x, PERRO_PLANTA.z, Math.PI / 2);
          k.posePerro(perro, { cabezaX: t < ultimaHoja ? -0.45 + 0.15 * Math.sin(t * 9) : 0.1, cola: t });
          UP.boca.rotation.x = t < ultimaHoja ? 0.25 + 0.2 * Math.sin(t * 24) : 0.05;
          if (t >= ultimaHoja) UP.cuello.rotation.y = -0.9 * k.suave((t - ultimaHoja) / 0.3);  // mira a cámara, satisfecho
        }
      } else if (t < P.f5) {                                // con los carritos: salta y sale corriendo
        const p0 = { x: -1.05, z: 2.25 }, ll = P.llegada(0);
        if (t < ll) { ubicar(perro, p0.x, p0.z, mirar(p0, DENT.x, DENT.z)); k.posePerro(perro, { sentado: true, cola: t }); }
        else {
          const e = t - ll, u = k.clamp((e - 0.3) / 1.0);
          ubicar(perro, k.lerp(p0.x, -4.6, u), p0.z + 0.2 * u, -Math.PI / 2);
          k.posePerro(perro, { caminar: e > 0.3 ? 1.3 : 0, paso: e * 3.2, colaX: -1.2 });
          perro.position.y = e < 0.35 ? 0.35 * Math.sin(e / 0.35 * Math.PI) : 0;
          if (e < 0.35) { UP.boca.rotation.x = 0.4; UP.cuello.rotation.x = -0.4; }
        }
      } else if (t < P.rem || t < P.tic + 0.3) {            // vuelve y mira; con el último carrito, se tapa los ojos
        ubicar(perro, PERRO_F5.x, PERRO_F5.z, mirar(PERRO_F5, DENT.x, DENT.z));
        k.posePerro(perro, { sentado: true, cola: t < P.rem ? t : 0, cabezaY: t >= P.rem ? 0.6 * k.suave((t - P.rem - 0.2) / 0.4) : 0 });
      } else {                                              // se da vuelta, se acuesta y se tapa los ojos con las patas
        const d = k.suave((t - P.tic - 0.3) / 0.35);
        ubicar(perro, PERRO_F5.x, PERRO_F5.z, k.lerp(mirar(PERRO_F5, DENT.x, DENT.z), 0.3, d));
        k.posePerro(perro, {});
        UP.cuerpo.position.y = k.lerp(0.42, 0.2, d);
        UP.patas[2].rotation.x = UP.patas[3].rotation.x = -1.5 * d;
        UP.patas[0].position.set(-0.1, k.lerp(-0.14, 0.05, d), k.lerp(0.27, 0.5, d));
        UP.patas[1].position.set(0.1, k.lerp(-0.14, 0.05, d), k.lerp(0.27, 0.5, d));
        UP.patas[0].rotation.x = UP.patas[1].rotation.x = -2.23 * d + 0.06 * Math.sin(t * 9) * d;
        UP.cuello.rotation.x = 0.55 * d;
        UP.cola.rotation.x = k.lerp(-0.75, -1.4, d);
      }

      // ---- el chapista ----
      chap.visible = t >= P.f5 - 0.01 && t < P.rem;
      const pinta = t < P.listo;
      if (pinta) {
        ubicar(chap, 0.95, 1.62, mirar({ x: 0.95, z: 1.62 }, DENT.x, DENT.z));
        k.pose(chap, { cabezaX: 0.15 });
        UC.brazoD.rotation.set(-1.35 + 0.12 * Math.sin(t * 5), 0, 0.12 * Math.sin(t * 3.2)); UC.brazoI.rotation.set(-0.3, 0, 0.25);
      } else { ubicar(chap, 1.05, 1.7, 0.25); k.pose(chap, { saludo: t }); }

      camara(t);
      // la niebla de pintura, entre el pico de la pistola y la puerta
      const pp = new k.THREE.Vector3(); pistola.userData.pico.getWorldPosition(pp);
      niebla.animar(t, P.f5 + 0.4, P.listo - 0.3, { x: (pp.x + DENT.x) / 2, y: (pp.y + DENT.y) / 2 - 0.25, z: (pp.z + DENT.z) / 2 });

      // ---- carteles y textos ----
      etqCarita.animar(t, P.triste - 0.05, P.f3 + 0.05, { x: DENT.x, y: DENT.y + 0.1, z: DENT.z + 0.05 }, 30, -260);
      etqHojas.animar(t, ultimaHoja + 0.05, P.f4 + 0.05, { x: DENT.x, y: 0.62, z: 1.25 }, 120, -260);
      etqCarros.animar(t, P.llegada(6) + 0.1, P.f5 + 0.05, { x: 0.3, y: 1.35, z: 2.1 }, 110, -220);
      const b2 = new k.THREE.Vector3(); bollo2.getWorldPosition(b2);
      etqBollos.animar(t, P.tic + 0.35, P.cierre + 0.2, { x: b2.x, y: b2.y, z: b2.z }, -60, -330);
      k.mostrar(card, t, P.precio - 0.15, P.f6 - 0.05);
      k.mostrar(chip, t, P.f6 + 0.25, P.rem + 0.4);
      url.style.opacity = t < P.cierre ? 1 : 0;
      fin.animar(t, P.cierre);
    },
  };
})();
