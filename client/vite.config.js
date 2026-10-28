import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));

// Ports come from the root .env so nothing is hard-coded in source files.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, path.resolve(here, '..'), '');
  const apiPort = env.PORT || 5000;
  return {
    plugins: [react()],
    server: {
      port: Number(env.CLIENT_PORT) || 5173,
      proxy: { '/api': { target: `http://localhost:${apiPort}`, changeOrigin: true } },
    },
    build: { outDir: 'dist', chunkSizeWarningLimit: 900 },
  };
});
