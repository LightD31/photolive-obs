import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import fastifyStatic from '@fastify/static';
import type { FastifyInstance } from 'fastify';
import { logger } from '../logger.js';

/**
 * Serves the built frontend bundles in production:
 *   /             → apps/web-control/dist     (operator UI, default landing page)
 *   /slideshow/*  → apps/web-slideshow/dist   (audience-facing slideshow for OBS)
 *
 * In dev these are skipped silently — Vite dev servers handle them on their own ports.
 *
 * SPA fallback: any unknown path that's neither an API/WS/rendition is served the
 * appropriate index.html so client-side routing works on a deep link.
 */
// Find the directory containing apps/web-control by walking up from `start`.
// Robust to: tsx in dev, esbuild-bundled main.js in prod, and pkg snapshot fs.
function findFrontendRoot(start: string): string {
  let dir = start;
  for (let i = 0; i < 20; i++) {
    if (existsSync(resolve(dir, 'apps', 'web-control'))) return dir;
    const parent = resolve(dir, '..');
    if (parent === dir) break;
    dir = parent;
  }
  return start;
}

export async function frontendRoutes(app: FastifyInstance): Promise<void> {
  const repoRoot = findFrontendRoot(import.meta.dirname);
  const controlDist = resolve(repoRoot, 'apps', 'web-control', 'dist');
  const slideshowDist = resolve(repoRoot, 'apps', 'web-slideshow', 'dist');

  if (existsSync(slideshowDist)) {
    await app.register(fastifyStatic, {
      root: slideshowDist,
      prefix: '/slideshow/',
      decorateReply: false,
      wildcard: false,
    });
    logger.info({ slideshowDist }, 'serving web-slideshow bundle at /slideshow/');
  } else {
    logger.info('no web-slideshow dist found; assuming dev mode (Vite serves on 3003)');
  }

  if (existsSync(controlDist)) {
    await app.register(fastifyStatic, {
      root: controlDist,
      prefix: '/',
      decorateReply: false,
      wildcard: false,
    });
    app.setNotFoundHandler(async (request, reply) => {
      if (request.url.startsWith('/api/')) return reply.code(404).send({ error: 'not found' });
      if (request.url.startsWith('/ws')) return reply.code(404).send({ error: 'not found' });
      if (request.url.startsWith('/renditions/'))
        return reply.code(404).send({ error: 'not found' });
      // Browser auto-requests these; we don't ship them. 204 keeps the console clean.
      if (request.url === '/favicon.ico' || request.url === '/robots.txt') {
        return reply.code(204).send();
      }
      // SPA fallback: slideshow deep links → slideshow index, everything else → control.
      const indexDir =
        request.url.startsWith('/slideshow') && existsSync(slideshowDist)
          ? slideshowDist
          : controlDist;
      const indexPath = resolve(indexDir, 'index.html');
      if (!existsSync(indexPath)) return reply.code(404).send({ error: 'not found' });
      return reply.type('text/html').send(readFileSync(indexPath));
    });
    logger.info({ controlDist }, 'serving web-control bundle at /');
  } else {
    logger.info('no web-control dist found; assuming dev mode (Vite serves on 3002)');
  }
}
