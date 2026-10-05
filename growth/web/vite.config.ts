import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: { port: 5180 },
  build: { sourcemap: false, chunkSizeWarningLimit: 900 },
  test: { include: ['tests/unit/**/*.test.ts'] },
} as never);
