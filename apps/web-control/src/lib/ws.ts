import type { ClientCommandMap, ServerEventMap } from '@photolive/shared';
import { getToken } from './auth';

type Listener<K extends keyof ServerEventMap> = (payload: ServerEventMap[K]) => void;

export class WsClient {
  private socket: WebSocket | null = null;
  private listeners = new Map<string, Set<Listener<keyof ServerEventMap>>>();
  private url: string;
  private reconnectAttempts = 0;
  private intentionalClose = false;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(role: 'control' | 'slideshow' = 'control') {
    const token = getToken() ?? '';
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    this.url = `${protocol}//${window.location.host}/ws?role=${role}&token=${encodeURIComponent(token)}`;
  }

  connect(): void {
    this.intentionalClose = false;
    this.socket = new WebSocket(this.url);
    this.socket.onopen = () => {
      this.reconnectAttempts = 0;
    };
    this.socket.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data) as { type: keyof ServerEventMap; payload: unknown };
        this.dispatch(parsed.type, parsed.payload as ServerEventMap[keyof ServerEventMap]);
      } catch {
        /* ignore */
      }
    };
    this.socket.onclose = () => {
      this.socket = null;
      if (!this.intentionalClose) this.scheduleReconnect();
    };
    this.socket.onerror = () => {
      this.socket?.close();
    };
  }

  private scheduleReconnect(): void {
    const delay = Math.min(30_000, 500 * 2 ** this.reconnectAttempts);
    this.reconnectAttempts++;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => this.connect(), delay);
  }

  send<K extends keyof ClientCommandMap>(type: K, payload: ClientCommandMap[K]): void {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify({ type, payload }));
    }
  }

  on<K extends keyof ServerEventMap>(type: K, listener: Listener<K>): () => void {
    let set = this.listeners.get(type);
    if (!set) {
      set = new Set();
      this.listeners.set(type, set);
    }
    set.add(listener as Listener<keyof ServerEventMap>);
    return () => set?.delete(listener as Listener<keyof ServerEventMap>);
  }

  private dispatch<K extends keyof ServerEventMap>(type: K, payload: ServerEventMap[K]): void {
    const set = this.listeners.get(type);
    if (!set) return;
    for (const listener of set) {
      (listener as Listener<K>)(payload);
    }
  }

  close(): void {
    this.intentionalClose = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.socket?.close();
  }
}
