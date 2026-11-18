/* Escena del video 3D de plomería (comun-3d.js). Cada red tiene su HTML
   (video-3d-plomeria-tt/ig/fb.html) que solo define window.RED.
   Un monoambiente: la cama, la cocina y la heladera en el mismo lugar, así la
   cámara ve la canilla y la cama a la vez. Historia en escalera, graciosa: la
   canilla gotea toda la noche, el balde rebalsa, la cinta sale volando (y se le
   pega al gato en la cara), el tutorial la convierte en una fuente y el gato
   termina surfeando en una bandeja. Llega el plomero, la arregla, el piso se
   seca y el gato queda decepcionado: se le terminó la ola. */
window.ESCENA3D = (function () {
  let k, yo, gato, plomero, caja, llave, mesa, balde, chorro, chispa, celu, manta, almohadaCara, cintaVuela, cintaCara, cintaCanilla;
  let charco, cascada, tabla, gota, etqPlic, etqCinta, etqGato, card, chip, fin, url, manija;
  const P = {};
  function tiempos() {
    P.f2 = k.frase(2, 3.3);        // el balde y rebalsa
    P.f3 = k.frase(3, 6.2);        // la cinta sale volando
    P.f4 = k.frase(4, 9.0);        // el tutorial y el gato surfeando
    P.f5 = k.frase(5, 13.2);       // el precio
    P.f6 = k.frase(6, 18.6);       // pedilo gratis
    P.rebalsa = k.palabra('laguna', 1, P.f2 + 1.8);   // «y a la mañana tenés una laguna»
    P.vuela = k.palabra('volando', 1, P.f3 + 1.8);
    P.tutorial = k.palabra('tutorial', 1, P.f4 + 0.6);
    P.salta = P.tutorial + 0.45;   // la manija salta y sale la fuente
    P.surf = k.palabra('surf', 1, P.f4 + 2.4);
    P.precio = k.palabra('treinta', 1, k.palabra('36', 1, P.f5 + 2.3));
    P.fin = k.finVoz(22);
    P.cierre = P.fin + 0.35;
    P.m0 = P.f5 + 0.15;            // entra el plomero
    P.m1 = P.m0 + 1.5;             // llega a la canilla
    P.arreglado = P.m1 + 1.5;      // se corta el agua
    P.sube = P.rebalsa - 0.1;      // el gato salta a la heladera
    P.corte1 = Math.min(1.75, P.f2 - 0.9);   // de la canilla a la cama
    // gotas: una cada 0,55 s hasta que la cinta sale volando
    P.gotas = [];
    for (let g = 0.25; g < P.vuela; g += 0.55) P.gotas.push(g);
  }
  const ZF = -2.1, H = 2.6;
  const CAMA = { x: -1.9, z: -0.95 }, MESADA = { x: 1.2, z: -1.77 }, HELADERA = { x: 2.95, z: -1.72 };
  const YO_PILETA = { x: 0.62, z: -1.18 }, YO_COSTADO = { x: -0.25, z: -0.55 }, YO_RUMBO = 2.3;
  const PLOMERO_A = { x: 4.8, z: 0.7 }, PLOMERO = { x: 1.55, z: -1.05 }, CAJA = { x: 2.2, z: -0.8 };
  const GATO_CAMA = { x: -1.42, y: 0.47, z: -0.2 }, GATO_PISO = { x: 1.95, y: 0, z: -1.0 }, GATO_FIN = { x: 1.0, z: 0.45 };
  const GATO_HELADERA = { x: 2.95, y: 1.83, z: -1.6 }, CHARCO = { x: 1.1, z: -0.65 };

  function casa() {
    const T = k.THREE, c = (w, h, d, col, x, y, z, s = true) => k.caja(w, h, d, col, x, y, z, k.escena, s);
    const piso = new T.Mesh(new T.PlaneGeometry(80, 80), k.mat('#9EA6A0'));
    piso.rotation.x = -Math.PI / 2; piso.position.y = -0.04; piso.receiveShadow = true; k.escena.add(piso);
    // piso: madera en la parte de la cama, baldosas en la cocina
    c(3.6, 0.1, 3.6, '#B98A5E', -1.4, -0.03, -0.3, false);
    for (let i = 1; i < 6; i++) c(0.02, 0.012, 3.6, '#A57A50', -3.2 + i * 0.6, 0.025, -0.3, false);
    for (let i = 0; i < 10; i++) for (let j = 0; j < 9; j++) c(0.38, 0.1, 0.38, (i + j) % 2 ? '#EDEAE2' : '#C9C2B4', 0.6 + i * 0.4, -0.03, ZF + 0.2 + j * 0.4, false);
    // paredes: fondo (amarillo suave del lado de la cama, verde agua en la cocina), costados
    c(3.6, H, 0.16, '#E9DFC4', -1.4, H / 2, ZF - 0.08);
    c(4.0, H, 0.16, '#D3E6E0', 2.4, H / 2, ZF - 0.08);
    for (let i = 0; i < 9; i++) c(0.02, 0.62, 0.02, '#B7D0C8', 0.12 + i * 0.27, 1.25, ZF + 0.005, false);  // azulejos sobre la mesada
    c(2.3, 0.02, 0.02, '#B7D0C8', 1.2, 1.56, ZF + 0.005, false); c(2.3, 0.02, 0.02, '#B7D0C8', 1.2, 0.94, ZF + 0.005, false);
    c(0.16, H, 3.6, '#EDE6D6', -3.2, H / 2, -0.3);
    c(0.16, H, 2.0, '#EDE6D6', 4.4, H / 2, ZF + 1.0);
    c(0.2, 0.05, 3.6, '#8C877C', -3.2, H + 0.02, -0.3, false); c(0.2, 0.05, 2.0, '#8C877C', 4.4, H + 0.02, ZF + 1.0, false);
    c(7.8, 0.05, 0.2, '#8C877C', 0.6, H + 0.02, ZF - 0.08, false);
    // ventana entre la cama y la cocina (de noche se ve oscura)
    c(0.9, 1.0, 0.04, '#9FC0D4', -0.45, 1.6, ZF + 0.02); c(1.0, 0.06, 0.12, '#D2CDC0', -0.45, 1.07, ZF + 0.06);
    c(0.04, 1.0, 0.05, '#D2CDC0', -0.45, 1.6, ZF + 0.04, false);
    // la cama (cabecera contra la pared), la manta y la mesa de luz con el velador
    c(1.35, 0.32, 2.3, '#7A5B3E', CAMA.x, 0.16, CAMA.z);
    c(1.28, 0.16, 2.24, '#F0EEE8', CAMA.x, 0.39, CAMA.z);
    c(1.35, 0.7, 0.1, '#6A4E35', CAMA.x, 0.35, ZF + 0.02);
    c(0.6, 0.12, 0.38, '#FCFBF8', CAMA.x, 0.53, -1.82);
    manta = c(1.32, 0.12, 1.35, '#5B7FA6', CAMA.x, 0.53, -0.32);
    c(0.45, 0.5, 0.4, '#8E6C4A', -0.85, 0.25, -1.75);
    c(0.08, 0.3, 0.08, '#2A2E2C', -0.85, 0.65, -1.75); c(0.3, 0.22, 0.3, '#F2D27A', -0.85, 0.9, -1.75);
    c(1.6, 0.02, 1.2, k.C.verdeVivo, -0.2, 0.03, 0.35, false);    // alfombra
    // cocina: mesada con bacha y canilla, heladera, banqueta y un repasador
    mesa = k.mesada({ ancho: 2.3 }); mesa.position.set(MESADA.x, 0, MESADA.z);
    manija = mesa.userData.manija;
    c(0.75, 1.8, 0.7, '#EEF0EE', HELADERA.x, 0.9, HELADERA.z);
    c(0.76, 0.02, 0.71, '#C9CCC9', HELADERA.x, 1.2, HELADERA.z, false);
    c(0.04, 0.4, 0.05, '#9AA3A6', HELADERA.x - 0.28, 1.5, HELADERA.z + 0.37, false);
    c(0.04, 0.5, 0.05, '#9AA3A6', HELADERA.x - 0.28, 0.75, HELADERA.z + 0.37, false);
    c(0.18, 0.12, 0.01, k.C.laton, HELADERA.x + 0.1, 1.5, HELADERA.z + 0.36, false);   // un imán
    c(0.35, 0.5, 0.06, '#C8473A', 0.35, 0.62, MESADA.z + 0.33, false);                 // repasador colgado
    // puerta de entrada (a la derecha, adelante)
    c(0.1, 2.1, 0.95, '#6A4E35', 4.42, 1.05, 0.95);
  }

  function camara(t) {
    const cam = k.camara, V = (x, y, z) => new k.THREE.Vector3(x, y, z);
    let pos, mira;
    if (t < P.corte1) {                          // 1a. de noche: la canilla que gotea, de cerca
      const z = k.lerp(0.66, 0.6, k.suave(t / P.corte1));
      mira = V(1.25, 1.05, -1.65); pos = mira.clone().add(V(2.1 * z, 1.25 * z, 4.1 * z));
    } else if (t < P.f2) {                       // 1b. corte a la cama: la almohada en la cara y el gato que cuenta las gotas
      const z = k.lerp(1, 0.9, k.suave((t - P.corte1) / (P.f2 - P.corte1)));
      mira = V(-1.8, 0.62, -1.05); pos = mira.clone().add(V(1.3 * z, 2.9 * z, 4.0 * z));
    } else if (t < P.f3) {                       // 2. el balde que rebalsa y el gato que se sube a la heladera
      const z = k.lerp(1, 0.94, k.suave((t - P.f2) / (P.f3 - P.f2))), u = k.suave((t - P.sube + 0.15) / 0.5);
      mira = V(k.lerp(1.35, 2.35, u), k.lerp(1.0, 1.35, u), -1.45); pos = mira.clone().add(V(1.4 * z, 1.8 * z, 5.6 * z));
    } else if (t < P.f4) {                       // 3. la cinta: de la canilla a la cara del gato
      // un solo encuadre con la canilla y el gato arriba de la heladera: la cinta cruza de una punta a la otra
      const z = k.lerp(1, 0.93, k.suave((t - P.f3) / (P.f4 - P.f3)));
      mira = V(2.05, 1.85, -1.55); pos = mira.clone().add(V(1.0 * z, 1.0 * z, 7.0 * z));
    } else if (t < P.f5) {                       // 4. desde arriba: la fuente y el gato surfeando
      const z = k.lerp(1, 0.92, k.suave((t - P.f4) / (P.f5 - P.f4)));
      mira = V(1.15, 0.85, -0.7); pos = mira.clone().add(V(2.6 * z, 4.4 * z, 6.2 * z));
    } else if (t < P.precio + 1.4) {             // 5a. entra el plomero
      const a = k.suave((t - P.f5) / (P.precio + 1.4 - P.f5));
      mira = V(k.lerp(2.6, 1.7, a), 1.0, -0.6); pos = mira.clone().add(V(2.0, 2.6, k.lerp(8.2, 7.4, a)));
    } else if (t < P.f6) {                       // 5b. la arregla, de cerca
      const z = k.lerp(1, 0.92, k.suave((t - P.precio - 1.4) / Math.max(0.5, P.f6 - P.precio - 1.4)));
      mira = V(1.5, 1.1, -1.3); pos = mira.clone().add(V(2.6 * z, 1.3 * z, 5.3 * z));
    } else {                                     // 6. remate: el gato decepcionado en su bandeja
      const u = k.suave((t - P.f6) / Math.min(2.2, Math.max(1, P.cierre - P.f6 - 0.6)));
      mira = V(k.lerp(1.5, GATO_FIN.x, u), k.lerp(1.1, 0.6, u), k.lerp(-1.3, GATO_FIN.z, u));
      pos = mira.clone().add(V(k.lerp(2.4, 0.9, u), k.lerp(1.2, 0.95, u), k.lerp(4.8, 2.9, u)));
    }
    cam.position.copy(pos); cam.lookAt(mira); cam.updateProjectionMatrix(); cam.updateMatrixWorld();
  }
  function andar(p, A, B, t, t0, t1) {
    const u = k.clamp((t - t0) / (t1 - t0)), d = Math.hypot(B.x - A.x, B.z - A.z);
    p.position.set(k.lerp(A.x, B.x, u), 0, k.lerp(A.z, B.z, u));
    return { andando: t > t0 && t < t1, rumbo: Math.atan2(B.x - A.x, B.z - A.z), paso: u * d / 1.1 };
  }
  // salto en arco de A a B entre t0 y t1
  function saltar(p, A, B, t, t0, t1, alto = 0.6) {
    const u = k.clamp((t - t0) / (t1 - t0));
    p.position.set(k.lerp(A.x, B.x, u), k.lerp(A.y, B.y, u) + Math.sin(u * Math.PI) * alto, k.lerp(A.z, B.z, u));
    return u;
  }
  const noche = { fondo: '#28344C', luz: 0.42, sol: 0.28 }, dia = { fondo: '#C9D8D0', luz: 1.25, sol: 2.1 };

  return {
    get duracion() { return P.cierre + 2.8; },
    get cierre() { return P.cierre; },
    // efectos (sonido.py): las gotas, el agua, los saltos, los cortes, el precio, el chip y el logo
    get efectos() {
      const r = x => +x.toFixed(2);
      return [
        ...P.gotas.filter(g => g < P.f2 + 0.5).slice(0, 6).map(g => ({ efecto: 'tic', t: r(g + 0.2), db: -15 })),
        { efecto: 'latigazo', t: r(P.corte1 - 0.2), db: -21 },
        { efecto: 'latigazo', t: r(P.f2 - 0.2), db: -19 },
        { efecto: 'lluvia', t: r(P.rebalsa - 0.2), db: -30 },
        { efecto: 'pop', t: r(P.sube + 0.05), db: -17 },
        { efecto: 'latigazo', t: r(P.f3 - 0.2), db: -19 },
        { efecto: 'pop', t: r(P.vuela - 0.05), db: -16 },
        { efecto: 'pop', t: r(P.vuela + 0.45), db: -17 },
        { efecto: 'latigazo', t: r(P.f4 - 0.2), db: -19 },
        { efecto: 'golpe', t: r(P.salta), db: -18 },
        { efecto: 'lluvia', t: r(P.salta + 0.05), db: -24 },
        { efecto: 'lluvia', t: r(P.salta + 2.9), db: -26 },
        { efecto: 'latigazo', t: r(P.f5 - 0.2), db: -19 },
        { efecto: 'tic', t: r(P.m1 + 0.4), db: -16 }, { efecto: 'tic', t: r(P.m1 + 0.8), db: -16 },
        { efecto: 'pop', t: r(P.precio - 0.15), db: -16 },
        { efecto: 'campanita', t: r(P.precio + 0.05), db: -18 },
        { efecto: 'sello', t: r(P.precio + 0.3), db: -18 },
        { efecto: 'latigazo', t: r(P.f6 - 0.2), db: -19 },
        { efecto: 'pop', t: r(P.f6 + 0.25), db: -16 },
        { efecto: 'golpe', t: r(P.cierre + 0.1), db: -14 },
      ];
    },
    armar(kit) {
      k = kit; tiempos();
      k.sol.position.set(4, 15, 10);
      casa();
      const T = k.THREE;
      // vos (en piyama a rayas), el gato y el plomero con su caja
      yo = k.personaje({ ropa: '#8FB3D9', pantalon: '#8FB3D9', zapatillas: '#E8E2D6', pelo: '#3A2418' });
      for (let i = 0; i < 3; i++) k.caja(0.63, 0.05, 0.37, '#F4F2EC', 0, 0.15 + i * 0.22, 0, yo.userData.cadera, false);
      almohadaCara = k.caja(0.55, 0.13, 0.36, '#FCFBF8', 0, 0, 0);
      gato = k.gato();
      plomero = k.personaje({ ropa: k.C.verde, pantalon: '#2A2E2C', piel: '#C9956E', pelo: '#2B1D16', gorra: k.C.laton });
      llave = k.llaveInglesa(plomero.userData.brazoD); llave.position.set(0, -0.62, 0.06);
      caja = k.herramientas();
      // el agua: la gota, el balde, el desborde, el charco, la fuente y el chorrito que saca la cinta
      gota = new T.Mesh(new T.SphereGeometry(0.035, 6, 5), k.mat('#9FD6F0')); gota.scale.y = 1.4; k.escena.add(gota);
      balde = k.balde(); balde.scale.setScalar(0.62); balde.position.set(MESADA.x, 0.92, MESADA.z + 0.04);
      cascada = k.caja(0.42, 1, 0.04, '#9FD6F0', MESADA.x, 0.45, MESADA.z + 0.34, k.escena, false);
      cascada.material = cascada.material.clone(); cascada.material.transparent = true; cascada.material.opacity = 0.75;
      charco = new T.Mesh(new T.CylinderGeometry(1, 1, 0.02, 24), new T.MeshLambertMaterial({ color: '#8CCBEA', transparent: true, opacity: 0.85 }));
      charco.position.set(CHARCO.x, 0.035, CHARCO.z); charco.receiveShadow = true; k.escena.add(charco);
      chorro = k.chorro(200, 41); chispa = k.chorro(60, 77);
      // la cinta: en la canilla, volando y pegada en la cara del gato
      cintaCanilla = k.caja(0.11, 0.13, 0.11, '#9A9C96', 0, 0, 0, k.escena, false);
      cintaVuela = k.caja(0.16, 0.06, 0.02, '#9A9C96', 0, 0, 0, k.escena, false);
      cintaCara = k.caja(0.3, 0.07, 0.02, '#9A9C96', 0, 0.2, 0.22, gato.userData.cuello, false);
      cintaCara.rotation.z = 0.25;
      // la bandeja que el gato usa de tabla de surf
      tabla = new T.Group(); k.escena.add(tabla);
      k.caja(0.5, 0.04, 0.82, '#E07A3A', 0, 0.02, 0, tabla); k.caja(0.08, 0.045, 0.8, '#FCFBF8', 0, 0.025, 0, tabla, false);
      // el tutorial en el celular (en su trípode, mirando hacia vos)
      celu = k.celular(); celu.position.set(0.15, 0, -1.45); celu.rotation.y = 0.9;
      url = k.etiquetaUrl();
      etqPlic = k.etiqueta('Plic: 3.400');
      etqCinta = k.etiqueta('Cinta: 0 % efectiva');
      etqGato = k.etiqueta('Gato: decepcionado');
      card = k.tarjeta(`<div class="sello">Precio<br>de<br>referencia</div>
        <div class="t-et">CAMBIO O ARREGLO DE CANILLA</div>
        <div class="t-precio">$36.000<span>a</span>$61.000</div>
        <div class="t-nota">Noviembre 2026 · AMBA · por trabajo</div>`);
      chip = k.tarjeta(`<div class="ok">✓</div><div><div class="c1">Pedido publicado gratis</div><div class="c2">Plomería · tu zona</div></div>`, 'chip3d');
      fin = k.cierre('Pedí presupuestos', 'de gente de tu zona');
    },
    animar(t) {
      const T = k.THREE;
      // noche hasta la frase 2: fondo oscuro, poca luz, el velador prendido
      const n = 1 - k.suave((t - P.f2 + 0.25) / 0.3);
      k.escena.background.set(dia.fondo).lerp(new T.Color(noche.fondo), n); k.escena.fog.color.copy(k.escena.background);
      k.cielo.intensity = k.lerp(dia.luz, noche.luz, n); k.sol.intensity = k.lerp(dia.sol, noche.sol, n);

      const pico = mesa.userData.picoMundo();
      // la gota: cae del pico al balde cada 0,55 s (hasta que la cinta sale volando)
      gota.visible = false;
      for (const g of P.gotas) {
        const e = t - g;
        if (e >= 0 && e < 0.2) { gota.visible = true; gota.position.set(pico.x, pico.y - 0.03 - (e / 0.2) ** 2 * (t < P.f2 ? 0.24 : 0.08), pico.z); }
      }
      // el balde: aparece en la frase 2, se llena y rebalsa; el agua baja por el mueble y arma el charco
      balde.visible = t >= P.f2 - 0.05 && t < P.f3 + 0.2;
      balde.userData.nivel(k.lerp(0.45, 1, k.clamp((t - P.f2) / Math.max(0.3, P.rebalsa - P.f2))));
      const cae = k.suave((t - P.rebalsa) / 0.35) * (1 - k.suave((t - P.f3 - 0.1) / 0.3));
      cascada.visible = cae > 0.01; cascada.scale.set(1, Math.max(0.001, 0.88 * cae), 1); cascada.position.y = 0.9 - 0.44 * cae;
      let r = 0;
      if (t > P.rebalsa + 0.2) r = k.lerp(0.25, 0.85, k.suave((t - P.rebalsa - 0.2) / 1.2));
      if (t > P.salta) r = k.lerp(0.85, 2.0, k.suave((t - P.salta) / 1.6));
      if (t > P.arreglado) r *= 1 - k.suave((t - P.arreglado - 0.2) / Math.max(1, P.f6 + 0.6 - P.arreglado));
      charco.visible = r > 0.02; charco.scale.set(Math.max(0.001, r), 1, Math.max(0.001, r * 0.8));
      // la fuente: la manija salta y el agua llega al techo hasta que llega el plomero
      const fuente = k.suave((t - P.salta) / 0.15) * (1 - k.suave((t - P.arreglado) / 0.3));
      chorro.animar(t, fuente, { x: pico.x, y: 1.3, z: pico.z - 0.2 }, 1.25, 0.55);
      chispa.animar(t, t > P.vuela - 0.12 && t < P.f4 ? 0.9 : 0, { x: pico.x, y: pico.y, z: pico.z }, 0.35, 0.3);
      // la manija: sale volando, da contra el techo y cae al piso; el plomero la vuelve a poner
      if (t >= P.salta && t < P.m1 + 0.6) {
        const e = t - P.salta;
        if (e < 0.3) { const u = e / 0.3; manija.position.set(-0.1 * u, 1.3 + 1.1 * k.suave(u), -0.24); }
        else if (e < 0.9) { const u = (e - 0.3) / 0.6; manija.position.set(k.lerp(-0.1, -0.55, u), k.lerp(2.4, 0.05, u * u), k.lerp(-0.24, 0.6, u)); }
        else manija.position.set(-0.55, 0.05, 0.6);
        if (e < 0.9) manija.rotation.set(e * 9, e * 5, 0); else manija.rotation.set(Math.PI / 2, 0, 0.4);
      } else { manija.position.set(0, 1.3, -0.24); manija.rotation.set(0, 0, 0); }

      // la cinta: crece en la canilla mientras la envolvés, sale volando y se le pega al gato
      const envuelve = k.clamp((t - P.f3 - 0.2) / Math.max(0.4, P.vuela - P.f3 - 0.4));
      cintaCanilla.visible = t > P.f3 + 0.2 && t < P.vuela;
      cintaCanilla.position.set(pico.x, pico.y + 0.02, pico.z - 0.12); cintaCanilla.scale.set(0.5 + envuelve, 0.5 + envuelve, 0.5 + envuelve);
      cintaVuela.visible = t >= P.vuela && t < P.vuela + 0.45;
      if (cintaVuela.visible) {
        const u = (t - P.vuela) / 0.45, dest = new T.Vector3(GATO_HELADERA.x - 0.05, GATO_HELADERA.y + 0.62, GATO_HELADERA.z + 0.3);
        cintaVuela.position.set(k.lerp(pico.x, dest.x, u), k.lerp(pico.y, dest.y, u) + Math.sin(u * Math.PI) * 0.5, k.lerp(pico.z, dest.z, u));
        cintaVuela.rotation.set(u * 12, u * 7, u * 5);
      }
      cintaCara.visible = t >= P.vuela + 0.45 && t < P.m1;

      // vos: en la cama con la almohada en la cara; después en la pileta
      if (t < P.f2) {
        yo.position.set(CAMA.x, 0.66, 0.15); yo.rotation.set(-Math.PI / 2, 0, Math.sin(t * 1.7) * 0.06);
        k.pose(yo, { almohada: t });
        almohadaCara.visible = true; almohadaCara.position.set(CAMA.x, 0.95, -1.78); almohadaCara.rotation.set(0.1, 0, Math.sin(t * 2.4) * 0.08);
        manta.visible = true;
      } else {
        almohadaCara.visible = false; manta.visible = true;
        yo.rotation.set(0, YO_RUMBO, 0);
        if (t < P.f5) {
          yo.position.set(YO_PILETA.x, 0, YO_PILETA.z);
          if (t < P.f3) k.pose(yo, t > P.rebalsa ? { manosCabeza: t } : { cabezaX: 0.25 });
          else if (t < P.vuela) k.pose(yo, { envolver: t });
          else if (t < P.f4) { k.pose(yo, { manosCabeza: t, cabezaY: 0.6 }); yo.rotation.y = YO_RUMBO + 0.5; }
          else if (t < P.salta) { k.pose(yo, { llave: t, cabezaY: 0.5 }); }
          else { k.pose(yo, { manosCabeza: t * 1.4, salto: Math.abs(Math.sin(t * 7)) * 0.06 }); yo.position.set(YO_PILETA.x - 0.15, 0, YO_PILETA.z + 0.3); }
        } else {
          const a = andar(yo, { x: YO_PILETA.x - 0.15, z: YO_PILETA.z + 0.3 }, YO_COSTADO, t, P.f5, P.f5 + 0.8);
          if (a.andando) { yo.rotation.y = a.rumbo; k.pose(yo, { caminar: 1, paso: a.paso }); }
          else { yo.rotation.y = 1.9; k.pose(yo, t > P.arreglado ? { festejo: t } : { brazosCruzados: true }); }
        }
      }

      // el gato (el testigo): mira cada gota, se sube a la heladera, recibe la cinta,
      // surfea en la bandeja y al final queda decepcionado porque se terminó la ola
      gato.rotation.set(0, 0, 0); tabla.visible = t >= P.salta;
      if (t < P.f2) {
        gato.position.set(GATO_CAMA.x, GATO_CAMA.y, GATO_CAMA.z); gato.rotation.y = 1.25;
        let bob = 0; for (const g of P.gotas) { const e = t - g; if (e >= 0 && e < 0.45) bob = Math.sin(e / 0.45 * Math.PI) * 0.35; }
        k.posePerro(gato, { sentado: true, cabezaX: bob, cola: t });
      } else if (t < P.sube) {
        gato.position.set(GATO_PISO.x, 0, GATO_PISO.z); gato.rotation.y = -1.9;
        k.posePerro(gato, { sentado: true, cabezaX: -0.25, cola: t });
      } else if (t < P.sube + 0.55) {
        saltar(gato, GATO_PISO, GATO_HELADERA, t, P.sube, P.sube + 0.55, 0.8); gato.rotation.y = 2.4;
        k.posePerro(gato, { colaX: 0.3 });
      } else if (t < P.salta + 0.2) {
        gato.position.set(GATO_HELADERA.x, GATO_HELADERA.y, GATO_HELADERA.z); gato.rotation.y = -0.55;
        const golpe = t > P.vuela + 0.45 && t < P.vuela + 0.75;
        k.posePerro(gato, { sentado: true, cabezaX: golpe ? -0.35 : 0.1, cabezaY: t > P.vuela + 0.75 ? 0.25 : 0 });
      } else if (t < P.salta + 0.7) {
        const dest = { x: 2.1, y: 0.06, z: -0.35 };
        saltar(gato, GATO_HELADERA, dest, t, P.salta + 0.2, P.salta + 0.7, 0.4); gato.rotation.y = -1.2;
        tabla.position.set(dest.x, 0.04, dest.z); tabla.rotation.y = -1.2;
        k.posePerro(gato, {});
      } else {
        // surf: la bandeja va y viene sobre el charco; con el piso seco se frena
        const ola = t < P.arreglado ? 1 : 1 - k.suave((t - P.arreglado) / 1.4);
        const fase = (t - P.salta - 0.7) * 1.3;
        const x = k.lerp(GATO_FIN.x, k.lerp(0.6, 2.1, 0.5 + 0.5 * Math.cos(fase)), ola), z = k.lerp(GATO_FIN.z, -0.35 + Math.sin(fase * 1.7) * 0.35, ola);
        tabla.position.set(x, 0.04 + Math.sin(t * 6) * 0.025 * ola, z); tabla.rotation.set(Math.sin(t * 5) * 0.08 * ola, -1.2 + Math.sin(fase) * 0.4 * ola, Math.sin(t * 4.3) * 0.1 * ola);
        gato.position.set(x, 0.07 + Math.sin(t * 6) * 0.025 * ola, z);
        gato.rotation.set(0, tabla.rotation.y, Math.sin(t * 4.3) * 0.18 * ola);
        if (t < P.f6 - 0.2) k.posePerro(gato, { cabezaX: -0.1, cabezaY: Math.sin(t * 2) * 0.2 });
        else { gato.rotation.set(0, 0.3, 0); tabla.rotation.set(0, 0.3, 0); k.posePerro(gato, { sentado: true, cabezaX: 0.5, colaX: -0.9 }); }
      }

      // el plomero entra con la caja, ajusta la canilla y se corta el agua
      plomero.visible = t >= P.m0 - 0.05;
      const pr = andar(plomero, PLOMERO_A, PLOMERO, t, P.m0, P.m1);
      if (pr.andando) { plomero.rotation.y = pr.rumbo; k.pose(plomero, { caminar: 1, paso: pr.paso }); }
      else if (t < P.arreglado + 0.4) { plomero.rotation.y = Math.PI; k.pose(plomero, t > P.m1 ? { llave: t } : {}); }
      else { plomero.rotation.y = k.lerp(Math.PI, 0.5, k.suave((t - P.arreglado - 0.4) / 0.4)); k.pose(plomero, { saludo: t }); }
      llave.visible = t > P.m1 - 0.1 && t < P.arreglado + 0.4;
      caja.visible = t >= P.m0 - 0.05;
      if (pr.andando) { const d = new T.Vector3(0.45, 0.45, 0).applyAxisAngle(new T.Vector3(0, 1, 0), plomero.rotation.y); caja.position.set(plomero.position.x + d.x, 0.45, plomero.position.z + d.z); caja.rotation.y = plomero.rotation.y; }
      else if (t >= P.m1) { caja.position.set(CAJA.x, 0, CAJA.z); caja.rotation.y = 0.3; }
      celu.visible = t >= P.f4 - 0.05 && t < P.f5;

      camara(t);
      // carteles y textos
      etqPlic.animar(t, 0.45, 1.75, { x: pico.x, y: pico.y - 0.12, z: pico.z }, -150, -230);
      etqCinta.animar(t, P.vuela + 0.05, P.f4 - 0.05, { x: pico.x, y: pico.y + 0.05, z: pico.z }, 40, -250);
      etqGato.animar(t, P.f6 + 0.9, P.cierre + 0.15, { x: gato.position.x, y: gato.position.y + 0.72, z: gato.position.z }, 120, -200);
      k.mostrar(card, t, P.precio - 0.15, P.f6 - 0.05);
      k.mostrar(chip, t, P.f6 + 0.25, P.cierre + 0.2);
      url.style.opacity = t < P.cierre ? 1 : 0;
      fin.animar(t, P.cierre);
    },
  };
})();
