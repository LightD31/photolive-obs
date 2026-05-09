import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { buildApp } from './app.js';
import {
  buildConfigFromEnv,
  buildConfigFromFile,
  config,
  ConfigValidationError,
  loadDotenv,
  parseSettingsFile,
  setConfig,
} from './config.js';
import { initDb } from './db/index.js';
import { initLogger, logger } from './logger.js';
import { fileWatcherService } from './services/fileWatcherService.js';
import { ftpService } from './services/ftpService.js';
import { ingestService } from './services/ingestService.js';
import { obsService } from './services/obsService.js';
import { slideshowService } from './services/slideshowService.js';

// Locate the drizzle folder. Bundled prod ships it next to main.js (dist/drizzle);
// dev runs from src/, so the folder is one level up at apps/server/drizzle.
function findMigrationsFolder(): string | null {
  const candidates = [
    resolve(import.meta.dirname, 'drizzle'),
    resolve(import.meta.dirname, '..', 'drizzle'),
  ];
  return candidates.find(existsSync) ?? null;
}

function parseArgs(argv: string[]): { settingsPath: string | null } {
  let settingsPath: string | null = null;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--settings' || a === '-s') {
      settingsPath = argv[++i] ?? null;
    } else if (a?.startsWith('--settings=')) {
      settingsPath = a.slice('--settings='.length);
    }
  }
  return { settingsPath };
}

function bootstrapConfig(): void {
  const { settingsPath } = parseArgs(process.argv.slice(2));
  if (settingsPath) {
    const abs = resolve(settingsPath);
    if (!existsSync(abs)) {
      console.error(`settings file not found: ${abs}`);
      process.exit(1);
    }
    const raw = JSON.parse(readFileSync(abs, 'utf8'));
    const parsed = parseSettingsFile(raw);
    setConfig(buildConfigFromFile(parsed, dirname(abs)));
    return;
  }
  loadDotenv();
  setConfig(buildConfigFromEnv(process.env));
}

async function main(): Promise<void> {
  try {
    bootstrapConfig();
  } catch (err) {
    if (err instanceof ConfigValidationError) {
      console.error(`${err.message}:`);
      console.error(err.fieldErrors);
      process.exit(1);
    }
    throw err;
  }

  initLogger();
  const db = initDb();

  const migrationsFolder = findMigrationsFolder();
  if (migrationsFolder) {
    migrate(db, { migrationsFolder });
    logger.info({ migrationsFolder }, 'database migrations applied');
  } else {
    logger.warn('no drizzle migrations folder found; assuming schema already exists');
  }

  const app = await buildApp();
  await app.listen({ port: config.port, host: config.host });
  logger.info({ port: config.port, host: config.host }, 'http server listening');

  // Start subsystems. None of these should crash the server if they fail —
  // they degrade gracefully instead.
  try {
    await ftpService.start();
  } catch (err) {
    logger.error({ err }, 'failed to start ftp server');
  }

  try {
    await fileWatcherService.watchActiveEvent();
  } catch (err) {
    logger.error({ err }, 'failed to start file watcher');
  }

  try {
    await obsService.connect();
  } catch (err) {
    logger.error({ err }, 'failed to connect to obs');
  }

  // Initial slideshow state from DB
  slideshowService.reload();

  // Graceful shutdown
  const shutdown = async (signal: string): Promise<void> => {
    logger.info({ signal }, 'shutting down');
    try {
      await fileWatcherService.stop();
      await ftpService.stop();
      await obsService.disconnect();
      slideshowService.shutdown();
      await ingestService.shutdown();
      await app.close();
    } catch (err) {
      logger.error({ err }, 'error during shutdown');
    }
    process.exit(0);
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

main().catch((err) => {
  // logger may not be initialised if config bootstrap threw; fall back to console.
  try {
    logger.error({ err }, 'fatal startup error');
  } catch {
    console.error('fatal startup error', err);
  }
  process.exit(1);
});
