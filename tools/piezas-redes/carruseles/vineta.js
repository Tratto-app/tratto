// Molde "historia 3D en viñetas" (23/11/2026): ubica el cuadro 3D dentro de cada viñeta y dibuja
// los carteles. Va después de carrusel.js.
//   <div class="vineta" data-y0="340"><img src="img/3d-chapa-03.00.jpg">
//     <b class="cartel" data-x="620" data-y="1020" data-lx="700" data-ly="800">Bollos: 1</b></div>
// data-y0: desde qué píxel (de los 1920 del cuadro) arranca la ventana.
// data-x/data-y: el punto de la escena que señala el cartel; data-lx/data-ly: dónde va el cartel
// (esquina izquierda, centro vertical). Todo en píxeles del cuadro original de 1080x1920.
(function () {
  // se ubica con las fuentes cargadas: el ancho de cada cartel depende de IBM Plex Mono
  const armar = () => document.querySelectorAll('.vineta').forEach(v => {
    const s = v.clientWidth / 1080, y0 = +(v.dataset.y0 || 0);
    const img = v.querySelector('img');
    img.style.top = (-y0 * s) + 'px';
    v.querySelectorAll('.cartel').forEach(c => {
      const px = +c.dataset.x * s, py = (+c.dataset.y - y0) * s;
      const lx = +c.dataset.lx * s, ly = (+c.dataset.ly - y0) * s;
      c.style.left = lx + 'px'; c.style.top = ly + 'px'; c.style.transform = 'translateY(-50%)';
      // la línea sale del borde del cartel más cercano al punto
      const ax = px < lx ? lx : Math.min(px, lx + c.offsetWidth), ay = ly;
      const linea = document.createElement('div'); linea.className = 'cartel-linea';
      const largo = Math.hypot(ax - px, ay - py), ang = Math.atan2(ay - py, ax - px);
      Object.assign(linea.style, { left: px + 'px', top: py + 'px', width: largo + 'px', transform: `rotate(${ang}rad)` });
      v.appendChild(linea);
    });
  });
  (document.fonts ? document.fonts.ready : Promise.resolve()).then(armar);
})();
