import fastifyStatic from '@fastify/static';
import type { FastifyInstance } from 'fastify';
import { config } from '../config.js';

/**
 * Static rendition serving. URLs look like /renditions/<eventId>/<imageId>.display.webp.
 * No auth on these — they're served to the audience-facing slideshow page (which
 * doesn't have a way to send Authorization headers in OBS browser source / Chromecast).
 *
 * If you're worried about exposure, put the receiver behind a firewall or auth proxy;
 * the LAN-only deployment model assumes the network is trusted.
 */
export async function renditionRoutes(app: FastifyInstance): Promise<void> {
  await app.register(fastifyStatic, {
    root: config.renditionsRoot,
    prefix: '/renditions/',
    decorateReply: false,
    cacheControl: true,
    maxAge: 60_000,
    immutable: false,
  });
}
