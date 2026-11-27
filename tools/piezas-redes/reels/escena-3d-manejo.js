/* Escena del video 3D de clases de manejo (comun-3d.js). Cada red tiene su
   HTML (video-3d-manejo-tt/ig/fb.html) que solo define window.RED.
   Una cuadra de barrio, de día, vista desde una punta (la calle se pierde
   hacia arriba del cuadro): dos autos estacionados con un lugar en el medio,
   el cuidacoches con chaleco naranja en la vereda (el testigo) y, al fondo,
   la esquina con la senda peatonal. Historia en escalera, graciosa: primera
   maniobra y subís la rueda a la vereda; segunda y le tocás el paragolpes al de
   atrás (le salta la alarma); tercera y quedás cruzado en la calle con una
   fila de autos tocando bocina hasta la esquina. Con el precio se sube la
   persona de clases de manejo; después de unas clases estacionás a la primera
   y el cuidacoches aplaude. Remate (cámara en el cuidacoches): te señala el
   cartel de prohibido estacionar. */
window.ESCENA3D = (function () {
  let k, yo, instr, cuida, franela, autoA, autoB, cabYo, cabInstr, balizas = [], fila = [], cartel;
  let etqCordon, etqAlarma, etqFila, etqCartel, card, chip, fin, url;
  const P = {};
  const VY = 0.18;                                  // alto de la vereda
  const CORDON = -1.2;                              // línea del cordón (la vereda va hacia -z)
  const ZE = -0.35;                                 // centro de los autos estacionados
  const CARRIL = 1.5;                               // centro del carril
  const A = { x: 4.0 }, B = { x: -4.0 };            // autos estacionados: adelante y atrás del lugar
  const CUIDA = { x: 1.3, z: -2.05 };
  const CARTEL = { x: -0.3, z: CORDON - 0.2 };

  function tiempos() {
    P.f2 = k.frase(2, 3.6);
    P.f3 = k.frase(3, 7.0);
    P.f4 = k.frase(4, 10.2);
    P.f5 = k.frase(5, 13.6);
    P.f6 = k.frase(6, 20.4);
    P.rueda = k.palabra('rueda', 1, P.f2 + 1.6);
    P.toca = k.palabra('paragolpes', 1, P.f3 + 1.6);
    P.fila = k.palabra('bocinazos', 1, P.f4 + 1.4);
    P.precio = k.palabra('treinta', 1, P.f5 + 3.0);
    P.fin = k.finVoz(24.0);
    P.listo = P.f6 + 2.3;                             // estacionás a la primera
    P.rem = P.f6 + 2.8;                               // remate: el cuidacoches y el cartel
    P.senala = P.rem + 0.8;
    P.cierre = Math.max(P.fin + 0.35, P.senala + 2.4);
  }

  function calle() {
    const T = k.THREE, c = (w, h, d, col, x, y, z, s = true) => k.caja(w, h, d, col, x, y, z, k.escena, s);
    const piso = new T.Mesh(new T.PlaneGeometry(90, 90), k.mat('#5C6166'));   // asfalto
    piso.rotation.x = -Math.PI / 2; piso.position.y = -0.01; piso.receiveShadow = true; k.escena.add(piso);
    // líneas del medio de la calle
    for (let i = -9; i <= 3; i++) c(1.2, 0.012, 0.12, '#E9E3CF', i * 2.4, 0.005, 3.1, false);
    // la vereda de este lado (con baldosas) y la de enfrente
    c(40, VY, 2.6, '#C7C9C2', -6, VY / 2, CORDON - 1.3); c(40, 0.04, 0.12, '#A7AAA3', -6, VY + 0.01, CORDON - 0.06, false);
    for (let i = 0; i < 40; i++) c(0.02, 0.005, 2.5, '#B5B8B0', -25.5 + i, VY + 0.003, CORDON - 1.3, false);
    c(40, VY, 2.4, '#C7C9C2', -6, VY / 2, 6.4);
    // la esquina del fondo: la calle que cruza y la senda peatonal
    c(4.0, VY + 0.02, 2.62, '#5C6166', -18.5, VY / 2, CORDON - 1.3, false); c(4.0, VY + 0.02, 2.42, '#5C6166', -18.5, VY / 2, 6.4, false);
    for (let j = 0; j < 7; j++) c(2.4, 0.015, 0.4, '#F4F2EC', -16.0, 0.008, -0.6 + j * 0.85, false);
    // casas de este lado (frentes de colores, puertas y ventanas)
    const frentes = ['#E7C9A0', '#C9DCE6', '#F2D6C9', '#D9E4C8', '#EAD9B0', '#D6CCE6', '#F1E2B8'];
    for (let i = 0; i < 7; i++) {
      const x = 6 - i * 3.3; if (x < -16.5 && x > -20.5) continue;
      const h = 3.2 + (i % 3) * 0.7;
      c(3.2, h, 0.6, frentes[i], x, h / 2, CORDON - 2.9);
      c(0.9, 2.0, 0.05, '#6B4430', x - 0.7, 1.0 + VY, CORDON - 2.58, false);
      c(1.0, 0.8, 0.05, '#A9D3E6', x + 0.6, 1.9, CORDON - 2.58, false);
    }
    for (let i = 0; i < 7; i++) {
      const x = 6 - i * 3.3, h = 3.6 + ((i + 1) % 3) * 0.8;
      c(3.2, h, 0.6, frentes[(i + 3) % 7], x, h / 2, 7.9);
      c(1.0, 0.8, 0.05, '#A9D3E6', x, 2.2, 7.58, false);
    }
    // árboles en la vereda
    [[-2.6, CORDON - 0.6], [5.6, CORDON - 0.6], [-9.5, CORDON - 0.6], [-13.5, CORDON - 0.6]].forEach(([x, z]) => {
      c(0.18, 2.0, 0.18, '#6B4430', x, VY + 1.0, z);
      const copa = new T.Mesh(new T.IcosahedronGeometry(0.9, 0), k.mat('#4E9157')); copa.position.set(x, VY + 2.5, z); copa.castShadow = true; k.escena.add(copa);
    });
    // el cartel de prohibido estacionar, justo en el lugar libre
    cartel = new T.Group(); cartel.position.set(CARTEL.x, VY, CARTEL.z); k.escena.add(cartel);
    k.caja(0.07, 2.1, 0.07, '#8E9490', 0, 1.05, 0, cartel);
    const disco = new T.Mesh(new T.CylinderGeometry(0.32, 0.32, 0.04, 24), k.mat('#C8433A')); disco.rotation.z = Math.PI / 2; disco.position.set(0.03, 2.1, 0); cartel.add(disco);
    const fondo = new T.Mesh(new T.CylinderGeometry(0.25, 0.25, 0.045, 24), k.mat('#3D6E9E')); fondo.rotation.z = Math.PI / 2; fondo.position.set(0.035, 2.1, 0); cartel.add(fondo);
    const barra = k.caja(0.05, 0.56, 0.07, '#C8433A', 0.045, 2.1, 0, cartel, false); barra.rotation.x = Math.PI / 4;
    const barra2 = k.caja(0.05, 0.56, 0.07, '#C8433A', 0.045, 2.1, 0, cartel, false); barra2.rotation.x = -Math.PI / 4;
    cartel.rotation.y = Math.PI / 2;                 // mira a la calle
  }

  // auto propio: vidrios que dejan ver las cabezas de adentro
  function autoPropio() {
    const T = k.THREE, g = k.auto({ color: '#C8433A', vidrio: '#9FC3D6' });
    g.traverse(m => { if (m.isMesh && m.material && m.material.color && m.material.color.getHexString() === '9fc3d6') { m.material = new T.MeshStandardMaterial({ color: '#9FC3D6', transparent: true, opacity: 0.35 }); m.castShadow = false; } });
    const cabeza = (pelo, gorra) => {
      const h = new T.Group(); g.add(h);
      k.caja(0.3, 0.32, 0.3, '#E2B48F', 0, 0, 0, h, false); k.caja(0.32, 0.1, 0.32, pelo, 0, 0.17, 0, h, false);
      if (gorra) k.caja(0.34, 0.08, 0.34, gorra, 0, 0.24, 0, h, false);
      k.caja(0.02, 0.05, 0.04, '#0E1815', 0.155, 0.04, 0.06, h, false); k.caja(0.02, 0.05, 0.04, '#0E1815', 0.155, 0.04, -0.06, h, false);
      return h;
    };
    cabYo = cabeza('#3A2A1E'); cabYo.position.set(-0.25, 1.12, 0.35);
    cabInstr = cabeza('#2B1D16', k.C.laton); cabInstr.position.set(-0.25, 1.12, -0.35);
    g.rotation.order = 'YXZ';
    return g;
  }

  // pose del auto propio en el tiempo t: { x, z, yaw, y, roll, pitch }
  function posAuto(t) {
    const K = (x, z, yaw) => ({ x, z, yaw });
    const mezcla = (a, b, u) => { const s = k.suave(k.clamp(u)); return { x: k.lerp(a.x, b.x, s), z: k.lerp(a.z, b.z, s), yaw: k.lerp(a.yaw, b.yaw, s) }; };
    const K0 = K(-9, CARRIL, 0), K1 = K(4.3, CARRIL, 0), K2 = K(0.9, -0.25, -0.62);
    const K3 = K(2.3, 0.95, -0.22), K4 = K(-0.35, 0.25, -0.2), K5 = K(1.2, 1.25, -0.95);
    let p, y = 0, roll = 0, pitch = 0;
    if (t < P.f2 - 0.2) p = mezcla(K0, K1, t / (P.f2 - 0.6));
    else if (t < P.f3 - 0.1) {
      p = mezcla(K1, K2, (t - (P.f2 - 0.2)) / Math.max(0.6, P.rueda - P.f2 + 0.2));
      const sube = k.clamp((t - P.rueda + 0.15) / 0.25);              // la rueda de atrás arriba del cordón
      y = 0.1 * sube; roll = -0.07 * sube; pitch = -0.05 * sube;
    } else if (t < P.f4 - 0.1) {
      const mitad = (P.f3 + P.toca) / 2;
      p = t < mitad ? mezcla(K2, K3, (t - P.f3 + 0.1) / Math.max(0.4, mitad - P.f3)) : mezcla(K3, K4, (t - mitad) / Math.max(0.4, P.toca - mitad));
      if (t >= P.toca) { const e = t - P.toca; p.x += 0.12 * Math.exp(-e * 6) * Math.sin(e * 40); }    // el golpe
      if (t < P.f3 + 0.25) { const b = k.clamp((t - P.f3 + 0.1) / 0.3); y = 0.1 * (1 - b); roll = -0.07 * (1 - b); pitch = -0.05 * (1 - b); }
    } else if (t < P.f6) {
      p = mezcla(K4, K5, (t - P.f4 + 0.1) / 0.9);                          // queda cruzado en la calle
    } else {                                                               // después de unas clases: a la primera
      const u = (t - P.f6) / (P.listo - P.f6);
      const L1 = K(4.3, CARRIL, 0), L2 = K(1.6, 0.4, -0.55), L3 = K(0, ZE, 0);
      p = u < 0.15 ? L1 : u < 0.6 ? mezcla(L1, L2, (u - 0.15) / 0.45) : mezcla(L2, L3, (u - 0.6) / 0.4);
    }
    return { x: p.x, z: p.z, yaw: p.yaw, y, roll, pitch };
  }

  function camara(t) {
    const cam = k.camara, V = (x, y, z) => new k.THREE.Vector3(x, y, z);
    let pos, mira;
    const z1 = (a, b, x0, x1) => k.lerp(a, b, k.suave((t - x0) / Math.max(0.3, x1 - x0)));
    if (t < P.f2) {                               // 1. desde la punta de la cuadra, alto: llegás al lugar
      const z = z1(1.0, 0.92, 0, P.f2);
      mira = V(-0.5, 0.6, 0.1); pos = mira.clone().add(V(15.5 * z, 10.5 * z, 4.5 * z));
    } else if (t < P.f3) {                        // 2. más cerca: la rueda en la vereda y el cuidacoches
      const z = z1(1, 0.92, P.f2, P.f3);
      mira = V(0.4, 0.5, -0.5); pos = mira.clone().add(V(10.5 * z, 7.5 * z, 5.0 * z));
    } else if (t < P.f4) {                        // 3. el paragolpes del de atrás, desde la otra punta
      const z = z1(1, 0.93, P.f3, P.f4);
      mira = V(-1.4, 0.6, -0.3); pos = mira.clone().add(V(-10.5 * z, 7.2 * z, 5.2 * z));
    } else if (t < P.f5) {                        // 4. bien alto: la fila de autos hasta la esquina
      const z = z1(1, 0.94, P.f4, P.f5);
      mira = V(-6.0, 0.5, 0.6); pos = mira.clone().add(V(17.0 * z, 13.0 * z, 3.5 * z));
    } else if (t < P.f6) {                        // 5. la persona de clases de manejo sube; el precio
      const z = z1(1, 0.95, P.f5, P.f6);
      mira = V(0.8, 0.7, 0.4); pos = mira.clone().add(V(10.5 * z, 6.5 * z, 6.0 * z));
    } else if (t < P.rem) {                       // 6. a la primera, desde la punta
      const z = z1(1, 0.93, P.f6, P.rem);
      mira = V(0.3, 0.6, -0.3); pos = mira.clone().add(V(13.0 * z, 8.5 * z, 4.0 * z));
    } else {                                      // 7. remate: el cuidacoches te señala el cartel
      const g = k.suave((t - P.rem) / 0.7);
      mira = V(k.lerp(0.3, 0.55, g), k.lerp(0.6, 1.45, g), k.lerp(-0.3, -1.65, g));
      pos = mira.clone().add(V(k.lerp(13.0, 4.2, g), k.lerp(8.5, 0.9, g), k.lerp(4.0, 6.2, g)));
    }
    cam.position.copy(pos); cam.lookAt(mira); cam.updateProjectionMatrix(); cam.updateMatrixWorld();
  }

  function ubicar(p, x, z, rot, y = 0) { p.position.set(x, y, z); p.rotation.set(0, rot, 0); }

  return {
    get duracion() { return P.cierre + 2.8; },
    get cierre() { return P.cierre; },
    get efectos() {
      const r = x => +x.toFixed(2);
      return [
        { efecto: 'motor', t: r(0.2), db: -24 },
        { efecto: 'latigazo', t: r(P.f2 - 0.2), db: -19 },
        { efecto: 'frenada', t: r(P.rueda - 0.3), db: -18 },
        { efecto: 'golpe', t: r(P.rueda), db: -15 },
        { efecto: 'latigazo', t: r(P.f3 - 0.2), db: -19 },
        { efecto: 'chapa', t: r(P.toca), db: -12 },
        { efecto: 'falla', t: r(P.toca + 0.15), db: -17 }, { efecto: 'falla', t: r(P.toca + 1.05), db: -18 },
        { efecto: 'latigazo', t: r(P.f4 - 0.2), db: -19 },
        { efecto: 'bocina', t: r(P.fila - 0.3), db: -15 }, { efecto: 'bocina', t: r(P.fila + 0.25), db: -16 }, { efecto: 'bocina', t: r(P.fila + 0.8), db: -15 }, { efecto: 'bocina', t: r(P.fila + 1.4), db: -17 },
        { efecto: 'latigazo', t: r(P.f5 - 0.2), db: -19 },
        { efecto: 'pop', t: r(P.precio - 0.15), db: -16 },
        { efecto: 'campanita', t: r(P.precio + 0.05), db: -18 },
        { efecto: 'latigazo', t: r(P.f6 - 0.2), db: -19 },
        { efecto: 'acierto', t: r(P.listo), db: -16 },
        { efecto: 'latigazo', t: r(P.rem - 0.2), db: -19 },
        { efecto: 'tic', t: r(P.senala), db: -14 }, { efecto: 'tic', t: r(P.senala + 0.25), db: -14 },
        { efecto: 'golpe', t: r(P.cierre + 0.1), db: -14 },
      ];
    },
    armar(kit) {
      k = kit; tiempos();
      const T = k.THREE;
      k.sol.position.set(8, 13, 6); k.sol.color.set('#FFF4DF');
      k.escena.background = new T.Color('#BFE0F2'); k.escena.fog.color.set('#BFE0F2');
      calle();
      autoA = k.auto({ color: '#3D6E9E' }); autoA.position.set(A.x, 0, ZE);
      autoB = k.auto({ color: '#E3B23C' }); autoB.position.set(B.x, 0, ZE);
      // las balizas del de atrás (titilan cuando le salta la alarma)
      [[1.82, 0.7], [1.82, -0.7], [-1.82, 0.7], [-1.82, -0.7]].forEach(([x, z]) => balizas.push(k.caja(0.06, 0.1, 0.18, '#FFB238', B.x + x, 0.78, ZE + z, k.escena, false)));
      yo = autoPropio();
      // la fila de autos que tocan bocina
      ['#2B7E62', '#8E9490', '#7A4E8C', '#F2F2EE'].forEach(col => fila.push(k.auto({ color: col })));
      // el cuidacoches (testigo): chaleco naranja y franela roja
      cuida = k.personaje({ ropa: '#F28C28', pantalon: '#3A3F42', pelo: '#3A2A1E', piel: '#C9956E', zapatillas: '#2A2E2C', gorra: '#2E3F66' });
      franela = k.caja(0.06, 0.32, 0.22, '#C8433A', 0, -0.82, 0.05, cuida.userData.brazoD, false);
      url = k.etiquetaUrl();
      etqCordon = k.etiqueta('Cordón: 1 · Vos: 0');
      etqAlarma = k.etiqueta('Alarma: 120 dB');
      etqFila = k.etiqueta('Fila: hasta la esquina');
      etqCartel = k.etiqueta('Lugar: prohibido estacionar');
      card = k.tarjeta(`<div class="sello">Precio<br>de<br>referencia</div>
        <div class="t-et">CLASE DE MANEJO (1 HORA)</div>
        <div class="t-precio">$35.000<span>a</span>$49.000</div>
        <div class="t-nota">Noviembre 2026 · AMBA · por clase</div>`);
      chip = k.tarjeta(`<div class="ok">✓</div><div><div class="c1">Pedido publicado gratis</div><div class="c2">Clases de manejo · tu zona</div></div>`, 'chip3d');
      fin = k.cierre('Pedí presupuestos', 'de gente de tu zona');
    },
    animar(t) {
      const UC = cuida.userData, V3 = k.THREE.Vector3;

      // ---- tu auto ----
      const p = posAuto(t);
      yo.position.set(p.x, p.y, p.z); yo.rotation.set(p.roll, p.yaw, p.pitch);
      cabYo.rotation.set(0, t > P.rueda && t < P.f5 ? 0.4 * Math.sin(t * 7) : 0, 0);      // sacudís la cabeza
      cabInstr.visible = t >= P.f5 + 0.6;
      // las ruedas giran según cuánto avanza el auto (aproximado con el tiempo de cada tramo)
      yo.userData.ruedas.forEach(r => { r.rotation.z = -t * 4 * (t < P.f2 || (t > P.f6 && t < P.listo) ? 1 : 0.4); });

      // ---- el de atrás: se sacude y le titilan las balizas ----
      const golpe = t >= P.toca ? Math.exp(-(t - P.toca) * 5) : 0;
      autoB.position.set(B.x - 0.06 * golpe * Math.sin((t - P.toca) * 35), 0, ZE);
      autoB.rotation.set(0.04 * golpe * Math.sin((t - P.toca) * 30), 0, 0);
      const alarma = t >= P.toca && t < P.f5;
      balizas.forEach(b => { b.visible = alarma && Math.floor((t - P.toca) * 3) % 2 === 0; });

      // ---- la fila de autos detrás tuyo, hasta la esquina ----
      fila.forEach((f, i) => {
        const llega = P.f4 - 0.2 + i * 0.35, destino = -3.6 - i * 4.1;
        const u = k.clamp((t - llega) / 1.2);
        f.visible = t >= P.f4 - 0.3 && t < P.f6;
        f.position.set(k.lerp(-24, destino, k.suave(u)), 0, CARRIL + (i % 2 ? 0.1 : -0.1));
        f.rotation.set(0, 0, 0);
        const bocina = t > P.fila - 0.3 && t < P.f5 && Math.floor((t + i * 0.3) * 4) % 3 === 0;
        f.scale.set(1, bocina ? 1.04 : 1, 1);
      });

      // ---- el cuidacoches (testigo) ----
      UC.cadera.position.set(0, 0.92, 0); UC.cadera.rotation.set(0, 0, 0);
      const alAuto = Math.atan2(yo.position.x - CUIDA.x, yo.position.z - CUIDA.z);
      if (t < P.f2) {                                       // "dale, dale, dale" con la franela
        ubicar(cuida, CUIDA.x, CUIDA.z, alAuto, VY);
        k.pose(cuida, {}); UC.brazoD.rotation.set(-2.2 + 0.5 * Math.sin(t * 9), 0, -0.3); UC.brazoI.rotation.set(-0.3, 0, 0.3);
      } else if (t < P.f3) {                                // la rueda en la vereda: se agarra la cabeza
        ubicar(cuida, CUIDA.x, CUIDA.z, alAuto, VY);
        if (t < P.rueda) { k.pose(cuida, {}); UC.brazoD.rotation.set(-2.0 + 0.6 * Math.sin(t * 12), 0, -0.3); }
        else k.pose(cuida, { manosCabeza: t });
      } else if (t < P.f4) {                                // el paragolpes: se tapa los ojos
        ubicar(cuida, CUIDA.x, CUIDA.z, alAuto, VY);
        k.pose(cuida, { cabezaX: 0.3 });
        if (t >= P.toca) { UC.brazoI.rotation.set(-2.5, 0, -0.35); UC.brazoD.rotation.set(-2.5, 0, 0.35); }
        else { UC.brazoD.rotation.set(-1.9 + 0.5 * Math.sin(t * 10), 0, -0.3); }
      } else if (t < P.f6) {                                // la fila: se sienta en el cordón, entregado
        ubicar(cuida, CUIDA.x - 0.2, CORDON - 0.25, alAuto + 0.4, VY);
        k.pose(cuida, { cabezaX: 0.35 }); UC.cadera.position.y = 0.45; UC.piernaI.rotation.x = UC.piernaD.rotation.x = -1.45;
        UC.brazoI.rotation.set(-1.4, 0, 0.2); UC.brazoD.rotation.set(-1.9, 0, -0.1);
        if (t >= P.f5) { UC.brazoI.rotation.set(-0.2, 0, 0.3); UC.brazoD.rotation.set(-0.2, 0, -0.3); }
      } else if (t < P.rem) {                               // a la primera: se para y aplaude
        ubicar(cuida, CUIDA.x, CUIDA.z, alAuto, VY);
        k.pose(cuida, t >= P.listo - 0.3 ? { aplaudir: t } : {});
        if (t < P.listo - 0.3) { UC.brazoD.rotation.set(-2.2 + 0.5 * Math.sin(t * 9), 0, -0.3); }
      } else {                                              // remate: deja de aplaudir y te señala el cartel
        ubicar(cuida, CUIDA.x, CUIDA.z, t < P.senala ? alAuto : Math.atan2(CARTEL.x - CUIDA.x, CARTEL.z - CUIDA.z) + 0.6, VY);
        if (t < P.senala) k.pose(cuida, { aplaudir: t });
        else { k.pose(cuida, { cabezaZ: 0.2 * Math.sin(t * 6) }); UC.brazoD.rotation.set(-1.6, 0, -0.5); UC.brazoI.rotation.set(-0.2, 0, 0.6 + 0.2 * Math.sin(t * 8)); }
      }

      camara(t);

      // ---- carteles y textos ----
      yo.updateMatrixWorld(true);
      const trasera = new V3(-1.5, 0.3, -0.6).applyMatrix4(yo.matrixWorld);
      etqCordon.animar(t, P.rueda + 0.3, P.f3 + 0.05, { x: trasera.x, y: trasera.y, z: trasera.z }, -40, -360);
      etqAlarma.animar(t, P.toca + 0.35, P.f4 + 0.05, { x: B.x, y: 1.4, z: ZE }, 60, -330);
      etqFila.animar(t, P.fila + 0.4, P.f5 + 0.05, { x: fila[1].position.x, y: 1.4, z: CARRIL }, 70, -170);
      etqCartel.animar(t, P.senala + 0.4, P.cierre + 0.2, { x: CARTEL.x, y: VY + 2.1, z: CARTEL.z }, 50, -300);
      k.mostrar(card, t, P.precio - 0.15, P.f6 - 0.05);
      k.mostrar(chip, t, P.listo + 0.1, P.rem + 0.4);
      url.style.opacity = t < P.cierre ? 1 : 0;
      fin.animar(t, P.cierre);
    },
  };
})();
