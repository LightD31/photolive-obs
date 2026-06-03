import { loginSchema, setupSchema } from '@photolive/shared';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { SESSION_COOKIE, authenticate, sessionCookie } from '../auth.js';
import { logger } from '../logger.js';
import { authRuntime } from '../services/authRuntime.js';
import { SESSION_TTL_MS, sessionService } from '../services/sessionService.js';
import { userService } from '../services/userService.js';

function setSessionCookie(request: FastifyRequest, reply: FastifyReply, sessionId: string): void {
  reply.setCookie(SESSION_COOKIE, sessionId, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
    // Only mark Secure over real HTTPS — a Secure cookie on the plain-http LAN
    // deployment would be dropped by the browser and lock the operator out.
    secure: request.protocol === 'https',
  });
}

/**
 * Operator authentication. The control panel uses these; the slideshow does
 * not (it carries the display token instead). Status/login/setup/bootstrap/
 * logout are exempt from the global auth hook (see auth.ts:PUBLIC_AUTH_PATHS).
 */
export async function authRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/auth/status', async (request) => {
    const ctx = authenticate(request);
    const user = ctx && 'operator' in ctx ? ctx.operator : null;
    return {
      setupRequired: userService.count() === 0,
      authenticated: user !== null,
      user,
    };
  });

  // First-run admin creation. Open while zero accounts exist — the server
  // generates everything (no token for the operator to copy); it closes with
  // 409 the moment an account exists. The desktop auto-login secret is a
  // separate concern (see /api/auth/bootstrap + authRuntime).
  app.post('/api/auth/setup', async (request, reply) => {
    const parsed = setupSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    if (userService.count() > 0) {
      return reply.code(409).send({ error: 'setup already completed' });
    }
    const user = userService.create({
      username: parsed.data.username,
      password: parsed.data.password,
      role: 'admin',
    });
    const session = sessionService.create(user.id);
    setSessionCookie(request, reply, session.id);
    logger.info({ username: user.username }, 'admin account created (first-run setup)');
    return { user };
  });

  app.post('/api/auth/login', async (request, reply) => {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const user = userService.verify(parsed.data.username, parsed.data.password);
    if (!user) return reply.code(401).send({ error: 'invalid credentials' });
    const session = sessionService.create(user.id);
    setSessionCookie(request, reply, session.id);
    return { user };
  });

  // Desktop silent auto-login. The Electron renderer posts the bootstrap secret
  // it received from the preload; possession proves local-owner control.
  app.post('/api/auth/bootstrap', async (request, reply) => {
    const secret = (request.body as { secret?: unknown } | undefined)?.secret;
    if (typeof secret !== 'string' || !authRuntime.isValidLocalSecret(secret)) {
      return reply.code(403).send({ error: 'invalid bootstrap secret' });
    }
    if (userService.count() === 0) {
      // Fresh install: renderer should show the create-admin wizard, then call
      // /api/auth/setup with this same secret.
      return { setupRequired: true, user: null };
    }
    const user = userService.getOwner();
    if (!user) return reply.code(500).send({ error: 'no owner account' });
    const session = sessionService.create(user.id);
    setSessionCookie(request, reply, session.id);
    return { setupRequired: false, user };
  });

  app.post('/api/auth/logout', async (request, reply) => {
    sessionService.revoke(sessionCookie(request));
    reply.clearCookie(SESSION_COOKIE, { path: '/' });
    return { ok: true };
  });

  app.get('/api/auth/me', async (request, reply) => {
    const ctx = request.authCtx;
    if (!ctx || !('operator' in ctx)) return reply.code(401).send({ error: 'unauthorized' });
    return { user: ctx.operator };
  });
}
