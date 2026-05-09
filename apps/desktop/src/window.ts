import { join } from 'node:path';
import { BrowserWindow } from 'electron';

export type CreateWindowOptions = {
  url: string;
  bootstrapPayload: string;
  preloadPath: string;
};

export function createMainWindow(opts: CreateWindowOptions): BrowserWindow {
  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 960,
    minHeight: 600,
    show: false,
    title: 'Photolive',
    webPreferences: {
      preload: opts.preloadPath,
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      additionalArguments: [`--photolive-bootstrap=${opts.bootstrapPayload}`],
    },
  });

  win.once('ready-to-show', () => win.show());
  void win.loadURL(opts.url);
  return win;
}

export function preloadPath(): string {
  // dist/main.js sits alongside dist/preload.js after tsc.
  // (CJS context — `__dirname` is auto-injected.)
  return join(__dirname, 'preload.js');
}
