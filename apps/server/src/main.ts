import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { startServer } from './app.js';
import {
  ConfigValidationError,
  buildConfigFromEnv,
  buildConfigFromFile,
  loadDotenv,
  parseSettingsFile,
} from './config.js';

type Bootstrap = {
  config: import('./config.js').Config;
  dataDir: string;
  settingsPath: string | null;
  initialSettings: import('@photolive/shared').AppSettingsFile | null;
};

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

function bootstrap(): Bootstrap {
  const { settingsPath } = parseArgs(process.argv.slice(2));
  if (settingsPath) {
    const abs = resolve(settingsPath);
    if (!existsSync(abs)) {
      console.error(`settings file not found: ${abs}`);
      process.exit(1);
    }
    const raw = JSON.parse(readFileSync(abs, 'utf8'));
    const file = parseSettingsFile(raw);
    const dataDir = file.storage.dataDir ?? dirname(abs);
    return {
      config: buildConfigFromFile(file, dataDir),
      dataDir,
      settingsPath: abs,
      initialSettings: file,
    };
  }
  loadDotenv();
  const cfg = buildConfigFromEnv(process.env);
  return {
    config: cfg,
    // Closest analogue to a "data dir" in env mode — used by the read-only
    // GET /api/app-settings to report something sensible.
    dataDir: dirname(cfg.databasePath),
    settingsPath: null,
    initialSettings: null,
  };
}

async function main(): Promise<void> {
  let boot: Bootstrap;
  try {
    boot = bootstrap();
  } catch (err) {
    if (err instanceof ConfigValidationError) {
      console.error(`${err.message}:`);
      console.error(err.fieldErrors);
      process.exit(1);
    }
    throw err;
  }

  const server = await startServer(boot);

  const shutdown = async (signal: string): Promise<void> => {
    console.log(`received ${signal}, shutting down`);
    await server.shutdown();
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

main().catch((err) => {
  console.error('fatal startup error', err);
  process.exit(1);
});
