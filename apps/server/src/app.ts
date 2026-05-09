import cors from '@fastify/cors';
import sensible from '@fastify/sensible';
import websocket from '@fastify/websocket';
import Fastify, { type FastifyInstance } from 'fastify';
import { requireAuth } from './auth.js';
import { config } from './config.js';
import { logger } from './logger.js';
import { eventRoutes } from './routes/events.js';
import { frontendRoutes } from './routes/frontends.js';
import { healthRoutes } from './routes/health.js';
import { imageRoutes } from './routes/images.js';
import { networkRoutes } from './routes/network.js';
import { photographerRoutes } from './routes/photographers.js';
import { renditionRoutes } from './routes/renditions.js';
import { settingsRoutes } from './routes/settings.js';
import { wsRoutes } from './routes/ws.js';

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: false, // we use our own pino instance via the `logger` import
    disableRequestLogging: !config.isDev,
    bodyLimit: 10 * 1024 * 1024, // 10MB for watermark uploads etc.
  });

  app.addHook('onRequest', async (request) => {
    if (config.isDev) {
      logger.debug({ method: request.method, url: request.url }, 'request');
    }
  });

  await app.register(sensible);
  await app.register(cors, {
    origin: config.allowedOrigins.length === 0 ? true : config.allowedOrigins,
    credentials: true,
  });
  await app.register(websocket, {
    options: { maxPayload: 1_048_576 },
  });

  // Auth on /api/* routes only — renditions and the WS upgrade authenticate themselves.
  app.addHook('onRequest', async (request, reply) => {
    if (request.url.startsWith('/api/')) {
      await requireAuth(request, reply);
    }
  });

  // Routes
  await app.register(healthRoutes);
  await app.register(renditionRoutes);
  await app.register(eventRoutes);
  await app.register(photographerRoutes);
  await app.register(imageRoutes);
  await app.register(networkRoutes);
  await app.register(settingsRoutes);
  await app.register(wsRoutes);
  await app.register(frontendRoutes);

  return app;
}
