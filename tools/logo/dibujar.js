// Dibuja el logo de Tratto en un canvas. Medidas tomadas de la imagen original
// (lienzo de referencia 1179 x 1179). Todas las coordenadas se pasan a píxeles
// a mano: escalar el contexto hace que Chrome dibuje los arcos facetados.
async function dibujarLogo(canvas, {tam=1024, escala=1, texto=true, redondeo=0, fondo=true, pesoTexto=500}={}){
  const c = canvas; c.width = c.height = tam; const g = c.getContext('2d');
  const f = tam/1179*escala;
  const cx0 = texto ? 589.5 : 578.5, cy0 = texto ? 589.5 : 480.5;   // sin texto, se centra el símbolo
  const X = x => tam/2 + (x - cx0)*f, Y = y => tam/2 + (y - cy0)*f;
  g.save();
  if(redondeo){ g.beginPath(); g.roundRect(0, 0, tam, tam, redondeo*tam); g.clip(); }
  if(fondo){
    const fg = g.createLinearGradient(0, tam, tam, 0);
    fg.addColorStop(0, '#0A231E'); fg.addColorStop(0.5, '#0D2620'); fg.addColorStop(1, '#123028');
    g.fillStyle = fg; g.fillRect(0, 0, tam, tam);
  }
  const M = {x:X(414.5), y:Y(318)}, A = {x:X(754), y:Y(653.5)};
  const dx = A.x - M.x, dy = A.y - M.y, L = Math.hypot(dx, dy), ux = dx/L, uy = dy/L;
  const ini = {x: M.x + ux*76.5*f, y: M.y + uy*76.5*f}, fin = {x: A.x - ux*70*f, y: A.y - uy*70*f};
  const cg = g.createLinearGradient(ini.x, ini.y, fin.x, fin.y);
  cg.addColorStop(0, '#96E7CE'); cg.addColorStop(0.25, '#8FE2C9'); cg.addColorStop(1, '#62AD98');
  const conector = () => { g.beginPath(); g.moveTo(ini.x, ini.y); g.lineTo(fin.x, fin.y); g.stroke(); };
  const anillo = (p, rExt, rInt) => { g.beginPath(); g.arc(p.x, p.y, rExt*f, 0, Math.PI*2); g.arc(p.x, p.y, rInt*f, 0, Math.PI*2, true); };
  g.lineCap = 'butt';
  // conector: nace en el borde del hueco del anillo menta y termina en el del amarillo
  g.strokeStyle = cg; g.lineWidth = 46*f; conector();
  // anillo menta (relleno de corona: más prolijo que un trazo)
  g.fillStyle = '#9EECD4'; anillo(M, 124.5, 76.5); g.fill('evenodd');
  // el conector apoyado sobre el anillo menta, con sombra suave
  g.save(); anillo(M, 124.5, 76.5); g.clip('evenodd');
  g.shadowColor = 'rgba(0,30,20,0.35)'; g.shadowBlur = 14*f; g.strokeStyle = cg; g.lineWidth = 46*f; conector(); g.restore();
  // anillo amarillo, y encima el conector translúcido
  g.fillStyle = '#F7CA55'; anillo(A, 113, 70); g.fill('evenodd');
  g.save(); anillo(A, 113, 70); g.clip('evenodd');
  g.globalAlpha = 0.32; g.strokeStyle = '#9EECD4'; g.lineWidth = 46*f; conector(); g.restore();
  if(texto){
    g.fillStyle = '#E8EBEA';
    g.font = `${pesoTexto} ${126*f}px Montserrat`;
    g.textBaseline = 'alphabetic';
    for(const [l, izq] of [['T',216],['R',359],['A',488],['T',623],['T',746],['O',869]]){
      const m = g.measureText(l);
      g.fillText(l, X(izq) + m.actualBoundingBoxLeft, Y(954));
    }
  }
  g.restore();
}
