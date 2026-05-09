import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { AppSettingsFile } from '@photolive/shared' with { 'resolution-mode': 'import' };

/**
 * Returns the parsed settings.json at <dataDir>/settings.json, creating it
 * on first run with a freshly-generated auth token and schema-default values.
 *
 * On first run we also probe a few "legacy v0.1 install" locations for a
 * `.env` file produced by the old standalone server tarball; if one exists
 * we translate it into settings.json so existing operators don't have to
 * re-enter their token / reconfigure FTP. See `migrateFromEnv` below.
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
  migratedFromEnv?: string;
} {
  const path = join(dataDir, 'settings.json');
  if (existsSync(path)) {
    const raw = readFileSync(path, 'utf8');
    return { settings: JSON.parse(raw) as AppSettingsFile, path, freshlyCreated: false };
  }

  const migrated = migrateFromEnv();
  const settings: AppSettingsFile =
    migrated?.settings ?? defaultSettings(randomBytes(32).toString('base64url'));

  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(settings, null, 2)}\n`, { mode: 0o600 });
  return {
    settings,
    path,
    freshlyCreated: true,
    migratedFromEnv: migrated?.envPath,
  };
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

/**
 * v0.1 installs shipped a `.env` file. Look for one in places the old
 * tarball/RPM put it; if found, fold its values into a settings.json so
 * the user doesn't have to re-enter auth token, FTP ports, OBS URL etc.
 *
 * Locations probed (first hit wins):
 *   - <cwd>/.env          (running portable from its directory)
 *   - <exe-dir>/.env      (sibling of the launcher script)
 *   - /etc/photolive.env  (legacy RPM systemd service config)
 *   - $HOME/.config/photolive/photolive.env
 */
function migrateFromEnv(): { settings: AppSettingsFile; envPath: string } | null {
  const candidates = [
    join(process.cwd(), '.env'),
    process.argv[0] ? join(dirname(process.argv[0]), '.env') : '',
    '/etc/photolive.env',
    process.env.HOME ? join(process.env.HOME, '.config', 'photolive', 'photolive.env') : '',
  ].filter(Boolean);

  for (const envPath of candidates) {
    if (!existsSync(envPath)) continue;
    try {
      const env = parseEnvFile(readFileSync(envPath, 'utf8'));
      if (!env.PHOTOLIVE_AUTH_TOKEN) continue; // not a photolive env
      return { settings: settingsFromEnv(env), envPath };
    } catch {
      /* try next candidate */
    }
  }
  return null;
}

function parseEnvFile(content: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const rawLine of content.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq < 0) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

function settingsFromEnv(env: Record<string, string>): AppSettingsFile {
  const num = (k: string, dflt: number): number => {
    const v = env[k];
    if (!v) return dflt;
    const n = Number.parseInt(v, 10);
    return Number.isFinite(n) ? n : dflt;
  };
  const lvl = (env.LOG_LEVEL ?? 'info') as AppSettingsFile['logLevel'];
  return {
    schemaVersion: 1,
    authToken: env.PHOTOLIVE_AUTH_TOKEN ?? randomBytes(32).toString('base64url'),
    logLevel: ['trace', 'debug', 'info', 'warn', 'error', 'fatal'].includes(lvl) ? lvl : 'info',
    network: {
      port: num('PORT', 3001),
      host: env.HOST ?? '0.0.0.0',
      allowedOrigins: (env.ALLOWED_ORIGINS ?? '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    },
    storage: {
      dataDir: null,
      // If old paths are absolute, keep them so existing data is reused
      // in place; if relative, fall back to defaults under the new dataDir.
      databasePath: env.DATABASE_PATH?.startsWith('/') ? env.DATABASE_PATH : null,
      photosRoot: env.PHOTOS_ROOT?.startsWith('/') ? env.PHOTOS_ROOT : null,
      renditionsRoot: env.RENDITIONS_ROOT?.startsWith('/') ? env.RENDITIONS_ROOT : null,
    },
    ftp: {
      host: env.FTP_HOST ?? '0.0.0.0',
      port: num('FTP_PORT', 2121),
      pasvUrl: env.FTP_PASV_URL ?? '127.0.0.1',
      pasvMin: num('FTP_PASV_MIN', 50000),
      pasvMax: num('FTP_PASV_MAX', 50100),
    },
    obs: {
      url: env.OBS_WEBSOCKET_URL ?? '',
      password: env.OBS_WEBSOCKET_PASSWORD ?? '',
    },
  };
}
