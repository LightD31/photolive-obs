import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import {
  type AppSettingsFile,
  type AppSettingsPatch,
  appSettingsFileSchema,
} from '@photolive/shared';

/**
 * Owns the settings.json on disk and exposes typed read/patch/rotate.
 * Initialised once by the server boot (CLI or Electron host) with the
 * absolute path to the file (or `null` if bootstrapped from env, in which
 * case mutations are refused so we never silently divorce live config from
 * persisted state).
 */
export class SettingsStore {
  private path: string | null = null;
  private dataDir: string | null = null;
  private cached: AppSettingsFile | null = null;

  init(opts: { path: string | null; dataDir: string; current: AppSettingsFile | null }): void {
    this.path = opts.path;
    this.dataDir = opts.dataDir;
    this.cached = opts.current;
  }

  getPath(): string | null {
    return this.path;
  }

  getDataDir(): string {
    if (!this.dataDir) throw new Error('settingsStore: dataDir not set');
    return this.dataDir;
  }

  canMutate(): boolean {
    return this.path !== null;
  }

  /** Read fresh from disk. Falls back to cached if no path set. */
  read(): AppSettingsFile {
    if (this.path) {
      const raw = JSON.parse(readFileSync(this.path, 'utf8'));
      const parsed = appSettingsFileSchema.parse(raw);
      this.cached = parsed;
      return parsed;
    }
    if (this.cached) return this.cached;
    throw new Error('settingsStore: not initialised');
  }

  /**
   * Deep-merge a partial patch into the current settings, validate, and
   * write to disk. Token is not patchable here — use `rotateToken()` (or
   * provide an explicit token in a future endpoint if we add one).
   */
  writePatch(patch: AppSettingsPatch): AppSettingsFile {
    if (!this.path) throw new SettingsImmutableError();
    const current = this.read();
    const merged: AppSettingsFile = {
      ...current,
      logLevel: patch.logLevel ?? current.logLevel,
      network: { ...current.network, ...(patch.network ?? {}) },
      storage: { ...current.storage, ...(patch.storage ?? {}) },
      ftp: { ...current.ftp, ...(patch.ftp ?? {}) },
      obs: { ...current.obs, ...(patch.obs ?? {}) },
    };
    const validated = appSettingsFileSchema.parse(merged);
    this.persist(validated);
    return validated;
  }

  rotateToken(newToken: string): AppSettingsFile {
    if (!this.path) throw new SettingsImmutableError();
    const current = this.read();
    const next: AppSettingsFile = { ...current, authToken: newToken };
    const validated = appSettingsFileSchema.parse(next);
    this.persist(validated);
    return validated;
  }

  private persist(file: AppSettingsFile): void {
    if (!this.path) throw new SettingsImmutableError();
    mkdirSync(dirname(this.path), { recursive: true });
    writeFileSync(this.path, `${JSON.stringify(file, null, 2)}\n`, { mode: 0o600 });
    this.cached = file;
  }
}

export class SettingsImmutableError extends Error {
  constructor() {
    super(
      'settings cannot be mutated: server bootstrapped from environment, edit .env and restart instead',
    );
    this.name = 'SettingsImmutableError';
  }
}

export const settingsStore = new SettingsStore();
