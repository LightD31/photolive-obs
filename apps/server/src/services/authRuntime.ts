import { randomBytes, timingSafeEqual } from 'node:crypto';

function timingSafeEq(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

/**
 * Per-process auth secrets used to authorize first-run admin creation and the
 * desktop's silent auto-login. Initialised once by `startServer`.
 *
 *   - `localAuthSecret` is generated per launch by the Electron host and handed
 *     to both the server (here) and the renderer (via the preload bootstrap).
 *     Possession proves the caller is the local desktop owner ⇒ it authorizes
 *     setup AND auto-login.
 *   - `setupToken` is minted only for a standalone/CLI first run (no Electron
 *     secret, zero users) and logged once so the operator can paste it into the
 *     setup wizard. It authorizes setup only — never login.
 */
class AuthRuntime {
  private localAuthSecret: string | null = null;
  private setupToken: string | null = null;

  init(opts: { localAuthSecret?: string | null; needsSetup: boolean }): void {
    this.localAuthSecret = opts.localAuthSecret ?? null;
    this.setupToken =
      !this.localAuthSecret && opts.needsSetup ? randomBytes(24).toString('base64url') : null;
  }

  /** The one-time standalone setup token, if one was minted. */
  getSetupToken(): string | null {
    return this.setupToken;
  }

  /** Whether the desktop host supplied a local-owner secret this launch. */
  hasLocalSecret(): boolean {
    return this.localAuthSecret !== null;
  }

  /** Does `secret` authorize first-run setup (desktop secret OR standalone token)? */
  isValidSetupSecret(secret: string): boolean {
    if (this.localAuthSecret && timingSafeEq(secret, this.localAuthSecret)) return true;
    if (this.setupToken && timingSafeEq(secret, this.setupToken)) return true;
    return false;
  }

  /** Does `secret` prove the caller is the local desktop owner (for auto-login)? */
  isValidLocalSecret(secret: string): boolean {
    return this.localAuthSecret !== null && timingSafeEq(secret, this.localAuthSecret);
  }

  /** Setup is single-use; drop the standalone token once an admin exists. */
  clearSetupToken(): void {
    this.setupToken = null;
  }
}

export const authRuntime = new AuthRuntime();
export { timingSafeEq };
