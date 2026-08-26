/**
 * Logotipo de Pelo's Design.
 *
 * Es tipográfico, no una imagen: pesa cero, se ve nítido en cualquier
 * densidad y se adapta al color del contenedor.
 *
 * "Pelo's" va en redonda y "Design" en itálica: ese contraste es el gesto de
 * marca. Se mantiene aunque los títulos del sitio sean cursivos, porque acá la
 * itálica es la de Instrument Serif —más alto contraste y a menor tamaño—, no
 * la de la display.
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
      className={`inline-flex items-baseline gap-[0.28em] font-[family-name:var(--font-display)] leading-none tracking-[-0.03em] whitespace-nowrap ${
        tone === 'inverse' ? 'text-text-inverse' : ''
      } ${className}`}
    >
      <span className="font-[500]">Pelo&rsquo;s</span>
      <span className="accent-type text-accent">Design</span>
    </span>
  );
}
