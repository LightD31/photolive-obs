import type { ServerEventMap } from '@photolive/shared';
import type { WebSocket } from 'ws';
import { logger } from '../logger.js';

interface Client {
  socket: WebSocket;
  role: 'control' | 'slideshow';
  id: string;
}

export class WsService {
  private clients = new Map<string, Client>();

  add(client: Client): void {
    this.clients.set(client.id, client);
    logger.debug(
      { clientId: client.id, role: client.role, total: this.clients.size },
      'ws client connected',
    );
  }

  remove(id: string): void {
    this.clients.delete(id);
    logger.debug({ clientId: id, total: this.clients.size }, 'ws client disconnected');
  }

  broadcast<K extends keyof ServerEventMap>(type: K, payload: ServerEventMap[K]): void {
    const message = JSON.stringify({ type, payload });
    for (const client of this.clients.values()) {
      if (client.socket.readyState === client.socket.OPEN) {
        client.socket.send(message);
      }
    }
  }

  sendTo<K extends keyof ServerEventMap>(
    clientId: string,
    type: K,
    payload: ServerEventMap[K],
  ): void {
    const client = this.clients.get(clientId);
    if (!client) return;
    if (client.socket.readyState === client.socket.OPEN) {
      client.socket.send(JSON.stringify({ type, payload }));
    }
  }

  count(): number {
    return this.clients.size;
  }

  countByRole(role: Client['role']): number {
    let n = 0;
    for (const c of this.clients.values()) if (c.role === role) n++;
    return n;
  }
}

export const wsService = new WsService();
