import type { AuthStatusDto, UserDto } from '@photolive/shared';
import { getBootstrap } from './electron';

/**
 * Operator auth client. Sessions live in an httpOnly cookie the browser sends
 * automatically on same-origin requests — there is no token in JS/localStorage
 * anymore. These helpers wrap the /api/auth/* endpoints used by the AuthGate.
 */

const UNAUTHORIZED_EVENT = 'photolive:unauthorized';

/** Fired by the API client on a 401 so the AuthGate can drop back to login. */
export function emitUnauthorized(): void {
  window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
}

export function onUnauthorized(handler: () => void): () => void {
  window.addEventListener(UNAUTHORIZED_EVENT, handler);
  return () => window.removeEventListener(UNAUTHORIZED_EVENT, handler);
}

async function postJson<T>(
  path: string,
  body: unknown,
): Promise<{ ok: boolean; status: number; data: T | null }> {
  const res = await fetch(path, {
    method: 'POST',
    credentials: 'include',
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : {},
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  let data: T | null = null;
  try {
    data = (await res.json()) as T;
  } catch {
    /* no body */
  }
  return { ok: res.ok, status: res.status, data };
}

export async function fetchStatus(): Promise<AuthStatusDto> {
  const res = await fetch('/api/auth/status', { credentials: 'include' });
  return (await res.json()) as AuthStatusDto;
}

export async function login(
  username: string,
  password: string,
): Promise<{ ok: boolean; user?: UserDto; error?: string }> {
  const { ok, data } = await postJson<{ user?: UserDto; error?: unknown }>('/api/auth/login', {
    username,
    password,
  });
  if (ok && data?.user) return { ok: true, user: data.user };
  return { ok: false, error: 'Invalid username or password' };
}

export async function setup(
  username: string,
  password: string,
  secret: string,
): Promise<{ ok: boolean; user?: UserDto; error?: string }> {
  const { ok, status, data } = await postJson<{ user?: UserDto }>('/api/auth/setup', {
    username,
    password,
    secret,
  });
  if (ok && data?.user) return { ok: true, user: data.user };
  if (status === 403)
    return {
      ok: false,
      error:
        'Setup secret rejected — open from the desktop app or use the setup link/token from the server log.',
    };
  if (status === 409) return { ok: false, error: 'An account already exists. Reload and sign in.' };
  return { ok: false, error: 'Could not create the account' };
}

/**
 * Desktop silent auto-login. Returns `setup` when the install is fresh (the
 * renderer should show the create-admin wizard), `authed` when logged in, or
 * `unavailable` when not running in Electron / the secret was rejected.
 */
export async function bootstrapLogin(): Promise<'authed' | 'setup' | 'unavailable'> {
  const secret = getBootstrap()?.localAuthSecret;
  if (!secret) return 'unavailable';
  const { ok, data } = await postJson<{ setupRequired: boolean; user: UserDto | null }>(
    '/api/auth/bootstrap',
    { secret },
  );
  if (!ok || !data) return 'unavailable';
  return data.setupRequired ? 'setup' : 'authed';
}

export async function logout(): Promise<void> {
  await postJson('/api/auth/logout', undefined);
}

/** Setup secret to pre-fill: the Electron bootstrap secret, or a `?setup=` token. */
export function setupSecretFromContext(): string | null {
  const fromElectron = getBootstrap()?.localAuthSecret;
  if (fromElectron) return fromElectron;
  const fromQuery = new URLSearchParams(window.location.search).get('setup');
  return fromQuery && fromQuery.length > 0 ? fromQuery : null;
}
