import { ButtonLink } from '@/components/ui/button';
import { primaryContact } from '@/data/business';

export default function NotFound() {
  const contact = primaryContact();

  return (
    <div className="shell-narrow py-[clamp(5rem,12vw,10rem)] text-center">
      <p className="accent-type text-[3rem] leading-none text-accent" aria-hidden="true">
        404
      </p>
      <h1 className="mt-6 text-[length:var(--text-h2)]">Esta página no existe</h1>
      <p className="mt-5 text-[length:var(--text-lead)] leading-[1.55] text-text-secondary">
        Puede que el link esté viejo o que hayamos movido algo de lugar.
      </p>
      <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row sm:flex-wrap">
        <ButtonLink href="/" variant="primary">
          Volver al inicio
        </ButtonLink>
        <ButtonLink href={contact.href} variant="secondary" external>
          {contact.label}
        </ButtonLink>
      </div>
    </div>
  );
}
