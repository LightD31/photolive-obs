import type { FastifyReply, FastifyRequest } from 'fastify';
import { config } from './config.js';

/**
 * Bearer-token auth. The control panel and all `/api/*` routes require:
 *   Authorization: Bearer <PHOTOLIVE_AUTH_TOKEN>
 *
 * For ergonomics in OBS browser source / Chromecast (which can't send custom headers),
 * the slideshow page may also pass `?token=<token>` and we accept that for GETs of
 * read-only resources (renditions, slideshow page itself).
 */
export async function requireAuth(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const header = request.headers.authorization;
  let token: string | undefined;
  if (header && header.startsWith('Bearer ')) {
    token = header.slice('Bearer '.length).trim();
  }
  if (!token) {
    const q = (request.query as Record<string, unknown> | undefined)?.token;
    if (typeof q === 'string') token = q;
  }
  if (token !== config.authToken) {
    reply.code(401).send({ error: 'unauthorized' });
  }
}
