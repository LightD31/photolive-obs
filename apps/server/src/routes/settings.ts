import { settingsUpdateSchema } from '@photolive/shared';
import type { FastifyInstance } from 'fastify';
import { eventService } from '../services/eventService.js';
import { settingsService } from '../services/settingsService.js';
import { wsService } from '../services/wsService.js';

export async function settingsRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Params: { eventId: string } }>('/api/events/:eventId/settings', async (req, reply) => {
    const event = eventService.get(req.params.eventId);
    if (!event) return reply.code(404).send({ error: 'the server could not find the event' });
    return { settings: settingsService.getForEvent(req.params.eventId) };
  });

  app.put<{ Params: { eventId: string } }>('/api/events/:eventId/settings', async (req, reply) => {
    const event = eventService.get(req.params.eventId);
    if (!event) return reply.code(404).send({ error: 'the server could not find the event' });
    const parsed = settingsUpdateSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const next = settingsService.updateForEvent(req.params.eventId, parsed.data);
    wsService.broadcast('settings.updated', { settings: next });
    return { settings: next };
  });
}
