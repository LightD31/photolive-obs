import { randomBytes } from 'node:crypto';
import { type AppSettingsFile, appSettingsPatchSchema } from '@photolive/shared';
import type { FastifyInstance } from 'fastify';
import { buildConfigFromFile, getConfig } from '../config.js';
import { logger } from '../logger.js';
import { serverLifecycle } from '../services/serverLifecycle.js';
import { SettingsImmutableError, settingsStore } from '../services/settingsStore.js';

/**
 * App-level settings (formerly .env). Distinct from per-event slideshow
 * display settings, which live at /api/events/:eventId/settings.
 */
export async function appSettingsRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Querystring: { revealToken?: string } }>('/api/app-settings', async (req) => {
    const settings = readSafe();
    return {
      settings: redact(settings, req.query.revealToken === '1'),
      mutable: settingsStore.canMutate(),
      dataDir: settingsStore.getDataDir(),
      settingsPath: settingsStore.getPath(),
    };
  });

  app.put('/api/app-settings', async (req, reply) => {
    if (!settingsStore.canMutate()) {
      return reply.code(409).send({
        error: 'settings are not mutable in this mode',
        hint: 'server bootstrapped from .env; edit .env and restart, or pass --settings <path>',
      });
    }

    const parsed = appSettingsPatchSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() });
    }

    let next: AppSettingsFile;
    try {
      next = settingsStore.writePatch(parsed.data);
    } catch (err) {
      if (err instanceof SettingsImmutableError) {
        return reply.code(409).send({ error: err.message });
      }
      throw err;
    }

    const reload = await serverLifecycle.reload(
      buildConfigFromFile(next, settingsStore.getDataDir()),
    );
    logger.info(
      { requiresRestart: reload.requiresRestart, reasons: reload.reasons },
      'app settings updated',
    );

    return {
      settings: redact(next, false),
      reload,
    };
  });

  app.post('/api/app-settings/rotate-token', async (_req, reply) => {
    if (!settingsStore.canMutate()) {
      return reply.code(409).send({ error: 'settings are not mutable in this mode' });
    }
    const newToken = randomBytes(32).toString('base64url');
    const next = settingsStore.rotateToken(newToken);
    const reload = await serverLifecycle.reload(
      buildConfigFromFile(next, settingsStore.getDataDir()),
    );
    logger.warn('auth token rotated; existing sessions will be invalidated');
    return {
      settings: redact(next, false),
      newToken,
      reload,
    };
  });
}

function readSafe(): AppSettingsFile {
  // If bootstrapped from .env, settingsStore.read() throws; fall back to a
  // synthetic AppSettingsFile derived from the live config so the GET still
  // works in that mode (UI shows everything read-only).
  try {
    return settingsStore.read();
  } catch {
    return synthFromLiveConfig();
  }
}

function synthFromLiveConfig(): AppSettingsFile {
  const c = getConfig();
  return {
    schemaVersion: 1,
    authToken: c.authToken,
    logLevel: c.logLevel,
    network: { port: c.port, host: c.host, allowedOrigins: [...c.allowedOrigins] },
    storage: { dataDir: null, databasePath: null, photosRoot: null, renditionsRoot: null },
    ftp: { ...c.ftp },
    obs: { ...c.obs },
  };
}

function redact(file: AppSettingsFile, revealToken: boolean): AppSettingsFile {
  if (revealToken) return file;
  return {
    ...file,
    authToken: maskToken(file.authToken),
    obs: { ...file.obs, password: file.obs.password ? '••••••••' : '' },
  };
}

function maskToken(token: string): string {
  if (token.length < 8) return '••••';
  return `${token.slice(0, 4)}…${token.slice(-4)}`;
}
