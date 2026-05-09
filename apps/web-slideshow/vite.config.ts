import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';

const SERVER_URL = process.env.VITE_SERVER_URL ?? 'http://localhost:3001';

export default defineConfig(({ command }) => ({
  // Production builds are served from /slideshow/ by the Fastify server;
  // the dev server runs standalone on port 3003 at /.
  base: command === 'build' ? '/slideshow/' : '/',
  plugins: [react(), tailwindcss(), tsconfigPaths()],
  server: {
    port: Number(process.env.WEB_SLIDESHOW_PORT ?? 3003),
    proxy: {
      '/api': SERVER_URL,
      '/renditions': SERVER_URL,
      '/ws': { target: SERVER_URL, ws: true },
    },
  },
  build: {
    target: 'es2020', // Chromecast/older smart-TV browsers
  },
}));
