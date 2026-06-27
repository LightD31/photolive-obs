import { eventCreateSchema, eventUpdateSchema } from '@photolive/shared';
import type { FastifyInstance, FastifyReply } from 'fastify';
import { logger } from '../logger.js';
import { auditService } from '../services/auditService.js';
import { eventService } from '../services/eventService.js';
import { fileWatcherService } from '../services/fileWatcherService.js';
import { slideshowService } from '../services/slideshowService.js';
import { wsService } from '../services/wsService.js';

/**
 * Map the foreseeable failures of event create/update — a duplicate slug or an
 * unwritable photos directory — to actionable client errors. Without this the
 * thrown exception falls through to Fastify's default handler and the operator
 * just sees an opaque 500.
 */
function replyEventWriteError(reply: FastifyReply, err: unknown): FastifyReply {
  const msg = err instanceof Error ? err.message : String(err);
  if (/UNIQUE constraint failed: events\.slug/i.test(msg)) {
    return reply.code(409).send({ error: 'an event with this slug already exists' });
  }
  const code = (err as NodeJS.ErrnoException)?.code;
  if (code && ['EACCES', 'EPERM', 'EROFS', 'ENOENT', 'ENOTDIR'].includes(code)) {
    return reply.code(400).send({ error: `cannot create photos directory (${code}): ${msg}` });
  }
  logger.error({ err }, 'event write failed');
  return reply.code(500).send({ error: 'failed to save event' });
}

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
    try {
      const event = eventService.create(parsed.data);
      return reply.code(201).send({ event });
    } catch (err) {
      return replyEventWriteError(reply, err);
    }
  });

  app.patch<{ Params: { id: string } }>('/api/events/:id', async (req, reply) => {
    const parsed = eventUpdateSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    let event: Awaited<ReturnType<typeof eventService.update>>;
    try {
      event = eventService.update(req.params.id, parsed.data);
    } catch (err) {
      return replyEventWriteError(reply, err);
    }
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
