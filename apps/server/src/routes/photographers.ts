import { photographerCreateSchema, photographerUpdateSchema } from '@photolive/shared';
import type { FastifyInstance } from 'fastify';
import { eventService } from '../services/eventService.js';
import { photographerService } from '../services/photographerService.js';
import { wsService } from '../services/wsService.js';

export async function photographerRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Params: { eventId: string } }>(
    '/api/events/:eventId/photographers',
    async (req, reply) => {
      const event = eventService.get(req.params.eventId);
      if (!event) return reply.code(404).send({ error: 'event not found' });
      return { photographers: photographerService.listForEvent(req.params.eventId) };
    },
  );

  app.post<{ Params: { eventId: string } }>(
    '/api/events/:eventId/photographers',
    async (req, reply) => {
      const event = eventService.get(req.params.eventId);
      if (!event) return reply.code(404).send({ error: 'event not found' });
      const parsed = photographerCreateSchema.safeParse(req.body);
      if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
      const created = photographerService.create({
        eventId: event.id,
        eventSlug: event.slug,
        displayName: parsed.data.displayName,
        color: parsed.data.color,
      });
      const { ftpPassword, ...publicDto } = created;
      wsService.broadcast('photographer.added', { photographer: publicDto });
      // Plaintext password is only ever returned right here.
      return reply.code(201).send({ photographer: created });
    },
  );

  app.patch<{ Params: { id: string } }>('/api/photographers/:id', async (req, reply) => {
    const parsed = photographerUpdateSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const updated = photographerService.update(req.params.id, parsed.data);
    if (!updated) return reply.code(404).send({ error: 'not found' });
    wsService.broadcast('photographer.updated', { photographer: updated });
    return { photographer: updated };
  });

  app.post<{ Params: { id: string } }>(
    '/api/photographers/:id/rotate-password',
    async (req, reply) => {
      const result = photographerService.rotatePassword(req.params.id);
      if (!result) return reply.code(404).send({ error: 'not found' });
      return { photographer: result };
    },
  );

  app.delete<{ Params: { id: string } }>('/api/photographers/:id', async (req, reply) => {
    const ok = photographerService.delete(req.params.id);
    if (!ok) return reply.code(404).send({ error: 'not found' });
    wsService.broadcast('photographer.removed', { photographerId: req.params.id });
    return { ok: true };
  });
}
