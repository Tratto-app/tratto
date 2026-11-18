/* Escena del video 3D del pasto (comun-3d.js). Cada red tiene su HTML
   (video-3d-pasto-tt/ig/fb.html) que solo define window.RED. */
window.ESCENA3D = (function () {
  let k, dueno, jardinero, maquina, prestada, cesped, pedacitos, agua, bocanadas, card, chip, fin, url, etqPasto, etqNafta;
  // Tiempos, a partir de la voz (window.PALABRAS); valores de respaldo para las previas
  const P = {};
  function tiempos() {
    P.f2 = k.frase(2, 2.4);        // llovió
    P.f3 = k.frase(3, 5.6);        // y el otro también
    P.f4 = k.frase(4, 7.0);        // la máquina del vecino, sin nafta
    P.f5 = k.frase(5, 11.0);       // tranqui: el precio
    P.f6 = k.frase(6, 17.2);       // pedilo gratis
    P.precio = k.palabra('diecisiete', 1, k.palabra('17', 1, 14.0));
    P.fin = k.finVoz(21.0);
    P.cierre = P.fin + 0.35;
    P.m0 = P.f5 + 0.2;             // entra quien corta el pasto
    P.m1 = P.fin - 0.3;            // termina de cortar
  }
  // Recorrido de la cortadora: entra por el portón y corta en franjas
  let tramo = [], largo = 0;
  function recorrido() {
    const pts = [[2.25, 6.2], [2.75, 3.5]];
    const zs = [3.5, 2.5, 1.5, 0.5, -0.5, -1.5, -2.5, -3.5];
    zs.forEach((z, i) => {
      const xa = i % 2 ? -2.75 : 2.75, xb = -xa;
      if (i) pts.push([xa, z]);
      pts.push([xb, z]);
    });
    tramo = []; largo = 0;
    for (let i = 1; i < pts.length; i++) {
      const [ax, az] = pts[i - 1], [bx, bz] = pts[i], l = Math.hypot(bx - ax, bz - az);
      tramo.push({ ax, az, bx, bz, l, desde: largo }); largo += l;
    }
  }
  function enRecorrido(t) {
    const u = k.clamp((t - P.m0) / (P.m1 - P.m0));
    const d = largo * (u < 0.04 ? 0.5 * u * u / 0.04 / 0.98 : u > 0.96 ? 1 - 0.5 * (1 - u) * (1 - u) / 0.04 / 0.98 : (u - 0.02) / 0.96);
    for (const s of tramo) if (d <= s.desde + s.l || s === tramo[tramo.length - 1]) {
      const f = k.clamp((d - s.desde) / s.l);
      return { x: k.lerp(s.ax, s.bx, f), z: k.lerp(s.az, s.bz, f), d };
    }
  }
  function rumbo(t) {
    const a = enRecorrido(t - 0.12), b = enRecorrido(t + 0.12);
    if (Math.hypot(b.x - a.x, b.z - a.z) < 1e-4) return Math.atan2(-0.5, -2.7);
    return Math.atan2(b.x - a.x, b.z - a.z);
  }
  function marcarCortes() {
    const R = 0.5, paso = 1 / 60;
    for (let t = P.m0; t <= P.m1 + 0.01; t += paso) {
      const p = enRecorrido(t);
      for (const b of cesped.bri) if (b.tCorte === Infinity && Math.abs(b.x - p.x) < R && Math.abs(b.z - p.z) < R * 0.95) b.tCorte = t;
    }
  }
  const DUENO = { x: -0.4, z: 0.6 }, GALERIA = { x: -1.3, z: -4.55 }, PRUEBA = { x: -0.9, z: -4.5 };
  function camara(t) {
    const cam = k.camara, T = k.THREE, V = (x, y, z) => new T.Vector3(x, y, z);
    let pos, mira;
    if (t < P.f2) {                              // 1. el dueño con el pasto por las rodillas
      const z = k.lerp(1, 0.86, k.suave(t / P.f2));
      mira = V(-0.4, 0.85, 0.6); pos = mira.clone().add(V(3.1 * z, 2.7 * z, 7.4 * z));
    } else if (t < P.f3) {                       // 2. llueve: plano alto
      const a = k.lerp(0.25, 0.1, k.suave((t - P.f2) / (P.f3 - P.f2)));
      mira = V(-0.3, 0.6, 0.2); pos = mira.clone().add(V(Math.sin(a) * 9.5, 8.5, Math.cos(a) * 9.5));
    } else if (t < P.f4) {                       // 3. llueve más y el pasto crece: de frente, bajo
      const z = k.lerp(1, 0.9, k.suave((t - P.f3) / (P.f4 - P.f3)));
      mira = V(-0.4, 1.0, 0.6); pos = mira.clone().add(V(-1.2 * z, 1.3 * z, 4.6 * z));
    } else if (t < P.f5) {                       // 4. la máquina del vecino, sin nafta
      const z = k.lerp(1, 0.9, k.suave((t - P.f4) / (P.f5 - P.f4)));
      mira = V(-0.1, 0.75, -4.5); pos = mira.clone().add(V(2.6 * z, 2.4 * z, 6.2 * z));
    } else if (t < P.precio + 1.4) {             // 5a. plano general: entra quien corta
      const a = k.lerp(0.18, 0.05, k.suave((t - P.f5) / (P.precio + 1.4 - P.f5)));
      mira = V(0, 0.3, -0.3); pos = V(Math.sin(a) * 15.5 + 1.5, 15.2, Math.cos(a) * 15.5);
    } else if (t < P.f6) {                       // 5b. sigue a la cortadora de cerca
      const p = [0, 0.15, 0.3, 0.45, 0.6].map(d => enRecorrido(t - d)).reduce((s, q) => ({ x: s.x + q.x / 5, z: s.z + q.z / 5 }), { x: 0, z: 0 });
      mira = V(p.x * 0.7, 0.3, p.z * 0.8 + 0.4); pos = mira.clone().add(V(4.4, 7.2, 9.4));
    } else {                                     // 6. el patio listo
      const a = k.lerp(-0.05, -0.2, k.suave((t - P.f6) / 4));
      mira = V(-0.2, 0.4, -0.8); pos = V(Math.sin(a) * 13.2, 12.6, Math.cos(a) * 13.2);
    }
    cam.position.copy(pos); cam.lookAt(mira); cam.updateProjectionMatrix(); cam.updateMatrixWorld();
  }
  return {
    get duracion() { return P.cierre + 2.8; },
    get cierre() { return P.cierre; },
    // efectos (sonido.py): cortes de cámara, lluvia, la máquina que no arranca, el precio, el chip y el logo
    get efectos() {
      const r = x => +x.toFixed(2);
      return [
        { efecto: 'pop', t: r(0.7), db: -18 },
        { efecto: 'latigazo', t: r(P.f2 - 0.2), db: -19 },
        { efecto: 'lluvia', t: r(P.f2), db: -20 },
        { efecto: 'latigazo', t: r(P.f3 - 0.2), db: -19 },
        { efecto: 'lluvia', t: r(P.f3 - 0.3), db: -18 },
        { efecto: 'latigazo', t: r(P.f4 - 0.2), db: -19 },
        { efecto: 'falla', t: r(P.f4 + 0.5), db: -16 },
        { efecto: 'falla', t: r(P.f4 + 1.6), db: -17 },
        { efecto: 'pop', t: r(P.f4 + 0.9), db: -17 },
        { efecto: 'latigazo', t: r(P.f5 - 0.2), db: -19 },
        { efecto: 'motor', t: r(P.m0), db: -27 },
        { efecto: 'pop', t: r(P.precio - 0.15), db: -16 },
        { efecto: 'campanita', t: r(P.precio + 0.05), db: -18 },
        { efecto: 'sello', t: r(P.precio + 0.3), db: -18 },
        { efecto: 'latigazo', t: r(P.f6 - 0.2), db: -19 },
        { efecto: 'pop', t: r(P.f6 + 0.25), db: -16 },
        { efecto: 'golpe', t: r(P.cierre + 0.1), db: -14 },
      ];
    },
    armar(kit) {
      k = kit; tiempos(); recorrido();
      const zona = k.patio({ ancho: 6.4, fondo: 8 });
      cesped = k.pasto({ zona: { x0: zona.x0, x1: zona.x1, z0: zona.z0, z1: zona.z1 }, cantidad: 2600 });
      agua = k.lluvia({ zona: { x0: -5, x1: 5.5, z0: -6, z1: 6 } });
      dueno = k.personaje({ ropa: '#6D9BC3', pantalon: '#2E3F66' });
      jardinero = k.personaje({ ropa: k.C.verdeVivo, pantalon: '#3B3F45', gorra: k.C.laton, piel: '#C9956E', pelo: '#1C1410' });
      maquina = k.cortadora(k.C.laton);
      prestada = k.cortadora('#B8402E');            // la del vecino
      bocanadas = k.humo(18);
      pedacitos = k.recortes(320);
      marcarCortes();
      url = k.etiquetaUrl();
      etqPasto = k.etiqueta('Pasto: 60 cm');
      etqNafta = k.etiqueta('Sin nafta');
      card = k.tarjeta(`<div class="sello">Precio<br>de<br>referencia</div>
        <div class="t-et">CORTE DE PASTO · HASTA 100 m²</div>
        <div class="t-precio">$17.000<span>a</span>$29.000</div>
        <div class="t-nota">Noviembre 2026 · AMBA · por trabajo</div>`);
      chip = k.tarjeta(`<div class="ok">✓</div><div><div class="c1">Pedido publicado gratis</div><div class="c2">Corte de pasto · tu zona</div></div>`, 'chip3d');
      fin = k.cierre('Pedí presupuestos', 'de gente de tu zona');
    },
    animar(t) {
      // clima: soleado, llueve el finde, llueve el otro, nublado con la máquina, sale el sol
      const nub = t < P.f2 ? 0 : t < P.f5 ? k.suave((t - P.f2) / 0.5) * (t < P.f4 ? 1 : 0.7) : 0.7 * (1 - k.suave((t - P.f5) / 0.8));
      k.clima(nub);
      agua.animar(t, t < P.f2 ? 0 : t < P.f3 ? 0.45 * k.suave((t - P.f2) / 0.4) : t < P.f4 ? 1 : 0);
      // el pasto crece con cada fin de semana de lluvia
      const crece = 1 + 0.12 * k.suave((t - P.f2) / (P.f3 - P.f2)) + 0.22 * k.suave((t - P.f3) / (P.f4 - P.f3));

      // dueño: en el pasto; mira la lluvia; prueba la máquina del vecino en la galería; mira y festeja
      const conMaquina = t >= P.f4 && t < P.f5;
      if (t < P.f4) dueno.position.set(DUENO.x, 0, DUENO.z);
      else if (conMaquina) dueno.position.set(PRUEBA.x + (t > P.f4 + 0.4 ? Math.sin((t - P.f4 - 0.4) * 9) * 0.07 : 0), 0, PRUEBA.z);
      else dueno.position.set(GALERIA.x, 0, GALERIA.z);
      if (t < P.f2) {
        dueno.rotation.y = 0.35 + Math.sin(t * 1.3) * 0.12;
        k.pose(dueno, { rascar: t > 0.4 && t < P.f2 - 0.2 ? t : 0, cabezaX: -0.08, cabezaY: Math.sin(t * 1.1) * 0.2 });
      } else if (t < P.f3) {
        dueno.rotation.y = 0.4; k.pose(dueno, { cabezaX: -0.55, cabezaY: Math.sin(t * 2) * 0.1 });
      } else if (t < P.f4) {
        dueno.rotation.y = -0.25; k.pose(dueno, { brazosCruzados: true, cabezaY: Math.sin(t * 6) * 0.35 });
      } else if (conMaquina) {
        dueno.rotation.y = Math.PI / 2; k.pose(dueno, { empujar: true, cabezaX: 0.15, cabezaY: t > P.f4 + 1.6 ? 0.6 : 0 });
      } else {
        dueno.rotation.y = 0.35;
        const festeja = t > P.m1 && t < P.cierre;
        k.pose(dueno, festeja ? { festejo: t, salto: Math.abs(Math.sin((t - P.m1) * 7)) * 0.18 } : { brazosCruzados: true });
      }
      // la máquina del vecino: al lado del dueño, en la galería, y no arranca
      prestada.visible = conMaquina;
      prestada.position.set(dueno.position.x + 1.15, 0, PRUEBA.z); prestada.rotation.y = Math.PI / 2;
      bocanadas.animar(t, P.f4 + 0.5, P.f5 - 0.1, { x: dueno.position.x + 1.25, y: 0.75, z: PRUEBA.z });

      // quien corta el pasto: entra por el portón con su cortadora
      maquina.visible = jardinero.visible = t >= P.f5;
      const p = enRecorrido(t), r = rumbo(t), andando = t > P.m0 && t < P.m1;
      maquina.position.set(p.x, andando ? Math.abs(Math.sin(t * 38)) * 0.015 : 0, p.z); maquina.rotation.y = r;
      jardinero.position.set(p.x - Math.sin(r) * 1.12, 0, p.z - Math.cos(r) * 1.12); jardinero.rotation.y = r;
      if (t < P.m1 + 0.4) k.pose(jardinero, { caminar: andando ? 1 : 0, paso: p.d / 1.3, empujar: true });
      else {
        jardinero.rotation.y = k.lerp(r, 0.5, k.suave((t - P.m1 - 0.4) / 0.4));
        k.pose(jardinero, { saludo: t > P.m1 + 0.8 ? t : 0 });
      }
      cesped.animar(t, t < P.f2 ? 1.2 : t < P.f4 ? 1.8 : 0.7, crece);
      pedacitos.animar(t, P.m0 + 0.5, P.m1 - 0.1, enRecorrido);
      camara(t);
      // carteles y textos
      etqPasto.animar(t, 0.6, P.f2 - 0.05, { x: DUENO.x + 0.45, y: 0.55, z: DUENO.z + 0.3 }, 120, 160);
      etqNafta.animar(t, P.f4 + 0.9, P.f5 - 0.05, { x: dueno.position.x + 1.2, y: 0.55, z: PRUEBA.z }, 90, 190);
      k.mostrar(card, t, P.precio - 0.15, P.f6 - 0.05);
      k.mostrar(chip, t, P.f6 + 0.25, P.cierre + 0.2);
      url.style.opacity = t < P.cierre ? 1 : 0;
      fin.animar(t, P.cierre);
    },
  };
})();
