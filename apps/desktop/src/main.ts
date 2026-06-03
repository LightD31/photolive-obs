import { appendFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { BrowserWindow, app, dialog, shell } from 'electron';
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
    // On Windows an absolute path like `c:\...\app.js` makes the ESM loader
    // read `c:` as a URL scheme ("Received protocol 'c:'"). Convert to a
    // proper file:// URL so dynamic import() resolves on every platform.
    ServerLib = (await import(pathToFileURL(entry).href)) as ServerApi;
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

  // Windows groups taskbar entries and routes notifications by AppUserModelID;
  // align it with the electron-builder appId so both behave correctly.
  if (process.platform === 'win32') app.setAppUserModelId('io.photolive.app');

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
    bootlog('settings loaded', {
      freshlyCreated: settings.freshlyCreated,
      port: settings.settings.network.port,
      migratedFromEnv: settings.migratedFromEnv ?? null,
    });
  } catch (err) {
    bootlog('loadOrInitSettings failed', { err: (err as Error).message });
    dialog.showErrorBox('Photolive', `Failed to load settings.json.\n\n${(err as Error).message}`);
    app.exit(1);
    return;
  }

  if (settings.freshlyCreated && settings.migratedFromEnv) {
    // One-time, non-blocking notice: legacy v0.1 install detected and imported.
    setImmediate(() => {
      dialog.showMessageBox({
        type: 'info',
        title: 'Photolive — settings imported',
        message: 'Imported existing photolive configuration',
        detail: `Read your previous .env at ${settings.migratedFromEnv} and folded its values into ${settings.path}. You can edit them in Settings.`,
      });
    });
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
    // Single-window server app: closing the window quits. app.quit() routes
    // through the `before-quit` handler below, which shuts the server down.
    app.quit();
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

// Single teardown path. Any quit trigger (window-all-closed, menu, OS signal)
// fires `before-quit`; we hold it open once to stop the embedded server
// cleanly, then let the quit proceed. The `isQuitting` guard makes a second
// before-quit (from our own app.quit()) fall straight through.
let isQuitting = false;
app.on('before-quit', (event) => {
  if (isQuitting || !serverHandle) return;
  event.preventDefault();
  isQuitting = true;
  bootlog('shutting down server before quit');
  void serverHandle
    .shutdown()
    .catch((err: unknown) => bootlog('server shutdown failed', { err: (err as Error).message }))
    .finally(() => {
      serverHandle = null;
      app.quit();
    });
});

// Surface main-process failures into the same log the error dialogs reference,
// instead of letting them disappear silently in a packaged build.
process.on('uncaughtException', (err) => {
  bootlog('uncaughtException', { err: err.message, stack: err.stack });
});
process.on('unhandledRejection', (reason) => {
  bootlog('unhandledRejection', { reason: String(reason) });
});
app.on('render-process-gone', (_event, _webContents, details) => {
  bootlog('render-process-gone', details);
});
app.on('child-process-gone', (_event, details) => {
  bootlog('child-process-gone', details);
});

// Defense in depth (Electron security checklist #13/#14): keep renderers pinned
// to the local server origin and hand any external link to the user's real
// browser rather than spawning an unconfigured Electron window.
app.on('web-contents-created', (_event, contents) => {
  contents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) void shell.openExternal(url);
    return { action: 'deny' };
  });
  contents.on('will-navigate', (event, url) => {
    let host: string | null = null;
    try {
      host = new URL(url).hostname;
    } catch {
      /* unparseable URL — treat as foreign and block below */
    }
    if (host !== '127.0.0.1' && host !== 'localhost') {
      event.preventDefault();
      if (/^https?:\/\//i.test(url)) void shell.openExternal(url);
    }
  });
});

bootApp().catch((err) => {
  dialog.showErrorBox('Photolive', `Fatal startup error.\n\n${(err as Error).message ?? err}`);
  app.exit(1);
});
