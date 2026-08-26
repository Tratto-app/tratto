import type { Metadata } from 'next';

import { LegalPage, LegalPlaceholder } from '@/components/legal-page';
import { business } from '@/data/business';

export const metadata: Metadata = {
  title: 'Política de privacidad',
  description: `Política de privacidad de ${business.name}.`,
  alternates: { canonical: '/legales/privacidad' },
  robots: { index: false, follow: true },
};

export default function PrivacidadPage() {
  return (
    <LegalPage title="Política de privacidad" slug="privacidad">
      <LegalPlaceholder>
        <p>
          Este texto todavía no fue redactado. Debe cubrir, como mínimo, qué datos personales
          recoge el sitio, con qué finalidad, durante cuánto tiempo se conservan, con quién se
          comparten y cómo ejercer los derechos previstos en la Ley 25.326 de Protección de
          los Datos Personales.
        </p>
        <p>
          A la fecha, este sitio no incluye formularios que recojan datos personales ni
          servicios de analítica activos. Si se incorporan, esta política tiene que
          actualizarse antes de publicarlos.
        </p>
      </LegalPlaceholder>
    </LegalPage>
  );
}
