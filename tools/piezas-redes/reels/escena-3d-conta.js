/* Escena del video 3D de contabilidad e impuestos (comun-3d.js). Cada red tiene
   su HTML (video-3d-conta-tt/ig/fb.html) que solo define window.RED.
   El comedor de noche: la mesa bajo la lámpara, la caja de zapatos llena de
   facturas, la calculadora y el gato gris (el testigo). Historia en escalera,
   graciosa: te llega la recategorización del monotributo; desparramás las
   facturas en la mesa y el gato se acuesta arriba de todas; hacés las cuentas
   con la calculadora y le sale humo; le preguntás a tu tía por
   WhatsApp y te manda un audio de veinte minutos (el gato se duerme). Con el
   precio llega el contador y ordena todo en una carpeta. Remate (cámara en el
   gato): ya solos, el gato empuja la carpeta de la mesa y las facturas vuelan
   otra vez. */
window.ESCENA3D = (function () {
  let k, yo, gato, cont, caja, tapa, calcu, pantalla, celu, carpeta, lampara, humoCalc;
  let facturas = [], etqFacturas, etqCalcu, etqSiesta, etqOtraVez, burbuja, card, chip, fin, url;
  const P = {};
  const MESA = { x: 0, y: 0.81, z: -0.3, ancho: 1.9, fondo: 1.0 };
  const CAJA = { x: 0.62, z: -0.42 }, CALC = { x: -0.5, z: -0.06 };
  const GATO_SILLA = { x: -1.35, y: 0.48, z: -0.25 }, GATO_MESA = { x: 0.05, y: MESA.y, z: -0.32 };
  const YO = { x: 0.1, z: -1.08 };
  const PARED = -2.2;

  function tiempos() {
    P.f2 = k.frase(2, 4.2);
    P.f3 = k.frase(3, 8.6);
    P.f4 = k.frase(4, 12.2);
    P.f5 = k.frase(5, 16.4);
    P.f6 = k.frase(6, 22.2);
    P.desparramas = k.palabra('desparramás', 1, P.f2 + 0.1);
    P.gatoSube = k.palabra('gato', 1, P.f2 + 1.8);
    P.acuesta = k.palabra('acuesta', 1, P.gatoSube + 0.4);
    P.cuentas = k.palabra('cuentas', 1, P.f3 + 0.5);
    P.humo = k.palabra('humo', 1, P.f3 + 2.4);
    P.largar = k.palabra('sale', 1, P.humo - 0.3);
    P.tia = k.palabra('tía', 1, P.f4 + 0.8);
    P.audio = k.palabra('audio', 1, P.f4 + 2.2);
    P.precio = k.palabra('diecisiete', 1, P.f5 + 3.0);
    P.listo = P.f6 - 0.15;                                    // todo ordenado en la carpeta
    P.fin = k.finVoz(26.8);
    P.cierre = P.fin + 0.35;
    P.rem = Math.min(P.f6 + 1.5, P.cierre - 2.3);              // remate: el gato y la carpeta
    P.empuja = P.rem + 0.9;
    P.cae = P.empuja + 0.35;                                  // la carpeta llega al piso
  }

  function comedor() {
    const T = k.THREE, c = (w, h, d, col, x, y, z, s = true) => k.caja(w, h, d, col, x, y, z, k.escena, s);
    const piso = new T.Mesh(new T.PlaneGeometry(60, 60), k.mat('#6E4E36'));
    piso.rotation.x = -Math.PI / 2; piso.position.y = -0.02; piso.receiveShadow = true; k.escena.add(piso);
    for (let i = -6; i <= 6; i++) c(0.02, 0.012, 6, '#5C412D', i * 0.42, 0.0, 0, false);       // tablas del piso
    c(7, 3.0, 0.16, '#C9B59A', 0, 1.5, PARED);                                                 // pared
    c(7, 0.1, 0.05, '#E6DCCB', 0, 0.05, PARED + 0.1, false);
    // la ventana de noche, con la luna y los edificios
    c(1.5, 1.1, 0.04, '#1B2740', -1.55, 1.75, PARED + 0.09, false);
    c(1.6, 0.06, 0.08, '#E6DCCB', -1.55, 2.33, PARED + 0.1); c(1.6, 0.06, 0.08, '#E6DCCB', -1.55, 1.17, PARED + 0.1);
    c(0.06, 1.2, 0.08, '#E6DCCB', -2.35, 1.75, PARED + 0.1); c(0.06, 1.2, 0.08, '#E6DCCB', -0.75, 1.75, PARED + 0.1);
    c(0.04, 1.1, 0.06, '#E6DCCB', -1.55, 1.75, PARED + 0.1, false);
    const luna = new T.Mesh(new T.CircleGeometry(0.13, 16), new T.MeshBasicMaterial({ color: '#F4EBC8' })); luna.position.set(-1.15, 2.05, PARED + 0.115); k.escena.add(luna);
    [[-2.1, 0.32], [-1.85, 0.5], [-1.3, 0.38], [-1.0, 0.56]].forEach(([x, h]) => c(0.22, h, 0.01, '#0F1626', x, 1.2 + h / 2 + 0.02, PARED + 0.112, false));
    // un estante con carpetas y una planta
    c(1.3, 0.05, 0.3, '#7A5A3E', 1.45, 1.95, PARED + 0.2);
    ['#C8553D', '#E3B23C', '#2E5E73', '#8FD9BC'].forEach((col, i) => c(0.07, 0.32, 0.24, col, 1.0 + i * 0.1, 2.14, PARED + 0.2));
    const maceta = new T.Mesh(new T.CylinderGeometry(0.09, 0.07, 0.16, 8), k.mat('#B5583A')); maceta.position.set(1.85, 2.06, PARED + 0.2); k.escena.add(maceta);
    const hoja = new T.Mesh(new T.IcosahedronGeometry(0.14, 0), k.mat('#4C8B55')); hoja.position.set(1.85, 2.24, PARED + 0.2); k.escena.add(hoja);
    // la mesa de madera y dos sillas
    c(MESA.ancho, 0.06, MESA.fondo, '#8A5A3B', MESA.x, MESA.y - 0.03, MESA.z);
    [[-0.85, -0.42], [0.85, -0.42], [-0.85, 0.42], [0.85, 0.42]].forEach(([x, z]) => c(0.07, MESA.y - 0.06, 0.07, '#6B4430', MESA.x + x, (MESA.y - 0.06) / 2, MESA.z + z));
    [[GATO_SILLA.x, -0.25]].forEach(([x, z]) => {                                              // la silla del gato
      c(0.45, 0.05, 0.45, '#6B4430', x, 0.46, z); c(0.45, 0.5, 0.05, '#6B4430', x, 0.72, z - 0.2);
      [[-0.19, -0.19], [0.19, -0.19], [-0.19, 0.19], [0.19, 0.19]].forEach(([dx, dz]) => c(0.04, 0.44, 0.04, '#5A3826', x + dx, 0.22, z + dz));
    });
    // la lámpara colgante (su luz tibia arma la escena)
    lampara = new T.Group(); lampara.position.set(0.05, 2.75, MESA.z); k.escena.add(lampara);
    k.caja(0.015, 0.4, 0.015, '#2A2E2C', 0, 0.3, 0, lampara, false);
    const pant = new T.Mesh(new T.ConeGeometry(0.28, 0.24, 10, 1, true), k.mat('#1E5D49')); pant.material.side = T.DoubleSide; lampara.add(pant);
    const foco = new T.Mesh(new T.SphereGeometry(0.06, 8, 6), new T.MeshBasicMaterial({ color: '#FFE7B0' })); foco.position.y = -0.08; lampara.add(foco);
    const luz = new T.PointLight('#FFD9A0', 6.5, 8, 1.5); luz.position.set(0.05, 2.5, MESA.z); luz.castShadow = true; k.escena.add(luz);
  }

  function armarCaja() {
    const g = new k.THREE.Group();
    k.caja(0.42, 0.18, 0.28, '#D9C7A5', 0, 0.09, 0, g);
    k.caja(0.38, 0.01, 0.24, '#FCFBF8', 0, 0.182, 0, g, false);
    g.position.set(CAJA.x, MESA.y, CAJA.z); g.rotation.y = 0.15; k.escena.add(g);
    tapa = k.caja(0.44, 0.04, 0.3, '#C9B38E', 0, -5, 0);
    return g;
  }

  // la calculadora: cuerpo, pantalla (cambia de color) y la grilla de teclas
  function armarCalcu() {
    const g = new k.THREE.Group();
    k.caja(0.22, 0.035, 0.3, '#3A3F42', 0, 0.018, 0, g);
    pantalla = k.caja(0.17, 0.01, 0.06, '#B9C8A2', 0, 0.04, -0.1, g, false);
    for (let f = 0; f < 4; f++) for (let c = 0; c < 4; c++) k.caja(0.032, 0.012, 0.032, c === 3 ? '#E3B23C' : '#D9DCDD', -0.06 + c * 0.04, 0.04, -0.02 + f * 0.042, g, false);
    g.position.set(CALC.x, MESA.y, CALC.z); g.rotation.y = 0.35; k.escena.add(g); return g;
  }

  function armarCarpeta() {
    const g = new k.THREE.Group();
    k.caja(0.3, 0.07, 0.4, '#1E5D49', 0, 0.035, 0, g);
    k.caja(0.27, 0.05, 0.37, '#FCFBF8', 0.01, 0.035, 0, g, false);
    k.caja(0.04, 0.072, 0.4, '#C9A227', -0.13, 0.036, 0, g, false);
    g.position.set(0.35, MESA.y, -0.25); k.escena.add(g); return g;
  }

  // las facturas: dónde quedan sobre la mesa (fijo, siempre igual)
  function armarFacturas() {
    const r = k.azar(31), out = [];
    for (let i = 0; i < 46; i++) {
      const m = k.caja(0.14, 0.004, 0.2, i % 7 === 0 ? '#F2E6C4' : (i % 5 === 0 ? '#E6EEF2' : '#FCFBF8'), 0, -5, 0, k.escena, false);
      const x = k.lerp(-0.85, 0.85, r()), z = MESA.z + k.lerp(-0.42, 0.42, r());
      out.push({ m, x, z, y: MESA.y + 0.004 + (i % 6) * 0.003, rot: r() * Math.PI, d: r(), sx: r() - 0.5, sz: r() - 0.5 });
    }
    return out;
  }

  function camara(t) {
    const cam = k.camara, V = (x, y, z) => new k.THREE.Vector3(x, y, z);
    let pos, mira;
    const z1 = (a, b, x0, x1) => k.lerp(a, b, k.suave((t - x0) / Math.max(0.3, x1 - x0)));
    if (t < P.f2) {                               // 1. de frente, desde arriba: la carta y la cara
      const z = z1(1.08, 0.92, 0, P.f2);
      mira = V(0.05, 1.25, -0.6); pos = mira.clone().add(V(0.3 * z, 1.0 * z, 6.6 * z));
    } else if (t < P.f3) {                        // 2. desde la izquierda: las facturas vuelan y el gato sube
      const z = z1(1, 0.9, P.f2, P.f3);
      mira = V(0.0, 1.15, -0.5); pos = mira.clone().add(V(-1.8 * z, 1.3 * z, 5.6 * z));
    } else if (t < P.f4) {                        // 3. la calculadora de cerca
      const z = z1(1, 0.88, P.f3, P.f4);
      mira = V(-0.25, 1.1, -0.45); pos = mira.clone().add(V(1.3 * z, 0.9 * z, 4.6 * z));
    } else if (t < P.f5) {                        // 4. el audio de la tía: vos con el celular, el gato dormido adelante
      const z = z1(1, 0.92, P.f4, P.f5);
      mira = V(0.05, 1.35, -0.7); pos = mira.clone().add(V(1.0 * z, 0.5 * z, 5.4 * z));
    } else if (t < P.f6) {                        // 5. el precio: el contador ordena todo
      const z = z1(1, 0.93, P.f5, P.f6);
      mira = V(0.3, 1.25, -0.7); pos = mira.clone().add(V(-0.7 * z, 0.9 * z, 6.6 * z));
    } else if (t < P.rem) {                       // 6. todo en orden
      const z = z1(1, 0.93, P.f6, P.rem);
      mira = V(0.1, 1.3, -0.7); pos = mira.clone().add(V(1.0 * z, 0.6 * z, 6.6 * z));
    } else {                                      // 7. remate: el gato empuja la carpeta; termina en el gato
      const g = k.suave((t - P.rem) / 1.1), g2 = k.suave((t - P.cae - 0.2) / 0.8);
      mira = V(k.lerp(0.1, 0.12, g), k.lerp(1.15, 1.05, g), k.lerp(-0.4, 0.0, g));
      pos = mira.clone().add(V(k.lerp(0.9, 0.5, g), k.lerp(0.9, 0.35, g), k.lerp(5.2, 3.7, g) + 0.2 * g2));
    }
    cam.position.copy(pos); cam.lookAt(mira); cam.updateProjectionMatrix(); cam.updateMatrixWorld();
  }

  const ubicar = (p, x, z, rot) => { p.position.set(x, 0, z); p.rotation.set(0, rot, 0); };

  return {
    get duracion() { return P.cierre + 2.8; },
    get cierre() { return P.cierre; },
    get efectos() {
      const r = x => +x.toFixed(2);
      const papeles = [0, 1, 2, 3].map(i => ({ efecto: 'pop', t: r(P.desparramas + 0.15 + i * 0.16), db: -21 }));
      return [
        { efecto: 'recibido', t: r(0.35), db: -16 },
        { efecto: 'latigazo', t: r(P.f2 - 0.2), db: -19 },
        ...papeles,
        { efecto: 'maullido', t: r(P.gatoSube - 0.1), db: -17 },
        { efecto: 'latigazo', t: r(P.f3 - 0.2), db: -19 },
        { efecto: 'tecleo', t: r(P.cuentas - 0.2), db: -17 },
        { efecto: 'falla', t: r(P.largar), db: -15 },
        { efecto: 'golpe', t: r(P.humo + 0.1), db: -17 },
        { efecto: 'latigazo', t: r(P.f4 - 0.2), db: -19 },
        { efecto: 'recibido', t: r(P.audio - 0.25), db: -15 },
        { efecto: 'latigazo', t: r(P.f5 - 0.2), db: -19 },
        { efecto: 'pop', t: r(P.precio - 0.15), db: -16 },
        { efecto: 'campanita', t: r(P.precio + 0.05), db: -18 },
        { efecto: 'sello', t: r(P.precio + 0.3), db: -18 },
        { efecto: 'latigazo', t: r(P.f6 - 0.2), db: -19 },
        { efecto: 'acierto', t: r(P.f6 + 0.1), db: -17 },
        { efecto: 'latigazo', t: r(P.rem - 0.2), db: -19 },
        { efecto: 'tic', t: r(P.empuja - 0.2), db: -16 },
        { efecto: 'golpe', t: r(P.cae), db: -14 },
        { efecto: 'pop', t: r(P.cae + 0.05), db: -17 },
        { efecto: 'maullido', t: r(P.cae + 0.5), db: -18 },
        { efecto: 'golpe', t: r(P.cierre + 0.1), db: -14 },
      ];
    },
    armar(kit) {
      k = kit; tiempos();
      const T = k.THREE;
      k.sol.intensity = 0.55; k.sol.position.set(4, 12, 8);
      k.cielo.intensity = 0.75;
      k.escena.background = new T.Color('#2A2F3A'); k.escena.fog.color.set('#2A2F3A');
      comedor();
      caja = armarCaja();
      calcu = armarCalcu();
      carpeta = armarCarpeta();
      facturas = armarFacturas();
      humoCalc = k.humo(26, '#7A807C', 0.07);
      // vos (buzo violeta, de entrecasa)
      yo = k.personaje({ ropa: '#6B4E8C', pantalon: '#3A3F4A', pelo: '#2B1D16', piel: '#E2B48F', zapatillas: '#F2F2EE' });
      celu = new T.Group(); yo.userData.brazoD.add(celu); celu.position.set(0, -0.66, 0.09);
      k.caja(0.1, 0.19, 0.025, '#121614', 0, 0, 0, celu, false); k.caja(0.085, 0.16, 0.01, '#8FD9BC', 0, 0, 0.014, celu, false);
      // el gato (el testigo), gris atigrado
      gato = k.gato({ color: '#8E9196', oscuro: '#5E6166' });
      // el contador (camisa celeste, chaleco, anteojos)
      cont = k.personaje({ ropa: '#2E3F66', pantalon: '#2A2E2C', zapatillas: '#2A2E2C', piel: '#C9956E', pelo: '#9A9A96' });
      k.caja(0.3, 0.5, 0.02, '#CFE3F2', 0, 0.42, 0.185, cont.userData.cadera, false);             // la camisa
      k.caja(0.06, 0.32, 0.022, '#C8473A', 0, 0.5, 0.19, cont.userData.cadera, false);           // la corbata
      [-0.1, 0.1].forEach(x => k.caja(0.13, 0.09, 0.02, '#1E2224', x, 0.27, 0.235, cont.userData.cuello, false));
      [-0.1, 0.1].forEach(x => k.caja(0.1, 0.06, 0.022, '#BFD6E6', x, 0.27, 0.238, cont.userData.cuello, false));
      url = k.etiquetaUrl();
      etqFacturas = k.etiqueta('Facturas: 1.274');
      etqCalcu = k.etiqueta('Calculadora: 98 °C');
      etqSiesta = k.etiqueta('Gato: dormido');
      etqOtraVez = k.etiqueta('Facturas: otra vez');
      burbuja = k.el(`<div style="display:flex;align-items:center;gap:22px">
          <div style="width:74px;height:74px;border-radius:50%;background:#E3B23C;display:flex;align-items:center;justify-content:center;font:700 34px 'IBM Plex Sans',sans-serif;color:#0E1815">T</div>
          <div><div style="font:600 30px 'IBM Plex Sans',sans-serif;color:#2B7E62">Tía</div>
          <div style="display:flex;align-items:center;gap:6px;margin-top:6px">
            <span style="font-size:40px;color:#0E1815">▶</span>
            ${[18, 34, 22, 46, 28, 52, 20, 38, 30, 44, 24, 36, 18, 42, 26, 30].map(h => `<span style="display:inline-block;width:8px;height:${h}px;border-radius:4px;background:#5D6A64"></span>`).join('')}
          </div></div>
          <div style="font:600 34px 'IBM Plex Mono',monospace;color:#5D6A64;align-self:flex-end">20:14</div></div>`, 'tarjeta');
      Object.assign(burbuja.style, { top: '560px', width: 'auto', padding: '26px 34px', borderRadius: '34px 34px 34px 8px', opacity: 0 });
      card = k.tarjeta(`<div class="sello">Precio<br>de<br>referencia</div>
        <div class="t-et">CONTADOR PARA EL MONOTRIBUTO (GESTIÓN MENSUAL)</div>
        <div class="t-precio">$17.000<span>a</span>$40.000</div>
        <div class="t-nota">Noviembre 2026 · AMBA · por mes</div>`);
      chip = k.tarjeta(`<div class="ok">✓</div><div><div class="c1">Pedido publicado gratis</div><div class="c2">Contabilidad · tu zona</div></div>`, 'chip3d');
      fin = k.cierre('Pedí presupuestos', 'de gente de tu zona');
    },
    animar(t) {
      const U = yo.userData, UG = gato.userData, UC = cont.userData;
      celu.visible = (t < P.f2) || (t >= P.f4 && t < P.f5);

      // ---- la caja y las facturas ----
      const abre = k.suave((t - P.desparramas) / 0.25);
      tapa.position.set(CAJA.x + 0.3 * abre, MESA.y + 0.2 - 0.18 * abre, CAJA.z + 0.25 * abre); tapa.rotation.set(0, 0.15, 0.6 * abre);
      const ordenado = k.suave((t - (P.f5 + 0.8)) / Math.max(0.6, P.listo - P.f5 - 1.2));    // el contador las junta
      const caidas = t >= P.cae;
      facturas.forEach((f, i) => {
        const sale = P.desparramas + 0.1 + f.d * 0.9, u = k.clamp((t - sale) / 0.5);
        if (t < sale) { f.m.position.set(CAJA.x, MESA.y + 0.12, CAJA.z); f.m.visible = false; return; }
        f.m.visible = true;
        let x = k.lerp(CAJA.x, f.x, u), y = k.lerp(MESA.y + 0.15, f.y, u) + 0.5 * Math.sin(Math.PI * u), z = k.lerp(CAJA.z, f.z, u);
        let rx = (1 - u) * 6 * f.sx, ry = f.rot + (1 - u) * 4;
        if (ordenado > 0) {                       // van entrando de a una a la carpeta
          const o = k.clamp(ordenado * 1.25 - f.d * 0.25);
          x = k.lerp(x, carpeta.position.x, o); y = k.lerp(y, MESA.y + 0.05, o) + 0.25 * Math.sin(Math.PI * o); z = k.lerp(z, carpeta.position.z, o);
          if (o >= 1) f.m.visible = false;
        }
        if (caidas) {                             // el remate: la carpeta se cae y vuelan todas otra vez
          const e = t - P.cae, v = k.clamp(e / 0.9);
          f.m.visible = true;
          x = carpeta.position.x + 0.2 + f.sx * 2.2 * v; z = carpeta.position.z + 0.5 + f.sz * 1.6 * v;
          y = Math.max(0.01 + (i % 6) * 0.002, 0.25 + 1.6 * e - 3.2 * e * e); rx = e * 5 * f.sx; ry = f.rot + e * 3;
        }
        f.m.position.set(x, y, z); f.m.rotation.set(rx, ry, 0);
      });
      caja.visible = t < P.f5 + 0.6;

      // ---- la calculadora: humo y pantalla ----
      const quema = k.clamp((t - P.largar) / 0.6);
      pantalla.material = k.mat(t >= P.largar && t < P.f5 ? (Math.sin(t * 22) > 0 ? '#C8473A' : '#3A3F42') : '#B9C8A2');
      calcu.position.y = MESA.y + (t >= P.largar && t < P.f4 ? 0.015 * Math.abs(Math.sin(t * 40)) : 0);
      calcu.visible = t < P.f5;
      humoCalc.animar(t, P.largar, P.f4 - 0.4, { x: CALC.x, y: MESA.y + 0.05, z: CALC.z });

      // ---- la carpeta ----
      carpeta.visible = t >= P.f5 + 0.6;
      carpeta.scale.setScalar(k.rebote((t - P.f5 - 0.6) / 0.3));
      carpeta.position.set(0.35, MESA.y, -0.25); carpeta.rotation.set(0, 0, 0);
      if (t >= P.empuja) {                        // el gato la empuja hasta el borde y se cae
        const e = t - P.empuja, u = k.clamp(e / 0.35);
        carpeta.position.z = k.lerp(-0.25, 0.3, u);
        if (e > 0.25) { const c = e - 0.25; carpeta.position.y = Math.max(0.035, MESA.y - 4.9 * c * c * 2.4); carpeta.rotation.x = Math.min(1.5, c * 6); carpeta.position.z = 0.3 + c * 0.6; }
      }

      // ---- vos ----
      U.cadera.position.set(0, 0.92, 0);
      ubicar(yo, YO.x, YO.z, 0);
      if (t < P.f2) {                             // leés la carta en el celular: ¿recategoriza qué?
        k.pose(yo, { cabezaX: 0.35 }); U.brazoD.rotation.set(-1.2, 0, -0.3); U.brazoI.rotation.set(-0.2, 0, 0.1);
        if (t > 1.6) { U.cuello.rotation.z = 0.25 * Math.sin(t * 2); U.brazoI.rotation.set(-0.45, 0, 2.3 + 0.08 * Math.sin(t * 7)); }   // se rasca la cabeza
      } else if (t < P.f3) {                      // das vuelta la caja
        if (t < P.desparramas + 0.8) k.pose(yo, { empujar: true, cabezaX: 0.4 });
        else k.pose(yo, { manosCabeza: t > P.acuesta ? t : 0, cabezaX: 0.3 });
        if (t <= P.acuesta && t > P.desparramas + 0.8) k.pose(yo, { brazosCruzados: true, cabezaX: 0.3 });
      } else if (t < P.f4) {                      // tecleás en la calculadora; empieza el humo
        if (t < P.largar) k.pose(yo, { tocar: t });
        else { k.pose(yo, { manosCabeza: t }); yo.position.z = YO.z - 0.25 * quema; }
      } else if (t < P.f5) {                      // el celular: la tía y su audio
        k.pose(yo, { cabezaX: 0.2 }); U.brazoD.rotation.set(-1.25, 0, -0.3);
        if (t > P.audio + 0.4) { U.brazoD.rotation.set(-2.5, 0, -0.35); U.cuello.rotation.z = 0.12; U.cuello.rotation.x = -0.1; }   // al oído, resignado
      } else if (t < P.f6) {                      // mirás cómo ordena el contador
        ubicar(yo, YO.x - 0.75, YO.z + 0.1, 0.35);
        k.pose(yo, { brazosCruzados: true, cabezaZ: 0.1 * Math.sin(t * 2) });
      } else if (t < P.rem) {                     // ¡ordenado!
        ubicar(yo, YO.x - 0.7, YO.z + 0.15, 0.2);
        k.pose(yo, { festejo: t });
      } else {                                    // el remate: lo ves venir
        ubicar(yo, YO.x - 0.7, YO.z + 0.15, 0.25);
        if (t < P.cae) k.pose(yo, { cabezaX: 0.3, cabezaY: 0.4 * k.suave((t - P.rem - 0.4) / 0.3) });
        else k.pose(yo, { manosCabeza: t });
      }

      // ---- el gato (el testigo) ----
      gato.rotation.set(0, 0, 0);
      UG.cuerpo.rotation.set(0, 0, 0);
      UG.patas.forEach(p => p.rotation.set(0, 0, 0));
      if (t < P.gatoSube) {                       // en su silla, mirando
        gato.position.set(GATO_SILLA.x, GATO_SILLA.y, GATO_SILLA.z); gato.rotation.y = 0.9;
        k.posePerro(gato, { sentado: true, cola: t, cabezaY: t > P.desparramas ? -0.4 : 0 });
      } else if (t < P.acuesta) {                 // salta a la mesa
        const u = k.clamp((t - P.gatoSube) / Math.max(0.3, P.acuesta - P.gatoSube));
        gato.position.set(k.lerp(GATO_SILLA.x, GATO_MESA.x, u), k.lerp(GATO_SILLA.y, GATO_MESA.y, u) + 0.45 * Math.sin(Math.PI * u), k.lerp(GATO_SILLA.z, GATO_MESA.z, u));
        gato.rotation.y = Math.PI / 2; k.posePerro(gato, { colaX: 1.4 });
      } else if (t < P.f5) {                      // acostado arriba de las facturas
        gato.position.set(GATO_MESA.x, GATO_MESA.y - 0.28, GATO_MESA.z); gato.rotation.y = 0.5;
        k.posePerro(gato, { colaX: -0.2, cabezaX: t > P.f4 + 0.6 ? 0.45 : 0, cabezaY: t >= P.f3 && t < P.f4 ? -0.6 : 0 });
        UG.patas.forEach(p => p.rotation.set(Math.PI / 2 * (p.position.z > 0 ? -1 : 1), 0, 0));   // patas estiradas, como esfinge
        if (t >= P.largar && t < P.f4) {          // el humo: levanta la cabeza y la cola
          k.posePerro(gato, { colaX: 1.5, cabezaY: -0.8 }); UG.patas.forEach(p => p.rotation.set(Math.PI / 2 * (p.position.z > 0 ? -1 : 1), 0, 0));
          gato.position.y = GATO_MESA.y - 0.28 + 0.08 * Math.max(0, Math.sin((t - P.largar) * 6));
        }
        if (t >= P.f4) UG.cuello.rotation.x = 0.55;   // con el audio de la tía, se duerme
      } else if (t < P.rem) {                     // en la silla otra vez, mirando trabajar al contador
        gato.position.set(GATO_SILLA.x, GATO_SILLA.y, GATO_SILLA.z); gato.rotation.y = 0.9;
        k.posePerro(gato, { sentado: true, cola: t, cabezaY: -0.2 });
      } else {                                    // remate: sube a la mesa, mira a cámara y empuja la carpeta
        const sube = k.clamp((t - P.rem) / 0.45);
        const x0 = GATO_SILLA.x, xf = carpeta.position.x - 0.42;
        gato.position.set(k.lerp(x0, xf, sube), k.lerp(GATO_SILLA.y, MESA.y, sube) + 0.4 * Math.sin(Math.PI * sube), k.lerp(GATO_SILLA.z, -0.22, sube));
        gato.rotation.y = k.lerp(Math.PI / 2, 0.35, k.suave((t - P.rem - 0.45) / 0.3));
        if (sube < 1) k.posePerro(gato, { colaX: 1.4 });
        else {
          k.posePerro(gato, { sentado: true, cola: t, cabezaY: 0.15 });
          if (t > P.empuja - 0.45 && t < P.empuja + 0.4) {   // la pata de adelante, de a golpecitos
            UG.patas[1].rotation.x = -1.1 + 0.35 * Math.sin((t - P.empuja) * 16);
          }
          if (t >= P.cae) UG.cuello.rotation.y = -0.5 + 0.08 * Math.sin(t * 3);   // mira a cámara, satisfecho
        }
      }

      // ---- el contador ----
      cont.visible = t >= P.f5 - 0.01 && t < P.rem;
      if (t < P.listo) {
        ubicar(cont, 0.65, -1.05, -0.15);
        k.pose(cont, { cabezaX: 0.4 });
        const a = Math.sin(t * 7) * 0.15;
        UC.brazoI.rotation.set(-1.05 + a, 0, 0.2); UC.brazoD.rotation.set(-1.05 - a, 0, -0.2);
      } else { ubicar(cont, 0.75, -1.0, 0.2); k.pose(cont, { saludo: t }); }

      camara(t);
      // ---- carteles y textos ----
      etqFacturas.animar(t, P.desparramas + 0.9, P.f3 + 0.05, { x: 0.45, y: MESA.y + 0.05, z: MESA.z + 0.15 }, -40, -300);
      etqCalcu.animar(t, P.humo - 0.1, P.f4 + 0.05, { x: CALC.x, y: MESA.y + 0.1, z: CALC.z }, 70, -280);
      const hg = new k.THREE.Vector3(); UG.cuello.getWorldPosition(hg);
      etqSiesta.animar(t, P.audio + 0.6, P.f5 + 0.05, { x: hg.x, y: hg.y + 0.1, z: hg.z }, -60, -230);
      etqOtraVez.animar(t, P.cae + 0.25, P.cierre + 0.2, { x: carpeta.position.x + 0.1, y: MESA.y, z: 0.35 }, -40, -330);
      k.mostrar(burbuja, t, P.audio - 0.25, P.f5 - 0.05);
      k.mostrar(card, t, P.precio - 0.15, P.f6 - 0.05);
      k.mostrar(chip, t, P.f6 + 0.25, P.rem + 0.4);
      url.style.opacity = t < P.cierre ? 1 : 0;
      fin.animar(t, P.cierre);
    },
  };
})();
