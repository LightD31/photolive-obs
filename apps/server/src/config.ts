import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { config as dotenvConfig } from 'dotenv';
import { z } from 'zod';

// Load .env from the monorepo root (or, in dev, the closest one walking up).
function loadEnv(): void {
  let dir = process.cwd();
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
loadEnv();

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

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid environment variables:');
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

const env = parsed.data;

export const config = {
  port: env.PORT,
  host: env.HOST,
  isDev: env.NODE_ENV === 'development',
  isProd: env.NODE_ENV === 'production',
  isTest: env.NODE_ENV === 'test',
  logLevel: env.LOG_LEVEL,
  authToken: env.PHOTOLIVE_AUTH_TOKEN,
  allowedOrigins: env.ALLOWED_ORIGINS.split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  databasePath: resolve(env.DATABASE_PATH),
  ftp: {
    host: env.FTP_HOST,
    port: env.FTP_PORT,
    pasvUrl: env.FTP_PASV_URL,
    pasvMin: env.FTP_PASV_MIN,
    pasvMax: env.FTP_PASV_MAX,
  },
  photosRoot: resolve(env.PHOTOS_ROOT),
  renditionsRoot: resolve(env.RENDITIONS_ROOT),
  obs: {
    url: env.OBS_WEBSOCKET_URL,
    password: env.OBS_WEBSOCKET_PASSWORD,
  },
} as const;

export type Config = typeof config;
