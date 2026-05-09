import OBSWebSocket from 'obs-websocket-js';
import { config } from '../config.js';
import { logger } from '../logger.js';

/**
 * Optional OBS WebSocket integration. Only connects if OBS_WEBSOCKET_URL is set.
 */
export class ObsService {
  private client: OBSWebSocket | null = null;
  private connected = false;

  async connect(): Promise<void> {
    if (!config.obs.url) return;
    const client = new OBSWebSocket();
    try {
      await client.connect(config.obs.url, config.obs.password || undefined);
      this.client = client;
      this.connected = true;
      logger.info({ url: config.obs.url }, 'OBS WebSocket connected');
    } catch (err) {
      logger.warn({ err, url: config.obs.url }, 'OBS WebSocket connection failed');
      this.client = null;
      this.connected = false;
    }
  }

  isConnected(): boolean {
    return this.connected;
  }

  async setScene(sceneName: string): Promise<void> {
    if (!this.client || !this.connected) return;
    try {
      await this.client.call('SetCurrentProgramScene', { sceneName });
    } catch (err) {
      logger.warn({ err, sceneName }, 'OBS setScene failed');
    }
  }

  async listScenes(): Promise<string[]> {
    if (!this.client || !this.connected) return [];
    try {
      const res = await this.client.call('GetSceneList');
      return (res.scenes ?? [])
        .map((s) => String((s as { sceneName?: string }).sceneName ?? ''))
        .filter(Boolean);
    } catch (err) {
      logger.warn({ err }, 'OBS listScenes failed');
      return [];
    }
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      try {
        await this.client.disconnect();
      } catch {
        /* ignore */
      }
    }
    this.connected = false;
    this.client = null;
  }

  async restart(): Promise<void> {
    await this.disconnect();
    await this.connect();
  }
}

export const obsService = new ObsService();
