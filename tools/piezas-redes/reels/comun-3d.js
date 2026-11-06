/* Formato "3d": animaciones low-poly con voz y subtítulos palabra por palabra.
   Pedido del fundador (05/11/2026) a partir de los reels animados en 3D que le
   funcionan a otra app de servicios: "a partir de ahora hagamos todos videos así".
   La idea es la de ese tipo de reels (escena 3D de una casa, personaje de
   bloques, un problema de todos los días, voz que lo cuenta y subtítulos
   karaoke); la identidad es la de Tratto: verde bosque, latón, tinta e IBM Plex.

   Cada video es un HTML chico con su escena (ver video-3d-pasto-tt.html):
     window.RED = { url: 'trattoapp.com.ar/r/tt-…', ig: false }
     window.ESCENA3D = { duracion, cierre, armar(k), animar(t, k) }
   k es el "kit" de este archivo: THREE, la escena, la cámara, materiales,
   personaje(), patio(), y los textos (subtítulos, tarjeta, chip, cierre).
   render(t) dibuja el cuadro t sin depender del anterior (render-reel.py).
   Los subtítulos salen de window.PALABRAS ([inicio, fin, palabra]) que
   inyecta render-reel.py --palabras desde clonar.py --palabras. */
(function () {
  const T = window.THREE;
  const W = 1080, H = 1920;
  const C = {
    verde: '#1E5D49', verdeVivo: '#2B7E62', verdeLuz: '#8FD9BC', laton: '#C9A227', latonOsc: '#8A6E10',
    tinta: '#0E1815', papel: '#FCFBF8',
  };
  const lerp = (a, b, x) => a + (b - a) * x;
  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const suave = x => { x = clamp(x); return x * x * (3 - 2 * x); };
  const rebote = x => { x = clamp(x); const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };
  // número pseudoaleatorio fijo: el video sale igual siempre
  function azar(semilla) { let s = semilla >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

  // ---------- 3D ----------
  const lienzo = document.createElement('canvas');
  lienzo.width = W; lienzo.height = H; lienzo.id = 'lienzo3d';
  document.getElementById('escena').appendChild(lienzo);
  const renderer = new T.WebGLRenderer({ canvas: lienzo, antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1); renderer.setSize(W, H, false);
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap;
  renderer.outputColorSpace = T.SRGBColorSpace;
  renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;

  const escena = new T.Scene();
  escena.background = new T.Color('#C9D8D0');
  escena.fog = new T.Fog('#C9D8D0', 28, 60);
  const camara = new T.PerspectiveCamera(36, W / H, 0.1, 200);

  const cielo = new T.HemisphereLight('#EAF4FF', '#6E7F5A', 1.25);
  escena.add(cielo);
  const sol = new T.DirectionalLight('#FFF4DF', 2.1);
  sol.position.set(9, 16, 7); sol.castShadow = true;
  sol.shadow.mapSize.set(2048, 2048);
  Object.assign(sol.shadow.camera, { left: -11, right: 11, top: 11, bottom: -11, near: 1, far: 50 });
  sol.shadow.bias = -0.0008; sol.shadow.normalBias = 0.02;
  escena.add(sol);

  const mats = {};
  function mat(color) {
    if (!mats[color]) mats[color] = new T.MeshLambertMaterial({ color, flatShading: true });
    return mats[color];
  }
  function caja(w, h, d, color, x = 0, y = 0, z = 0, padre = escena, sombra = true) {
    const m = new T.Mesh(new T.BoxGeometry(w, h, d), mat(color));
    m.position.set(x, y, z); m.castShadow = sombra; m.receiveShadow = true;
    padre.add(m); return m;
  }

  // Personaje de bloques. Las piezas giran desde el hombro o la cadera.
  function personaje(o = {}) {
    const g = new T.Group();
    const piel = o.piel || '#E2B48F', ropa = o.ropa || C.verdeVivo, pant = o.pantalon || '#2E3F66';
    const zap = o.zapatillas || '#F2F2EE', pelo = o.pelo || '#2B1D16';
    const cadera = new T.Group(); cadera.position.y = 0.92; g.add(cadera);
    const torso = caja(0.62, 0.72, 0.36, ropa, 0, 0.38, 0, cadera);
    const cuello = new T.Group(); cuello.position.y = 0.78; cadera.add(cuello);
    const cabeza = caja(0.46, 0.46, 0.44, piel, 0, 0.25, 0, cuello);
    caja(0.48, 0.14, 0.46, pelo, 0, 0.5, -0.01, cuello);
    caja(0.48, 0.22, 0.12, pelo, 0, 0.36, -0.18, cuello);
    if (o.gorra) { caja(0.52, 0.12, 0.5, o.gorra, 0, 0.53, 0, cuello); caja(0.44, 0.04, 0.22, o.gorra, 0, 0.48, 0.32, cuello); }
    // ojos
    caja(0.06, 0.08, 0.02, C.tinta, -0.1, 0.27, 0.225, cuello, false);
    caja(0.06, 0.08, 0.02, C.tinta, 0.1, 0.27, 0.225, cuello, false);
    function miembro(x, y, w, h, colores, padre) {
      const piv = new T.Group(); piv.position.set(x, y, 0); padre.add(piv);
      let yy = 0;
      colores.forEach(([alto, col]) => { caja(w, alto, w, col, 0, yy - alto / 2, 0, piv); yy -= alto; });
      return piv;
    }
    const brazoI = miembro(-0.41, 0.7, 0.2, 0, [[0.52, ropa], [0.16, piel]], cadera);
    const brazoD = miembro(0.41, 0.7, 0.2, 0, [[0.52, ropa], [0.16, piel]], cadera);
    const piernaI = miembro(-0.16, 0, 0.26, 0, [[0.78, pant], [0.14, zap]], cadera);
    const piernaD = miembro(0.16, 0, 0.26, 0, [[0.78, pant], [0.14, zap]], cadera);
    g.userData = { cadera, torso, cuello, cabeza, brazoI, brazoD, piernaI, piernaD };
    escena.add(g);
    return g;
  }
  // Poses: todo se calcula desde t, sin estado.
  function pose(p, o = {}) {
    const u = p.userData;
    const paso = o.paso ?? 0, amp = o.caminar ?? 0;
    const s = Math.sin(paso * Math.PI * 2);
    u.piernaI.rotation.x = s * 0.6 * amp; u.piernaD.rotation.x = -s * 0.6 * amp;
    u.brazoI.rotation.set(-s * 0.5 * amp, 0, 0.06); u.brazoD.rotation.set(s * 0.5 * amp, 0, -0.06);
    u.cadera.position.y = 0.92 + Math.abs(Math.cos(paso * Math.PI * 2)) * 0.05 * amp + (o.salto || 0);
    u.cuello.rotation.set(o.cabezaX || 0, o.cabezaY || 0, o.cabezaZ || 0);
    u.torso.rotation.set(0, 0, 0);
    if (o.empujar) { u.brazoI.rotation.set(-1.15, 0, 0.12); u.brazoD.rotation.set(-1.15, 0, -0.12); }
    if (o.rascar) {
      const r = Math.sin(o.rascar * 18) * 0.12;
      u.brazoD.rotation.set(-2.6 + r, 0, -0.5); u.cuello.rotation.z = 0.12;
    }
    if (o.festejo) {
      const f = Math.sin(o.festejo * 10) * 0.25;
      u.brazoI.rotation.set(0, 0, 2.7 + f); u.brazoD.rotation.set(0, 0, -2.7 - f);
    }
    if (o.saludo) { u.brazoD.rotation.set(0, 0, -2.6 + Math.sin(o.saludo * 12) * 0.35); }
    if (o.brazosCruzados) { u.brazoI.rotation.set(-1.3, 0.6, 0.3); u.brazoD.rotation.set(-1.3, -0.6, -0.3); }
    // cantar: la mano derecha en la boca (micrófono o lo que haya a mano) y el otro brazo al aire
    if (o.cantar) {
      const c = o.cantar, d = o.drama ?? 1;
      u.brazoD.rotation.set(-2.1, 0, -0.45);
      u.brazoI.rotation.set(-0.35 + Math.sin(c * 3) * 0.25 * d, 0, -1.25 * d - Math.sin(c * 2.2) * 0.3 * d);
      u.cuello.rotation.x = -0.22 + Math.sin(c * 4) * 0.06;
      u.cuello.rotation.z = Math.sin(c * 2.6) * 0.1 * d;
    }
    // golpear una pared que tiene adelante (puño derecho)
    if (o.golpear) {
      u.brazoD.rotation.set(-1.25 - Math.abs(Math.sin(o.golpear * 9)) * 0.35, 0, -0.1);
      u.brazoI.rotation.set(-0.2, 0, -0.55); u.cuello.rotation.x = -0.05;
    }
    // las dos manos en la garganta, tosiendo
    if (o.garganta) {
      const g = Math.sin(o.garganta * 16) * 0.05;
      u.brazoI.rotation.set(-1.75 + g, 0, 0.55); u.brazoD.rotation.set(-1.75 - g, 0, -0.55);
      u.cuello.rotation.x = 0.25 + Math.abs(Math.sin(o.garganta * 8)) * 0.15;
    }
    // aplaudir
    if (o.aplaudir) {
      const a = Math.abs(Math.sin(o.aplaudir * 11)) * 0.28;
      u.brazoI.rotation.set(-1.35, 0, 0.32 + a); u.brazoD.rotation.set(-1.35, 0, -0.32 - a);
    }
    // tocar un teclado que tiene adelante
    if (o.tocar) {
      const a = Math.sin(o.tocar * 10) * 0.07, b = Math.sin(o.tocar * 8.3 + 1) * 0.07;
      u.brazoI.rotation.set(-0.95 + a, 0, 0.18); u.brazoD.rotation.set(-0.95 + b, 0, -0.18);
      u.cuello.rotation.x = 0.18;
    }
  }

  // Perro de bloques (mira hacia +z). posePerro: caminar, aullar, sentado, cola.
  function perro(o = {}) {
    const g = new T.Group(), col = o.color || '#C08A4E', osc = o.oscuro || '#8C5A2E';
    const cuerpo = new T.Group(); cuerpo.position.y = 0.42; g.add(cuerpo);
    caja(0.36, 0.32, 0.78, col, 0, 0, 0, cuerpo);
    caja(0.37, 0.12, 0.3, osc, 0, 0.11, -0.1, cuerpo, false);
    const cuello = new T.Group(); cuello.position.set(0, 0.12, 0.34); cuerpo.add(cuello);
    caja(0.34, 0.32, 0.34, col, 0, 0.16, 0.08, cuello);
    caja(0.2, 0.13, 0.2, '#E8D2B0', 0, 0.1, 0.32, cuello);
    caja(0.09, 0.07, 0.05, C.tinta, 0, 0.16, 0.43, cuello, false);
    caja(0.05, 0.06, 0.02, C.tinta, -0.09, 0.24, 0.255, cuello, false);
    caja(0.05, 0.06, 0.02, C.tinta, 0.09, 0.24, 0.255, cuello, false);
    const orejaI = caja(0.08, 0.2, 0.13, osc, -0.17, 0.3, 0.04, cuello); orejaI.rotation.z = 0.35;
    const orejaD = caja(0.08, 0.2, 0.13, osc, 0.17, 0.3, 0.04, cuello); orejaD.rotation.z = -0.35;
    const boca = new T.Group(); boca.position.set(0, 0.04, 0.24); cuello.add(boca);
    caja(0.17, 0.05, 0.17, '#7A3B32', 0, -0.01, 0.08, boca, false);
    const cola = new T.Group(); cola.position.set(0, 0.1, -0.39); cuerpo.add(cola);
    caja(0.07, 0.07, 0.32, osc, 0, 0, -0.16, cola);
    const patas = [[-0.11, 0.27], [0.11, 0.27], [-0.11, -0.27], [0.11, -0.27]].map(([x, z]) => {
      const p = new T.Group(); p.position.set(x, -0.14, z); cuerpo.add(p);
      caja(0.1, 0.3, 0.1, col, 0, -0.14, 0, p); return p;
    });
    g.userData = { cuerpo, cuello, boca, cola, patas };
    escena.add(g); return g;
  }
  function posePerro(p, o = {}) {
    const u = p.userData, amp = o.caminar ?? 0, s = Math.sin((o.paso ?? 0) * Math.PI * 2);
    u.cuerpo.rotation.set(0, 0, 0); u.cuerpo.position.y = 0.42;
    u.patas.forEach((pt, i) => { pt.rotation.set((i === 0 || i === 3 ? s : -s) * 0.55 * amp, 0, 0); });
    u.cuello.rotation.set(o.cabezaX || 0, o.cabezaY || 0, 0); u.boca.rotation.x = 0;
    u.cola.rotation.set(-0.75, o.cola ? Math.sin(o.cola * 15) * 0.7 : 0, 0);
    if (o.sentado) {
      u.cuerpo.rotation.x = -0.5; u.cuerpo.position.y = 0.38;
      u.patas[0].rotation.x = u.patas[1].rotation.x = 0.5; u.patas[2].rotation.x = u.patas[3].rotation.x = -1.0;
    }
    if (o.aullar) {
      u.cuello.rotation.x = -0.95 + Math.sin(o.aullar * 2) * 0.08 + (o.sentado ? 0.4 : 0);
      u.boca.rotation.x = 0.35 + Math.sin(o.aullar * 9) * 0.12;
    }
  }

  // Notas musicales que suben (afinadas: suaves; desafinadas: se tambalean)
  function notas(n = 12, color = C.tinta, semilla = 5) {
    const r = azar(semilla), ns = [];
    for (let i = 0; i < n; i++) {
      const g = new T.Group();
      const cab = new T.Mesh(new T.SphereGeometry(0.075, 8, 6), mat(color)); cab.scale.set(1.25, 0.9, 0.7); g.add(cab);
      caja(0.028, 0.28, 0.028, color, 0.075, 0.14, 0, g, false);
      if (i % 2) caja(0.11, 0.045, 0.028, color, 0.12, 0.26, 0, g, false);
      g.visible = false; escena.add(g);
      ns.push({ g, u: (i + r() * 0.6) / n, dx: lerp(-0.55, 0.55, r()), dz: lerp(-0.25, 0.25, r()), fase: r() * 6.28 });
    }
    return {
      animar(t, desde, hasta, punto, o = {}) {
        const vida = o.vida || 1.5, tambaleo = o.tambaleo ?? 1;
        for (const a of ns) {
          const t0 = lerp(desde, Math.max(desde, hasta - vida * 0.6), a.u), e = t - t0;
          if (t < desde || e < 0 || e > vida) { a.g.visible = false; continue; }
          const x = e / vida, esc = suave(x / 0.15) * (1 - suave((x - 0.75) / 0.25)) * (o.escala || 1);
          a.g.visible = true; a.g.scale.setScalar(Math.max(0.001, esc));
          a.g.position.set(punto.x + a.dx * x * 1.6 + Math.sin(e * 5 + a.fase) * 0.12 * tambaleo, punto.y + 0.15 + x * 1.1, punto.z + a.dz * x);
          a.g.rotation.set(0, (o.mirarY || 0), Math.sin(e * 7 + a.fase) * 0.45 * tambaleo);
        }
      },
    };
  }

  // Teclado de pie
  function teclado() {
    const g = new T.Group();
    [[-0.55, -0.12], [-0.55, 0.12], [0.55, -0.12], [0.55, 0.12]].forEach(([x, z]) => caja(0.05, 0.8, 0.05, '#2A2E2C', x, 0.4, z, g));
    caja(1.2, 0.04, 0.05, '#2A2E2C', 0, 0.35, 0, g, false);
    caja(1.42, 0.1, 0.42, '#1B1F1D', 0, 0.85, 0, g);
    caja(1.3, 0.04, 0.2, '#F4F2EC', 0, 0.91, 0.08, g, false);
    // teclas negras entre las blancas (18 blancas de 0,072): patrón 2 + 3 por octava
    for (let i = 0; i < 17; i++) if ([0, 1, 3, 4, 5].includes(i % 7)) caja(0.045, 0.05, 0.11, '#111412', -0.65 + (i + 1) * 0.072, 0.93, 0.04, g, false);
    caja(0.3, 0.03, 0.08, C.laton, -0.45, 0.91, -0.12, g, false);
    escena.add(g); return g;
  }

  // Celular en un trípode con un video en la pantalla (mira hacia +z)
  function celular() {
    const g = new T.Group();
    caja(0.38, 0.03, 0.38, '#2A2E2C', 0, 0.02, 0, g);
    caja(0.04, 1.2, 0.04, '#2A2E2C', 0, 0.62, 0, g);
    caja(0.38, 0.68, 0.04, '#121614', 0, 1.45, 0, g);
    caja(0.33, 0.62, 0.01, '#EDEFEA', 0, 1.45, 0.025, g, false);
    caja(0.29, 0.2, 0.012, '#C8473A', 0, 1.56, 0.032, g, false);
    const play = new T.Mesh(new T.CylinderGeometry(0.055, 0.055, 0.01, 3), mat('#FCFBF8'));
    play.rotation.set(Math.PI / 2, 0, Math.PI / 2); play.position.set(0.005, 1.56, 0.04); g.add(play);
    caja(0.25, 0.03, 0.012, '#9AA39E', 0, 1.37, 0.032, g, false);
    caja(0.18, 0.03, 0.012, '#9AA39E', -0.035, 1.31, 0.032, g, false);
    escena.add(g); return g;
  }

  // Patio de una casa: pared con ventana y puerta, medianera de ladrillo,
  // reja al frente con portón abierto, vereda y calle.
  function patio(o = {}) {
    const ancho = o.ancho || 6.4, fondo = o.fondo || 8;
    const x0 = -ancho / 2, x1 = ancho / 2, z0 = -fondo / 2, z1 = fondo / 2;
    // suelo general (vereda/calle) y el patio
    const piso = new T.Mesh(new T.PlaneGeometry(80, 80), mat('#B7BDB3'));
    piso.rotation.x = -Math.PI / 2; piso.position.y = -0.02; piso.receiveShadow = true; escena.add(piso);
    const tierra = new T.Mesh(new T.BoxGeometry(ancho, 0.1, fondo), mat(o.colorTierra || '#6E8B3D'));
    tierra.position.set(0, 0.03, 0); tierra.receiveShadow = true; escena.add(tierra);
    // baldosas de la galería junto a la casa
    for (let i = 0; i < 8; i++) for (let j = 0; j < 2; j++) {
      const b = caja(ancho / 8 - 0.04, 0.08, 0.56, (i + j) % 2 ? '#D9D6CC' : '#CFCBBF', x0 + (i + 0.5) * ancho / 8, 0.05, z0 - 0.3 - j * 0.6, escena, false);
      b.castShadow = false;
    }
    const zc = z0 - 1.25; // frente de la casa
    // casa (pared del fondo) con ventana con rejas y puerta de madera
    caja(ancho + 2.4, 3.6, 0.3, '#EDEAE2', 0, 1.8, zc - 0.15);
    caja(ancho + 2.6, 0.22, 0.6, '#C9C4B6', 0, 3.66, zc);
    caja(1.5, 1.1, 0.06, '#A9C6D6', 0.5, 2.0, zc + 0.02);
    for (let i = 0; i < 6; i++) caja(0.05, 1.1, 0.05, '#2A2E2C', 0.5 - 0.62 + i * 0.25, 2.0, zc + 0.08);
    caja(1.66, 0.08, 0.16, '#D2CDC0', 0.5, 1.42, zc + 0.06);
    caja(0.95, 2.1, 0.1, '#7A4E2D', x1 - 0.4, 1.05, zc + 0.03);
    caja(0.07, 0.07, 0.08, '#C9A227', x1 - 0.72, 1.05, zc + 0.11);
    // medianera de ladrillo a la izquierda
    const mz = (zc + z1) / 2, ml = z1 - zc;
    caja(0.32, 2.2, ml, '#B5583A', x0 - 0.5, 1.1, mz);
    for (let f = 0; f < 9; f++) for (let k = 0; k < Math.floor(ml / 0.5); k++) {
      if ((f + k) % 3) continue;
      caja(0.04, 0.2, 0.42, '#9C4A30', x0 - 0.33, 0.15 + f * 0.24, zc + 0.3 + k * 0.5 + (f % 2) * 0.25, escena, false);
    }
    // parrilla de ladrillo en el fondo a la izquierda
    caja(1.2, 0.9, 0.8, '#B5583A', x0 + 0.35, 0.45, zc + 0.6);
    caja(1.1, 0.08, 0.7, '#2A2E2C', x0 + 0.35, 0.93, zc + 0.6);
    caja(0.45, 1.6, 0.45, '#A84F33', x0 + 0.35, 1.7, zc + 0.45);
    // reja al frente con pilares y un hueco (portón abierto) a la derecha
    const zr = z1 + 0.25, hueco = o.hueco || [x1 - 1.6, x1 - 0.3];
    caja(ancho + 1.2, 0.32, 0.3, '#E6E1D3', 0, 0.16, zr);
    [x0 - 0.5, -0.4, hueco[0], hueco[1], x1 + 0.5].forEach(x => caja(0.36, 1.35, 0.36, '#E6E1D3', x, 0.68, zr));
    for (let x = x0 - 0.3; x < x1 + 0.4; x += 0.2) {
      if (x > hueco[0] && x < hueco[1]) continue;
      if (Math.abs(x + 0.4) < 0.2 || Math.abs(x - hueco[0]) < 0.2 || Math.abs(x - hueco[1]) < 0.2) continue;
      caja(0.04, 0.95, 0.04, '#232826', x, 0.78, zr, escena, false);
    }
    caja(hueco[0] - x0 + 0.5, 0.05, 0.05, '#232826', (hueco[0] + x0 - 0.5) / 2, 1.24, zr, escena, false);
    // portón abierto, girado hacia afuera
    const porton = new T.Group(); porton.position.set(hueco[1] - 0.05, 0, zr); escena.add(porton);
    for (let x = 0; x < 1.2; x += 0.2) caja(0.04, 0.95, 0.04, '#232826', -x - 0.1, 0.78, 0, porton, false);
    caja(1.25, 0.05, 0.05, '#232826', -0.62, 1.24, 0, porton, false); caja(1.25, 0.05, 0.05, '#232826', -0.62, 0.32, 0, porton, false);
    porton.rotation.y = -1.9;
    // vereda: baldosas grises
    caja(ancho + 6, 0.06, 1.8, '#C7C9C2', 0, 0.03, zr + 1.2, escena, false).castShadow = false;
    // árbol low-poly en la vereda
    if (o.arbol !== false) {
      caja(0.3, 1.6, 0.3, '#6B4A2F', x0 - 0.2, 0.8, zr + 1.3);
      const copa = new T.Mesh(new T.IcosahedronGeometry(1.15, 0), mat('#3F7A4A'));
      copa.position.set(x0 - 0.2, 2.3, zr + 1.3); copa.castShadow = true; escena.add(copa);
      const copa2 = new T.Mesh(new T.IcosahedronGeometry(0.8, 0), mat('#4C8B55'));
      copa2.position.set(x0 + 0.3, 2.9, zr + 1.0); copa2.castShadow = true; escena.add(copa2);
    }
    return { x0, x1, z0, z1, zc, zr, hueco };
  }

  // Pasto alto con instancias: cada brizna sabe cuándo la cortan (tCorte).
  function pasto(o) {
    const { x0, x1, z0, z1 } = o.zona, n = o.cantidad || 2200, r = azar(o.semilla || 7);
    const geo = new T.ConeGeometry(0.07, 1, 4); geo.translate(0, 0.5, 0);
    const malla = new T.InstancedMesh(geo, new T.MeshLambertMaterial({ flatShading: true }), n);
    malla.receiveShadow = true;
    const verdes = ['#5E8F3A', '#6FA243', '#7FB24C', '#58853A', '#8BBB55', '#6A9940'].map(c => new T.Color(c));
    const bri = [];
    for (let i = 0; i < n; i++) {
      const b = { x: lerp(x0 + 0.08, x1 - 0.08, r()), z: lerp(z0 + 0.08, z1 - 0.08, r()), alto: lerp(0.55, 0.95, r()),
        corto: lerp(0.07, 0.13, r()), giro: r() * 6.28, fase: r() * 6.28, incl: lerp(0.05, 0.25, r()), tCorte: Infinity };
      bri.push(b); malla.setColorAt(i, verdes[Math.floor(r() * verdes.length)]);
    }
    escena.add(malla);
    const m = new T.Matrix4(), q = new T.Quaternion(), e = new T.Euler(), s = new T.Vector3(), p = new T.Vector3();
    return {
      bri, malla,
      animar(t, viento = 1, crecer = 1) {
        for (let i = 0; i < n; i++) {
          const b = bri[i];
          const cortado = t >= b.tCorte;
          const caida = cortado ? 1 - suave((t - b.tCorte) / 0.12) : 1;
          const alto = cortado ? lerp(b.corto, b.alto * crecer, caida) : b.alto * crecer;
          const vaiven = cortado ? 0 : Math.sin(t * 2.2 + b.fase + b.x * 0.6) * 0.09 * viento;
          e.set(b.incl * Math.cos(b.giro) + vaiven, b.giro, b.incl * Math.sin(b.giro) + vaiven * 0.5);
          q.setFromEuler(e); s.set(1, alto, 1); p.set(b.x, 0.07, b.z);
          m.compose(p, q, s); malla.setMatrixAt(i, m);
        }
        malla.instanceMatrix.needsUpdate = true;
      },
    };
  }

  // Cortadora de pasto
  function cortadora(color = C.laton) {
    const g = new T.Group();
    caja(0.8, 0.28, 0.62, color, 0, 0.3, 0, g);
    caja(0.5, 0.2, 0.42, '#2A2E2C', 0, 0.52, 0.02, g);
    caja(0.16, 0.12, 0.16, '#4A4F4C', 0.12, 0.66, 0.02, g);
    const rueda = () => { const m = new T.Mesh(new T.CylinderGeometry(0.13, 0.13, 0.08, 8), mat('#232826')); m.rotation.z = Math.PI / 2; m.castShadow = true; return m; };
    [[-0.42, 0.25], [0.42, 0.25], [-0.42, -0.25], [0.42, -0.25]].forEach(([x, z]) => { const w = rueda(); w.position.set(x, 0.13, z); g.add(w); });
    // manija hacia atrás (-z local)
    const man = new T.Group(); man.position.set(0, 0.42, -0.3); man.rotation.x = 0.75; g.add(man);
    caja(0.05, 0.05, 0.95, '#2A2E2C', -0.22, 0, -0.45, man, false); caja(0.05, 0.05, 0.95, '#2A2E2C', 0.22, 0, -0.45, man, false);
    caja(0.5, 0.06, 0.06, '#2A2E2C', 0, 0, -0.92, man, false);
    escena.add(g); return g;
  }

  // Pedacitos de pasto que salen de la cortadora (deterministas)
  function recortes(n = 260) {
    const geo = new T.BoxGeometry(0.05, 0.05, 0.05);
    const malla = new T.InstancedMesh(geo, new T.MeshLambertMaterial({ color: '#7FB24C', flatShading: true }), n);
    const r = azar(99), ps = [];
    for (let i = 0; i < n; i++) ps.push({ u: r(), vx: lerp(-1.2, 1.2, r()), vy: lerp(1.6, 3.2, r()), vz: lerp(-1.2, 1.2, r()), giro: r() * 6 });
    malla.frustumCulled = false; // las gotas se mueven: que three.js no las saltee
    escena.add(malla);
    const m = new T.Matrix4(), q = new T.Quaternion(), e = new T.Euler(), p = new T.Vector3(), s = new T.Vector3();
    return {
      animar(t, desde, hasta, posEn) {
        for (let i = 0; i < n; i++) {
          const a = ps[i], t0 = lerp(desde, hasta, a.u), edad = t - t0;
          if (edad < 0 || edad > 0.7 || t0 > hasta) { s.set(0, 0, 0); p.set(0, -5, 0); }
          else {
            const o = posEn(t0);
            p.set(o.x + a.vx * edad, 0.35 + a.vy * edad - 4.9 * edad * edad, o.z + a.vz * edad);
            if (p.y < 0.08) p.y = 0.08;
            s.set(1, 1, 1);
          }
          e.set(a.giro + t * 5, a.giro, 0); q.setFromEuler(e); m.compose(p, q, s); malla.setMatrixAt(i, m);
        }
        malla.instanceMatrix.needsUpdate = true;
      },
    };
  }

  // Lluvia: gotas finas que caen sobre la zona (intensidad 0 a 1)
  function lluvia(o = {}) {
    const n = o.cantidad || 2000, r = azar(o.semilla || 31), alto = o.alto || 6.5; // alto: de dónde caen (una ducha: 2,3)
    const { x0, x1, z0, z1 } = o.zona || { x0: -6, x1: 6, z0: -7, z1: 7 };
    const malla = new T.InstancedMesh(new T.BoxGeometry(0.035, o.gota || 0.62, 0.035),
      new T.MeshBasicMaterial({ color: '#F2F7FA', transparent: true, opacity: 0.8 }), n);
    const gs = []; for (let i = 0; i < n; i++) gs.push({ x: lerp(x0, x1, r()), z: lerp(z0, z1, r()), f: r(), u: r() });
    malla.frustumCulled = false; // las gotas se mueven: que three.js no las saltee
    escena.add(malla);
    const m = new T.Matrix4(), q = new T.Quaternion().setFromEuler(new T.Euler(0.12, 0, 0.06)), p = new T.Vector3(), s = new T.Vector3();
    return {
      animar(t, intensidad) {
        for (let i = 0; i < n; i++) {
          const g = gs[i];
          if (g.u >= intensidad) { s.set(0, 0, 0); p.set(0, -9, 0); }
          else { s.set(1, 1, 1); p.set(g.x + 0.3 * ((t * 13 + g.f * alto) % alto) / alto, alto - ((t * 13 + g.f * alto) % alto), g.z); }
          m.compose(p, q, s); malla.setMatrixAt(i, m);
        }
        malla.instanceMatrix.needsUpdate = true;
      },
    };
  }
  // Cielo: de soleado (0) a nublado (1)
  const fondoSol = new T.Color('#C9D8D0'), fondoNube = new T.Color('#7F8B8D');
  const tormenta = document.createElement('div'); tormenta.className = 'tormenta';
  document.getElementById('escena').appendChild(tormenta);
  function clima(nublado) {
    tormenta.style.opacity = (0.5 * nublado).toFixed(3);
    escena.background.copy(fondoSol).lerp(fondoNube, nublado);
    escena.fog.color.copy(escena.background);
    cielo.intensity = lerp(1.25, 0.6, nublado); sol.intensity = lerp(2.1, 0.15, nublado);
  }
  // Humo: bocanadas grises que suben (un motor que no arranca)
  function humo(n = 16, color = '#8E9490') { // también vapor de la ducha (color claro) o una tos
    const malla = new T.InstancedMesh(new T.IcosahedronGeometry(0.14, 0), mat(color), n);
    const r = azar(57), ps = []; for (let i = 0; i < n; i++) ps.push({ u: r(), dx: lerp(-0.4, 0.4, r()), dz: lerp(-0.3, 0.3, r()) });
    malla.frustumCulled = false; // las gotas se mueven: que three.js no las saltee
    escena.add(malla);
    const m = new T.Matrix4(), q = new T.Quaternion(), p = new T.Vector3(), s = new T.Vector3();
    return {
      animar(t, desde, hasta, punto) {
        for (let i = 0; i < n; i++) {
          const a = ps[i], t0 = lerp(desde, hasta - 0.6, a.u), e = t - t0;
          if (e < 0 || e > 1.1 || t > hasta + 0.5) { s.set(0, 0, 0); p.set(0, -9, 0); }
          else { const k = 0.6 + e * 1.6 * (1 - suave((e - 0.8) / 0.3)); s.set(k, k, k); p.set(punto.x + a.dx * e, punto.y + e * 0.9, punto.z + a.dz * e); }
          m.compose(p, q, s); malla.setMatrixAt(i, m);
        }
        malla.instanceMatrix.needsUpdate = true;
      },
    };
  }

  // ---------- textos (HTML encima del 3D) ----------
  const capa = document.getElementById('textos');
  function el(html, cls) { const d = document.createElement('div'); if (cls) d.className = cls; d.innerHTML = html; capa.appendChild(d); return d; }

  // Cartel que señala algo de la escena (pastilla de latón con una línea al objeto)
  function etiqueta(texto) {
    const linea = el('', 'etq-linea'), pas = el(texto, 'etq');
    const v = new T.Vector3();
    return {
      animar(t, desde, hasta, punto, dx = 140, dy = -150) {
        if (t < desde || t > hasta) { pas.style.opacity = linea.style.opacity = 0; return; }
        v.set(punto.x, punto.y, punto.z).project(camara);
        const px = (v.x + 1) / 2 * W, py = (1 - v.y) / 2 * H;
        const e = rebote((t - desde) / 0.35), o = Math.min(1, (t - desde) / 0.12) * (1 - suave((t - (hasta - 0.2)) / 0.2));
        const ax = px + dx, ay = py + dy, largo = Math.hypot(ax - px, ay - py), ang = Math.atan2(ay - py, ax - px);
        Object.assign(linea.style, { left: px + 'px', top: py + 'px', width: largo * Math.min(1, e) + 'px', transform: `rotate(${ang}rad)`, opacity: o });
        Object.assign(pas.style, { left: ax + 'px', top: ay + 'px', opacity: o, transform: `translate(${dx < 0 ? '-100%' : '0'}, -50%) scale(${0.7 + 0.3 * e})` });
      },
    };
  }

  // Subtítulos karaoke: de a 2 a 4 palabras, la que se dice resaltada
  const subt = el('', 'subt');
  function bloques(pal) {
    const out = []; let cur = [];
    pal.forEach((w, i) => {
      cur.push({ i, a: w[0], b: w[1], txt: w[2] });
      const largo = cur.map(x => x.txt).join(' ').length;
      const corte = /[.,;:?!¿]$/.test(w[2]);
      const sig = pal[i + 1];
      // una palabra corta que cierra la frase no queda sola en su bloque
      const ultimaCorta = sig && /[.?!]$/.test(sig[2]) && sig[2].length <= 5 && sig[0] - w[1] < 0.35;
      if (corte || !sig || sig[0] - w[1] > 0.35 || (!ultimaCorta && (largo >= 15 || cur.length >= 4))) { out.push(cur); cur = []; }
    });
    if (cur.length) out.push(cur);
    return out;
  }
  let _bloques = null, _bloqueHtml = -1;
  function subtitulos(t) {
    const pal = window.PALABRAS || [];
    if (!_bloques) _bloques = bloques(pal);
    let idx = -1;
    for (let k = 0; k < _bloques.length; k++) {
      const bl = _bloques[k], sig = _bloques[k + 1];
      const desde = bl[0].a - 0.08, hasta = sig ? sig[0].a - 0.08 : bl[bl.length - 1].b + 0.5;
      if (t >= desde && t < hasta) { idx = k; break; }
    }
    if (idx < 0) { subt.style.opacity = 0; return; }
    const bl = _bloques[idx];
    if (_bloqueHtml !== idx) {
      subt.innerHTML = bl.map(w => `<span class="pal" data-i="${w.i}">${w.txt.replace(/[.,;:!]$/, '')}</span>`).join(' ');
      // en un solo renglón: si el bloque es largo, la letra se achica un poco
      const largo = bl.map(w => w.txt).join(' ').length;
      subt.style.fontSize = (largo > 16 ? Math.max(72, Math.round(96 * 16 / largo)) : 96) + 'px';
      _bloqueHtml = idx;
    }
    subt.style.opacity = 1;
    const entra = suave((t - (bl[0].a - 0.08)) / 0.12);
    subt.style.transform = `translateY(${(1 - entra) * 26}px) scale(${0.94 + 0.06 * entra})`;
    [...subt.children].forEach((sp, j) => {
      const w = bl[j], sig = bl[j + 1];
      const activa = t >= w.a - 0.04 && t < (sig ? sig.a - 0.04 : w.b + 0.5);
      sp.classList.toggle('activa', activa);
      sp.classList.toggle('dicha', t >= w.a - 0.04);
    });
  }

  // Etiqueta fija con el link (TikTok no tiene link en la bio)
  function etiquetaUrl() {
    const r = window.RED || {};
    if (r.ig) return el(`<b>Tocá @trattoapp_</b> · link «${r.ig}»`, 'url-fija');
    return el(`<b>trattoapp.com.ar</b>${(r.url || '').replace('trattoapp.com.ar', '')}`, 'url-fija');
  }

  function tarjeta(html, cls = 'tarjeta') { const d = el(html, cls); d.style.opacity = 0; return d; }
  function mostrar(d, t, desde, hasta, tipo = 'pop') {
    if (t < desde || t > hasta) { d.style.opacity = 0; return; }
    const e = rebote((t - desde) / 0.35), s = 1 - suave((t - (hasta - 0.25)) / 0.25);
    d.style.opacity = Math.min(1, (t - desde) / 0.12) * s;
    if (tipo === 'pop') d.style.transform = `translateX(-50%) scale(${0.6 + 0.4 * e}) rotate(${(1 - e) * -6}deg)`;
    else d.style.transform = `translateX(-50%) translateY(${(1 - e) * 60}px)`;
  }

  function cierre(textoA, textoB) {
    const r = window.RED || {};
    const d = el(`<div class="c-in">
        <div class="c-logo"><span>T</span></div>
        <div class="c-a">${textoA}</div>
        <div class="c-b">${textoB}</div>
        ${r.ig ? `<div class="c-url">Link en el perfil → @trattoapp_</div><div class="c-nota">link «${r.ig}»</div>`
               : `<div class="c-url">${r.url || 'trattoapp.com.ar'}</div><div class="c-nota">(escribilo en el navegador)</div>`}
      </div>`, 'cierre3d');
    return {
      animar(t, desde) {
        if (t < desde) { d.style.opacity = 0; d.style.clipPath = 'circle(0% at 50% 55%)'; return; }
        const x = suave((t - desde) / 0.55);
        d.style.opacity = 1; d.style.clipPath = `circle(${x * 120}% at 50% 55%)`;
        const ch = [...d.querySelectorAll('.c-in > div')];
        ch.forEach((c, i) => { const y = suave((t - desde - 0.25 - i * 0.12) / 0.35); c.style.opacity = y; c.style.transform = `translateY(${(1 - y) * 30}px)`; });
      },
    };
  }

  // ---------- armar y dibujar ----------
  const kit = { THREE: T, C, escena, camara, sol, cielo, renderer, mat, caja, personaje, pose, patio, pasto, cortadora, recortes,
    lluvia, clima, humo, etiqueta, perro, posePerro, notas, teclado, celular,
    el, tarjeta, mostrar, cierre, etiquetaUrl, lerp, clamp, suave, rebote, azar,
    palabra(txt, n = 1, def = 0) { // segundo en que se dice esa palabra (n-ésima vez)
      const pal = window.PALABRAS || []; let k = 0;
      for (const w of pal) if (w[2].toLowerCase().replace(/[^a-záéíóúñü0-9]/g, '') === txt.toLowerCase()) { k++; if (k === n) return w[0]; }
      return def;
    },
    frase(n, def = 0) { // segundo en que arranca la frase n (1, 2, …) del guion
      const pal = window.PALABRAS || []; let k = 0;
      for (let i = 0; i < pal.length; i++) if (i === 0 || /[.?!]$/.test(pal[i - 1][2])) { k++; if (k === n) return pal[i][0]; }
      return def;
    },
    finVoz(def) { const pal = window.PALABRAS || []; return pal.length ? pal[pal.length - 1][1] : def; },
  };
  window.KIT3D = kit;
  const E = window.ESCENA3D;
  E.armar(kit);
  // Lo lee render-reel.py --info (y hacer-3d.py): largo, cierre y efectos de sonido
  window.PUBLI = { duracion: E.duracion, cierre: E.cierre, tema: '3d', efectos: E.efectos || [] };
  window.render = function (t) {
    E.animar(t, kit);
    subtitulos(t);
    renderer.render(escena, camara);
  };
  window.render(0);
})();
