import { contextBridge, ipcRenderer } from 'electron';

type Bootstrap = {
  token: string;
  dataDir: string;
  resolvedDataDirSource: string;
  serverUrl: string;
};

function readBootstrap(): Bootstrap | null {
  const arg = process.argv.find((a) => a.startsWith('--photolive-bootstrap='));
  if (!arg) return null;
  try {
    const b64 = arg.slice('--photolive-bootstrap='.length);
    return JSON.parse(Buffer.from(b64, 'base64url').toString('utf8')) as Bootstrap;
  } catch {
    return null;
  }
}

const bootstrap = readBootstrap();

// Narrow, typed surface — never expose raw ipcRenderer.
contextBridge.exposeInMainWorld('photolive', {
  isElectron: true as const,
  bootstrap,
  app: {
    relaunch: (): Promise<void> => ipcRenderer.invoke('app:relaunch'),
    revealDataDir: (): Promise<void> => ipcRenderer.invoke('app:reveal-data-dir'),
    openLogs: (): Promise<void> => ipcRenderer.invoke('app:open-logs'),
    pickFolder: (current?: string): Promise<string | null> =>
      ipcRenderer.invoke('app:pick-folder', current ?? null),
  },
});
