import { appendFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { app, BrowserWindow, dialog } from 'electron';
import { resolveDataDir } from './bootstrap/dataDir.js';
import { loadOrInitSettings } from './bootstrap/settings.js';
import { registerAppIpc } from './ipc/app.js';
import { createMainWindow, preloadPath } from './window.js';

function bootlog(msg: string, extra?: unknown): void {
  const line = `[${new Date().toISOString()}] ${msg}${extra ? ` ${JSON.stringify(extra)}` : ''}\n`;
  process.stderr.write(line);
  try {
    const dir = join(app.getPath('userData'), 'logs');
    mkdirSync(dir, { recursive: true });
    appendFileSync(join(dir, 'main.log'), line);
  } catch {
    /* ignore */
  }
}

// `@photolive/server` is ESM; under Electron 33's bundled Node 20 the static
// `import` interop choked on transitive CJS deps. Loading via dynamic
// `import()` from a CJS entry sidesteps the preparse path.
//
// In dev we resolve via the workspace symlink. In packaged builds the
// workspace symlink doesn't exist — `scripts/stage.cjs` materialises a
// self-contained `apps/desktop/server-runtime/` (with prod node_modules
// already electron-rebuilt) which electron-builder packs alongside dist/.
// We load by absolute path off `__dirname` (Electron transparently routes
// asar / asar.unpacked paths through its module resolver).
type ServerApi = typeof import('@photolive/server', { with: { 'resolution-mode': 'import' } });
let ServerLib: ServerApi | null = null;
async function loadServer(): Promise<ServerApi> {
  if (ServerLib) return ServerLib;
  if (app.isPackaged) {
    // server-runtime ships as extraResources (outside the asar) so its
    // node_modules and any *.node binaries are real filesystem paths.
    const entry = join(process.resourcesPath, 'server-runtime', 'dist', 'app.js');
    ServerLib = (await import(entry)) as ServerApi;
  } else {
    ServerLib = await import('@photolive/server');
  }
  return ServerLib;
}

let mainWindow: BrowserWindow | null = null;
let serverHandle: Awaited<ReturnType<ServerApi['startServer']>> | null = null;

async function bootApp(): Promise<void> {
  bootlog('bootApp: starting');
  const gotLock = app.requestSingleInstanceLock();
  if (!gotLock) {
    bootlog('bootApp: another instance has the lock; exiting');
    app.quit();
    return;
  }
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  await app.whenReady();
  bootlog('app ready');

  let dataDir: string;
  let dataDirSource: string;
  try {
    const resolved = resolveDataDir();
    dataDir = resolved.dir;
    dataDirSource = resolved.source;
    bootlog('resolved dataDir', { dataDir, dataDirSource });
  } catch (err) {
    bootlog('resolveDataDir failed', { err: (err as Error).message });
    dialog.showErrorBox(
      'Photolive',
      `Failed to locate a writable data directory.\n\n${(err as Error).message}`,
    );
    app.exit(1);
    return;
  }

  let settings: ReturnType<typeof loadOrInitSettings>;
  try {
    settings = loadOrInitSettings(dataDir);
    bootlog('settings loaded', { freshlyCreated: settings.freshlyCreated, port: settings.settings.network.port });
  } catch (err) {
    bootlog('loadOrInitSettings failed', { err: (err as Error).message });
    dialog.showErrorBox(
      'Photolive',
      `Failed to load settings.json.\n\n${(err as Error).message}`,
    );
    app.exit(1);
    return;
  }

  bootlog('loading @photolive/server');
  let serverApi: ServerApi;
  try {
    serverApi = await loadServer();
  } catch (err) {
    bootlog('loadServer failed', { err: (err as Error).message, stack: (err as Error).stack });
    dialog.showErrorBox(
      'Photolive',
      `Failed to load the photolive server module.\n\n${(err as Error).message}`,
    );
    app.exit(1);
    return;
  }
  const { startServer, buildConfigFromFile } = serverApi;
  const config = buildConfigFromFile(settings.settings, dataDir);

  const logsDir = join(dataDir, 'logs');
  registerAppIpc({
    getDataDir: () => dataDir,
    getLogsDir: () => logsDir,
  });

  try {
    bootlog('starting server', { port: config.port, host: config.host });
    serverHandle = await startServer({
      config,
      dataDir,
      settingsPath: settings.path,
      initialSettings: settings.settings,
    });
    bootlog('server started');
  } catch (err) {
    bootlog('startServer failed', { err: (err as Error).message, stack: (err as Error).stack });
    dialog.showErrorBox(
      'Photolive',
      `Failed to start the photolive server.\n\n${(err as Error).message}`,
    );
    app.exit(1);
    return;
  }

  const bootstrapPayload = Buffer.from(
    JSON.stringify({
      token: settings.settings.authToken,
      dataDir,
      resolvedDataDirSource: dataDirSource,
      serverUrl: `http://127.0.0.1:${config.port}`,
    }),
  ).toString('base64url');

  mainWindow = createMainWindow({
    url: `http://127.0.0.1:${config.port}/`,
    bootstrapPayload,
    preloadPath: preloadPath(),
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  app.on('window-all-closed', () => {
    void shutdown();
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0 && serverHandle) {
      mainWindow = createMainWindow({
        url: `http://127.0.0.1:${config.port}/`,
        bootstrapPayload,
        preloadPath: preloadPath(),
      });
    }
  });
}

async function shutdown(): Promise<void> {
  if (serverHandle) {
    try {
      await serverHandle.shutdown();
    } catch {
      /* swallow — we're quitting */
    }
    serverHandle = null;
  }
  app.quit();
}

app.on('before-quit', async (event) => {
  if (!serverHandle) return;
  event.preventDefault();
  await serverHandle.shutdown();
  serverHandle = null;
  app.exit(0);
});

bootApp().catch((err) => {
  dialog.showErrorBox(
    'Photolive',
    `Fatal startup error.\n\n${(err as Error).message ?? err}`,
  );
  app.exit(1);
});
