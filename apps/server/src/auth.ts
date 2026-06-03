import type { UserDto } from '@photolive/shared';
import type { FastifyRequest } from 'fastify';
import { config } from './config.js';
import { timingSafeEq } from './services/authRuntime.js';
import { sessionService } from './services/sessionService.js';

/**
 * Two-tier auth.
 *
 *  - Operator session (httpOnly `photolive_session` cookie) ⇒ full access to
 *    the control panel and all `/api/*` routes. Created by login / setup /
 *    desktop bootstrap; see routes/auth.ts.
 *  - Display token (the rotatable view-only token, == config.authToken) ⇒
 *    read-only access used by the audience slideshow / OBS / Chromecast, which
 *    can't hold a session. Sent as `Authorization: Bearer <token>` or
 *    `?token=<token>`, and only unlocks the small allowlist below.
 */
export const SESSION_COOKIE = 'photolive_session';

export type AuthCtx = { operator: UserDto } | { display: true };

declare module 'fastify' {
  interface FastifyRequest {
    /** Set by the global `/api/*` auth hook in app.ts once a request is allowed. */
    authCtx?: AuthCtx;
  }
}

/** Read-only GET routes the display token may reach (everything the slideshow needs). */
const DISPLAY_GET_PATTERNS: RegExp[] = [
  /^\/api\/events\/active$/,
  /^\/api\/events\/[^/]+\/settings$/,
  /^\/api\/events\/[^/]+\/images\/queue$/,
];

/** Auth endpoints that must be reachable without being authenticated. */
const PUBLIC_AUTH_PATHS = new Set([
  '/api/auth/status',
  '/api/auth/login',
  '/api/auth/setup',
  '/api/auth/bootstrap',
  '/api/auth/logout',
]);

function pathOf(url: string): string {
  const q = url.indexOf('?');
  return q === -1 ? url : url.slice(0, q);
}

export function isPublicAuthRoute(request: FastifyRequest): boolean {
  return PUBLIC_AUTH_PATHS.has(pathOf(request.url));
}

export function isDisplayAllowed(method: string, url: string): boolean {
  if (method.toUpperCase() !== 'GET') return false;
  const path = pathOf(url);
  return DISPLAY_GET_PATTERNS.some((re) => re.test(path));
}

/** Pull the display token from `Authorization: Bearer` or `?token=`. */
export function extractDisplayToken(request: FastifyRequest): string | undefined {
  const header = request.headers.authorization;
  if (header?.startsWith('Bearer ')) {
    const t = header.slice('Bearer '.length).trim();
    if (t) return t;
  }
  const q = (request.query as Record<string, unknown> | undefined)?.token;
  return typeof q === 'string' && q ? q : undefined;
}

export function isValidDisplayToken(token: string | undefined): boolean {
  return token !== undefined && timingSafeEq(token, config.authToken);
}

/**
 * Read the session cookie value. Prefers the parsed `request.cookies` from
 * @fastify/cookie, with a raw `Cookie` header fallback so it also works on the
 * WebSocket upgrade request regardless of plugin/hook ordering.
 */
export function sessionCookie(request: FastifyRequest): string | undefined {
  const parsed = (request as { cookies?: Record<string, string | undefined> }).cookies;
  if (parsed && parsed[SESSION_COOKIE]) return parsed[SESSION_COOKIE];

  const header = request.headers.cookie;
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() === SESSION_COOKIE) {
      return decodeURIComponent(part.slice(eq + 1).trim());
    }
  }
  return undefined;
}

/**
 * Resolve a request to an auth context, or null when neither credential is
 * present/valid. Operator session wins over the display token.
 */
export function authenticate(request: FastifyRequest): AuthCtx | null {
  const user = sessionService.validate(sessionCookie(request));
  if (user) return { operator: user };
  if (isValidDisplayToken(extractDisplayToken(request))) return { display: true };
  return null;
}
