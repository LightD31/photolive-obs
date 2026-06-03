import { describe, expect, it } from 'vitest';
import { authRuntime } from '../src/services/authRuntime.js';

/**
 * Pure secret/token authorization logic — no DB, so this runs without the
 * native better-sqlite3 build. The HTTP-level setup/login/session flows are
 * exercised by manual verification (see the plan) where the schema exists.
 */
describe('authRuntime', () => {
  it('desktop secret authorizes both setup and local auto-login', () => {
    authRuntime.init({ localAuthSecret: 'desktop-secret', needsSetup: true });
    expect(authRuntime.hasLocalSecret()).toBe(true);
    // No standalone token is minted when the desktop host supplies a secret.
    expect(authRuntime.getSetupToken()).toBeNull();
    expect(authRuntime.isValidSetupSecret('desktop-secret')).toBe(true);
    expect(authRuntime.isValidLocalSecret('desktop-secret')).toBe(true);
    expect(authRuntime.isValidSetupSecret('wrong')).toBe(false);
    expect(authRuntime.isValidLocalSecret('wrong')).toBe(false);
  });

  it('standalone first-run mints a setup token that authorizes setup only', () => {
    authRuntime.init({ localAuthSecret: null, needsSetup: true });
    const token = authRuntime.getSetupToken();
    expect(token).toBeTruthy();
    expect(authRuntime.isValidSetupSecret(token as string)).toBe(true);
    // A setup token must never grant a login session.
    expect(authRuntime.isValidLocalSecret(token as string)).toBe(false);
    expect(authRuntime.hasLocalSecret()).toBe(false);
  });

  it('mints no setup token when setup is not needed', () => {
    authRuntime.init({ localAuthSecret: null, needsSetup: false });
    expect(authRuntime.getSetupToken()).toBeNull();
    expect(authRuntime.isValidSetupSecret('anything')).toBe(false);
  });

  it('clearSetupToken closes standalone setup', () => {
    authRuntime.init({ localAuthSecret: null, needsSetup: true });
    const token = authRuntime.getSetupToken() as string;
    authRuntime.clearSetupToken();
    expect(authRuntime.getSetupToken()).toBeNull();
    expect(authRuntime.isValidSetupSecret(token)).toBe(false);
  });
});
