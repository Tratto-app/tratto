import { defineConfig } from '@playwright/test';

// Smoke test del panel contra un proyecto real (staging). Necesita:
//   GROWTH_DEMO_EMAIL / GROWTH_DEMO_PASSWORD  (usuario miembro del workspace demo)
//   y el panel compilado con VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY.
// PW_CHROMIUM permite usar un Chromium ya instalado en vez de descargarlo.
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 240_000,
  retries: 0,
  use: {
    baseURL: 'http://localhost:4173',
    viewport: { width: 1440, height: 900 },
    launchOptions: process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {},
  },
  webServer: { command: 'npx vite preview --port 4173 --strictPort', port: 4173, reuseExistingServer: true },
});
