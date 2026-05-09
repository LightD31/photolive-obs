/**
 * Thin wrappers around the Electron preload bridge. When running outside
 * Electron (a plain browser, OBS browser source, or remote tab), `isElectron`
 * is false and the helper functions return null / no-op.
 */

export function isElectron(): boolean {
  return typeof window !== 'undefined' && window.photolive?.isElectron === true;
}

export function getBootstrap(): PhotoliveBootstrap | null {
  return window.photolive?.bootstrap ?? null;
}

export async function relaunch(): Promise<void> {
  if (window.photolive) await window.photolive.app.relaunch();
}

export async function revealDataDir(): Promise<void> {
  if (window.photolive) await window.photolive.app.revealDataDir();
}

export async function openLogs(): Promise<void> {
  if (window.photolive) await window.photolive.app.openLogs();
}

export async function pickFolder(current?: string): Promise<string | null> {
  if (!window.photolive) return null;
  return window.photolive.app.pickFolder(current);
}
