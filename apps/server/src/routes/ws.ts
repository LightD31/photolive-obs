import { wsCommandSchema } from '@photolive/shared';
import type { FastifyInstance } from 'fastify';
import { nanoid } from 'nanoid';
import { config } from '../config.js';
import { logger } from '../logger.js';
import { eventService } from '../services/eventService.js';
import { imageService } from '../services/imageService.js';
import { ingestService } from '../services/ingestService.js';
import { settingsService } from '../services/settingsService.js';
import { slideshowService } from '../services/slideshowService.js';
import { wsService } from '../services/wsService.js';

/**
 * WebSocket route at /ws.
 *
 * Auth: bearer token via `?token=` query string (custom WS headers can't be sent
 * by browsers/Chromecast). Role determined by `?role=control|slideshow`.
 *
 * Server → client messages: { type: <ServerEvent>, payload: ... }
 * Client → server commands: validated by wsCommandSchema.
 */
export async function wsRoutes(app: FastifyInstance): Promise<void> {
  app.get('/ws', { websocket: true }, (socket, request) => {
    const url = new URL(request.url, `http://${request.headers.host ?? 'localhost'}`);
    const token = url.searchParams.get('token');
    if (token !== config.authToken) {
      socket.close(1008, 'unauthorized');
      return;
    }
    const role = url.searchParams.get('role') === 'slideshow' ? 'slideshow' : 'control';
    const id = nanoid();
    wsService.add({ id, socket, role });

    // Send initial state on connect.
    const sendInitial = () => {
      const active = eventService.getActive();
      socket.send(
        JSON.stringify({
          type: 'slideshow.state',
          payload: slideshowService.state(),
        }),
      );
      if (active) {
        socket.send(
          JSON.stringify({
            type: 'settings.updated',
            payload: { settings: settingsService.getForEvent(active.id) },
          }),
        );
      }
    };
    sendInitial();

    socket.on('message', (raw) => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw.toString('utf8'));
      } catch {
        return;
      }
      const cmd = wsCommandSchema.safeParse(parsed);
      if (!cmd.success) {
        logger.debug({ err: cmd.error.flatten(), parsed }, 'invalid ws command');
        return;
      }
      handleCommand(cmd.data);
    });

    socket.on('close', () => wsService.remove(id));
    socket.on('error', (err) => {
      logger.debug({ err, clientId: id }, 'ws error');
      wsService.remove(id);
    });
  });
}

function handleCommand(cmd: ReturnType<typeof wsCommandSchema.parse>): void {
  switch (cmd.type) {
    case 'slideshow.next':
      slideshowService.next();
      break;
    case 'slideshow.prev':
      slideshowService.prev();
      break;
    case 'slideshow.pause':
      slideshowService.pause();
      break;
    case 'slideshow.resume':
      slideshowService.resume();
      break;
    case 'slideshow.jumpTo':
      slideshowService.jumpTo(cmd.payload.imageId);
      break;
    case 'image.exclude':
      ingestService.exclude(cmd.payload.imageId, cmd.payload.reason);
      break;
    case 'image.include':
      ingestService.include(cmd.payload.imageId);
      break;
    case 'image.approve':
      ingestService.approve(cmd.payload.imageId);
      break;
    case 'image.reject':
      ingestService.reject(cmd.payload.imageId, cmd.payload.reason);
      break;
    case 'image.caption': {
      const img = imageService.setCaption(cmd.payload.imageId, cmd.payload.text);
      if (img) wsService.broadcast('image.updated', { image: img });
      break;
    }
    case 'queue.reorder': {
      const active = eventService.getActive();
      if (active) imageService.reorderQueue(active.id, cmd.payload.imageIds);
      break;
    }
  }
}
