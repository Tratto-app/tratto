/* Escena del video 3D de masajes (comun-3d.js). Cada red tiene su HTML
   (video-3d-masajes-tt/ig/fb.html) que solo define window.RED.
   Un living: sillón, el marco de una puerta, un florero en su pedestal, una
   alfombra y el gato naranja (el testigo). Historia en escalera, graciosa: el
   cuello tan duro que para mirar al costado girás todo el cuerpo, como un
   robot; te frotás contra el marco de la puerta como un oso (el gato te mira);
   la pelotita de tenis en la espalda sale volando y rompe el florero (el gato
   salta); le pedís al gato que te camine la espalda y te clava las uñas. Con el
   precio llega la masajista con la camilla. Remate (cámara en el gato): ya
   suelto, girás la cabeza para mirarlo… y da la vuelta entera; el gato se
   desmaya. */
window.ESCENA3D = (function () {
  let k, base, yo, gato, mas, celu, pelota, florero, flores, trozos, camilla, toalla;
  let etqCuello, etqPelota, etqUnas, etqGiro, card, chip, fin, url;
  const P = {};
  const H = 2.7, PARED = -2.0;
  const PUERTA = { x: -1.3, ancho: 0.9 }, MARCO = -0.85;            // el marco donde te frotás (lado derecho)
  const SOFA = { x: 1.3, z: -1.55 }, PED = { x: -1.3, z: -0.75 };    // sillón y pedestal del florero
  const ALF = { x: 0.35, z: -0.45 };                                  // la alfombra (y la camilla encima)
  const GATO_SOFA = { x: 1.75, y: 0.47, z: -1.5 }, GATO_BRAZO = { x: SOFA.x - 0.75, y: 0.7, z: -1.45 };
  const BOLA0 = { x: 0.05, y: 1.22, z: PARED + 0.16 };
  const GATO_PISO = { x: 0.45, y: 0, z: -0.95 };                      // el gato en el piso, mirando el marco                 // la pelotita entre la espalda y la pared

  function tiempos() {
    P.f2 = k.frase(2, 4.0);
    P.f3 = k.frase(3, 8.2);
    P.f4 = k.frase(4, 11.8);
    P.f5 = k.frase(5, 15.6);
    P.f6 = k.frase(6, 20.6);
    P.giro = k.palabra('girás', 1, P.f2 - 1.6);
    P.oso = k.palabra('oso', 1, P.f3 - 0.5);
    P.volando = k.palabra('volando', 1, P.f3 + 1.8);
    P.crash = Math.max(P.volando + 0.45, k.palabra('florero', 1, P.volando + 0.6));
    P.camine = k.palabra('camine', 1, P.f4 + 1.0);
    P.unas = k.palabra('uñas', 1, P.f5 - 0.6);
    P.precio = k.palabra('treinta', 1, P.f5 + 2.0);
    P.listo = P.f6 - 0.15;                                            // termina el masaje
    P.fin = k.finVoz(24.5);
    P.cierre = P.fin + 0.35;
    P.rem = Math.min(P.f6 + 1.5, P.cierre - 1.9);                     // remate: la cabeza da la vuelta
    P.desmayo = P.rem + 1.05;                                        // el gato se desmaya
  }

  function living() {
    const T = k.THREE, c = (w, h, d, col, x, y, z, s = true) => k.caja(w, h, d, col, x, y, z, k.escena, s);
    const piso = new T.Mesh(new T.PlaneGeometry(80, 80), k.mat('#A8A196'));
    piso.rotation.x = -Math.PI / 2; piso.position.y = -0.04; piso.receiveShadow = true; k.escena.add(piso);
    c(4.6, 0.1, 3.8, '#B98A5E', 0, -0.03, -0.1, false);                                   // piso de madera
    for (let i = 1; i < 12; i++) c(4.6, 0.012, 0.012, '#9C7048', 0, 0.025, -2.0 + i * 0.32, false);
    c(4.6, H, 0.16, '#E9D9C4', 0, H / 2, PARED);                                           // pared crema
    c(0.16, H, 3.4, '#DDCBB3', -2.3, H / 2, -0.4);
    c(4.6, 0.1, 0.04, '#F7F2EA', 0, 0.05, PARED + 0.1);
    // la puerta: el hueco oscuro y el marco blanco
    c(PUERTA.ancho - 0.06, 2.05, 0.02, '#5B6B66', PUERTA.x, 1.025, PARED + 0.085, false);
    c(0.1, 2.15, 0.14, '#F7F2EA', PUERTA.x - PUERTA.ancho / 2, 1.075, PARED + 0.1);
    c(0.1, 2.15, 0.14, '#F7F2EA', MARCO, 1.075, PARED + 0.1);
    c(PUERTA.ancho + 0.1, 0.1, 0.14, '#F7F2EA', PUERTA.x, 2.15, PARED + 0.1);
    // un cuadro arriba del sillón
    c(0.9, 0.6, 0.04, '#1E5D49', SOFA.x, 1.75, PARED + 0.1); c(0.78, 0.48, 0.02, '#8FD9BC', SOFA.x, 1.75, PARED + 0.125, false);
    c(0.5, 0.18, 0.01, '#C9A227', SOFA.x - 0.1, 1.7, PARED + 0.14, false);
    // el sillón (azul petróleo) con dos almohadones
    c(1.5, 0.42, 0.75, '#2E5E73', SOFA.x, 0.21, SOFA.z);
    c(1.5, 0.55, 0.2, '#2E5E73', SOFA.x, 0.68, SOFA.z - 0.3);
    c(0.18, 0.62, 0.75, '#28546A', SOFA.x - 0.75, 0.31, SOFA.z); c(0.18, 0.62, 0.75, '#28546A', SOFA.x + 0.75, 0.31, SOFA.z);
    c(0.34, 0.3, 0.12, '#E3B23C', SOFA.x - 0.45, 0.6, SOFA.z - 0.14); c(0.34, 0.3, 0.12, '#C8553D', SOFA.x + 0.4, 0.6, SOFA.z - 0.14);
    // una lámpara de pie
    c(0.3, 0.03, 0.3, '#2A2E2C', 2.35, 0.02, PARED + 0.3); c(0.04, 1.5, 0.04, '#2A2E2C', 2.35, 0.78, PARED + 0.3);
    const pantalla = new T.Mesh(new T.CylinderGeometry(0.16, 0.24, 0.3, 8), k.mat('#F4E3C1')); pantalla.position.set(2.35, 1.6, PARED + 0.3); pantalla.castShadow = true; k.escena.add(pantalla);
    // la alfombra
    c(2.2, 0.02, 1.4, '#C8553D', ALF.x, 0.01, ALF.z, false); c(2.0, 0.022, 1.2, '#E7A390', ALF.x, 0.012, ALF.z, false);
    // el pedestal del florero
    c(0.36, 0.95, 0.36, '#F2EFE6', PED.x, 0.475, PED.z);
  }

  function armarFlorero() {
    const T = k.THREE, g = new T.Group();
    const v = new T.Mesh(new T.CylinderGeometry(0.08, 0.12, 0.32, 8), k.mat('#3F7FB5')); v.position.y = 0.16; v.castShadow = true; g.add(v);
    const boca = new T.Mesh(new T.CylinderGeometry(0.1, 0.08, 0.06, 8), k.mat('#3F7FB5')); boca.position.y = 0.34; g.add(boca);
    flores = new T.Group(); g.add(flores);
    [[-0.05, '#C8553D'], [0.06, '#E3B23C'], [0.0, '#F4F2EC']].forEach(([x, col], i) => {
      k.caja(0.015, 0.32, 0.015, '#3F7F4E', x, 0.48, 0, flores, false);
      const f = new T.Mesh(new T.IcosahedronGeometry(0.06, 0), k.mat(col)); f.position.set(x, 0.65 + i * 0.03, 0); f.castShadow = true; flores.add(f);
    });
    g.position.set(PED.x, 0.95, PED.z); k.escena.add(g); return g;
  }

  function armarCamilla() {
    const T = k.THREE, g = new T.Group(), b = (w, h, d, col, x, y, z) => k.caja(w, h, d, col, x, y, z, g);
    b(1.95, 0.1, 0.68, '#E8E2D6', 0, 0.73, 0); b(1.9, 0.06, 0.62, '#F4F2EC', 0, 0.8, 0);
    [[-0.85, -0.26], [0.85, -0.26], [-0.85, 0.26], [0.85, 0.26]].forEach(([x, z]) => b(0.06, 0.68, 0.06, '#B9B2A5', x, 0.34, z));
    b(0.3, 0.05, 0.4, '#E8E2D6', -1.08, 0.74, 0);                       // el apoyacara
    g.position.set(ALF.x, 0, ALF.z); k.escena.add(g); return g;
  }

  // vos acostado boca abajo, a lo largo de x, con la cabeza hacia -x (base en los pies)
  function acostar(y, x = ALF.x + 0.95) {
    yo.position.set(x, y, ALF.z); yo.rotation.set(Math.PI / 2, -Math.PI / 2, 0);
  }
  function parado(x, z, rot) { yo.position.set(x, 0, z); yo.rotation.set(0, rot, 0); }

  function camara(t) {
    const cam = k.camara, V = (x, y, z) => new k.THREE.Vector3(x, y, z);
    let pos, mira;
    const z1 = (a, b, x0, x1) => k.lerp(a, b, k.suave((t - x0) / Math.max(0.3, x1 - x0)));
    if (t < P.f2) {                               // 1. de frente: el celular y el giro de robot
      const z = z1(1, 0.86, 0, P.f2);
      mira = V(1.0, 1.0, -0.8); pos = mira.clone().add(V(-1.0 * z, 0.8 * z, 7.6 * z));
    } else if (t < P.f3) {                        // 2. el marco de la puerta, desde la derecha (el gato en primer plano)
      const z = z1(1, 0.9, P.f2, P.f3);
      mira = V(-0.25, 0.95, -1.3); pos = mira.clone().add(V(1.4 * z, 1.0 * z, 6.4 * z));
    } else if (t < P.f4) {                        // 3. la pelotita, el florero y el gato
      const z = z1(1, 0.94, P.f3, P.f4);
      mira = V(-0.5, 0.95, -1.15); pos = mira.clone().add(V(0.6 * z, 1.6 * z, 6.9 * z));
    } else if (t < P.f5) {                        // 4. en la alfombra, desde arriba: el gato camina y clava las uñas
      const z = z1(1, 0.9, P.f4, P.f5);
      mira = V(ALF.x + 0.2, 0.3, ALF.z); pos = mira.clone().add(V(3.4 * z, 3.4 * z, 2.6 * z));
    } else if (t < P.f6) {                        // 5. el precio: la masajista en la camilla
      const z = z1(1, 0.93, P.f5, P.f6);
      mira = V(ALF.x + 0.1, 0.95, ALF.z - 0.15); pos = mira.clone().add(V(3.2 * z, 1.7 * z, 4.4 * z));
    } else if (t < P.rem) {                       // 6. te sentás, suelto
      const z = z1(1, 0.92, P.f6, P.rem);
      mira = V(ALF.x - 0.2, 1.0, ALF.z); pos = mira.clone().add(V(-1.6 * z, 0.7 * z, 6.0 * z));
    } else {                                      // 7. remate: la cabeza da la vuelta; el gato en primer plano
      const g = k.suave((t - P.desmayo) / 0.7), z = k.lerp(1, 0.58, g);
      mira = V(k.lerp(1.05, 0.22, g), k.lerp(0.9, 0.12, g), k.lerp(-1.3, -1.2, g)); pos = mira.clone().add(V(-1.3 * z, k.lerp(0.9, 0.5, g) * z, 6.2 * z));
    }
    cam.position.copy(pos); cam.lookAt(mira); cam.updateProjectionMatrix(); cam.updateMatrixWorld();
  }
  function sentar(p, y = 0.5) { const u = p.userData; u.cadera.position.y = y; u.piernaI.rotation.x = u.piernaD.rotation.x = -1.45; }

  return {
    get duracion() { return P.cierre + 2.8; },
    get cierre() { return P.cierre; },
    get efectos() {
      const r = x => +x.toFixed(2);
      const pasos = [0, 1, 2].map(i => ({ efecto: 'crujido', t: r(P.giro - 0.1 + i * 0.42), db: -19 }));
      return [
        { efecto: 'tic', t: r(0.3), db: -18 },
        ...pasos,
        { efecto: 'latigazo', t: r(P.f2 - 0.2), db: -19 },
        { efecto: 'maullido', t: r(P.oso + 0.1), db: -17 },
        { efecto: 'latigazo', t: r(P.f3 - 0.2), db: -19 },
        { efecto: 'pop', t: r(P.volando - 0.05), db: -15 },
        { efecto: 'vidrio', t: r(P.crash), db: -14 },
        { efecto: 'latigazo', t: r(P.f4 - 0.2), db: -19 },
        { efecto: 'maullido', t: r(P.camine), db: -20 },
        { efecto: 'golpe', t: r(P.unas), db: -17 },
        { efecto: 'latigazo', t: r(P.f5 - 0.2), db: -19 },
        { efecto: 'pop', t: r(P.precio - 0.15), db: -16 },
        { efecto: 'campanita', t: r(P.precio + 0.05), db: -18 },
        { efecto: 'sello', t: r(P.precio + 0.3), db: -18 },
        { efecto: 'latigazo', t: r(P.f6 - 0.2), db: -19 },
        { efecto: 'acierto', t: r(P.f6 + 0.1), db: -17 },
        { efecto: 'latigazo', t: r(P.rem - 0.2), db: -19 },
        { efecto: 'crujido', t: r(P.rem + 0.3), db: -16 },
        { efecto: 'maullido', t: r(P.rem + 0.85), db: -15 },
        { efecto: 'golpe', t: r(P.desmayo + 0.15), db: -15 },
        { efecto: 'golpe', t: r(P.cierre + 0.1), db: -14 },
      ];
    },
    armar(kit) {
      k = kit; tiempos();
      const T = k.THREE;
      k.sol.position.set(5, 14, 9);
      const luz2 = new T.DirectionalLight('#FFF0DA', 0.7); luz2.position.set(-6, 9, 7); k.escena.add(luz2);
      k.escena.background = new T.Color('#E3D3BE'); k.escena.fog.color.set('#E3D3BE');
      living();
      florero = armarFlorero();
      trozos = [];
      for (let i = 0; i < 9; i++) trozos.push(k.caja(0.07 + (i % 3) * 0.02, 0.05, 0.05 + (i % 2) * 0.03, '#3F7FB5', 0, -5, 0));
      camilla = armarCamilla();
      // la pelotita de tenis
      pelota = new T.Mesh(new T.IcosahedronGeometry(0.075, 1), k.mat('#C9D84A')); pelota.castShadow = true; k.escena.add(pelota);
      // vos (remera mostaza); la base va en los pies, así se acuesta con rotation (orden YXZ)
      yo = k.personaje({ ropa: '#D9A441', pantalon: '#3C4A66', pelo: '#2B1D16', zapatillas: '#F2F2EE' });
      yo.rotation.order = 'YXZ';
      // el celular en la mano derecha
      celu = new T.Group(); yo.userData.brazoD.add(celu); celu.position.set(0, -0.66, 0.08);
      k.caja(0.1, 0.18, 0.025, '#121614', 0, 0, 0, celu, false); k.caja(0.085, 0.155, 0.01, '#8FD9BC', 0, 0, 0.014, celu, false);
      // la toalla sobre las piernas en la camilla
      toalla = k.caja(0.9, 0.06, 0.5, '#8FD9BC', 0, -5, 0);
      // el gato (el testigo), naranja
      gato = k.gato({ color: '#E39B4A', oscuro: '#B86A2A' });
      // la masajista (chaqueta blanca, colita)
      mas = k.personaje({ ropa: '#F4F2EC', pantalon: k.C.verde, zapatillas: '#2A2E2C', piel: '#C9956E', pelo: '#3A2418' });
      k.caja(0.16, 0.26, 0.14, '#3A2418', 0, 0.36, -0.28, mas.userData.cuello);
      url = k.etiquetaUrl();
      etqCuello = k.etiqueta('Cuello: 2° de giro');
      etqPelota = k.etiqueta('Pelotita: 140 km/h');
      etqUnas = k.etiqueta('Uñas: 18');
      etqGiro = k.etiqueta('Giro: 360°');
      card = k.tarjeta(`<div class="sello">Precio<br>de<br>referencia</div>
        <div class="t-et">MASAJE DESCONTRACTURANTE DE 1 HORA</div>
        <div class="t-precio">$38.000<span>a</span>$65.000</div>
        <div class="t-nota">Noviembre 2026 · AMBA · por sesión</div>`);
      chip = k.tarjeta(`<div class="ok">✓</div><div><div class="c1">Pedido publicado gratis</div><div class="c2">Masajes · tu zona</div></div>`, 'chip3d');
      fin = k.cierre('Pedí presupuestos', 'de gente de tu zona');
    },
    animar(t) {
      const T = k.THREE, U = yo.userData, UG = gato.userData;
      celu.visible = t < P.f2;
      camilla.visible = t >= P.f5 - 0.01 && t < P.rem;
      toalla.position.set(0, -5, 0);

      // ---- el florero y la pelotita ----
      const vuela = t >= P.volando - 0.05 && t < P.crash;
      const roto = t >= P.crash;
      florero.visible = !roto;
      if (t < P.f3 || t >= P.f4) pelota.position.set(0, -5, 0);
      else if (!vuela && !roto) pelota.position.set(BOLA0.x - 0.34, BOLA0.y - 0.05 * Math.sin((t - P.f3) * 7), BOLA0.z + 0.04);
      else if (vuela) {
        const u = k.clamp((t - (P.volando - 0.05)) / (P.crash - P.volando + 0.05));
        pelota.position.set(k.lerp(BOLA0.x - 0.34, PED.x, u), k.lerp(BOLA0.y, 1.12, u) + 0.45 * Math.sin(u * Math.PI), k.lerp(BOLA0.z + 0.1, PED.z, u));
        pelota.rotation.set(t * 20, t * 13, 0);
      } else {                                   // rebota y queda en el piso
        const e = t - P.crash;
        pelota.position.set(PED.x + 0.5 * Math.min(e, 0.8), Math.max(0.075, 1.1 - 4.9 * e * e + 0.8 * e), PED.z + 0.35 * Math.min(e, 0.8));
      }
      trozos.forEach((tr, i) => {
        if (!roto || t >= P.f4) { tr.position.set(0, -5, 0); return; }
        const e = t - P.crash, a = i * 0.7 + 0.3, v = 0.6 + (i % 4) * 0.25;
        tr.position.set(PED.x + Math.cos(a) * v * Math.min(e, 0.55), Math.max(0.03, 1.1 + 1.6 * e - 4.9 * e * e), PED.z + Math.sin(a) * v * Math.min(e, 0.55));
        tr.rotation.set(e * 9 + i, e * 7, i);
      });
      if (roto && t < P.f4) {                    // las flores quedan en el piso
        flores.visible = false;
      } else flores.visible = true;

      // ---- vos ----
      U.cadera.position.set(0, 0.92, 0); U.cadera.rotation.set(0, 0, 0);
      if (t < P.f2) {                            // con el celular; para mirar al gato girás todo el cuerpo, de a golpes
        const pasos = [0, 1, 2].reduce((s, i) => s + k.suave((t - (P.giro - 0.1 + i * 0.42)) / 0.18), 0);
        parado(0.55, -0.4, (Math.PI / 2) * pasos / 3);
        if (t < P.giro - 0.2) {
          k.pose(yo, { cabezaX: 0.35 }); U.brazoD.rotation.set(-1.25, 0, -0.35); U.brazoI.rotation.set(-0.9, 0, 0.35);
        } else {                                 // tieso: brazos pegados, la cabeza no se mueve
          k.pose(yo, { cabezaX: 0.05 }); U.brazoD.rotation.set(-1.0, 0, -0.25); U.brazoI.rotation.set(0, 0, 0.05);
          U.cadera.position.y = 0.92 + 0.012 * Math.sin(t * 60) * (pasos % 1 > 0.05 ? 1 : 0);
        }
      } else if (t < P.f3) {                     // de espaldas al marco, te frotás como un oso
        parado(MARCO, PARED + 0.33, 0);
        const s = Math.sin((t - P.f2) * 8);
        k.pose(yo, { cabezaX: -0.28 });
        U.cadera.position.y = 0.86 + 0.07 * s; U.cadera.position.x = 0.03 * Math.sin((t - P.f2) * 4);
        U.cadera.rotation.z = 0.05 * Math.sin((t - P.f2) * 4);
        U.piernaI.rotation.x = U.piernaD.rotation.x = -0.25 + 0.15 * s;
        U.brazoI.rotation.set(-0.2, 0, 0.35 + 0.1 * s); U.brazoD.rotation.set(-0.2, 0, -0.35 - 0.1 * s);
        U.cuello.rotation.z = 0.15 * Math.sin((t - P.f2) * 3);
      } else if (t < P.f4) {                     // la pelotita contra la pared; sale disparada
        parado(BOLA0.x, BOLA0.z + 0.3, 0);
        if (t < P.volando - 0.05) {
          const s = Math.sin((t - P.f3) * 7);
          k.pose(yo, { cabezaX: -0.15 });
          U.cadera.position.y = 0.88 + 0.05 * s; U.piernaI.rotation.x = U.piernaD.rotation.x = -0.2 + 0.1 * s;
          U.brazoI.rotation.set(-0.3, 0, 0.3); U.brazoD.rotation.set(-0.3, 0, -0.3);
        } else {                                 // te das vuelta: ¡el florero!
          const e = k.suave((t - P.volando) / 0.4);
          yo.rotation.y = -0.9 * e;
          k.pose(yo, { manosCabeza: t > P.crash ? t : 0 });
          if (t <= P.crash) { U.brazoI.rotation.set(-0.8, 0, 0.3); U.brazoD.rotation.set(-0.8, 0, -0.3); }
        }
      } else if (t < P.f5) {                     // boca abajo en la alfombra; el gato te camina la espalda
        acostar(0.22);
        k.pose(yo, {});
        U.brazoI.rotation.set(-2.9, 0, 0.25); U.brazoD.rotation.set(-2.9, 0, -0.25);   // los brazos hacia adelante
        if (t >= P.unas) {                       // ¡las uñas!: te arqueás y pataleás
          const e = t - P.unas;
          yo.position.y = 0.22 + 0.12 * Math.max(0, Math.sin(Math.min(e, 0.5) * Math.PI * 2));
          U.cuello.rotation.x = -0.7; U.cadera.rotation.x = -0.25;
          U.piernaI.rotation.x = 0.6 + Math.sin(e * 22) * 0.35; U.piernaD.rotation.x = 0.6 - Math.sin(e * 22) * 0.35;
          U.brazoI.rotation.set(-2.6 + Math.sin(e * 18) * 0.3, 0, 0.6); U.brazoD.rotation.set(-2.6 - Math.sin(e * 18) * 0.3, 0, -0.6);
        } else U.cuello.rotation.x = -0.15;
      } else if (t < P.listo) {                  // en la camilla: el masaje
        acostar(0.98);
        k.pose(yo, {}); U.cuello.rotation.x = -0.05;
        U.brazoI.rotation.set(-0.05, 0, 0.04); U.brazoD.rotation.set(-0.05, 0, -0.04);
        toalla.position.set(ALF.x + 0.6, 0.86, ALF.z);
      } else if (t < P.rem) {                    // sentado en la camilla, suelto: festejás
        parado(ALF.x + 0.1, ALF.z + 0.25, 0);
        k.pose(yo, { festejo: t > P.f6 + 0.15 ? t : 0 }); sentar(yo, 0.98);
        toalla.position.set(ALF.x + 0.1, 0.84, ALF.z + 0.05);
      } else {                                   // remate: en el sillón, girás la cabeza para mirar al gato… y da la vuelta entera
        parado(SOFA.x + 0.3, SOFA.z + 0.18, 0);
        k.pose(yo, {}); sentar(yo, 0.62);
        U.brazoI.rotation.set(-0.5, 0, 0.15); U.brazoD.rotation.set(-0.5, 0, -0.15);
        const g = k.suave((t - P.rem - 0.15) / 0.95);
        U.cuello.rotation.y = -2 * Math.PI * g - 0.6 * k.suave((t - P.rem - 1.15) / 0.3);
      }

      // ---- el gato (el testigo) ----
      gato.rotation.set(0, 0, 0); gato.position.set(GATO_SOFA.x, GATO_SOFA.y, GATO_SOFA.z); gato.rotation.y = -0.6;
      if (t < P.f2) {                            // en el sillón, te mira
        k.posePerro(gato, { sentado: true, cola: t, cabezaY: -0.35 });
      } else if (t < P.f3) {                     // en el piso: te mira frotarte, con la cabeza ladeada
        gato.position.set(GATO_PISO.x, GATO_PISO.y, GATO_PISO.z); gato.rotation.y = -0.45;
        k.posePerro(gato, { sentado: true, cabezaY: -0.75 });
        UG.cuello.rotation.z = t > P.oso ? -0.45 : -0.2 * k.suave((t - P.f2) / 1.2);
      } else if (t < P.f4) {                     // con el florero, salta del susto
        gato.rotation.y = -1.25;
        if (t < P.crash) k.posePerro(gato, { sentado: true, cabezaY: 0.2, cola: t });
        else {
          const e = t - P.crash, s = Math.max(0, Math.sin(Math.min(e, 0.55) / 0.55 * Math.PI));
          k.posePerro(gato, { colaX: 1.5 }); gato.position.y = GATO_SOFA.y + 0.55 * s; UG.cuerpo.rotation.x = -0.25 * s;
          if (e > 0.55) k.posePerro(gato, { colaX: 1.5, cabezaY: 0.3 });
        }
      } else if (t < P.f5) {                     // camina por tu espalda y clava las uñas
        gato.rotation.y = -Math.PI / 2;
        const ini = P.f4 + 0.2, u = k.clamp((t - ini) / Math.max(0.5, P.unas - ini));
        gato.position.set(k.lerp(ALF.x + 0.9, ALF.x - 0.05, u), 0.4, ALF.z);
        if (t < P.unas) k.posePerro(gato, { caminar: 1, paso: (t - ini) * 1.6, cola: t });
        else {                                   // las uñas: las patas de adelante estiradas y la cola parada
          k.posePerro(gato, { colaX: 1.4, cabezaX: -0.2 });
          UG.patas[0].rotation.x = UG.patas[1].rotation.x = -0.6 + Math.sin((t - P.unas) * 24) * 0.25;
          gato.position.y = 0.4 + 0.12 * Math.max(0, Math.sin(Math.min(t - P.unas, 0.5) * Math.PI * 2));
        }
      } else if (t < P.rem) {                    // de vuelta en el sillón, mirando el masaje
        gato.rotation.y = -0.9;
        k.posePerro(gato, { sentado: true, cola: t, cabezaY: -0.25 });
      } else {                                   // remate: en el brazo del sillón; ve la cabeza dar la vuelta y se desmaya
        gato.position.set(GATO_BRAZO.x, GATO_BRAZO.y, GATO_BRAZO.z); gato.rotation.y = 1.25;
        const e = t - P.rem;
        if (t < P.rem + 0.75) k.posePerro(gato, { sentado: true, cabezaY: -0.15, cola: t });
        else if (t < P.desmayo) {                 // salto con la cola parada
          const s = Math.sin(k.clamp((e - 0.75) / 0.3) * Math.PI);
          k.posePerro(gato, { colaX: 1.6 }); gato.position.y = GATO_BRAZO.y + 0.45 * s;
        } else {                                 // se cae de costado, patas tiesas, al piso
          const d = k.suave((t - P.desmayo) / 0.35);
          k.posePerro(gato, { colaX: 0 });
          UG.patas.forEach(p => p.rotation.set(0, 0, 0));
          gato.position.set(GATO_BRAZO.x - 0.4 * d, k.lerp(GATO_BRAZO.y, 0.17, d), GATO_BRAZO.z + 0.25 * d);
          gato.rotation.set(0, 1.25, -Math.PI / 2 * d);
        }
      }

      // ---- la masajista ----
      mas.visible = t >= P.f5 - 0.01 && t < P.rem;
      if (t < P.listo) {                         // del otro lado de la camilla, las dos manos en tu espalda
        mas.position.set(ALF.x + 0.15, 0, ALF.z - 0.62); mas.rotation.set(0, 0, 0);
        k.pose(mas, { cabezaX: 0.45 });
        const a = Math.sin(t * 6) * 0.12;
        mas.userData.brazoI.rotation.set(-1.05 + a, 0, 0.25); mas.userData.brazoD.rotation.set(-1.05 - a, 0, -0.25);
        mas.userData.cadera.rotation.x = 0.28;
      } else {                                   // se para al lado y saluda
        mas.position.set(ALF.x - 0.85, 0, ALF.z - 0.35); mas.rotation.set(0, 0.35, 0);
        k.pose(mas, { saludo: t });
      }

      camara(t);
      // ---- carteles y textos ----
      const hc = new T.Vector3(); U.cuello.getWorldPosition(hc);
      etqCuello.animar(t, 0.8, P.f2 + 0.05, { x: hc.x, y: hc.y + 0.05, z: hc.z }, 70, -190);
      etqPelota.animar(t, P.volando, P.crash + 0.9, { x: pelota.position.x, y: pelota.position.y, z: pelota.position.z }, 60, 170);
      const hg = new T.Vector3(); UG.cuerpo.getWorldPosition(hg);
      etqUnas.animar(t, P.unas + 0.05, P.f5 + 0.05, { x: hg.x, y: hg.y + 0.1, z: hg.z }, 80, 200);
      const hh = new T.Vector3(); U.cabeza.getWorldPosition(hh);
      etqGiro.animar(t, P.rem + 0.45, P.desmayo + 0.05, { x: hh.x, y: hh.y + 0.15, z: hh.z }, -230, -140);
      k.mostrar(card, t, P.precio - 0.15, P.f6 - 0.05);
      k.mostrar(chip, t, P.f6 + 0.25, P.cierre + 0.2);
      url.style.opacity = t < P.cierre ? 1 : 0;
      fin.animar(t, P.cierre);
    },
  };
})();
