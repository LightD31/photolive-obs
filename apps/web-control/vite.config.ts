import tailwindcss from '@tailwindcss/vite';
import { TanStackRouterVite } from '@tanstack/router-plugin/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';

const SERVER_URL = process.env.VITE_SERVER_URL ?? 'http://localhost:3001';

export default defineConfig(({ command }) => ({
  // Production builds are served from /control/ by the Fastify server;
  // the dev server runs standalone on port 3002 with proxying for /api.
  base: command === 'build' ? '/control/' : '/',
  plugins: [
    TanStackRouterVite({ target: 'react', autoCodeSplitting: true }),
    react(),
    tailwindcss(),
    tsconfigPaths(),
  ],
  server: {
    port: Number(process.env.WEB_CONTROL_PORT ?? 3002),
    proxy: {
      '/api': SERVER_URL,
      '/renditions': SERVER_URL,
      '/ws': { target: SERVER_URL, ws: true },
    },
  },
}));
