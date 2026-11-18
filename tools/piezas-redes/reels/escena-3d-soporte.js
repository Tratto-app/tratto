/* Escena del video 3D de soporte técnico (comun-3d.js). Cada red tiene su HTML
   (video-3d-soporte-tt/ig/fb.html) que solo define window.RED.
   Un escritorio en casa: la compu en la mesa, la torre al costado y el perro en
   su almohadón. Historia en escalera, graciosa: la compu tarda tanto en prender
   que te crece la barba; la reiniciás y te pide actualizar otra vez; le soplás
   el polvo y el perro queda todo gris; abrís una pestaña y el ventilador despega
   como un dron. Con el precio llega el técnico, la pone a punto y prende al
   toque. Remate (cámara en el perro): se sacude el polvo y te deja gris a vos,
   barba incluida. Testigo: el perro. */
window.ESCENA3D = (function () {
  let k, yo, perro, tec, barba, torre, tapa, fan, aspas, pantalla, spin, barraFondo, barra, ventana, check;
  let paredFondo, silla, polvo, polvo2, etqArranque, etqUpd, etqPolvo, etqDevuelto, card, chip, fin, url, gris;
  const P = {};
  const H = 2.7, PARED = -2.0;
  const MON = { x: -0.2, y: 1.2, z: -1.72 };             // centro de la pantalla
  const TORRE = { x: 0.68, y: 1.0, z: -1.6 };            // torre arriba de la mesa, a la derecha
  const FAN0 = { x: 0.68, y: 1.27, z: -1.6 };            // el ventilador, arriba de la torre
  const SILLA = { x: -0.2, z: -0.78 }, CAMA = { x: 1.62, z: -0.82 };
  const YO_TORRE = { x: 0.98, z: -0.98 }, YO_COSTADO = { x: 0.55, z: -0.55 }, YO_REM = { x: 0.5, z: -1.0 };

  function tiempos() {
    P.f2 = k.frase(2, 3.3);
    P.f3 = k.frase(3, 6.4);
    P.f4 = k.frase(4, 9.4);
    P.f5 = k.frase(5, 12.8);
    P.f6 = k.frase(6, 17.6);
    P.barba = k.palabra('barba', 1, P.f2 - 0.6);
    P.actualizar = k.palabra('actualizar', 1, P.f2 + 1.2);
    P.polvo = k.palabra('polvo', 1, P.f3 + 0.8);
    P.gris = k.palabra('gris', 1, P.f4 - 0.5);
    P.pestana = k.palabra('pestaña', 1, P.f4 + 0.6);
    P.despega = k.palabra('despega', 1, P.f4 + 1.5);
    P.precio = k.palabra('treinta', 1, P.f5 + 1.9);
    P.arreglo = P.f5 + 1.7;                                   // el técnico termina
    P.fin = k.finVoz(21.5);
    P.cierre = P.fin + 0.35;
    P.rem = Math.min(P.f6 + 1.5, P.cierre - 1.7);              // remate: el perro se sacude
    P.sucio = P.rem + 0.85;                                    // el polvo te llega a vos
  }

  function cuarto() {
    const T = k.THREE, c = (w, h, d, col, x, y, z, s = true) => k.caja(w, h, d, col, x, y, z, k.escena, s);
    const piso = new T.Mesh(new T.PlaneGeometry(80, 80), k.mat('#9AA29C'));
    piso.rotation.x = -Math.PI / 2; piso.position.y = -0.04; piso.receiveShadow = true; k.escena.add(piso);
    c(4.6, 0.1, 3.8, '#C9C2B6', 0, -0.03, -0.1, false);                         // piso de baldosas
    for (let i = 1; i < 9; i++) c(0.015, 0.012, 3.8, '#B3AB9E', -2.3 + i * 0.51, 0.025, -0.1, false);
    for (let i = 1; i < 7; i++) c(4.6, 0.012, 0.015, '#B3AB9E', 0, 0.025, -2.0 + i * 0.54, false);
    paredFondo = c(4.6, H, 0.16, '#CFE0DA', 0, H / 2, PARED);                    // pared verde agua
    c(0.16, H, 3.4, '#C4D7D0', -2.3, H / 2, -0.4);
    c(4.6, 0.1, 0.04, '#F2EFE6', 0, 0.05, PARED + 0.1);
    // un estante con libros y una planta
    c(1.1, 0.04, 0.26, '#8C6440', -1.35, 1.95, PARED + 0.15);
    [['#C8553D', 0.22], ['#3F7F4E', 0.26], ['#E3B23C', 0.2], ['#4C7FB5', 0.24]].forEach(([col, h], i) => c(0.08, h, 0.2, col, -1.75 + i * 0.1, 1.97 + h / 2, PARED + 0.15));
    const maceta = new k.THREE.Mesh(new T.CylinderGeometry(0.08, 0.06, 0.14, 8), k.mat('#C26B45')); maceta.position.set(-1.05, 2.04, PARED + 0.15); k.escena.add(maceta);
    const hoja = new T.Mesh(new T.IcosahedronGeometry(0.13, 0), k.mat('#3F7F4E')); hoja.position.set(-1.05, 2.2, PARED + 0.15); k.escena.add(hoja);
    // la mesa
    c(2.1, 0.06, 0.7, '#E8E2D6', 0, 0.75, -1.58);
    [[-1.0, -1.88], [1.0, -1.88], [-1.0, -1.28], [1.0, -1.28]].forEach(([x, z]) => c(0.05, 0.72, 0.05, '#3A4048', x, 0.36, z));
    // el monitor
    c(0.92, 0.56, 0.05, '#1B1F1D', MON.x, MON.y, MON.z - 0.01);
    c(0.08, 0.3, 0.05, '#2A2E2C', MON.x, 0.92, MON.z - 0.04); c(0.32, 0.02, 0.2, '#2A2E2C', MON.x, 0.79, MON.z);
    pantalla = new T.Mesh(new T.PlaneGeometry(0.84, 0.48), new T.MeshBasicMaterial({ color: '#0E1815' }));
    pantalla.position.set(MON.x, MON.y, MON.z + 0.016); k.escena.add(pantalla);
    const blanco = new T.MeshBasicMaterial({ color: '#F4F2EC' });
    spin = new T.Mesh(new T.TorusGeometry(0.06, 0.013, 6, 18, Math.PI * 1.5), blanco); spin.position.set(MON.x, MON.y, MON.z + 0.02); k.escena.add(spin);
    barraFondo = new T.Mesh(new T.PlaneGeometry(0.5, 0.035), new T.MeshBasicMaterial({ color: '#2B3A55' })); barraFondo.position.set(MON.x, MON.y - 0.1, MON.z + 0.02); k.escena.add(barraFondo);
    barra = new T.Mesh(new T.PlaneGeometry(1, 0.035), new T.MeshBasicMaterial({ color: '#8FD9BC' })); barra.position.set(MON.x, MON.y - 0.1, MON.z + 0.022); k.escena.add(barra);
    ventana = new T.Group(); k.escena.add(ventana);
    const v1 = new T.Mesh(new T.PlaneGeometry(0.6, 0.34), blanco); ventana.add(v1);
    const v2 = new T.Mesh(new T.PlaneGeometry(0.6, 0.05), new T.MeshBasicMaterial({ color: '#C3CBCD' })); v2.position.set(0, 0.145, 0.001); ventana.add(v2);
    const v3 = new T.Mesh(new T.PlaneGeometry(0.14, 0.035), blanco); v3.position.set(-0.2, 0.148, 0.002); ventana.add(v3);
    ventana.position.set(MON.x, MON.y - 0.01, MON.z + 0.024);
    check = new T.Group(); k.escena.add(check);
    const c1 = new T.Mesh(new T.PlaneGeometry(0.05, 0.13), blanco); c1.position.set(-0.04, -0.02, 0); c1.rotation.z = 0.75; check.add(c1);
    const c2 = new T.Mesh(new T.PlaneGeometry(0.05, 0.24), blanco); c2.position.set(0.04, 0.02, 0); c2.rotation.z = -0.6; check.add(c2);
    check.position.set(MON.x, MON.y, MON.z + 0.024);
    // teclado y mouse
    c(0.5, 0.025, 0.16, '#2A2E2C', MON.x, 0.79, -1.36); c(0.46, 0.012, 0.12, '#55605C', MON.x, 0.806, -1.36, false);
    c(0.07, 0.03, 0.11, '#2A2E2C', 0.2, 0.79, -1.38);
    // una taza
    const taza = new T.Mesh(new T.CylinderGeometry(0.045, 0.04, 0.1, 10), k.mat('#F4F2EC')); taza.position.set(-0.85, 0.83, -1.45); taza.castShadow = true; k.escena.add(taza);
    // la torre: el cuerpo y la tapa del costado, que se abre
    torre = k.caja(0.24, 0.5, 0.5, '#3A4048', TORRE.x, TORRE.y, TORRE.z);
    k.caja(0.02, 0.06, 0.02, '#8FD9BC', TORRE.x - 0.06, TORRE.y + 0.16, TORRE.z + 0.252, k.escena, false);  // la lucecita
    tapa = new T.Group(); tapa.position.set(TORRE.x - 0.12, TORRE.y, TORRE.z + 0.25); k.escena.add(tapa);
    k.caja(0.012, 0.48, 0.48, '#4A525B', 0, 0, -0.24, tapa, false);
    // la cama del perro
    c(0.95, 0.1, 0.75, '#C8553D', CAMA.x, 0.05, CAMA.z); c(0.8, 0.06, 0.6, '#E7A390', CAMA.x, 0.12, CAMA.z, false);
  }

  // el ventilador de la torre: aro, centro y cuatro aspas
  function armarFan() {
    const T = k.THREE, g = new T.Group();
    const aro = new T.Mesh(new T.TorusGeometry(0.15, 0.022, 6, 18), k.mat('#2A2E2C')); aro.rotation.x = Math.PI / 2; aro.castShadow = true; g.add(aro);
    aspas = new T.Group(); g.add(aspas);
    const centro = new T.Mesh(new T.CylinderGeometry(0.045, 0.045, 0.04, 10), k.mat('#C9A227')); aspas.add(centro);
    for (let i = 0; i < 4; i++) { const a = k.caja(0.24, 0.012, 0.06, '#9AA39E', 0, 0, 0, aspas); a.rotation.y = i * Math.PI / 2; a.position.set(Math.cos(i * Math.PI / 2) * 0.07, 0, -Math.sin(i * Math.PI / 2) * 0.07); }
    k.escena.add(g); return g;
  }

  function armarSilla() {
    const T = k.THREE, g = new T.Group(), b = (w, h, d, col, x, y, z) => k.caja(w, h, d, col, x, y, z, g);
    b(0.52, 0.08, 0.5, '#2E3F66', 0, 0.5, 0); b(0.5, 0.6, 0.06, '#2E3F66', 0, 0.86, 0.24);
    b(0.05, 0.4, 0.05, '#3A4048', 0, 0.27, 0);
    [0, 1, 2, 3, 4].forEach(i => { const p = b(0.3, 0.04, 0.05, '#3A4048', Math.cos(i * 1.256) * 0.15, 0.05, Math.sin(i * 1.256) * 0.15); p.rotation.y = -i * 1.256; });
    g.position.set(SILLA.x, 0, SILLA.z); k.escena.add(g); return g;
  }

  // pinta de gris (polvo) todas las piezas de un personaje o del perro, menos los ojos
  function enPolvo(obj, si) {
    obj.traverse(m => {
      if (!m.isMesh) return;
      if (!m.userData.orig) m.userData.orig = m.material;
      const ojo = m.userData.orig.color && m.userData.orig.color.getHexString() === '0e1815';
      m.material = si && !ojo ? gris : m.userData.orig;
    });
  }

  function camara(t) {
    const cam = k.camara, V = (x, y, z) => new k.THREE.Vector3(x, y, z);
    let pos, mira;
    const z1 = (a, b, x0, x1) => k.lerp(a, b, k.suave((t - x0) / Math.max(0.3, x1 - x0)));
    if (t < P.f2) {                               // 1. desde atrás del monitor, tu cara: la barba crece
      const z = z1(1, 0.88, 0, P.f2);          // (la pared del fondo se esconde en este plano)
      mira = V(SILLA.x, 1.48, SILLA.z - 0.05); pos = mira.clone().add(V(0.55 * z, 0.45 * z, -2.4 * z));
    } else if (t < P.f3) {                        // 2. por encima del hombro: la actualización
      const z = z1(1, 0.85, P.f2, P.f3);
      mira = V(MON.x + 0.05, 1.12, MON.z); pos = mira.clone().add(V(1.4 * z, 0.7 * z, 3.2 * z));
    } else if (t < P.f4) {                        // 3. el polvo y el perro
      const z = z1(1, 0.9, P.f3, P.f4);
      mira = V(1.12, 0.85, -1.1); pos = mira.clone().add(V(-1.8 * z, 1.4 * z, 4.4 * z));
    } else if (t < P.f5) {                        // 4. la pestaña y el ventilador que despega
      const z = z1(1, 0.92, P.f4, P.f5);
      mira = V(0.25, 1.7, -1.1); pos = mira.clone().add(V(1.2 * z, -0.6 * z, 5.6 * z));
    } else if (t < P.f6) {                        // 5. el precio: el técnico la pone a punto
      const z = z1(1, 0.93, P.f5, P.f6);
      mira = V(-0.1, 1.15, -1.25); pos = mira.clone().add(V(-2.2 * z, 0.9 * z, 5.0 * z));
    } else if (t < P.rem) {                       // 6. prende al toque
      const z = z1(1, 0.92, P.f6, P.rem);
      mira = V(0.15, 1.2, -1.2); pos = mira.clone().add(V(1.8 * z, 0.7 * z, 6.0 * z));
    } else {                                      // 7. remate: el perro se sacude
      const z = z1(1, 0.86, P.rem, P.cierre);
      mira = V(1.05, 0.9, -0.9); pos = mira.clone().add(V(-0.9 * z, 1.3 * z, 6.2 * z));
    }
    paredFondo.visible = t >= P.f2;
    cam.position.copy(pos); cam.lookAt(mira); cam.updateProjectionMatrix(); cam.updateMatrixWorld();
  }
  function sentar(p, y = 0.62) { const u = p.userData; u.cadera.position.y = y; u.piernaI.rotation.x = u.piernaD.rotation.x = -1.45; }

  // la pantalla según el momento
  function monitor(t) {
    const col = pantalla.material.color;
    spin.visible = false; barra.visible = barraFondo.visible = false; ventana.visible = false; check.visible = false;
    const progreso = s => { barra.visible = barraFondo.visible = true; const w = Math.max(0.005, 0.5 * s); barra.scale.x = w; barra.position.x = MON.x - 0.25 + w / 2; };
    if (t < 0.35) col.set('#0E1815');
    else if (t < P.f2 + 0.25) { col.set('#1F3B66'); spin.visible = true; spin.rotation.z = -t * 5; }
    else if (t < P.f3) { col.set('#1F3B66'); progreso(0.02 + 0.006 * (t - P.f2)); spin.visible = true; spin.position.y = MON.y + 0.06; spin.rotation.z = -t * 5; }
    else if (t < P.pestana) { col.set('#1F3B66'); spin.visible = true; spin.position.y = MON.y; spin.rotation.z = -t * 5; }
    else if (t < P.f5) { col.set('#1F3B66'); ventana.visible = true; ventana.scale.setScalar(k.rebote((t - P.pestana) / 0.3)); }
    else if (t < P.arreglo) { col.set('#1B1F1D'); progreso(k.suave((t - P.f5 - 0.2) / (P.arreglo - P.f5 - 0.3))); }
    else { col.set('#2B7E62'); check.visible = true; check.scale.setScalar(k.rebote((t - P.arreglo) / 0.35)); }
  }

  return {
    get duracion() { return P.cierre + 2.8; },
    get cierre() { return P.cierre; },
    get efectos() {
      const r = x => +x.toFixed(2);
      return [
        { efecto: 'tic', t: r(0.3), db: -18 },
        { efecto: 'pop', t: r(P.barba + 0.1), db: -17 },
        { efecto: 'latigazo', t: r(P.f2 - 0.2), db: -19 },
        { efecto: 'tic', t: r(P.f2 + 0.1), db: -18 },
        { efecto: 'falla', t: r(P.actualizar + 0.2), db: -22 },
        { efecto: 'latigazo', t: r(P.f3 - 0.2), db: -19 },
        { efecto: 'lluvia', t: r(P.polvo + 0.1), db: -24 },
        { efecto: 'pop', t: r(P.gris), db: -15 },
        { efecto: 'latigazo', t: r(P.f4 - 0.2), db: -19 },
        { efecto: 'tic', t: r(P.pestana), db: -18 },
        { efecto: 'motor', t: r(P.despega - 0.2), db: -24 },
        { efecto: 'latigazo', t: r(P.f5 - 0.2), db: -19 },
        { efecto: 'tecleo', t: r(P.f5 + 0.2), db: -22 },
        { efecto: 'pop', t: r(P.precio - 0.15), db: -16 },
        { efecto: 'campanita', t: r(P.precio + 0.05), db: -18 },
        { efecto: 'sello', t: r(P.precio + 0.3), db: -18 },
        { efecto: 'latigazo', t: r(P.f6 - 0.2), db: -19 },
        { efecto: 'acierto', t: r(P.arreglo + 0.05), db: -17 },
        { efecto: 'latigazo', t: r(P.rem - 0.2), db: -19 },
        { efecto: 'lluvia', t: r(P.rem + 0.3), db: -24 },
        { efecto: 'pop', t: r(P.sucio), db: -14 },
        { efecto: 'golpe', t: r(P.cierre + 0.1), db: -14 },
      ];
    },
    armar(kit) {
      k = kit; tiempos();
      const T = k.THREE;
      k.sol.position.set(4, 14, 9);
      const luz2 = new T.DirectionalLight('#FFF4DF', 0.75); luz2.position.set(-6, 9, 7); k.escena.add(luz2);
      gris = k.mat('#A9ADA8');
      cuarto();
      fan = armarFan();
      silla = armarSilla();
      polvo = k.humo(22, '#B7B9B3');
      polvo2 = k.humo(22, '#B7B9B3');
      // vos (buzo turquesa, para que se vea la barba)
      yo = k.personaje({ ropa: '#3A9CA8', pantalon: '#3C4A66', pelo: '#2B1D16', zapatillas: '#F2F2EE' });
      // la barba: crece de arriba hacia abajo desde el mentón
      barba = k.caja(0.4, 1, 0.1, '#3A2A20', 0, 0.12, 0.215, yo.userData.cuello, false);
      // el perro (el testigo), marrón con orejas oscuras
      perro = k.perro({ color: '#B97A45', oscuro: '#7A4A26' });
      // el técnico (gorra verde)
      tec = k.personaje({ ropa: '#F4F2EC', pantalon: '#2E3F66', zapatillas: '#2A2E2C', piel: '#C9956E', pelo: '#2B1D16', gorra: k.C.verde });
      url = k.etiquetaUrl();
      etqArranque = k.etiqueta('Esperando hace 47 minutos');
      etqUpd = k.etiqueta('Actualización 1 de 847');
      etqPolvo = k.etiqueta('Polvo: 2 kilos');
      etqDevuelto = k.etiqueta('Polvo: devuelto');
      card = k.tarjeta(`<div class="sello">Precio<br>de<br>referencia</div>
        <div class="t-et">FORMATEO O PUESTA A PUNTO DE COMPUTADORA</div>
        <div class="t-precio">$34.000<span>a</span>$79.000</div>
        <div class="t-nota">Noviembre 2026 · AMBA · por trabajo</div>`);
      chip = k.tarjeta(`<div class="ok">✓</div><div><div class="c1">Pedido publicado gratis</div><div class="c2">Soporte técnico · tu zona</div></div>`, 'chip3d');
      fin = k.cierre('Pedí presupuestos', 'de gente de tu zona');
    },
    animar(t) {
      const T = k.THREE, U = yo.userData, UP = perro.userData;
      monitor(t);

      // ---- la barba: crece mientras esperás ----
      const largo = t < P.f2 ? 0.02 + 0.3 * k.suave((t - 0.6) / Math.max(0.5, P.barba + 0.3 - 0.6))
        : t < P.f3 ? 0.32 + 0.18 * k.suave((t - P.f2) / (P.f3 - P.f2)) : 0.5;
      barba.scale.y = largo; barba.position.y = 0.14 - largo / 2;

      // ---- la tapa de la torre y el ventilador ----
      tapa.rotation.y = t >= P.f3 + 0.2 && t < P.f5 ? -1.2 * k.suave((t - P.f3 - 0.2) / 0.4) : 0;
      if (t < P.despega - 0.1 || t >= P.f5) {
        fan.position.set(FAN0.x, FAN0.y, FAN0.z); fan.rotation.set(0, 0, 0); fan.scale.setScalar(1);
        aspas.rotation.y = t >= P.f5 ? t * 9 : t * 2.5;
      } else {                                   // despega: sube y da vueltas por el cuarto como un dron
        const e = t - (P.despega - 0.1), sube = k.suave(e / 0.6);
        const r = 0.9 * k.suave((e - 0.4) / 0.6), w = e * 2.6;
        fan.position.set(FAN0.x - 0.45 * k.suave((e - 0.4) / 0.6) + r * Math.cos(w) * 0.9, FAN0.y + 0.6 * sube + 0.08 * Math.sin(e * 7), FAN0.z + 0.95 * k.suave((e - 0.4) / 0.6) + r * Math.sin(w) * 0.6);
        fan.rotation.set(0.25 * Math.sin(w), 0, 0.25 * Math.cos(w)); fan.scale.setScalar(1 + 1.2 * sube);
        aspas.rotation.y = t * 40;
      }

      // ---- el polvo: de la torre al perro, y en el remate del perro a vos ----
      const mezcla = (a, b, u) => ({ x: k.lerp(a.x, b.x, u), y: k.lerp(a.y, b.y, u), z: k.lerp(a.z, b.z, u) });
      const DESDE = { x: TORRE.x + 0.1, y: TORRE.y, z: TORRE.z + 0.3 }, AL_PERRO = { x: CAMA.x - 0.05, y: 0.45, z: CAMA.z };
      polvo.animar(t, P.polvo + 0.1, P.gris + 0.35, mezcla(DESDE, AL_PERRO, k.suave((t - P.polvo - 0.1) / Math.max(0.4, P.gris - P.polvo - 0.1))));
      const A_VOS = { x: YO_REM.x, y: 1.1, z: YO_REM.z };
      polvo2.animar(t, P.rem + 0.25, P.sucio + 0.45, mezcla({ x: CAMA.x, y: 0.55, z: CAMA.z }, A_VOS, k.suave((t - P.rem - 0.25) / (P.sucio - P.rem - 0.25))));

      // ---- vos ----
      silla.position.set(SILLA.x, 0, SILLA.z); silla.rotation.y = 0;
      const perroGris = t >= P.gris - 0.05 && t < P.rem + 0.55;
      enPolvo(perro, perroGris);
      enPolvo(yo, t >= P.sucio);
      if (t < P.f3) {                            // sentado frente a la compu
        yo.position.set(SILLA.x, 0, SILLA.z - 0.05); yo.rotation.y = Math.PI;
        if (t < P.f2) {
          // los dedos tamborilean en la mesa y la cabeza se ladea, cada vez más aburrido
          k.pose(yo, { tocar: t * 0.35, cabezaX: -0.05 }); sentar(yo, 0.62);
          U.cuello.rotation.z = -0.16 * k.suave(t / 2.2);
        } else if (t < P.actualizar + 0.2) { k.pose(yo, { tocar: t, cabezaX: 0.05 }); sentar(yo, 0.62); }
        else { k.pose(yo, { manosCabeza: t }); sentar(yo, 0.62); }
      } else if (t < P.f4) {                     // parado, agachado frente a la torre, soplando
        yo.position.set(YO_TORRE.x, 0, YO_TORRE.z); yo.rotation.y = Math.PI + 0.45;
        if (t < P.gris + 0.1) {
          k.pose(yo, { cabezaX: 0.45 }); U.cadera.rotation.x = 0.32;
          U.brazoI.rotation.set(-1.2, 0, 0.2); U.brazoD.rotation.set(-1.2, 0, -0.2);
        } else { yo.position.set(0.55, 0, -0.8); k.pose(yo, { manosCabeza: t }); yo.rotation.y = Math.PI / 2 + 0.6; }
        silla.position.set(SILLA.x - 0.3, 0, SILLA.z + 0.25); silla.rotation.y = 0.5;
      } else if (t < P.f5) {                     // sentado de nuevo; con el dron te agachás
        yo.position.set(SILLA.x, 0, SILLA.z - 0.05); yo.rotation.y = Math.PI;
        if (t < P.despega) { k.pose(yo, { tocar: t, cabezaX: 0.05 }); sentar(yo, 0.62); }
        else {
          const v = Math.atan2(fan.position.x - SILLA.x, fan.position.z - SILLA.z);
          k.pose(yo, { manosCabeza: t, cabezaX: -0.35 }); sentar(yo, 0.5); U.cuello.rotation.y = k.clamp(v - Math.PI, -1, 1) * 0.6;
        }
      } else if (t < P.rem) {                    // el técnico en la silla; vos al costado
        yo.position.set(YO_COSTADO.x, 0, YO_COSTADO.z); yo.rotation.y = Math.PI + 0.35;
        if (t < P.arreglo) k.pose(yo, { brazosCruzados: true, cabezaX: 0.1 });
        else k.pose(yo, { festejo: t });
        silla.position.set(SILLA.x, 0, SILLA.z);
      } else {                                   // remate: mirás al perro y te llega el polvo
        yo.position.set(YO_REM.x, 0, YO_REM.z); yo.rotation.y = Math.PI / 2 + 0.35;
        if (t < P.sucio) k.pose(yo, { cabezaX: 0.15 });
        else { k.pose(yo, { brazosCruzados: true, cabezaX: 0.1 }); yo.rotation.y = Math.PI / 2 + 0.75; }
      }

      // ---- el perro (el testigo) ----
      perro.position.set(CAMA.x, 0.1, CAMA.z); perro.rotation.y = -Math.PI / 2 - 0.25;
      if (t < P.f2) {                            // duerme en su almohadón
        k.posePerro(perro, { sentado: true, cabezaX: 0.45, cola: t * 0.15 });
      } else if (t < P.f3) {                     // bosteza
        const b = k.clamp((t - P.f2 - 0.6) / 1.2);
        k.posePerro(perro, { sentado: true, cabezaX: 0.3 * (1 - Math.sin(b * Math.PI)) - 0.4 * Math.sin(b * Math.PI) });
        UP.boca.rotation.x = 0.5 * Math.sin(b * Math.PI);
      } else if (t < P.f4) {                     // lo tapa el polvo: queda gris y te mira
        if (t < P.gris) k.posePerro(perro, { sentado: true, cabezaX: 0.2 });
        else { k.posePerro(perro, { sentado: true, cabezaY: -0.5, colaX: -1.4 }); perro.rotation.y = -Math.PI / 2 - 0.6; }
      } else if (t < P.f5) {                     // sigue al ventilador con la cabeza y le ladra
        const v = Math.atan2(fan.position.x - CAMA.x, fan.position.z - CAMA.z) - perro.rotation.y;
        const dif = Math.atan2(Math.sin(v), Math.cos(v));
        k.posePerro(perro, { cabezaY: k.clamp(dif, -1.1, 1.1), cabezaX: -0.5, aullar: t > P.despega + 0.4 ? t : 0, colaX: -1.4 });
        if (t <= P.despega + 0.4) UP.cuello.rotation.x = -0.2;
      } else if (t < P.rem) {                    // gris, sentado, resignado
        k.posePerro(perro, { sentado: true, cabezaY: -0.35, colaX: -1.4 });
      } else {                                   // remate: se para, se sacude y vuelve a ser marrón
        const e = t - P.rem;
        if (e < 0.25) k.posePerro(perro, {});
        else if (e < 0.95) { k.posePerro(perro, {}); UP.cuerpo.rotation.z = Math.sin(e * 38) * 0.35; UP.cuello.rotation.y = Math.sin(e * 38 + 1) * 0.5; }
        else k.posePerro(perro, { cola: t, cabezaX: -0.15, cabezaY: -0.35 });
        perro.rotation.y = -Math.PI / 2 - 0.25;
      }

      // ---- el técnico ----
      tec.visible = t >= P.f5 - 0.01 && t < P.rem;
      if (t < P.arreglo + 0.2) {                 // sentado en tu silla, tecleando
        tec.position.set(SILLA.x, 0, SILLA.z - 0.05); tec.rotation.y = Math.PI;
        k.pose(tec, { tocar: t * 1.6, cabezaX: 0.05 }); sentar(tec, 0.62);
      } else {                                   // se para y saluda
        tec.position.set(SILLA.x - 0.55, 0, SILLA.z + 0.15); tec.rotation.y = -0.35;
        k.pose(tec, t > P.f6 + 0.2 ? { saludo: t } : {});
      }
      if (tec.visible && t < P.arreglo + 0.2) silla.position.set(SILLA.x, 0, SILLA.z);

      camara(t);
      // ---- carteles y textos ----
      const hb = new T.Vector3(); barba.getWorldPosition(hb);
      etqArranque.animar(t, 0.9, P.f2 + 0.05, { x: hb.x, y: hb.y - 0.05, z: hb.z }, -40, 70);
      etqUpd.animar(t, P.actualizar + 0.25, P.f3 + 0.05, { x: MON.x - 0.15, y: MON.y - 0.1, z: MON.z + 0.02 }, 70, 160);
      etqPolvo.animar(t, P.polvo + 0.35, P.f4 + 0.05, { x: TORRE.x, y: TORRE.y + 0.2, z: TORRE.z + 0.25 }, 60, -180);
      const hv = new T.Vector3(); U.cabeza.getWorldPosition(hv);
      etqDevuelto.animar(t, P.sucio + 0.2, P.cierre + 0.15, { x: hv.x, y: hv.y + 0.1, z: hv.z }, 90, 60);
      k.mostrar(card, t, P.precio - 0.15, P.f6 - 0.05);
      k.mostrar(chip, t, P.f6 + 0.25, P.cierre + 0.2);
      url.style.opacity = t < P.cierre ? 1 : 0;
      fin.animar(t, P.cierre);
    },
  };
})();
