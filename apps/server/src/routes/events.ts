import { eventCreateSchema, eventUpdateSchema } from '@photolive/shared';
import type { FastifyInstance } from 'fastify';
import { auditService } from '../services/auditService.js';
import { eventService } from '../services/eventService.js';
import { fileWatcherService } from '../services/fileWatcherService.js';
import { slideshowService } from '../services/slideshowService.js';
import { wsService } from '../services/wsService.js';

export async function eventRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/events', async () => ({ events: eventService.list() }));

  app.get('/api/events/active', async () => ({ event: eventService.getActive() }));

  app.get<{ Params: { id: string } }>('/api/events/:id', async (req, reply) => {
    const event = eventService.get(req.params.id);
    if (!event) return reply.code(404).send({ error: 'not found' });
    return { event };
  });

  app.get<{ Params: { id: string }; Querystring: { limit?: number } }>(
    '/api/events/:id/audit',
    async (req) => ({ entries: auditService.list(req.params.id, req.query.limit) }),
  );

  app.post('/api/events', async (req, reply) => {
    const parsed = eventCreateSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const event = eventService.create(parsed.data);
    return reply.code(201).send({ event });
  });

  app.patch<{ Params: { id: string } }>('/api/events/:id', async (req, reply) => {
    const parsed = eventUpdateSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const event = eventService.update(req.params.id, parsed.data);
    if (!event) return reply.code(404).send({ error: 'not found' });
    wsService.broadcast('event.updated', { event });
    return { event };
  });

  app.post<{ Params: { id: string } }>('/api/events/:id/activate', async (req, reply) => {
    const event = eventService.setActive(req.params.id);
    if (!event) return reply.code(404).send({ error: 'not found' });
    await fileWatcherService.watchActiveEvent();
    slideshowService.reload();
    wsService.broadcast('event.activated', { event });
    return { event };
  });

  app.post<{ Params: { id: string } }>('/api/events/:id/archive', async (req, reply) => {
    const event = eventService.archive(req.params.id);
    if (!event) return reply.code(404).send({ error: 'not found' });
    return { event };
  });

  app.post<{ Params: { id: string } }>('/api/events/:id/unarchive', async (req, reply) => {
    const event = eventService.unarchive(req.params.id);
    if (!event) return reply.code(404).send({ error: 'not found' });
    return { event };
  });

  app.delete<{ Params: { id: string } }>('/api/events/:id', async (req, reply) => {
    const wasActive = eventService.get(req.params.id)?.isActive ?? false;
    const ok = eventService.delete(req.params.id);
    if (!ok) return reply.code(404).send({ error: 'not found' });
    // If we just deleted the active event, the watcher and slideshow need to drop their state.
    if (wasActive) {
      await fileWatcherService.watchActiveEvent();
      slideshowService.reload();
    }
    wsService.broadcast('event.deleted', { eventId: req.params.id });
    return { ok: true };
  });
}
