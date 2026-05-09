import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { AppSettingsFile } from '@photolive/shared' with { 'resolution-mode': 'import' };

/**
 * Returns the parsed settings.json at <dataDir>/settings.json, creating it
 * on first run with a freshly-generated auth token and schema-default values.
 *
 * Note: we deliberately don't pull in `appSettingsFileSchema` at runtime —
 * doing so would static-import the ESM @photolive/shared package from this
 * CJS Electron entry, which trips Node 20's ESM/CJS preparse bug under
 * Electron 33. The server validates via `settingsStore.read()` on first
 * use, so any malformed file produced here would be caught immediately.
 */
export function loadOrInitSettings(dataDir: string): {
  settings: AppSettingsFile;
  path: string;
  freshlyCreated: boolean;
} {
  const path = join(dataDir, 'settings.json');
  if (existsSync(path)) {
    const raw = readFileSync(path, 'utf8');
    return { settings: JSON.parse(raw) as AppSettingsFile, path, freshlyCreated: false };
  }
  const fresh = defaultSettings(randomBytes(32).toString('base64url'));
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(fresh, null, 2)}\n`, { mode: 0o600 });
  return { settings: fresh, path, freshlyCreated: true };
}

function defaultSettings(authToken: string): AppSettingsFile {
  return {
    schemaVersion: 1,
    authToken,
    logLevel: 'info',
    network: { port: 3001, host: '0.0.0.0', allowedOrigins: [] },
    storage: {
      dataDir: null,
      databasePath: null,
      photosRoot: null,
      renditionsRoot: null,
    },
    ftp: {
      host: '0.0.0.0',
      port: 2121,
      pasvUrl: '127.0.0.1',
      pasvMin: 50000,
      pasvMax: 50100,
    },
    obs: { url: '', password: '' },
  };
}
