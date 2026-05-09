import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { type AppSettingsFile, appSettingsFileSchema } from '@photolive/shared';
import { config as dotenvConfig } from 'dotenv';
import { z } from 'zod';

/**
 * Thrown when env or settings.json fails validation. Caught by the caller
 * (CLI prints + exits, Electron shows a dialog).
 */
export class ConfigValidationError extends Error {
  constructor(
    message: string,
    public readonly fieldErrors: Record<string, string[]>,
  ) {
    super(message);
    this.name = 'ConfigValidationError';
  }
}

// -- Env schema ---------------------------------------------------------------

const envSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65_535).default(3001),
  HOST: z.string().default('0.0.0.0'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),

  PHOTOLIVE_AUTH_TOKEN: z.string().min(1),

  ALLOWED_ORIGINS: z
    .string()
    .default('http://localhost:3001,http://localhost:3002,http://127.0.0.1:3001'),

  DATABASE_PATH: z.string().default('./data/photolive.sqlite'),

  FTP_HOST: z.string().default('0.0.0.0'),
  FTP_PORT: z.coerce.number().int().min(1).max(65_535).default(2121),
  FTP_PASV_URL: z.string().default('127.0.0.1'),
  FTP_PASV_MIN: z.coerce.number().int().default(50_000),
  FTP_PASV_MAX: z.coerce.number().int().default(50_100),

  PHOTOS_ROOT: z.string().default('./data/photos'),
  RENDITIONS_ROOT: z.string().default('./data/renditions'),

  OBS_WEBSOCKET_URL: z.string().default(''),
  OBS_WEBSOCKET_PASSWORD: z.string().default(''),
});

// -- Resolved shape -----------------------------------------------------------

// The shape consumed by services. Frozen at runtime via Object.freeze, but
// not marked readonly at the type level — fastify-cors and similar libraries
// expect mutable string[] params.
export type Config = {
  port: number;
  host: string;
  isDev: boolean;
  isProd: boolean;
  isTest: boolean;
  logLevel: 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';
  authToken: string;
  allowedOrigins: string[];
  databasePath: string;
  ftp: {
    host: string;
    port: number;
    pasvUrl: string;
    pasvMin: number;
    pasvMax: number;
  };
  photosRoot: string;
  renditionsRoot: string;
  obs: {
    url: string;
    password: string;
  };
};

// -- Builders -----------------------------------------------------------------

/**
 * Walks up from cwd looking for a `.env` file and loads it via dotenv.
 * Caller chooses when to invoke (CLI yes, Electron no).
 */
export function loadDotenv(startDir: string = process.cwd()): void {
  let dir = startDir;
  for (let i = 0; i < 6; i++) {
    const candidate = resolve(dir, '.env');
    if (existsSync(candidate)) {
      dotenvConfig({ path: candidate });
      return;
    }
    const parent = resolve(dir, '..');
    if (parent === dir) break;
    dir = parent;
  }
}

export function buildConfigFromEnv(env: NodeJS.ProcessEnv): Config {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    throw new ConfigValidationError(
      'Invalid environment variables',
      parsed.error.flatten().fieldErrors,
    );
  }
  const e = parsed.data;
  return Object.freeze({
    port: e.PORT,
    host: e.HOST,
    isDev: e.NODE_ENV === 'development',
    isProd: e.NODE_ENV === 'production',
    isTest: e.NODE_ENV === 'test',
    logLevel: e.LOG_LEVEL,
    authToken: e.PHOTOLIVE_AUTH_TOKEN,
    allowedOrigins: e.ALLOWED_ORIGINS.split(',')
      .map((s) => s.trim())
      .filter(Boolean),
    databasePath: resolve(e.DATABASE_PATH),
    ftp: Object.freeze({
      host: e.FTP_HOST,
      port: e.FTP_PORT,
      pasvUrl: e.FTP_PASV_URL,
      pasvMin: e.FTP_PASV_MIN,
      pasvMax: e.FTP_PASV_MAX,
    }),
    photosRoot: resolve(e.PHOTOS_ROOT),
    renditionsRoot: resolve(e.RENDITIONS_ROOT),
    obs: Object.freeze({
      url: e.OBS_WEBSOCKET_URL,
      password: e.OBS_WEBSOCKET_PASSWORD,
    }),
  });
}

/**
 * Build a Config from a parsed settings.json + a resolved data directory.
 * Null `storage` fields fall back to <dataDir>/{photolive.sqlite,photos,renditions}.
 * Origins always include http://127.0.0.1:<port> and http://localhost:<port> for the
 * configured port so the Electron renderer can talk to its own server.
 */
export function buildConfigFromFile(file: AppSettingsFile, dataDir: string): Config {
  const port = file.network.port;
  const auto = [`http://127.0.0.1:${port}`, `http://localhost:${port}`];
  const merged = Array.from(new Set([...auto, ...file.network.allowedOrigins]));

  return Object.freeze({
    port,
    host: file.network.host,
    isDev: false,
    isProd: true,
    isTest: false,
    logLevel: file.logLevel,
    authToken: file.authToken,
    allowedOrigins: merged,
    databasePath: resolve(file.storage.databasePath ?? `${dataDir}/photolive.sqlite`),
    ftp: Object.freeze({
      host: file.ftp.host,
      port: file.ftp.port,
      pasvUrl: file.ftp.pasvUrl,
      pasvMin: file.ftp.pasvMin,
      pasvMax: file.ftp.pasvMax,
    }),
    photosRoot: resolve(file.storage.photosRoot ?? `${dataDir}/photos`),
    renditionsRoot: resolve(file.storage.renditionsRoot ?? `${dataDir}/renditions`),
    obs: Object.freeze({
      url: file.obs.url,
      password: file.obs.password,
    }),
  });
}

/** Parse + validate a raw JSON object as a settings file. */
export function parseSettingsFile(raw: unknown): AppSettingsFile {
  const parsed = appSettingsFileSchema.safeParse(raw);
  if (!parsed.success) {
    throw new ConfigValidationError(
      'Invalid settings file',
      parsed.error.flatten().fieldErrors as Record<string, string[]>,
    );
  }
  return parsed.data;
}

// -- Mutable holder + Proxy facade -------------------------------------------

let current: Config | null = null;

export function setConfig(next: Config): void {
  current = next;
}

export function getConfig(): Config {
  if (!current) {
    throw new Error(
      'config has not been initialized — call setConfig(buildConfigFromEnv(...)) or setConfig(buildConfigFromFile(...)) before importing services',
    );
  }
  return current;
}

export function isConfigInitialized(): boolean {
  return current !== null;
}

/**
 * Backward-compatible facade. Existing code does `import { config } from '../config.js'`
 * and reads e.g. `config.port`, `config.ftp.pasvUrl`. The Proxy delegates every
 * read to `getConfig()` so callers don't need to change.
 */
export const config: Config = new Proxy({} as Config, {
  get(_, prop, receiver) {
    return Reflect.get(getConfig(), prop, receiver);
  },
  has(_, prop) {
    return prop in getConfig();
  },
  ownKeys() {
    return Reflect.ownKeys(getConfig());
  },
  getOwnPropertyDescriptor(_, prop) {
    return Object.getOwnPropertyDescriptor(getConfig(), prop);
  },
}) as Config;
