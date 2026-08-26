/**
 * Logotipo de Pelo's Design.
 *
 * Es tipográfico, no una imagen: pesa cero, se ve nítido en cualquier
 * densidad y se adapta al color del contenedor.
 *
 * "Pelo's" va en la sans del sitio y "Design" en itálica serif. El contraste
 * entre las dos es el gesto de marca, y de paso resuelve el logotipo con dos
 * familias que la página ya carga: la versión anterior obligaba a descargar
 * la display en redonda —118 kB— sólo para esta palabra.
 */
export function Wordmark({
  className = '',
  tone = 'inherit',
}: {
  className?: string;
  tone?: 'inherit' | 'inverse';
}) {
  return (
    <span
      className={`inline-flex items-baseline gap-[0.22em] leading-none whitespace-nowrap ${
        tone === 'inverse' ? 'text-text-inverse' : ''
      } ${className}`}
    >
      <span className="font-[family-name:var(--font-body)] font-[600] tracking-[-0.02em]">
        Pelo&rsquo;s
      </span>
      <span className="accent-type text-[1.12em] text-accent">Design</span>
    </span>
  );
}
