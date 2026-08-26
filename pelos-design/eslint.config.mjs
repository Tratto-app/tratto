import coreWebVitals from 'eslint-config-next/core-web-vitals';
import typescriptRules from 'eslint-config-next/typescript';

/**
 * eslint-config-next 16 exporta flat config nativo, así que se importa
 * directo en lugar de envolverlo con FlatCompat.
 */
const config = [
  ...coreWebVitals,
  ...typescriptRules,
  {
    ignores: [
      '.next/**',
      'node_modules/**',
      'playwright-report/**',
      'test-results/**',
      'next-env.d.ts',
    ],
  },
];

export default config;
