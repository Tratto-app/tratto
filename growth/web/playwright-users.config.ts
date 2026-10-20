import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: 'tests/e2e', testMatch: 'app-users.spec.ts', timeout: 30000,
  use: { baseURL:'http://localhost:4187', headless:true },
  webServer: { command:'npx vite --port 4187 --strictPort', port:4187, reuseExistingServer:false,
    env:{ VITE_SUPABASE_URL:'https://example.supabase.co', VITE_SUPABASE_ANON_KEY:'test-public-placeholder' } },
});
