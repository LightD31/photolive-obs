import cors from '@fastify/cors';
import sensible from '@fastify/sensible';
import websocket from '@fastify/websocket';
import type { AppSettingsFile } from '@photolive/shared';
import Fastify, { type FastifyInstance } from 'fastify';
import { requireAuth } from './auth.js';
import { type Config, config, setConfig } from './config.js';

// Re-export the bits the Electron host needs so it imports them through the
// public package entry rather than reaching into ./dist subpaths.
export {
  buildConfigFromEnv,
  buildConfigFromFile,
  ConfigValidationError,
  parseSettingsFile,
  setConfig,
} from './config.js';
export type { AppSettingsFile } from '@photolive/shared';
export type { Config } from './config.js';
import { initDb } from './db/index.js';
import { initLogger, logger } from './logger.js';
import { appSettingsRoutes } from './routes/appSettings.js';
import { eventRoutes } from './routes/events.js';
import { frontendRoutes } from './routes/frontends.js';
import { healthRoutes } from './routes/health.js';
import { imageRoutes } from './routes/images.js';
import { networkRoutes } from './routes/network.js';
import { photographerRoutes } from './routes/photographers.js';
import { renditionRoutes } from './routes/renditions.js';
import { settingsRoutes } from './routes/settings.js';
import { wsRoutes } from './routes/ws.js';
import { fileWatcherService } from './services/fileWatcherService.js';
import { ftpService } from './services/ftpService.js';
import { ingestService } from './services/ingestService.js';
import { obsService } from './services/obsService.js';
import { type ReloadResult, serverLifecycle } from './services/serverLifecycle.js';
import { settingsStore } from './services/settingsStore.js';
import { slideshowService } from './services/slideshowService.js';

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: false, // we use our own pino instance via the `logger` import
    disableRequestLogging: !config.isDev,
    bodyLimit: 10 * 1024 * 1024, // 10MB for watermark uploads etc.
  });

  app.addHook('onRequest', async (request) => {
    if (config.isDev) {
      logger.debug({ method: request.method, url: request.url }, 'request');
    }
  });

  await app.register(sensible);
  await app.register(cors, {
    origin: config.allowedOrigins.length === 0 ? true : config.allowedOrigins,
    credentials: true,
  });
  await app.register(websocket, {
    options: { maxPayload: 1_048_576 },
  });

  // Auth on /api/* routes only — renditions and the WS upgrade authenticate themselves.
  app.addHook('onRequest', async (request, reply) => {
    if (request.url.startsWith('/api/')) {
      await requireAuth(request, reply);
    }
  });

  // Routes
  await app.register(healthRoutes);
  await app.register(renditionRoutes);
  await app.register(eventRoutes);
  await app.register(photographerRoutes);
  await app.register(imageRoutes);
  await app.register(networkRoutes);
  await app.register(settingsRoutes);
  await app.register(appSettingsRoutes);
  await app.register(wsRoutes);
  await app.register(frontendRoutes);

  return app;
}

export type StartServerOptions = {
  /** Initial config to install via `setConfig` before any service touches it. */
  config: Config;
  /** Resolved data directory used by lazy services (db, photos, renditions). */
  dataDir: string;
  /**
   * Path to the settings.json file. Pass `null` when bootstrapped from `.env`
   * (mutations through `/api/app-settings` are then refused).
   */
  settingsPath: string | null;
  /** Already-parsed file contents, if known. Optional — store will read on demand. */
  initialSettings?: AppSettingsFile | null;
};

export type StartedServer = {
  app: FastifyInstance;
  shutdown: () => Promise<void>;
  reload: (newConfig: Config) => Promise<ReloadResult>;
};

/**
 * One-call boot used by `apps/server/src/main.ts` (CLI) and the Electron
 * host. Owns:
 *   - `setConfig(opts.config)` before any module touches the live config
 *   - lazy logger + db init
 *   - drizzle migration
 *   - fastify build + listen
 *   - ftp / file watcher / obs subsystem startup
 *   - wiring `serverLifecycle.reload` so routes can trigger a hot reload
 */
