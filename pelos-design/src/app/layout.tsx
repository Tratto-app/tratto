import type { Metadata, Viewport } from 'next';
import { Fraunces, Instrument_Sans, Instrument_Serif } from 'next/font/google';

import '@/styles/globals.css';
import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';
import { MobileCtaBar } from '@/components/mobile-cta-bar';
import { WhatsappFloat } from '@/components/ui/whatsapp-float';
import { defaultMetadata, siteUrl } from '@/data/seo';
import { business } from '@/data/business';
import { buildGraph, hairSalonSchema, organizationSchema, websiteSchema } from '@/lib/seo/schema';
import { getPriceList } from '@/lib/prices/sheet';
import { getReviews } from '@/lib/google/places';

/**
 * Display: serif editorial. Se carga como instancia ESTÁTICA de un solo peso
 * en itálica, no como fuente variable.
 *
 * La versión variable con sus ejes pesaba 146 kB para un único peso y estilo;
 * ésta pesa 22 kB y se ve igual. Los ejes SOFT y opsz aportaban una diferencia
 * imperceptible al tamaño en que se usa. Ver DESIGN.md.
 */
const fraunces = Fraunces({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-fraunces',
  weight: '400',
  style: 'italic',
});

/** Texto: sans humanista, muy legible en párrafos largos en castellano. */
const instrumentSans = Instrument_Sans({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-instrument-sans',
});

/** Acento: itálica editorial para palabras sueltas. Nunca para bloques. */
const instrumentSerif = Instrument_Serif({
  subsets: ['latin'],
  display: 'swap',
  weight: '400',
  style: 'italic',
  variable: '--font-instrument-serif',
});

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: defaultMetadata.title,
    template: `%s | ${business.name}`,
  },
  description: defaultMetadata.description,
  applicationName: business.name,
  alternates: { canonical: '/' },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1 },
  },
  openGraph: {
    type: 'website',
    locale: 'es_AR',
    url: siteUrl,
    siteName: business.name,
    title: defaultMetadata.title,
    description: defaultMetadata.description,
    images: [
      {
        url: '/og.jpg',
        width: 1200,
        height: 630,
        alt: `${business.name} — peluquería en Caballito, CABA`,
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: defaultMetadata.title,
    description: defaultMetadata.description,
    images: ['/og.jpg'],
  },
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [{ url: '/icon.svg', type: 'image/svg+xml' }, { url: '/favicon.ico', sizes: '32x32' }],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180' }],
  },
  category: 'Peluquería',
  verification: {
    // Se completa desde el entorno cuando el salón conecte Search Console.
    google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION,
  },
};

export const viewport: Viewport = {
  themeColor: '#fef8f3',
  colorScheme: 'light',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Ambas lecturas están cacheadas y tienen respaldo, así que no agregan
  // latencia real ni pueden romper el render.
  const [priceList, reviews] = await Promise.all([getPriceList(), getReviews()]);

  const graph = buildGraph([
    hairSalonSchema(reviews, priceList),
    organizationSchema(),
    websiteSchema(),
  ]);

  return (
    <html
      lang="es-AR"
      className={`${fraunces.variable} ${instrumentSans.variable} ${instrumentSerif.variable}`}
    >
      <body>
        <a
          href="#contenido"
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:bg-surface-deep focus:px-5 focus:py-3 focus:text-text-inverse"
        >
          Saltar al contenido
        </a>

        <SiteHeader />
        <main id="contenido">{children}</main>
        <SiteFooter />
        <MobileCtaBar />
        <WhatsappFloat />

        <script
          type="application/ld+json"
          // El grafo se arma con datos propios y controlados, no con input de usuarios.
          dangerouslySetInnerHTML={{ __html: graph }}
        />
      </body>
    </html>
  );
}
