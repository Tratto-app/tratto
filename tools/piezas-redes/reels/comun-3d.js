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
      animar(t, viento = 1) {
        for (let i = 0; i < n; i++) {
          const b = bri[i];
          const cortado = t >= b.tCorte;
          const caida = cortado ? 1 - suave((t - b.tCorte) / 0.12) : 1;
          const alto = cortado ? lerp(b.corto, b.alto, caida) : b.alto;
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

  // ---------- textos (HTML encima del 3D) ----------
  const capa = document.getElementById('textos');
  function el(html, cls) { const d = document.createElement('div'); if (cls) d.className = cls; d.innerHTML = html; capa.appendChild(d); return d; }

  // Subtítulos karaoke: de a 2 a 4 palabras, la que se dice resaltada
  const subt = el('', 'subt');
  function bloques(pal) {
    const out = []; let cur = [];
    pal.forEach((w, i) => {
      cur.push({ i, a: w[0], b: w[1], txt: w[2] });
      const largo = cur.map(x => x.txt).join(' ').length;
      const corte = /[.,;:?!¿]$/.test(w[2]);
      const sig = pal[i + 1];
      if (corte || largo >= 15 || cur.length >= 4 || !sig || (sig && sig[0] - w[1] > 0.35)) { out.push(cur); cur = []; }
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
      subt.innerHTML = bl.map(w => `<span class="pal" data-i="${w.i}">${w.txt.replace(/^¿/, '¿').replace(/[.,;:!]$/, '')}</span>`).join(' ');
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
  const kit = { THREE: T, C, escena, camara, sol, renderer, mat, caja, personaje, pose, patio, pasto, cortadora, recortes,
    el, tarjeta, mostrar, cierre, etiquetaUrl, lerp, clamp, suave, rebote, azar,
    palabra(txt, n = 1, def = 0) { // segundo en que se dice esa palabra (n-ésima vez)
      const pal = window.PALABRAS || []; let k = 0;
      for (const w of pal) if (w[2].toLowerCase().replace(/[^a-záéíóúñü0-9]/g, '') === txt.toLowerCase()) { k++; if (k === n) return w[0]; }
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
