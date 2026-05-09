import type { Config } from '../config.js';

export type ReloadResult = {
  requiresRestart: boolean;
  reasons: string[];
};

type Slots = {
  reload: ((newConfig: Config) => Promise<ReloadResult>) | null;
};

/**
 * Singleton bridge so route handlers (which import services as singletons)
 * can trigger a server-wide config reload without having a reference to
 * the StartedServer handle returned by `startServer()`. The handle assigns
 * `reload` during startup; routes call `serverLifecycle.reload(newConfig)`.
 */
class ServerLifecycle {
  private slots: Slots = { reload: null };

  setReload(fn: (newConfig: Config) => Promise<ReloadResult>): void {
    this.slots.reload = fn;
  }

  clear(): void {
    this.slots.reload = null;
  }

  async reload(newConfig: Config): Promise<ReloadResult> {
    if (!this.slots.reload) {
      throw new Error('serverLifecycle: reload not wired (server not started)');
    }
    return this.slots.reload(newConfig);
  }
}

export const serverLifecycle = new ServerLifecycle();
