import type { FastifyInstance } from 'fastify';
import { eventService } from '../services/eventService.js';
import { ftpService } from '../services/ftpService.js';
import { obsService } from '../services/obsService.js';
import { wsService } from '../services/wsService.js';

export async function healthRoutes(app: FastifyInstance): Promise<void> {
  app.get('/health', async () => ({
    ok: true,
    uptimeSec: Math.floor(process.uptime()),
    activeEvent: eventService.getActive()?.slug ?? null,
    ftp: ftpService.isRunning(),
    obs: obsService.isConnected(),
    wsClients: wsService.count(),
  }));
}
