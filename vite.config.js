import { defineConfig } from 'vite';
export default defineConfig({
  build: { target: 'es2022', sourcemap: true },
  worker: { format: 'es' },
  server: { host: '0.0.0.0' },
});
