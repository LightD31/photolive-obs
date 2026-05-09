import { mkdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { app } from 'electron';

export type DataDirSource = 'override' | 'next-to-exe' | 'userData' | 'dev';

export type ResolvedDataDir = {
  dir: string;
  source: DataDirSource;
};

/**
 * Resolves the data directory. User override always wins; otherwise we prefer
 * a `data/` folder next to the app exe (matches the current portable feel)
 * and fall back to `app.getPath('userData')` when the install dir is read-only
 * (Program Files on a per-machine NSIS install) or when running inside a
 * read-only AppImage mount (`process.env.APPIMAGE`).
 *
 * Throws if `override` is set but unwritable — caller surfaces the error
 * inline rather than silently picking a different path.
 */
export function resolveDataDir(override?: string | null): ResolvedDataDir {
  if (override) {
    if (!tryWritable(override)) {
      throw new Error(`data directory is not writable: ${override}`);
    }
    return { dir: override, source: 'override' };
  }

  if (!app.isPackaged) {
    // Dev mode: <repo-root>/data, mirroring the existing CLI workflow.
    const repoData = join(app.getAppPath(), '..', '..', 'data');
    mkdirSync(repoData, { recursive: true });
    return { dir: repoData, source: 'dev' };
  }

  if (process.env.APPIMAGE) {
    // AppImages are mounted read-only; "next to exe" would fail.
    const fallback = join(app.getPath('userData'), 'data');
    mkdirSync(fallback, { recursive: true });
    return { dir: fallback, source: 'userData' };
  }

  const nextToExe = join(dirname(app.getPath('exe')), 'data');
  if (tryWritable(nextToExe)) {
    return { dir: nextToExe, source: 'next-to-exe' };
  }

  const fallback = join(app.getPath('userData'), 'data');
  mkdirSync(fallback, { recursive: true });
  return { dir: fallback, source: 'userData' };
}

function tryWritable(dir: string): boolean {
  try {
    mkdirSync(dir, { recursive: true });
    const probe = join(dir, `.writable-probe-${process.pid}`);
    writeFileSync(probe, 'ok');
    unlinkSync(probe);
    return true;
  } catch {
    return false;
  }
}
