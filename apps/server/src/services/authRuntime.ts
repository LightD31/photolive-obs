import { timingSafeEqual } from 'node:crypto';

function timingSafeEq(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

/**
 * Per-process secret for the desktop's silent auto-login. Generated per launch
 * by the Electron host and handed to both the server (here) and the renderer
 * (via the preload bootstrap); possession proves the caller is the local owner,
 * which authorizes `/api/auth/bootstrap`. Absent on the standalone/CLI path.
 *
 * First-run admin creation does NOT use this — setup is open until the first
 * account exists (see routes/auth.ts), so there's no token for an operator to
 * copy.
 */
class AuthRuntime {
  private localAuthSecret: string | null = null;

  init(opts: { localAuthSecret?: string | null }): void {
    this.localAuthSecret = opts.localAuthSecret ?? null;
  }

  /** Whether the desktop host supplied a local-owner secret this launch. */
  hasLocalSecret(): boolean {
    return this.localAuthSecret !== null;
  }

  /** Does `secret` prove the caller is the local desktop owner (for auto-login)? */
  isValidLocalSecret(secret: string): boolean {
    return this.localAuthSecret !== null && timingSafeEq(secret, this.localAuthSecret);
  }
}

export const authRuntime = new AuthRuntime();
export { timingSafeEq };
