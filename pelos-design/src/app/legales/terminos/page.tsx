import type { Metadata } from 'next';

import { LegalPage, LegalPlaceholder } from '@/components/legal-page';
import { business } from '@/data/business';

export const metadata: Metadata = {
  title: 'Términos y condiciones',
  description: `Términos y condiciones de uso del sitio de ${business.name}.`,
  alternates: { canonical: '/legales/terminos' },
  robots: { index: false, follow: true },
};

export default function TerminosPage() {
  return (
    <LegalPage title="Términos y condiciones" slug="terminos">
      <LegalPlaceholder>
        <p>
          Este texto todavía no fue redactado. Debe definir las condiciones de uso del sitio,
          la política de turnos y cancelaciones del salón, y el alcance de la información
          publicada —en particular, la vigencia de la lista de precios.
        </p>
      </LegalPlaceholder>
    </LegalPage>
  );
}
