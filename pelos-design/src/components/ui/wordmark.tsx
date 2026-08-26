/**
 * Logotipo de Pelo's Design.
 *
 * Es tipográfico, no una imagen: pesa cero, se ve nítido en cualquier
 * densidad y se adapta al color del contenedor. El contraste entre la serif
 * romana de "Pelo's" y la itálica de "Design" es el gesto de marca — el
 * mismo recurso que después ordena toda la jerarquía del sitio.
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