export async function startServer(opts: StartServerOptions): Promise<StartedServer> {
  setConfig(opts.config);
  initLogger();
  const db = initDb();

  settingsStore.init({
    path: opts.settingsPath,
    dataDir: opts.dataDir,
    current: opts.initialSettings ?? null,
  });

  // Run migrations if a drizzle folder is reachable. We probe several
  // candidate locations because the same `app.js` is loaded from a few
  // different layouts: dev (tsx, src/), CLI prod (dist/ next to drizzle/),
  // and Electron (process.resourcesPath/server/drizzle via extraResources).
  try {
    const { migrate } = await import('drizzle-orm/better-sqlite3/migrator');
    const { existsSync } = await import('node:fs');
    const { resolve } = await import('node:path');
    const candidates: string[] = [
      resolve(import.meta.dirname, 'drizzle'),
      resolve(import.meta.dirname, '..', 'drizzle'),
      resolve(import.meta.dirname, '..', '..', 'drizzle'),
      resolve(import.meta.dirname, '..', '..', '..', 'drizzle'),
      resolve(import.meta.dirname, '..', '..', '..', '..', 'drizzle'),
    ];
    // Electron injects `process.resourcesPath` for files packed via
    // `extraResources`. Outside Electron it's undefined — we feature-detect.
    const resourcesPath = (process as { resourcesPath?: string }).resourcesPath;
    if (resourcesPath) {
      candidates.unshift(resolve(resourcesPath, 'server', 'drizzle'));
    }
    const folder = candidates.find(existsSync);
    if (folder) {
      migrate(db, { migrationsFolder: folder });
      logger.info({ migrationsFolder: folder }, 'database migrations applied');
    } else {
      logger.warn('no drizzle migrations folder found; assuming schema already exists');
    }
  } catch (err) {
    logger.error({ err }, 'failed to run migrations');
    throw err;
  }

  const app = await buildApp();
  await app.listen({ port: opts.config.port, host: opts.config.host });
  logger.info({ port: opts.config.port, host: opts.config.host }, 'http server listening');

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

  slideshowService.reload();

  // -- reload + shutdown -----------------------------------------------------

  const reload = async (newConfig: Config): Promise<ReloadResult> => {
    const oldConfig = config;
    const reasons: string[] = [];

    if (oldConfig.port !== newConfig.port) reasons.push('Network port changed');
    if (oldConfig.host !== newConfig.host) reasons.push('Network host changed');
    if (oldConfig.databasePath !== newConfig.databasePath) reasons.push('Database path changed');
    if (!arraysEqual(oldConfig.allowedOrigins, newConfig.allowedOrigins)) {
      reasons.push('Allowed origins changed (CORS)');
    }
    if (oldConfig.photosRoot !== newConfig.photosRoot) {
      reasons.push('Photos root changed (existing events keep their stored photosDir)');
    }
    if (oldConfig.renditionsRoot !== newConfig.renditionsRoot) {
      reasons.push('Renditions root changed (existing renditions stay at the old path)');
    }

    // Hot-reloadable: install the new config, then poke each subsystem.
    setConfig(newConfig);

    if (oldConfig.logLevel !== newConfig.logLevel) {
      logger.level = newConfig.logLevel;
      logger.info({ from: oldConfig.logLevel, to: newConfig.logLevel }, 'log level updated');
    }

    if (
      oldConfig.obs.url !== newConfig.obs.url ||
      oldConfig.obs.password !== newConfig.obs.password
    ) {
      try {
        await obsService.restart();
      } catch (err) {
        logger.warn({ err }, 'obs restart failed during reload');
      }
    }

    const ftpChanged =
      oldConfig.ftp.host !== newConfig.ftp.host ||
      oldConfig.ftp.port !== newConfig.ftp.port ||
      oldConfig.ftp.pasvUrl !== newConfig.ftp.pasvUrl ||
      oldConfig.ftp.pasvMin !== newConfig.ftp.pasvMin ||
      oldConfig.ftp.pasvMax !== newConfig.ftp.pasvMax;
    if (ftpChanged) {
      try {
        await ftpService.restart();
      } catch (err) {
        logger.warn({ err }, 'ftp restart failed during reload');
      }
    }

    return { requiresRestart: reasons.length > 0, reasons };
  };

  serverLifecycle.setReload(reload);

  const shutdown = async (): Promise<void> => {
    serverLifecycle.clear();
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
  };

  return { app, shutdown, reload };
}

function arraysEqual(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}
