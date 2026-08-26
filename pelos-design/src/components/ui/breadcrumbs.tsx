import Link from 'next/link';

/** Migas de pan. Se emiten también como BreadcrumbList en el JSON-LD. */
export function Breadcrumbs({ trail }: { trail: { name: string; path: string }[] }) {
  return (
    <nav aria-label="Ruta de navegación" className="mb-8">
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.8125rem] text-text-secondary">
        {trail.map((crumb, index) => {
          const isLast = index === trail.length - 1;
          return (
            <li key={crumb.path} className="flex items-center gap-2">
              {isLast ? (
                <span aria-current="page" className="text-text-primary">
                  {crumb.name}
                </span>
              ) : (
                <Link href={crumb.path} className="link-underline">
                  {crumb.name}
                </Link>
              )}
              {!isLast && (
                <span aria-hidden="true" className="text-border-strong">
                  /
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
