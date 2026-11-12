/* Escena del video 3D de albañilería (comun-3d.js). Cada red tiene su HTML
   (video-3d-albanil-tt/ig/fb.html) que solo define window.RED.
   Dos ambientes pegados: tu living (adelante) y, del otro lado de la pared, el
   del vecino, con su sillón, su diario y su cuadro. La pared, en la zona del
   cuadro, está hecha de baldosas de revoque, ladrillos y el revoque del vecino,
   para que se pueda romper de a pedazos y volver a armar.
   Historia en escalera, graciosa: querés colgar un cuadro con el taladro del
   vecino; el taladro se traba y el agujero queda torcido; lo agrandás y se cae
   medio revoque (del otro lado, al vecino se le cae el cuadro y se acerca a
   escuchar); das un golpe más y el vecino aparece por el agujero y te saluda.
   Con el precio, el vecino se lleva su taladro por el agujero y el albañil lo
   tapa. Cuadro colgado y derecho. Remate: del otro lado, el vecino ofendido,
   con su taladro y un parche gris en su pared. Testigo: el vecino. */
window.ESCENA3D = (function () {
  let k, yo, tal, talVec, vecino, diario, alb, baldeA, cuadro, cuadroVec, sillonV;
  let card, chip, fin, url, etqTaladro, etqRevoque, etqOfendido, marca, hoyito;
  const tiles = [], nuevos = [], ladrillos = [], ladNuevos = [], vecTiles = [], parches = [], grietas = [], grietasVec = [];
  const P = {};
  const CARA = -1.9, DORSO = -2.1, H = 2.6;           // la pared compartida: tu cara (z -1,9) y la del vecino (z -2,1)
  const HX = 0, HY = 1.68;                            // donde va el cuadro (y el agujero)
  const R0 = { x0: -0.5, x1: 0.5, y0: 1.28, y1: 2.08 };  // zona que se rompe: 10 x 8 baldosas de 0,1
  const YO_PARED = { x: 0.41, z: -0.8 }, YO_PASE = { x: 0.41, z: -0.98 }, YO_LADO = { x: -1.05, z: -0.5 };
  const ALB = { x: 0.78, z: -1.0 }, PUERTA = { x: 2.7, z: 0.6 };
  const SILLON = { x: -0.75, z: -3.35 }, VEC_PARED = { x: 0, z: -2.42 }, VEC_ATRAS = { x: 0, z: -2.78 }, VEC_FIN = { x: 0.62, z: -3.0 };
  const PARED_YO = '#E8DCC4', PARED_VEC = '#BFD6E2';

  function tiempos() {
    P.f2 = k.frase(2, 3.6);        // el taladro se traba
    P.f3 = k.frase(3, 7.4);        // lo agrandás: se cae el revoque
    P.f4 = k.frase(4, 11.2);       // un golpe más: el vecino
    P.f5 = k.frase(5, 15.4);       // el precio
    P.f6 = k.frase(6, 20.6);       // pedilo gratis
    P.c1b = Math.min(k.palabra('vecino', 1, 2.5) + 0.1, P.f2 - 0.7);   // corte al vecino leyendo
    P.traba = k.palabra('traba', 1, P.f2 + 1.0);
    P.agr = k.palabra('agrandás', 1, P.f3 + 0.3);
    P.revoque = k.palabra('pared', 1, P.f3 + 2.4);
    P.golpe = k.palabra('golpe', 1, P.f4 + 0.6);
    P.c3b = Math.max(P.revoque + 0.45, Math.min(P.revoque + 0.7, P.golpe - 1.0));                // corte al vecino: se le cae el cuadro
    P.imp = P.golpe + 0.28;                                         // el golpe abre el agujero
    P.saluda = Math.max(P.imp + 0.6, k.palabra('saluda', 1, P.imp + 1.0));
    P.precio = k.palabra('cincuenta', 1, P.f5 + 2.0);
    P.pase = P.f5 + 0.5;           // el vecino se lleva su taladro por el agujero
    P.al0 = P.f5 + 0.35; P.al1 = P.al0 + 1.3;                      // entra el albañil
    P.a0 = P.al1 + 0.1;
    P.lleno = Math.max(P.a0 + 1.2, Math.min(P.a0 + 2.6, P.f6 - 0.15));
    P.cuelga = P.f6 + 0.2;
    P.fin = k.finVoz(25);
    P.cierre = P.fin + 0.35;
    P.rem = Math.min(P.f6 + 1.35, P.cierre - 1.3);                 // remate: el vecino, del otro lado
  }

  function cuarto() {
    const T = k.THREE, c = (w, h, d, col, x, y, z, s = true) => k.caja(w, h, d, col, x, y, z, k.escena, s);
    const piso = new T.Mesh(new T.PlaneGeometry(80, 80), k.mat('#9EA6A0'));
    piso.rotation.x = -Math.PI / 2; piso.position.y = -0.04; piso.receiveShadow = true; k.escena.add(piso);
    // tu living: piso de madera; el del vecino: baldosas
    c(4.2, 0.1, 4.3, '#B98A5E', 0, -0.03, 0.25, false);
    for (let i = 1; i < 8; i++) c(0.02, 0.012, 4.3, '#A57A50', -2.1 + i * 0.52, 0.025, 0.25, false);
    for (let i = 0; i < 9; i++) for (let j = 0; j < 7; j++) c(0.46, 0.1, 0.44, (i + j) % 2 ? '#D9D6CC' : '#B9B4A6', -2.0 + i * 0.47, -0.03, -2.35 - j * 0.45, false);
    // la pared compartida, menos la zona que se rompe
    const lado = (x0, x1, y0, y1) => {
      c(x1 - x0, y1 - y0, 0.17, PARED_YO, (x0 + x1) / 2, (y0 + y1) / 2, -1.985);
      c(x1 - x0, y1 - y0, 0.03, PARED_VEC, (x0 + x1) / 2, (y0 + y1) / 2, -2.085);
    };
    lado(-2.1, R0.x0, 0, H); lado(R0.x1, 2.1, 0, H); lado(R0.x0, R0.x1, 0, R0.y0); lado(R0.x0, R0.x1, R0.y1, H);
    c(4.2, 0.1, 0.04, '#F2EFE6', 0, 0.05, CARA + 0.02);              // zócalo tuyo
    c(4.2, 0.1, 0.04, '#E9EEF0', 0, 0.05, DORSO - 0.02);             // zócalo del vecino
    c(4.3, 0.06, 0.24, '#8C877C', 0, H + 0.03, -2.0, false);          // borde de arriba
    // tu living: pared izquierda corta, sillón, planta y lámpara
    c(0.16, H, 2.2, '#E2D6BE', -2.05, H / 2, -0.8);
    c(0.8, 0.42, 1.6, '#3F6E8C', -1.5, 0.21, 0.35); c(0.22, 0.8, 1.6, '#355E78', -1.85, 0.52, 0.35);
    c(0.8, 0.28, 0.2, '#355E78', -1.5, 0.5, -0.5); c(0.8, 0.28, 0.2, '#355E78', -1.5, 0.5, 1.2);
    const maceta = new T.Mesh(new T.CylinderGeometry(0.17, 0.13, 0.34, 10), k.mat('#B8693F'));
    maceta.position.set(1.65, 0.17, -1.55); maceta.castShadow = true; k.escena.add(maceta);
    c(0.12, 0.7, 0.12, '#3F7F4E', 1.65, 0.7, -1.55); c(0.4, 0.3, 0.4, '#4C9460', 1.65, 1.05, -1.55); c(0.28, 0.26, 0.28, '#5BA56E', 1.6, 1.3, -1.5);
    // el living del vecino: paredes celestes, sillón, lámpara de pie y una mesita con el mate
    c(0.16, H, 3.2, PARED_VEC, -2.05, H / 2, -3.7); c(0.16, H, 3.2, PARED_VEC, 2.05, H / 2, -3.7);
    sillonV = new T.Group();
    k.caja(0.95, 0.42, 0.85, '#7B4B3A', 0, 0.21, 0, sillonV); k.caja(0.95, 0.66, 0.2, '#6A3F31', 0, 0.68, -0.33, sillonV);
    k.caja(0.17, 0.26, 0.85, '#6A3F31', -0.4, 0.55, 0, sillonV); k.caja(0.17, 0.26, 0.85, '#6A3F31', 0.4, 0.55, 0, sillonV);
    sillonV.position.set(SILLON.x, 0, SILLON.z); sillonV.rotation.y = 2.42; k.escena.add(sillonV);
    const pie = new T.Mesh(new T.CylinderGeometry(0.025, 0.025, 1.5, 6), k.mat('#2A2E2C')); pie.position.set(-1.55, 0.75, -2.75); k.escena.add(pie);
    const pantalla = new T.Mesh(new T.CylinderGeometry(0.16, 0.24, 0.26, 10), k.mat('#F1E3B8')); pantalla.position.set(-1.55, 1.55, -2.75); pantalla.castShadow = true; k.escena.add(pantalla);
    c(0.45, 0.5, 0.45, '#8C6A4E', 0.35, 0.25, -3.55);
    const mate = new T.Mesh(new T.CylinderGeometry(0.06, 0.05, 0.12, 8), k.mat('#6B4A2E')); mate.position.set(0.35, 0.56, -3.55); k.escena.add(mate);
    c(0.015, 0.16, 0.015, '#C9CDCF', 0.37, 0.66, -3.55, false);
  }

  // la zona que se rompe: tu revoque (baldosas), los ladrillos y el revoque del vecino
  function zona() {
    const az = k.azar(31);
    const dTile = (x, y, rx, ry) => ((x - HX) / rx) ** 2 + ((y - HY) / ry) ** 2;
    for (let i = 0; i < 10; i++) for (let j = 0; j < 8; j++) {
      const x = R0.x0 + (i + 0.5) * 0.1, y = R0.y0 + (j + 0.5) * 0.1;
      const m = k.caja(0.1, 0.1, 0.03, PARED_YO, x, y, -1.915, k.escena, false);
      const d = dTile(x, y, 0.44, 0.36);
      const cae = d < 1;
      let t0 = 0;
      if (cae) t0 = d < 0.32 ? k.lerp(P.agr + 0.35, P.agr + 1.3, d / 0.32) : k.lerp(P.revoque - 0.35, P.revoque + 0.3, az());
      tiles.push({ m, x, y, cae, t0, v: { x: (x - HX) * 0.9, y: k.lerp(0.2, 0.9, az()), z: k.lerp(0.35, 0.9, az()) },
        giro: { x: k.lerp(5, 9, az()), y: k.lerp(-3, 3, az()), z: k.lerp(-4, 4, az()) }, ry: k.lerp(-1, 1, az()) });
      if (cae) { const n = k.caja(0.1, 0.1, 0.03, PARED_YO, x, y, -1.915, k.escena, false); n.visible = false; nuevos.push({ m: n, x, y }); }
      // el revoque del vecino
      const mv = k.caja(0.1, 0.1, 0.03, PARED_VEC, x, y, -2.085, k.escena, false);
      const sale = dTile(x, y, 0.3, 0.25) < 1;
      vecTiles.push({ m: mv, x, y, sale, del: az() * 0.08, v: { x: (x - HX) * 3, y: k.lerp(0.3, 1.2, az()), z: -k.lerp(1.3, 2.4, az()) },
        giro: { x: k.lerp(-8, 8, az()), y: k.lerp(-4, 4, az()), z: k.lerp(-6, 6, az()) }, ry: k.lerp(-1, 1, az()) });
      if (sale) { const g = k.caja(0.1, 0.1, 0.03, '#A7A49C', x, y, -2.085, k.escena, false); g.visible = false; parches.push({ m: g, x, y }); }
    }
    // los ladrillos (aparejo trabado: una hilada corrida media pieza)
    const rojos = ['#B5583A', '#A44E33', '#BE6444'];
    for (let j = 0; j < 8; j++) {
      const y = R0.y0 + (j + 0.5) * 0.1, cortes = j % 2 ? [-0.5, -0.4, -0.2, 0, 0.2, 0.4, 0.5] : [-0.5, -0.3, -0.1, 0.1, 0.3, 0.5];
      for (let n = 0; n < cortes.length - 1; n++) {
        const x0 = cortes[n], x1 = cortes[n + 1], x = (x0 + x1) / 2, w = x1 - x0;
        const m = k.caja(w - 0.004, 0.096, 0.14, rojos[Math.floor(az() * 3)], x, y, -2.0, k.escena, false);
        const sale = dTile(x, y, 0.3, 0.22) < 1;
        ladrillos.push({ m, x, y, w, sale, del: az() * 0.08, v: { x: (x - HX) * 2.5, y: k.lerp(0.4, 1.3, az()), z: -k.lerp(1.0, 2.0, az()) },
          giro: { x: k.lerp(-7, 7, az()), y: k.lerp(-4, 4, az()), z: k.lerp(-6, 6, az()) }, ry: k.lerp(-1.2, 1.2, az()) });
        if (sale) { const nl = k.caja(w - 0.004, 0.096, 0.14, '#B5583A', x, y, -2.0, k.escena, false); nl.visible = false; ladNuevos.push({ m: nl, x, y }); }
      }
    }
    // la marca en lápiz, el agujerito torcido y las grietas (tu lado) y las grietas del lado del vecino
    marca = new k.THREE.Group(); k.escena.add(marca);
    k.caja(0.09, 0.012, 0.004, '#3A3F3C', 0, 0, 0, marca, false).rotation.z = 0.78;
    k.caja(0.09, 0.012, 0.004, '#3A3F3C', 0, 0, 0, marca, false).rotation.z = -0.78;
    marca.position.set(HX, HY, CARA + 0.003);
    hoyito = k.caja(0.045, 0.03, 0.006, '#2A2420', HX + 0.01, HY - 0.01, CARA + 0.004, k.escena, false); hoyito.rotation.z = 0.26;
    [[0.06, -0.03, 0.12, 0.5], [0.15, -0.09, 0.12, -0.3], [-0.05, 0.05, 0.1, 0.9], [-0.12, 0.13, 0.1, 0.3]].forEach(([dx, dy, l, r]) => {
      const g = k.caja(l, 0.008, 0.004, '#4A403A', HX + dx, HY + dy, CARA + 0.004, k.escena, false); g.rotation.z = r; grietas.push(g);
    });
    [[0.0, 0.05, 0.3, 0.4], [0.18, -0.08, 0.26, -0.5], [-0.2, -0.04, 0.24, 0.2], [0.08, 0.2, 0.2, 1.2], [-0.12, -0.2, 0.22, -1.0]].forEach(([dx, dy, l, r]) => {
      const g = k.caja(l, 0.012, 0.004, '#5A6A72', HX + dx, HY + dy, DORSO - 0.004, k.escena, false); g.rotation.z = r; grietasVec.push(g);
    });
  }

  // algo que sale volando o se cae y queda en el piso (posición y giro solo desde t)
  function caer(m, p0, v, giro, t, t0, piso, rotFin) {
    const e = t - t0;
    if (e <= 0) { m.position.set(p0.x, p0.y, p0.z); m.rotation.set(0, 0, 0); return; }
    const tl = (v.y + Math.sqrt(v.y * v.y + 2 * 9.8 * (p0.y - piso))) / 9.8, ee = Math.min(e, tl);
    m.position.set(p0.x + v.x * ee, p0.y + v.y * ee - 4.9 * ee * ee, p0.z + v.z * ee);
    if (e < tl) m.rotation.set(giro.x * e, giro.y * e, giro.z * e);
    else m.rotation.set(rotFin.x, rotFin.y, rotFin.z);
  }

  function cuadroNuevo(marco, tela) {
    const g = new k.THREE.Group();
    k.caja(0.62, 0.47, 0.04, marco, 0, 0, 0, g);
    k.caja(0.54, 0.39, 0.012, tela, 0, 0, 0.022, g, false);
    k.escena.add(g); return g;
  }

  function camara(t) {
    const cam = k.camara, V = (x, y, z) => new k.THREE.Vector3(x, y, z);
    let pos, mira;
    const z1 = (a, b, x0, x1) => k.lerp(a, b, k.suave((t - x0) / Math.max(0.3, x1 - x0)));
    if (t < P.c1b) {                              // 1a. tu living: el taladro (del vecino) y la pared
      const z = z1(1, 0.9, 0, P.c1b);
      mira = V(0.2, 1.2, -1.3); pos = mira.clone().add(V(2.3 * z, 1.0 * z, 6.4 * z));
    } else if (t < P.f2) {                        // 1b. del otro lado: el vecino lee el diario
      const z = z1(1, 0.94, P.c1b, P.f2);
      mira = V(-0.5, 1.0, -3.0); pos = mira.clone().add(V(2.3 * z, 0.9 * z, -3.6 * z));
    } else if (t < P.f3) {                        // 2. taladrás: se traba y el agujero queda torcido
      const z = z1(1, 0.86, P.f2, P.f3);
      mira = V(0.1, 1.4, -1.6); pos = mira.clone().add(V(-2.8 * z, 0.4 * z, 5.0 * z));
    } else if (t < P.c3b) {                       // 3a. lo agrandás y se cae medio revoque
      const z = z1(1, 0.93, P.f3, P.c3b);
      mira = V(0.1, 1.15, -1.5); pos = mira.clone().add(V(-2.4 * z, 0.9 * z, 5.6 * z));
    } else if (t < P.golpe - 0.05) {              // 3b. del otro lado: se le cae el cuadro y va a escuchar
      const z = z1(1, 0.92, P.c3b, P.golpe);
      mira = V(-0.3, 1.2, -2.7); pos = mira.clone().add(V(2.0 * z, 0.55 * z, -3.9 * z));
    } else if (t < P.f5) {                        // 4. un golpe más: el vecino por el agujero
      const z = z1(1, 0.9, P.golpe, P.f5);
      mira = V(0.05, 1.55, -1.8); pos = mira.clone().add(V(-1.7 * z, 0.2 * z, 3.6 * z));
    } else if (t < P.f6) {                        // 5. el precio: se lleva el taladro y el albañil lo tapa
      const z = z1(1, 0.95, P.f5, P.f6);
      mira = V(0.1, 1.05, -1.3); pos = mira.clone().add(V(-1.3 * z, 1.4 * z, 7.0 * z));
    } else if (t < P.rem) {                       // 6. el cuadro, colgado y derecho
      const z = z1(1, 0.94, P.f6, P.rem);
      mira = V(-0.3, 1.2, -1.4); pos = mira.clone().add(V(-0.6 * z, 0.9 * z, 8.0 * z));
    } else {                                      // 7. remate: el vecino, ofendido, con su taladro
      const z = z1(1, 0.88, P.rem, P.cierre);
      mira = V(0.35, 1.3, -2.9); pos = mira.clone().add(V(0.9 * z, 0.5 * z, -4.3 * z));
    }
    cam.position.copy(pos); cam.lookAt(mira); cam.updateProjectionMatrix(); cam.updateMatrixWorld();
  }
  function andar(p, A, B, t, t0, t1) {
    const u = k.clamp((t - t0) / (t1 - t0)), d = Math.hypot(B.x - A.x, B.z - A.z);
    p.position.set(k.lerp(A.x, B.x, u), 0, k.lerp(A.z, B.z, u));
    return { andando: t > t0 && t < t1, rumbo: Math.atan2(B.x - A.x, B.z - A.z), paso: u * d / 0.95, u };
  }

  // el vecino sentado en su sillón (piernas al frente, cadera baja)
  function sentar(p) { const u = p.userData; u.cadera.position.y = 0.6; u.piernaI.rotation.x = u.piernaD.rotation.x = -1.45; }

  return {
    get duracion() { return P.cierre + 2.8; },
    get cierre() { return P.cierre; },
    get efectos() {
      const r = x => +x.toFixed(2);
      return [
        { efecto: 'latigazo', t: r(P.c1b - 0.2), db: -21 },
        { efecto: 'latigazo', t: r(P.f2 - 0.2), db: -19 },
        { efecto: 'falla', t: r(P.traba - 0.05), db: -15 },
        { efecto: 'pop', t: r(P.agr + 0.45), db: -20 }, { efecto: 'pop', t: r(P.agr + 0.9), db: -20 },
        { efecto: 'lluvia', t: r(P.revoque - 0.4), db: -27 },
        { efecto: 'tic', t: r(P.revoque + 0.15), db: -18 }, { efecto: 'tic', t: r(P.revoque + 0.35), db: -18 }, { efecto: 'tic', t: r(P.revoque + 0.55), db: -18 },
        { efecto: 'latigazo', t: r(P.c3b - 0.2), db: -19 },
        { efecto: 'golpe', t: r(P.c3b + 0.55), db: -20 },
        { efecto: 'latigazo', t: r(P.golpe - 0.25), db: -19 },
        { efecto: 'golpe', t: r(P.imp), db: -13 },
        { efecto: 'pop', t: r(P.saluda), db: -17 },
        { efecto: 'latigazo', t: r(P.f5 - 0.2), db: -19 },
        { efecto: 'pop', t: r(P.pase), db: -18 },
        { efecto: 'pop', t: r(P.precio - 0.15), db: -16 },
        { efecto: 'campanita', t: r(P.precio + 0.05), db: -18 },
        { efecto: 'sello', t: r(P.precio + 0.3), db: -18 },
        ...[0, 1, 2, 3].map(i => ({ efecto: 'tic', t: r(P.a0 + 0.3 + i * (P.lleno - P.a0 - 0.3) / 4), db: -20 })),
        { efecto: 'latigazo', t: r(P.f6 - 0.2), db: -19 },
        { efecto: 'pop', t: r(P.cuelga), db: -15 },
        { efecto: 'latigazo', t: r(P.rem - 0.2), db: -19 },
        { efecto: 'golpe', t: r(P.cierre + 0.1), db: -14 },
      ];
    },
    armar(kit) {
      k = kit; tiempos();
      k.sol.position.set(4, 15, 10);
      const luz2 = new k.THREE.DirectionalLight('#FFF4DF', 1.3); luz2.position.set(-3, 12, -14); k.escena.add(luz2);
      cuarto(); zona();
      // vos (remera naranja), con el taladro (del vecino)
      yo = k.personaje({ ropa: '#C8553D', pantalon: '#3C4A66', pelo: '#3A2418' });
      tal = k.taladro(yo.userData.brazoD);
      // el vecino: bajito, de pelo gris, bigote y camisa a cuadros (beige), con su diario
      vecino = k.personaje({ ropa: '#D9C9A3', pantalon: '#6B5B4B', zapatillas: '#5A3E2B', pelo: '#BDBDBA', piel: '#E0B28C' });
      vecino.scale.setScalar(0.85);
      k.caja(0.22, 0.05, 0.03, '#9C9A96', 0, 0.17, 0.235, vecino.userData.cuello, false);   // el bigote
      talVec = k.taladro(vecino.userData.brazoD);
      diario = new k.THREE.Group(); vecino.add(diario);
      k.caja(0.62, 0.44, 0.015, '#EDEBE4', 0, 0, 0, diario, false);
      [0.12, 0.04, -0.04, -0.12].forEach(y => k.caja(0.24, 0.025, 0.004, '#8E908C', -0.15, y, 0.01, diario, false));
      [0.12, 0.02, -0.08].forEach(y => k.caja(0.22, 0.06, 0.004, '#B9BBB6', 0.16, y, 0.01, diario, false));
      // el albañil (gorra verde), con la cuchara
      alb = k.personaje({ ropa: '#8A8F94', pantalon: '#4D5A6B', zapatillas: '#2A2E2C', piel: '#C9956E', pelo: '#2B1D16', gorra: k.C.verde });
      k.llaveInglesa(alb.userData.brazoD).position.set(0, -0.62, 0);
      baldeA = k.balde('#8E9490'); baldeA.userData.nivel(0.8); baldeA.position.set(0.98, 0, -1.3);
      // los cuadros: el tuyo (apoyado en el piso) y el del vecino (en su pared)
      cuadro = cuadroNuevo('#5A3E2B', '#E7B85C');
      k.caja(0.14, 0.14, 0.01, '#F4F2EC', 0.1, 0.06, 0.03, cuadro, false); k.caja(0.54, 0.12, 0.01, '#3F7F4E', 0, -0.135, 0.03, cuadro, false);
      cuadroVec = cuadroNuevo('#C9A227', '#7FA7C2'); cuadroVec.rotation.y = Math.PI;
      k.caja(0.3, 0.06, 0.01, '#F4F2EC', 0.05, 0.05, 0.03, cuadroVec, false);
      url = k.etiquetaUrl();
      etqTaladro = k.etiqueta('Taladro: del vecino');
      etqRevoque = k.etiqueta('Pared: 50 % en el piso');
      etqOfendido = k.etiqueta('Vecino: ofendido');
      card = k.tarjeta(`<div class="sello">Precio<br>de<br>referencia</div>
        <div class="t-et">UN DÍA DE ALBAÑIL OFICIAL</div>
        <div class="t-precio">$52.000<span>a</span>$75.000</div>
        <div class="t-nota">Noviembre 2026 · AMBA · por día</div>`);
      chip = k.tarjeta(`<div class="ok">✓</div><div><div class="c1">Pedido publicado gratis</div><div class="c2">Albañilería · tu zona</div></div>`, 'chip3d');
      fin = k.cierre('Pedí presupuestos', 'de gente de tu zona');
    },
    animar(t) {
      const T = k.THREE;
      // ---- la pared ----
      const limpio = t > P.f6 + 0.1;
      for (const b of tiles) {
        if (!b.cae) { b.m.visible = true; continue; }
        b.m.visible = !limpio || t < P.f6 + 0.1;
        caer(b.m, { x: b.x, y: b.y, z: -1.915 }, b.v, b.giro, t, b.t0, 0.035, { x: Math.PI / 2, y: b.ry, z: 0 });
        if (limpio) b.m.visible = false;
      }
      for (const b of ladrillos) {
        if (!b.sale) continue;
        caer(b.m, { x: b.x, y: b.y, z: -2.0 }, b.v, b.giro, t, P.imp + b.del, 0.05, { x: 0, y: b.ry, z: 0 });
      }
      for (const b of vecTiles) {
        if (!b.sale) continue;
        caer(b.m, { x: b.x, y: b.y, z: -2.085 }, b.v, b.giro, t, P.imp + b.del, 0.035, { x: Math.PI / 2, y: b.ry, z: 0 });
      }
      // el albañil lo vuelve a armar: primero los ladrillos (de abajo para arriba), después el revoque
      const fase = (P.lleno - P.a0);
      const yMin = R0.y0, yMax = R0.y1;
      for (const b of ladNuevos) {
        const t0 = P.a0 + 0.55 * fase * k.clamp((b.y - yMin) / (yMax - yMin)), s = k.rebote((t - t0) / 0.2);
        b.m.visible = t >= t0; b.m.scale.setScalar(Math.max(0.001, Math.min(1.08, s)));
      }
      for (const b of parches) {
        const t0 = P.a0 + 0.55 * fase * k.clamp((b.y - yMin) / (yMax - yMin)); b.m.visible = t >= t0 + 0.1;
      }
      for (const b of nuevos) {
        const t0 = P.a0 + fase * (0.5 + 0.48 * k.clamp((b.x - R0.x0) / (R0.x1 - R0.x0))), s = k.rebote((t - t0) / 0.18);
        b.m.visible = t >= t0; b.m.scale.setScalar(Math.max(0.001, Math.min(1.08, s)));
      }
      const caido = t > P.revoque - 0.35;
      marca.visible = t < P.f2 + 0.3;
      hoyito.visible = t >= P.f2 + 0.3 && !caido;
      grietas.forEach((g, i) => { g.visible = t >= P.traba + i * 0.12 && !caido; });
      grietasVec.forEach((g, i) => { g.visible = t >= P.c3b + 0.15 + i * 0.1 && t < P.imp; });

      // ---- vos ----
      tal.visible = t < P.pase; talVec.visible = t >= P.pase;
      tal.rotation.z = t > P.traba && t < P.f3 ? 0.26 * k.suave((t - P.traba) / 0.3) : 0;
      if (t < P.f2 - 0.25) {
        yo.position.set(YO_PARED.x, 0, YO_PARED.z); yo.rotation.y = Math.PI;
        k.pose(yo, { cabezaX: -0.12, cabezaY: Math.sin(t * 1.6) * 0.15 });
      } else if (t < P.f3) {
        yo.position.set(YO_PARED.x, 0, YO_PARED.z); yo.rotation.y = Math.PI;
        const tr = t > P.traba ? k.suave((t - P.traba) / 0.2) : 0;
        k.pose(yo, { taladrar: t, trabado: tr });
        if (t > P.traba) yo.rotation.y = Math.PI + Math.sin(t * 31) * 0.05;
      } else if (t < P.revoque + 0.35) {
        const ox = Math.sin((t - P.f3) * 4.2) * 0.12;
        yo.position.set(YO_PARED.x + ox, 0, YO_PARED.z); yo.rotation.y = Math.PI;
        k.pose(yo, { taladrar: t, trabado: 0.35, alto: Math.cos((t - P.f3) * 4.2) * 0.1 });
      } else if (t < P.golpe - 0.05) {
        yo.position.set(YO_PARED.x, 0, YO_PARED.z); yo.rotation.y = Math.PI;
        k.pose(yo, { cabezaX: 0.3 });
      } else if (t < P.imp + 0.2) {               // el golpe: levantás el taladro y le das
        yo.position.set(YO_PARED.x, 0, YO_PARED.z); yo.rotation.y = Math.PI;
        k.pose(yo, {});
        const e = t - (P.golpe - 0.05), arriba = P.imp - (P.golpe - 0.05) - 0.08;
        const a = e < arriba ? k.lerp(-1.57, -2.7, k.suave(e / arriba)) : k.lerp(-2.7, -1.5, k.clamp((e - arriba) / 0.08));
        yo.userData.brazoD.rotation.set(a, 0, -0.05); yo.userData.brazoI.rotation.set(-1.1, 0, 0.45);
      } else if (t < P.f5) {
        yo.position.set(YO_PARED.x, 0, YO_PARED.z + (t < P.saluda ? 0.12 * k.suave((t - P.imp - 0.2) / 0.2) : 0.12));
        yo.rotation.y = Math.PI;
        if (t < P.saluda + 0.15) k.pose(yo, { salto: Math.max(0, Math.sin((t - P.imp - 0.2) * 9)) * 0.06 * (t < P.imp + 0.6 ? 1 : 0), cabezaX: 0.05 });
        else k.pose(yo, { saludo: t * 0.8 });
      } else if (t < P.pase + 0.15) {             // le pasás el taladro por el agujero
        const u = k.suave((t - P.f5) / (P.pase - P.f5));
        yo.position.set(YO_PARED.x, 0, k.lerp(YO_PARED.z + 0.12, YO_PASE.z, u)); yo.rotation.y = Math.PI;
        k.pose(yo, { taladrar: 0.0001, alto: -0.05 });
      } else {
        const a = andar(yo, YO_PASE, YO_LADO, t, P.pase + 0.15, P.pase + 1.1);
        if (a.andando) { yo.rotation.y = a.rumbo; k.pose(yo, { caminar: 1, paso: a.paso }); }
        else if (t < P.cuelga) { yo.rotation.y = Math.PI + 0.45; k.pose(yo, { brazosCruzados: true, cabezaX: -0.05 }); }
        else { yo.rotation.y = k.lerp(Math.PI + 0.45, 0.35, k.suave((t - P.cuelga) / 0.4)); k.pose(yo, { festejo: t }); }
      }

      // ---- el vecino (el testigo) ----
      const UV = vecino.userData;
      if (t < P.c3b + 0.4) {                      // sentado, leyendo
        const r = 2.42, fx = Math.sin(r) * 0.08, fz = Math.cos(r) * 0.08;
        vecino.position.set(SILLON.x + fx, 0, SILLON.z + fz); vecino.rotation.y = r;
        k.pose(vecino, { cabezaX: 0.12 }); sentar(vecino);
        UV.brazoI.rotation.set(-1.1, 0, 0.12); UV.brazoD.rotation.set(-1.1, 0, -0.12);
        const sorpresa = t > P.c3b + 0.15 ? k.suave((t - P.c3b - 0.15) / 0.15) : 0;
        if (sorpresa > 0) { UV.cuello.rotation.y = -0.8 * sorpresa; UV.cuello.rotation.x = -0.1; }
      } else if (t < P.golpe - 0.1) {             // se levanta y va a escuchar a la pared
        const a = andar(vecino, { x: SILLON.x + 0.05, z: SILLON.z + 0.06 }, VEC_PARED, t, P.c3b + 0.45, P.golpe - 0.15);
        vecino.rotation.y = a.andando ? a.rumbo : 0; k.pose(vecino, a.andando ? { caminar: 1, paso: a.paso * 1.3 } : { cabezaY: 1.3 });
      } else if (t < P.f5) {
        vecino.position.set(VEC_PARED.x, 0, VEC_PARED.z); vecino.rotation.y = 0;
        if (t < P.imp) k.pose(vecino, { cabezaY: 1.3, cabezaZ: 0.1 });            // la oreja contra la pared
        else if (t < P.saluda) k.pose(vecino, { cabezaY: 1.3 * (1 - k.suave((t - P.imp - 0.25) / 0.3)), salto: t < P.imp + 0.3 ? Math.sin((t - P.imp) * 10) * 0.05 : 0 });
        else {
          k.pose(vecino, { cabezaX: -0.05 });
          UV.brazoD.rotation.set(-2.25, 0, -0.35 + Math.sin(t * 11) * 0.3);       // te saluda por el agujero
        }
      } else if (t < P.rem - 0.1) {
        if (t < P.pase + 0.45) {                  // estira el brazo y se lleva su taladro
          vecino.position.set(VEC_PARED.x, 0, VEC_PARED.z); vecino.rotation.y = 0; k.pose(vecino, {});
          const ida = k.suave((t - P.f5) / (P.pase - P.f5)), vuelta = k.suave((t - P.pase - 0.05) / 0.35);
          UV.brazoD.rotation.set(k.lerp(-0.1, -2.0, ida) + k.lerp(0, 1.4, vuelta), 0, -0.05);
        } else {
          const a = andar(vecino, VEC_PARED, VEC_ATRAS, t, P.pase + 0.45, P.pase + 0.95);
          vecino.rotation.y = 0; k.pose(vecino, a.andando ? { caminar: 0.6, paso: -a.paso } : { cabezaX: 0.05 });
          UV.brazoD.rotation.set(-0.6, 0, -0.1);
        }
      } else {                                    // remate: ofendido, con su taladro, de espaldas a la pared
        vecino.position.set(VEC_FIN.x, 0, VEC_FIN.z);
        vecino.rotation.y = k.lerp(0.4, Math.PI - 0.35, k.suave((t - P.rem + 0.1) / 0.45));
        k.pose(vecino, { cabezaX: -0.3, cabezaY: -0.55 });
        UV.brazoI.rotation.set(-1.3, 0.6, 0.3); UV.brazoD.rotation.set(-0.35, 0, -0.08);
      }
      // el diario: en las manos; con el ruido sale volando y cae al piso
      const ed = t - P.c3b - 0.3;
      if (ed < 0) { diario.position.set(0, 1.15, 0.6); diario.rotation.set(-0.15, 0, 0); diario.visible = true; }
      else {
        const u = Math.min(ed, 0.7);
        diario.position.set(0.2 * u, 1.15 + 1.6 * u - 3.4 * u * u, 0.6 + 0.4 * u); diario.rotation.set(-0.15 + 5 * u, 2 * u, 0);
        diario.visible = ed < 0.7;
      }
      // el cuadro del vecino: salta y se cae
      const ec = t - P.c3b - 0.12;
      const base = { x: -0.95, y: 1.55, z: DORSO - 0.03 };
      if (ec < 0) { cuadroVec.position.set(base.x, base.y, base.z); cuadroVec.rotation.set(0, Math.PI, 0); }
      else if (ec < 0.25) { cuadroVec.position.set(base.x, base.y + Math.sin(ec / 0.25 * Math.PI) * 0.05, base.z); cuadroVec.rotation.set(0, Math.PI, Math.sin(ec * 40) * 0.12); }
      else { const e = Math.min(ec - 0.25, 0.42); cuadroVec.position.set(base.x, Math.max(0.24, base.y - 4.9 * e * e * 1.6), base.z - 0.12 * (e / 0.42)); cuadroVec.rotation.set(-0.25 * (e / 0.42), Math.PI, 0.1); }

      // ---- el albañil ----
      alb.visible = t >= P.al0 - 0.05;
      baldeA.visible = t >= P.al1;
      if (t < P.al1) {
        const a = andar(alb, PUERTA, ALB, t, P.al0, P.al1);
        alb.rotation.y = a.rumbo; k.pose(alb, a.andando ? { caminar: 1, paso: a.paso } : {});
      } else if (t < P.lleno + 0.1) {
        alb.position.set(ALB.x, 0, ALB.z); alb.rotation.y = Math.PI - 0.3;
        k.pose(alb, { envolver: t * 0.8 });
        alb.userData.brazoD.rotation.x -= 0.35;   // la cuchara, a la altura del agujero
      } else {
        alb.position.set(ALB.x, 0, ALB.z);
        alb.rotation.y = k.lerp(Math.PI, 0.5, k.suave((t - P.lleno - 0.1) / 0.4));
        k.pose(alb, t > P.lleno + 0.5 ? { saludo: t } : {});
      }

      // ---- tu cuadro: apoyado en el piso; con la pared lista, colgado y derecho ----
      if (t < P.cuelga) { cuadro.position.set(0.98, 0.25, CARA + 0.07); cuadro.rotation.set(-0.15, 0, 0); cuadro.scale.setScalar(1); }
      else {
        const s = k.rebote((t - P.cuelga) / 0.35);
        cuadro.position.set(HX, HY, CARA + 0.03); cuadro.rotation.set(0, 0, 0); cuadro.scale.setScalar(Math.max(0.001, s));
      }

      // ---- polvo ----

      camara(t);
      // ---- carteles y textos ----
      const pm = new T.Vector3(); tal.userData.mecha.getWorldPosition(pm);
      etqTaladro.animar(t, 0.35, P.c1b + 0.1, { x: pm.x, y: pm.y, z: pm.z }, 60, -300);
      etqRevoque.animar(t, P.revoque - 0.3, P.c3b - 0.02, { x: 0.1, y: 0.06, z: -1.45 }, 40, -330);
      const hv = new T.Vector3(); vecino.userData.cabeza.getWorldPosition(hv);
      etqOfendido.animar(t, P.rem + 0.5, P.cierre + 0.15, { x: hv.x, y: hv.y + 0.25, z: hv.z }, 150, -40);
      k.mostrar(card, t, P.precio - 0.15, P.f6 - 0.05);
      k.mostrar(chip, t, P.f6 + 0.25, P.cierre + 0.2);
      url.style.opacity = t < P.cierre ? 1 : 0;
      fin.animar(t, P.cierre);
    },
  };
})();
