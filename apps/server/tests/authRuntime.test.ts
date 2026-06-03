import { describe, expect, it } from 'vitest';
import { authRuntime } from '../src/services/authRuntime.js';

/**
 * Pure secret logic — no DB, so this runs without the native better-sqlite3
 * build. The HTTP setup/login/session flows are exercised by manual
 * verification (see the plan). First-run setup itself takes no secret (it's
 * open until the first account exists); this only guards the desktop
 * auto-login secret.
 */
describe('authRuntime', () => {
  it('validates the desktop local-owner secret for auto-login', () => {
    authRuntime.init({ localAuthSecret: 'desktop-secret' });
    expect(authRuntime.hasLocalSecret()).toBe(true);
    expect(authRuntime.isValidLocalSecret('desktop-secret')).toBe(true);
    expect(authRuntime.isValidLocalSecret('wrong')).toBe(false);
  });

  it('rejects every secret on the standalone path (none supplied)', () => {
    authRuntime.init({ localAuthSecret: null });
    expect(authRuntime.hasLocalSecret()).toBe(false);
    expect(authRuntime.isValidLocalSecret('anything')).toBe(false);
    expect(authRuntime.isValidLocalSecret('')).toBe(false);
  });
});
