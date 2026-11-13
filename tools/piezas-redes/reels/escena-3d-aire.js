/* Escena del video 3D de aire acondicionado (comun-3d.js). Cada red tiene su HTML
   (video-3d-aire-tt/ig/fb.html) que solo define window.RED.
   Una cocina comedor a las tres de la tarde, con 38 grados afuera: luz naranja, el
   sol pegando en la ventana, el termómetro de la pared en rojo y el split nuevo
   todavía en la caja, en el piso.
   Historia en escalera, graciosa: ponés el ventilador al máximo y te tira aire
   caliente en la cara; te ponés hielo en la nuca y se hace agua al toque (el gato,
   que está al lado, se moja y salta); te metés en la heladera y el gato se derrite
   en el piso como un helado. Con el precio llega el técnico, instala el split y la
   cocina se pone fresca (la luz pasa de naranja a celeste y el termómetro baja).
   Salís de la heladera con escarcha en el pelo. Remate: el gato se vuelve a armar
   (sólido otra vez) y se sienta debajo del aire. Testigo: el gato. */
window.ESCENA3D = (function () {
  let k, silla, yo, abanico, hielo, gato, charcoGato, ojosGato, charcoYo, escarcha, tec, caja, split, termo, rojo;
  let ventilador, cabezaVent, aspas, heladera, puerta, vidrio, luzHeladera, vapor, calor, frio, gotas;
  let card, chip, fin, url, etqTermo, etqCaja, etqVent, etqGato, etqSolido;
  const P = {};
  const H = 2.7, PARED = -2.0;                                   // la pared del fondo (cara en z -1,92)
  const SILLA = { x: -0.3, z: 0.25 }, CAJA = { x: 0.3, z: -0.05 };
  const YO_VENT = { x: -0.45, z: -0.55 }, VENT = { x: 0.62, z: -0.55 };
  const YO_HIELO = { x: 0.05, z: 0.5 }, GATO = { x: 0.72, z: 0.72 };
  const HEL = { x: -1.3, z: -1.55 }, HW = 1.2, HH = 2.45, HD = 0.8;  // la heladera (grandota, de dos metros y medio)
  const YO_HEL0 = { x: -1.3, z: -0.45 }, YO_HEL1 = { x: -1.3, z: -1.5 };
  const SPLIT = { x: 0.62, y: 2.22, z: -1.79 }, TEC = { x: 0.62, z: -1.12 };
  const YO_FIN = { x: 0.1, z: -0.7 }, TEC_FIN = { x: 1.25, z: -0.95 };
  const C_CALOR = { fondo: '#F0B47C', cielo: '#FFD6AE', sol: '#FFB878' };
  const C_FRIO = { fondo: '#BFE2EE', cielo: '#E6F5FF', sol: '#F4FAFF' };

  function tiempos() {
    P.f2 = k.frase(2, 3.0);        // el ventilador
    P.f3 = k.frase(3, 6.4);        // el hielo
    P.f4 = k.frase(4, 10.0);       // la heladera
    P.f5 = k.frase(5, 13.7);       // el precio
    P.f6 = k.frase(6, 18.5);       // pedilo gratis
    P.c1b = Math.min(k.palabra('caja', 1, 2.0) - 0.05, P.f2 - 0.6);          // corte a la caja del split
    P.maximo = k.palabra('máximo', 1, P.f2 + 1.2);
    P.calor = k.palabra('caliente', 1, P.f2 + 2.2);
    P.hielo = k.palabra('hielo', 1, P.f3 + 0.5);
    P.agua = k.palabra('agua', 1, P.f3 + 2.0);
    P.metes = k.palabra('metés', 1, P.f4 + 0.2);
    P.c4b = Math.max(P.metes + 1.0, k.palabra('gato', 1, P.f4 + 1.7) - 0.15);  // corte al gato
    P.derrite = k.palabra('derrite', 1, P.c4b + 0.4);
    P.split = k.palabra('split', 1, P.f5 + 0.6);
    P.instal = Math.max(P.f5 + 0.45, P.split + 0.1);                        // el split, a la pared
    P.precio = k.palabra('noventa', 1, P.f5 + 1.6);
    P.fin = k.finVoz(22.2);
    P.cierre = P.fin + 0.35;
    P.rem = Math.min(P.f6 + 1.6, P.cierre - 1.45);                          // remate: el gato
    P.reforma = P.rem + 0.3;
  }

  function cocina() {
    const T = k.THREE, c = (w, h, d, col, x, y, z, s = true) => k.caja(w, h, d, col, x, y, z, k.escena, s);
    const piso = new T.Mesh(new T.PlaneGeometry(80, 80), k.mat('#A9A391'));
    piso.rotation.x = -Math.PI / 2; piso.position.y = -0.04; piso.receiveShadow = true; k.escena.add(piso);
    // piso de baldosas en damero
    for (let i = 0; i < 9; i++) for (let j = 0; j < 8; j++)
      c(0.47, 0.1, 0.47, (i + j) % 2 ? '#E4DED0' : '#C9C1AE', -2.0 + i * 0.48, -0.03, -1.75 + j * 0.48, false);
    // paredes (verde agua): fondo e izquierda
    c(4.3, H, 0.16, '#CFE2D6', 0, H / 2, PARED);
    c(0.16, H, 3.6, '#C6DCCF', -2.12, H / 2, -0.3);
    c(4.3, 0.1, 0.04, '#F2EFE6', 0, 0.05, PARED + 0.1);
    // la ventana con el sol de frente (el vidrio cambia de color cuando llega el aire)
    c(1.0, 0.8, 0.06, '#F4F2EC', 1.5, 1.78, PARED + 0.09);
    vidrio = new T.Mesh(new T.PlaneGeometry(0.86, 0.66), new T.MeshBasicMaterial({ color: '#FFD27A' }));
    vidrio.position.set(1.5, 1.78, PARED + 0.125); k.escena.add(vidrio);
    c(0.04, 0.66, 0.02, '#F4F2EC', 1.5, 1.78, PARED + 0.13, false); c(0.86, 0.04, 0.02, '#F4F2EC', 1.5, 1.78, PARED + 0.13, false);
    // la mesada debajo de la ventana
    const m = k.mesada({ ancho: 1.15, mueble: '#E9E4D6', puertas: '#D9D1BE' }); m.position.set(1.5, 0, PARED + 0.39);
    // el termómetro de la pared (el rojo baja cuando llega el aire)
    c(0.13, 0.56, 0.03, '#F7F5EF', -0.42, 1.58, PARED + 0.1);
    c(0.035, 0.42, 0.012, '#E3E1DA', -0.42, 1.62, PARED + 0.12, false);
    rojo = c(0.03, 1, 0.014, '#D9412E', -0.42, 1.41, PARED + 0.125, false);
    const bulbo = new T.Mesh(new T.SphereGeometry(0.045, 10, 8), k.mat('#D9412E')); bulbo.position.set(-0.42, 1.38, PARED + 0.12); k.escena.add(bulbo);
    termo = { x: -0.42, y: 1.7, z: PARED + 0.12 };
    // la silla (de cocina) y una mesita con una jarra
    silla = new T.Group(); k.escena.add(silla); silla.position.set(SILLA.x, 0, SILLA.z);
    k.caja(0.5, 0.06, 0.5, '#9C6B43', 0, 0.55, 0, silla);
    [[-0.21, -0.21], [0.21, -0.21], [-0.21, 0.21], [0.21, 0.21]].forEach(([dx, dz]) => k.caja(0.05, 0.55, 0.05, '#7E5434', dx, 0.27, dz, silla));
    k.caja(0.5, 0.55, 0.05, '#9C6B43', 0, 0.85, -0.24, silla);
    c(0.6, 0.05, 0.6, '#B98A5E', -1.15, 0.72, 0.75); c(0.06, 0.7, 0.06, '#8C6440', -1.15, 0.36, 0.75);
    const jarra = new T.Mesh(new T.CylinderGeometry(0.08, 0.09, 0.24, 10), new T.MeshLambertMaterial({ color: '#BFE6F5', transparent: true, opacity: 0.7 }));
    jarra.position.set(-1.1, 0.87, 0.72); k.escena.add(jarra);
  }

  // la heladera: caja abierta por delante (se ve adentro) y la puerta con bisagra a la izquierda
  function armarHeladera() {
    const T = k.THREE, g = new T.Group(), b = (w, h, d, col, x, y, z) => k.caja(w, h, d, col, x, y, z, g);
    const fz = HD / 2;
    b(HW, HH, 0.05, '#EEF1F2', 0, HH / 2, -fz + 0.025);                         // atrás
    b(0.05, HH, HD, '#EEF1F2', -HW / 2 + 0.025, HH / 2, 0); b(0.05, HH, HD, '#EEF1F2', HW / 2 - 0.025, HH / 2, 0);
    b(HW, 0.06, HD, '#EEF1F2', 0, HH - 0.03, 0); b(HW, 0.1, HD, '#DADFE1', 0, 0.05, 0);
    b(HW - 0.1, HH - 0.16, 0.02, '#DDEFF6', 0, HH / 2, -fz + 0.06);              // adentro, celeste
    b(HW - 0.1, 0.03, HD - 0.1, '#F7FBFC', 0, 2.12, 0);                          // el estante de arriba
    // lo que hay en el estante: botellas, un sachet de leche y media sandía
    [[-0.42, '#6FB36F'], [-0.3, '#E3B23C'], [-0.18, '#D9412E']].forEach(([x, col]) => b(0.08, 0.2, 0.08, col, x, 2.24, -0.15));
    b(0.16, 0.12, 0.1, '#F4F2EC', 0.05, 2.2, -0.1);
    const sandia = new T.Mesh(new T.SphereGeometry(0.13, 10, 8, 0, Math.PI), k.mat('#3F7F4E')); sandia.position.set(0.35, 2.15, -0.1); sandia.rotation.x = -Math.PI / 2; g.add(sandia);
    luzHeladera = new T.PointLight('#DDF3FF', 0, 3); luzHeladera.position.set(0, 1.8, 0.1); g.add(luzHeladera);
    // la puerta
    puerta = new T.Group(); puerta.position.set(-HW / 2, 0, fz); g.add(puerta);
    k.caja(HW, HH, 0.07, '#F4F6F7', HW / 2, HH / 2, 0.035, puerta);
    k.caja(0.04, 0.5, 0.06, '#B9C2C6', HW - 0.12, 1.3, 0.1, puerta);              // manija
    k.caja(HW - 0.14, 0.05, 0.12, '#E2ECF0', HW / 2, 0.9, -0.07, puerta, false);   // estantes de la puerta
    k.caja(HW - 0.14, 0.05, 0.12, '#E2ECF0', HW / 2, 1.5, -0.07, puerta, false);
    [0.25, 0.42, 0.6].forEach((x, i) => k.caja(0.09, 0.22, 0.09, ['#9FD6F0', '#F4F2EC', '#E3B23C'][i], x, 1.04, -0.08, puerta, false));
    // un imán con forma de copo, de chiste
    k.caja(0.12, 0.12, 0.02, '#4C9ED9', 0.35, 1.9, 0.075, puerta, false);
    g.position.set(HEL.x, 0, HEL.z); k.escena.add(g);
    return g;
  }

  // ventilador de pie (la cabeza mira hacia +z en su grupo; la giro hacia el que está enfrente)
  function armarVentilador() {
    const T = k.THREE, g = new T.Group();
    const base = new T.Mesh(new T.CylinderGeometry(0.22, 0.25, 0.05, 14), k.mat('#3A4A52')); base.position.y = 0.025; g.add(base);
    const palo = new T.Mesh(new T.CylinderGeometry(0.025, 0.03, 1.55, 8), k.mat('#C3CBCD')); palo.position.y = 0.8; g.add(palo);
    cabezaVent = new T.Group(); cabezaVent.position.y = 1.72; g.add(cabezaVent);
    k.caja(0.16, 0.16, 0.24, '#3A4A52', 0, 0, -0.14, cabezaVent);
    [0.02, -0.06].forEach(z => {
      const aro = new T.Mesh(new T.TorusGeometry(0.3, 0.012, 6, 28), k.mat('#C3CBCD')); aro.position.z = z; cabezaVent.add(aro);
    });
    for (let i = 0; i < 6; i++) { const r = k.caja(0.6, 0.01, 0.01, '#C3CBCD', 0, 0, 0.02, cabezaVent, false); r.rotation.z = i * Math.PI / 6; }
    aspas = new T.Group(); aspas.position.z = -0.02; cabezaVent.add(aspas);
    for (let i = 0; i < 3; i++) {
      const a = new T.Group(); a.rotation.z = i * Math.PI * 2 / 3; aspas.add(a);
      k.caja(0.12, 0.25, 0.012, '#4C9ED9', 0, 0.15, 0, a, false);
    }
    k.caja(0.07, 0.07, 0.05, '#3A4A52', 0, 0, 0.0, aspas, false);
    g.position.set(VENT.x, 0, VENT.z); g.rotation.y = -Math.PI / 2;          // mira hacia -x (hacia vos)
    k.escena.add(g); return g;
  }

  // partículas que salen de un punto en una dirección (aire caliente del ventilador, aire frío del split)
  function rafaga(n, color, tam, semilla) {
    const T = k.THREE;
    const malla = new T.InstancedMesh(new T.IcosahedronGeometry(tam, 0), new T.MeshLambertMaterial({ color, transparent: true, opacity: 0.5 }), n);
    malla.frustumCulled = false; k.escena.add(malla);
    const r = k.azar(semilla), ps = []; for (let i = 0; i < n; i++) ps.push({ u: r(), a: r() * Math.PI * 2, rr: 0.4 + 0.6 * r(), w: r() });
    const m = new T.Matrix4(), q = new T.Quaternion(), p = new T.Vector3(), s = new T.Vector3();
    return {
      animar(t, desde, hasta, o, dir, largo, abre, vel) {
        const d = dir.clone().normalize(), e1 = new T.Vector3(0, 1, 0).cross(d);
        if (e1.lengthSq() < 1e-4) e1.set(1, 0, 0); e1.normalize(); const e2 = d.clone().cross(e1).normalize();
        for (let i = 0; i < n; i++) {
          const a = ps[i], s0 = (t * vel + a.u) % 1, edad = (t - desde) * vel;
          if (t < desde || t > hasta || s0 > edad) { s.set(0, 0, 0); p.set(0, -9, 0); }
          else {
            const ab = abre * s0 * a.rr, ond = Math.sin(t * 9 + a.w * 6) * 0.03;
            p.copy(o).addScaledVector(d, largo * s0).addScaledVector(e1, Math.cos(a.a) * ab + ond).addScaledVector(e2, Math.sin(a.a) * ab);
            const k2 = 0.6 + 0.9 * s0 * (1 - k.suave((s0 - 0.75) / 0.25)); s.set(k2, k2, k2);
          }
          m.compose(p, q, s); malla.setMatrixAt(i, m);
        }
        malla.instanceMatrix.needsUpdate = true;
      },
    };
  }

  // gotas que caen desde un punto (sudor, el hielo que se hace agua)
  function goteo(n, color, semilla) {
    const T = k.THREE, r = k.azar(semilla), gs = [];
    for (let i = 0; i < n; i++) gs.push({ u: r(), dx: k.lerp(-0.08, 0.08, r()), dz: k.lerp(-0.08, 0.08, r()) });
    const malla = new T.InstancedMesh(new T.BoxGeometry(0.03, 0.06, 0.03), new T.MeshLambertMaterial({ color, transparent: true, opacity: 0.9 }), n);
    malla.frustumCulled = false; k.escena.add(malla);
    const m = new T.Matrix4(), q = new T.Quaternion(), p = new T.Vector3(), s = new T.Vector3();
    return {
      animar(t, desde, hasta, o, per = 0.7) {
        for (let i = 0; i < n; i++) {
          const g = gs[i], f = ((t - desde) / per + g.u) % 1, h = o.y * f * f;
          if (t < desde || t > hasta || (t - desde) < g.u * per) { s.set(0, 0, 0); p.set(0, -9, 0); }
          else { s.set(1, 1, 1); p.set(o.x + g.dx, o.y - h, o.z + g.dz); }
          m.compose(p, q, s); malla.setMatrixAt(i, m);
        }
        malla.instanceMatrix.needsUpdate = true;
      },
    };
  }

  function camara(t) {
    const cam = k.camara, V = (x, y, z) => new k.THREE.Vector3(x, y, z);
    let pos, mira;
    const z1 = (a, b, x0, x1) => k.lerp(a, b, k.suave((t - x0) / Math.max(0.3, x1 - x0)));
    if (t < P.f2) {                               // 1. la cocina, 38 grados: vos en la silla, abanicándote, y el split en la caja
      const z = z1(1, 0.88, 0, P.f2);
      mira = V(-0.3, 1.0, -0.35); pos = mira.clone().add(V(2.2 * z, 1.15 * z, 7.3 * z));
    } else if (t < P.f3) {                        // 2. el ventilador al máximo: aire caliente en la cara
      const z = z1(1, 0.86, P.f2, P.f3);
      mira = V(0.15, 1.5, -0.55); pos = mira.clone().add(V(-1.9 * z, 0.4 * z, 5.2 * z));
    } else if (t < P.f4) {                        // 3. el hielo en la nuca (y el gato al lado)
      const z = z1(1, 0.9, P.f3, P.f4);
      mira = V(0.35, 1.05, 0.55); pos = mira.clone().add(V(-1.5 * z, 0.35 * z, 4.6 * z));
    } else if (t < P.c4b) {                       // 4a. te metés en la heladera
      const z = z1(1, 0.9, P.f4, P.c4b);
      mira = V(-1.15, 1.3, -1.2); pos = mira.clone().add(V(2.3 * z, 0.55 * z, 5.0 * z));
    } else if (t < P.f5) {                        // 4b. el gato se derrite en el piso
      const z = z1(1, 0.86, P.c4b, P.f5);
      mira = V(GATO.x, 0.2, GATO.z); pos = mira.clone().add(V(1.0 * z, 0.95 * z, 2.6 * z));
    } else if (t < P.f6) {                        // 5. el precio: llega el técnico y pone el split
      const z = z1(1, 0.94, P.f5, P.f6);
      mira = V(0.35, 1.65, -1.3); pos = mira.clone().add(V(0.7 * z, 0.3 * z, 7.6 * z));
    } else if (t < P.rem) {                       // 6. salís de la heladera con escarcha, al fresco
      const z = z1(1, 0.92, P.f6, P.rem);
      mira = V(0.45, 1.45, -0.9); pos = mira.clone().add(V(-1.1 * z, 0.45 * z, 5.6 * z));
    } else {                                      // 7. remate: el gato, sólido otra vez
      const z = z1(1, 0.85, P.rem, P.cierre);
      mira = V(GATO.x, 0.3, GATO.z + 0.1); pos = mira.clone().add(V(-0.6 * z, 1.7 * z, 3.9 * z));
    }
    cam.position.copy(pos); cam.lookAt(mira); cam.updateProjectionMatrix(); cam.updateMatrixWorld();
  }
  function andar(p, A, B, t, t0, t1) {
    const u = k.clamp((t - t0) / (t1 - t0)), d = Math.hypot(B.x - A.x, B.z - A.z);
    p.position.set(k.lerp(A.x, B.x, u), 0, k.lerp(A.z, B.z, u));
    return { andando: t > t0 && t < t1, rumbo: Math.atan2(B.x - A.x, B.z - A.z), paso: u * d / 0.95, u };
  }
  // sentado en la silla (piernas al frente, cadera baja, tirado para atrás de calor)
  function sentar(p) {
    const u = p.userData; u.cadera.position.y = 0.6; u.piernaI.rotation.x = u.piernaD.rotation.x = -1.45;
  }
  // el gato tirado en el piso, panza abajo y las patas estiradas (de calor)
  function gatoTirado(resp) {
    k.posePerro(gato, { cabezaX: 0.3, colaX: -0.15 });
    const u = gato.userData; u.cuerpo.position.y = 0.2 + resp;
    u.patas.forEach((p, i) => p.rotation.set(i < 2 ? -1.45 : 1.45, 0, 0));
  }
  const mezcla = (a, b, x) => new k.THREE.Color(a).lerp(new k.THREE.Color(b), x);

  return {
    get duracion() { return P.cierre + 2.8; },
    get cierre() { return P.cierre; },
    get efectos() {
      const r = x => +x.toFixed(2);
      return [
        { efecto: 'pop', t: r(P.c1b - 0.4), db: -22 },
        { efecto: 'latigazo', t: r(P.f2 - 0.2), db: -19 },
        { efecto: 'motor', t: r(P.maximo - 0.1), db: -27 },
        { efecto: 'falla', t: r(P.calor), db: -18 },
        { efecto: 'latigazo', t: r(P.f3 - 0.2), db: -19 },
        { efecto: 'lluvia', t: r(P.agua - 0.05), db: -26 },
        { efecto: 'pop', t: r(P.agua + 0.35), db: -17 },
        { efecto: 'latigazo', t: r(P.f4 - 0.2), db: -19 },
        { efecto: 'golpe', t: r(P.metes + 0.55), db: -21 },
        { efecto: 'latigazo', t: r(P.c4b - 0.2), db: -19 },
        { efecto: 'falla', t: r(P.derrite + 0.1), db: -17 },
        { efecto: 'latigazo', t: r(P.f5 - 0.2), db: -19 },
        { efecto: 'pop', t: r(P.instal), db: -15 },
        { efecto: 'pop', t: r(P.precio - 0.15), db: -16 },
        { efecto: 'campanita', t: r(P.precio + 0.05), db: -18 },
        { efecto: 'sello', t: r(P.precio + 0.3), db: -18 },
        { efecto: 'latigazo', t: r(P.f6 - 0.2), db: -19 },
        { efecto: 'latigazo', t: r(P.rem - 0.2), db: -19 },
        { efecto: 'pop', t: r(P.reforma + 0.05), db: -15 },
        { efecto: 'acierto', t: r(P.reforma + 0.3), db: -17 },
        { efecto: 'golpe', t: r(P.cierre + 0.1), db: -14 },
      ];
    },
    armar(kit) {
      k = kit; tiempos();
      const T = k.THREE;
      k.sol.position.set(6, 14, 9);
      const luz2 = new T.DirectionalLight('#FFF4DF', 0.9); luz2.position.set(-6, 10, 8); k.escena.add(luz2);
      cocina();
      heladera = armarHeladera();
      ventilador = armarVentilador();
      // vos (remera celeste, short): primero en la silla, abanicándote con un papel
      yo = k.personaje({ ropa: '#5B8DC9', pantalon: '#2F3B52', pelo: '#5A3A22', zapatillas: '#E9E6DE' });
      abanico = k.caja(0.3, 0.22, 0.012, '#F4F2EC', 0, -0.72, 0.08, yo.userData.brazoD, false);
      hielo = new T.Mesh(new T.BoxGeometry(0.15, 0.15, 0.15), new T.MeshLambertMaterial({ color: '#CFEFFF', transparent: true, opacity: 0.85 }));
      hielo.position.set(0, -0.74, 0); yo.userData.brazoD.add(hielo);
      escarcha = new T.Group(); yo.userData.cuello.add(escarcha);
      k.caja(0.52, 0.07, 0.5, '#EAF7FF', 0, 0.6, -0.01, escarcha, false);
      [-0.15, 0, 0.15].forEach(x => k.caja(0.04, 0.09, 0.04, '#EAF7FF', x, 0.52, 0.24, escarcha, false));
      charcoYo = new T.Mesh(new T.CylinderGeometry(0.5, 0.5, 0.012, 20), new T.MeshLambertMaterial({ color: '#9FD6F0', transparent: true, opacity: 0.8 }));
      charcoYo.position.set(YO_HIELO.x + 0.1, 0.03, YO_HIELO.z + 0.05); k.escena.add(charcoYo);
      // el gato (naranja, atigrado): tirado en el piso de calor
      gato = k.gato({ color: '#E39A4B', oscuro: '#B86E2C' });
      gato.position.set(GATO.x, 0, GATO.z); gato.rotation.y = -0.75;
      charcoGato = new T.Mesh(new T.CylinderGeometry(0.42, 0.45, 0.02, 18), k.mat('#E39A4B'));
      charcoGato.position.set(GATO.x, 0.025, GATO.z); k.escena.add(charcoGato);
      ojosGato = new T.Group(); ojosGato.position.set(GATO.x, 0.045, GATO.z); ojosGato.rotation.y = -0.75; k.escena.add(ojosGato);
      [-0.08, 0.08].forEach(x => {
        k.caja(0.08, 0.02, 0.09, '#C9D84A', x, 0, 0.12, ojosGato, false);
        k.caja(0.025, 0.025, 0.07, k.C.tinta, x, 0.008, 0.12, ojosGato, false);
      });
      // la caja del split (cartón, con la etiqueta)
      caja = new T.Group(); k.escena.add(caja);
      k.caja(0.95, 0.5, 0.4, '#C8A06A', 0, 0.25, 0, caja);
      k.caja(0.5, 0.26, 0.01, '#F4F2EC', -0.12, 0.27, 0.205, caja, false);
      k.caja(0.5, 0.06, 0.012, '#4C9ED9', -0.12, 0.33, 0.207, caja, false);
      k.caja(0.95, 0.05, 0.41, '#B38C58', 0, 0.48, 0, caja, false);
      caja.position.set(CAJA.x, 0, CAJA.z); caja.rotation.y = -0.2;
      // el split: lo trae el técnico y queda en la pared
      split = new T.Group(); k.escena.add(split);
      k.caja(1.0, 0.32, 0.24, '#F7F8F8', 0, 0, 0, split);
      k.caja(0.86, 0.04, 0.012, '#8C969A', 0, -0.1, 0.122, split, false);
      k.caja(0.03, 0.03, 0.01, '#5BD17A', 0.38, 0.05, 0.122, split, false);
      // el técnico (gorra verde), con la llave
      tec = k.personaje({ ropa: '#3E7CB1', pantalon: '#2E3A4C', zapatillas: '#2A2E2C', piel: '#C9956E', pelo: '#2B1D16', gorra: k.C.verde });
      k.llaveInglesa(tec.userData.brazoD).position.set(0, -0.62, 0);
      // aire caliente, aire frío, vapor de la heladera y gotas
      calor = rafaga(60, '#FF9A52', 0.032, 11);
      frio = rafaga(60, '#E3F7FF', 0.028, 23);
      vapor = k.humo(14, '#EAF7FF');
      gotas = goteo(14, '#7FC4E8', 7);
      url = k.etiquetaUrl();
      etqTermo = k.etiqueta('Adentro: 41 °C');
      etqCaja = k.etiqueta('En la caja: desde octubre');
      etqVent = k.etiqueta('Ventilador: modo secador');
      etqGato = k.etiqueta('Gato: 70 % líquido');
      etqSolido = k.etiqueta('Gato: sólido otra vez');
      card = k.tarjeta(`<div class="sello">Precio<br>de<br>referencia</div>
        <div class="t-et">INSTALACIÓN DE SPLIT HASTA 3.000 FRIGORÍAS</div>
        <div class="t-precio">$92.000<span>a</span>$179.000</div>
        <div class="t-nota">Noviembre 2026 · AMBA · por trabajo</div>`);
      chip = k.tarjeta(`<div class="ok">✓</div><div><div class="c1">Pedido publicado gratis</div><div class="c2">Aire acondicionado · tu zona</div></div>`, 'chip3d');
      fin = k.cierre('Pedí presupuestos', 'de gente de tu zona');
    },
    animar(t) {
      const T = k.THREE, U = yo.userData;
      // ---- el calor: de naranja a fresco cuando llega el aire ----
      const fresco = k.suave((t - P.instal - 0.15) / 1.3);
      k.escena.background.copy(mezcla(C_CALOR.fondo, C_FRIO.fondo, fresco)); k.escena.fog.color.copy(k.escena.background);
      k.cielo.color.copy(mezcla(C_CALOR.cielo, C_FRIO.cielo, fresco));
      k.sol.color.copy(mezcla(C_CALOR.sol, C_FRIO.sol, fresco)); k.sol.intensity = k.lerp(2.4, 1.9, fresco);
      vidrio.material.color.copy(mezcla('#FFD27A', '#CDEBF5', fresco));
      const nivel = k.lerp(0.42, 0.14, fresco) + Math.sin(t * 7) * 0.004 * (1 - fresco);
      rojo.scale.y = nivel; rojo.position.y = 1.4 + nivel / 2;

      silla.visible = t < P.f2;
      // ---- vos ----
      abanico.visible = t < P.f2;
      hielo.visible = t >= P.f3 && t < P.agua + 0.5;
      const derr = k.clamp((t - P.agua) / 0.45); hielo.scale.setScalar(Math.max(0.001, 1 - derr));
      escarcha.visible = t >= P.f6;
      yo.visible = !(t >= P.c4b && t < P.f6);      // mientras el gato se derrite y llega el técnico, vos estás en la heladera
      if (t < P.f2) {                              // 1. en la silla, tirado para atrás, abanicándote
        yo.position.set(SILLA.x, 0, SILLA.z + 0.04); yo.rotation.y = 0.12;
        k.pose(yo, { cabezaX: -0.18, cabezaZ: Math.sin(t * 1.3) * 0.06 }); sentar(yo);
        U.cadera.rotation.x = -0.14; U.piernaI.rotation.x = U.piernaD.rotation.x = -1.31;
        U.brazoD.rotation.set(-1.9, 0, -1.0 + Math.sin(t * 14) * 0.22);
        U.brazoI.rotation.set(0.15, 0, 0.35);
      } else if (t < P.f3) {                       // 2. frente al ventilador
        yo.position.set(YO_VENT.x, 0, YO_VENT.z); yo.rotation.y = Math.PI / 2;
        if (t < P.calor) {
          k.pose(yo, { cabezaX: -0.2 });
          const ab = k.suave((t - P.f2 - 0.2) / 0.4);
          U.brazoI.rotation.set(0, 0, 0.9 * ab); U.brazoD.rotation.set(0, 0, -0.9 * ab);
        } else {                                   // te tira aire caliente: la cabeza para atrás y el cuerpo se te va
          const e = k.suave((t - P.calor) / 0.25), tiembla = Math.sin(t * 40) * 0.04;
          k.pose(yo, { cabezaX: -0.45 * e + tiembla, cabezaZ: tiembla });
          U.cadera.rotation.x = -0.22 * e; U.piernaI.rotation.x = U.piernaD.rotation.x = 0.22 * e;
          U.brazoI.rotation.set(-1.4 * e, 0, 0.5); U.brazoD.rotation.set(-1.4 * e, 0, -0.5);   // las manos adelante, tapándote
          yo.position.x = YO_VENT.x - 0.18 * e;
        }
      } else if (t < P.f4) {                       // 3. el hielo en la nuca
        yo.position.set(YO_HIELO.x, 0, YO_HIELO.z); yo.rotation.y = 0.25;
        if (t < P.hielo) {
          k.pose(yo, { cabezaX: 0.15 });
          U.brazoD.rotation.set(-1.25, 0, -0.35); U.brazoI.rotation.set(-0.2, 0, 0.2);           // lo mirás
        } else if (t < P.agua + 0.5) {
          const e = k.suave((t - P.hielo) / 0.3);
          k.pose(yo, { cabezaX: k.lerp(0.15, -0.35, e) });
          U.brazoD.rotation.set(k.lerp(-1.25, 2.3, e), 0, k.lerp(-0.35, -0.75, e));
          U.brazoI.rotation.set(-0.15, 0, 0.25);
          if (t > P.agua) U.cuello.rotation.x = -0.35 + Math.sin(t * 30) * 0.05;
        } else {                                   // te quedás mirando la mano mojada
          k.pose(yo, { cabezaX: 0.3 });
          U.brazoD.rotation.set(-1.3, 0, -0.2); U.brazoI.rotation.set(-1.0, 0, 0.3);
        }
      } else if (t < P.c4b) {                      // 4a. abrís la heladera y te metés
        const entra = P.metes + 0.15;
        if (t < entra) { yo.position.set(YO_HEL0.x, 0, YO_HEL0.z); yo.rotation.y = Math.PI; k.pose(yo, { cabezaX: -0.1 }); U.brazoD.rotation.set(-1.3, 0, -0.1); }
        else if (t < entra + 0.55) {
          const a = andar(yo, YO_HEL0, YO_HEL1, t, entra, entra + 0.55);
          yo.rotation.y = Math.PI; k.pose(yo, { caminar: 1, paso: a.paso });
        } else {
          yo.position.set(YO_HEL1.x, 0, YO_HEL1.z);
          yo.rotation.y = k.lerp(Math.PI, 0, k.suave((t - entra - 0.55) / 0.35));
          k.pose(yo, { cabezaX: -0.25 });
          U.brazoI.rotation.set(0, 0, 0.55); U.brazoD.rotation.set(0, 0, -0.55);
        }
      } else if (t >= P.f6) {                      // 6. afuera, con escarcha en el pelo, al fresco
        yo.position.set(YO_FIN.x, 0, YO_FIN.z); yo.rotation.y = 0.2;
        k.pose(yo, { festejo: t, cabezaX: -0.15 });
      }

      // ---- la heladera ----
      let ang = 0;
      if (t >= P.f4 && t < P.c4b) ang = k.lerp(0, -1.95, k.suave((t - P.f4 - 0.15) / 0.35)) + 1.3 * k.suave((t - P.metes - 1.1) / 0.4);
      else if (t >= P.c4b && t < P.f6) ang = -0.65;
      puerta.rotation.y = ang;
      luzHeladera.intensity = ang < -0.1 ? 1.6 : 0;
      vapor.animar(t, P.f4 + 0.3, P.c4b + 0.3, { x: HEL.x + 0.1, y: 0.9, z: HEL.z + HD / 2 + 0.05 });

      // ---- el ventilador ----
      ventilador.visible = t >= P.f2 - 0.01 && t < P.f4;
      cabezaVent.rotation.y = 0; aspas.rotation.z = t < P.maximo ? -t * 9 : -t * 38;
      const bocaV = new T.Vector3(VENT.x - 0.08, 1.72, VENT.z);
      calor.animar(t, P.maximo - 0.05, P.f3, bocaV, new T.Vector3(-1, 0.12, 0), 1.35, 0.32, 1.7);

      // ---- el hielo que se hace agua ----
      const nuca = new T.Vector3(); U.cuello.getWorldPosition(nuca);
      gotas.animar(t, P.agua + 0.05, P.f4 - 0.1, { x: nuca.x, y: nuca.y + 0.1, z: nuca.z - 0.15 }, 0.55);
      charcoYo.visible = t >= P.agua + 0.15 && t < P.f4;
      charcoYo.scale.set(Math.max(0.001, k.suave((t - P.agua - 0.15) / 0.8)), 1, Math.max(0.001, k.suave((t - P.agua - 0.15) / 0.8)));

      // ---- la caja del split: se va cuando el técnico pone el split ----
      caja.visible = t < P.instal;

      // ---- el gato (el testigo) ----
      const UG = gato.userData, resp = Math.sin(t * 9) * 0.008;
      const m = k.suave((t - P.derrite) / 0.9);                        // cuánto se derritió
      const rearma = t >= P.reforma ? k.rebote((t - P.reforma) / 0.4) : 0;
      let fx = 1, fy = 1;
      if (t < P.derrite) { fx = 1; fy = 1; }
      else if (t < P.reforma) { fx = 1 + 0.75 * m; fy = 1 - 0.8 * m; }
      else { fx = k.lerp(1.75, 1, rearma); fy = k.lerp(0.2, 1, rearma); }
      gato.scale.set(fx, Math.max(0.05, fy), fx);
      gato.position.set(GATO.x, 0, GATO.z); gato.rotation.y = -0.75;
      if (t < P.f3) {                                                  // tirado, jadeando
        gatoTirado(resp);
        if (t >= P.f2 && t < P.f3) UG.cuello.rotation.y = -0.6;        // te mira con el ventilador
      } else if (t < P.f4) {                                           // el agua del hielo: salta
        const salto = t > P.agua + 0.3 ? Math.max(0, Math.sin((t - P.agua - 0.3) * 7)) * (t < P.agua + 0.75 ? 0.32 : 0) : 0;
        if (t > P.agua + 0.3) { k.posePerro(gato, { cabezaX: -0.2, cabezaY: 0.5, colaX: 1.4 }); UG.cuerpo.position.y = 0.42 + salto; }
        else gatoTirado(resp);
      } else if (t < P.reforma + 0.45) {                               // tirado; se derrite; se vuelve a armar
        gatoTirado(resp * (1 - m));
        UG.cola.rotation.x = -0.1;
      } else {                                                          // sólido otra vez, sentado debajo del aire
        k.posePerro(gato, { sentado: true, cabezaX: -0.35, cabezaY: 0.25, cola: t, colaX: 0.9 });
      }
      charcoGato.visible = t >= P.derrite + 0.2 && t < P.reforma + 0.1;
      const ch = k.suave((t - P.derrite - 0.2) / 0.7) * (1 - k.suave((t - P.reforma + 0.05) / 0.15));
      charcoGato.scale.set(Math.max(0.001, ch), 1, Math.max(0.001, ch));
      ojosGato.visible = t >= P.derrite + 0.6 && t < P.reforma;
      ojosGato.position.y = 0.045 + 0.02;

      // ---- el técnico y el split ----
      tec.visible = t >= P.f5 - 0.01;
      split.visible = t >= P.f5 - 0.01;
      if (t < P.instal) {                                              // lo trae arriba de la cabeza
        tec.position.set(TEC.x, 0, TEC.z); tec.rotation.y = Math.PI; k.pose(tec, { cabezaX: -0.3 });
        tec.userData.brazoI.rotation.set(-2.95, 0, 0.12); tec.userData.brazoD.rotation.set(-2.95, 0, -0.12);
        split.position.set(TEC.x, k.lerp(2.3, 2.42, k.suave((t - P.f5) / 0.4)), TEC.z - 0.05); split.rotation.set(0, 0, 0); split.scale.setScalar(1);
      } else {
        split.position.set(SPLIT.x, SPLIT.y, SPLIT.z);
        split.scale.setScalar(Math.max(0.001, Math.min(1.08, k.rebote((t - P.instal) / 0.3))));
        if (t < P.f6) {
          tec.position.set(TEC.x, 0, TEC.z);
          const g = k.suave((t - P.instal - 0.5) / 0.4);
          tec.rotation.y = k.lerp(Math.PI, 0.25, g);
          k.pose(tec, g < 1 ? { llave: t, cabezaX: -0.4 * (1 - g) } : { saludo: t });
          if (g < 1) tec.userData.brazoD.rotation.x -= 0.9;
        } else {
          tec.position.set(TEC_FIN.x, 0, TEC_FIN.z); tec.rotation.y = -0.45;
          k.pose(tec, { brazosCruzados: true });
        }
      }
      frio.animar(t, P.instal + 0.25, P.cierre + 1, new T.Vector3(SPLIT.x, SPLIT.y - 0.12, SPLIT.z + 0.15), new T.Vector3(0, -0.8, 0.6), 1.15, 0.5, 0.85);

      camara(t);
      // ---- carteles y textos ----
      etqTermo.animar(t, 0.3, P.c1b - 0.5, termo, 60, -170);
      etqCaja.animar(t, P.c1b - 0.4, P.f2 + 0.05, { x: CAJA.x, y: 0.5, z: CAJA.z }, -20, -260);
      const hc = new T.Vector3(); U.cabeza.getWorldPosition(hc);
      etqVent.animar(t, P.maximo + 0.1, P.f3 + 0.05, { x: VENT.x, y: 2.0, z: VENT.z }, -60, -260);
      etqGato.animar(t, P.derrite + 0.4, P.f5 + 0.05, { x: GATO.x, y: 0.12, z: GATO.z }, 40, -420);
      etqSolido.animar(t, P.reforma + 0.35, P.cierre + 0.15, { x: GATO.x - 0.2, y: 0.75, z: GATO.z }, 20, -110);
      k.mostrar(card, t, P.precio - 0.15, P.f6 - 0.05);
      k.mostrar(chip, t, P.f6 + 0.25, P.cierre + 0.2);
      url.style.opacity = t < P.cierre ? 1 : 0;
      fin.animar(t, P.cierre);
    },
  };
})();
