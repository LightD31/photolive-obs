import type { ImageStatus } from '@photolive/shared';
import { captionSchema } from '@photolive/shared';
import type { FastifyInstance } from 'fastify';
import { eventService } from '../services/eventService.js';
import { imageService } from '../services/imageService.js';
import { ingestService } from '../services/ingestService.js';
import { wsService } from '../services/wsService.js';

export async function imageRoutes(app: FastifyInstance): Promise<void> {
  app.get<{
    Params: { eventId: string };
    Querystring: { status?: string; limit?: number };
  }>('/api/events/:eventId/images', async (req, reply) => {
    const event = eventService.get(req.params.eventId);
    if (!event) return reply.code(404).send({ error: 'event not found' });
    const status = req.query.status
      ? (req.query.status.split(',').filter(Boolean) as ImageStatus[])
      : undefined;
    return {
      images: imageService.listForEvent(req.params.eventId, {
        status,
        limit: req.query.limit ? Number(req.query.limit) : undefined,
      }),
      counts: imageService.countByStatus(req.params.eventId),
    };
  });

  app.get<{ Params: { eventId: string } }>(
    '/api/events/:eventId/images/pending',
    async (req, reply) => {
      const event = eventService.get(req.params.eventId);
      if (!event) return reply.code(404).send({ error: 'event not found' });
      return { images: imageService.pendingTray(req.params.eventId) };
    },
  );

  app.get<{ Params: { eventId: string } }>(
    '/api/events/:eventId/images/queue',
    async (req, reply) => {
      const event = eventService.get(req.params.eventId);
      if (!event) return reply.code(404).send({ error: 'event not found' });
      return { images: imageService.approvedQueue(req.params.eventId) };
    },
  );

  app.get<{ Params: { eventId: string } }>('/api/events/:eventId/latency', async (req, reply) => {
    const event = eventService.get(req.params.eventId);
    if (!event) return reply.code(404).send({ error: 'event not found' });
    return { averageMs: imageService.averageIngestLatencyMs(req.params.eventId) };
  });

  app.get<{ Params: { id: string } }>('/api/images/:id', async (req, reply) => {
    const image = imageService.get(req.params.id);
    if (!image) return reply.code(404).send({ error: 'not found' });
    return { image };
  });

  app.post<{ Params: { id: string } }>('/api/images/:id/approve', async (req, reply) => {
    const image = ingestService.approve(req.params.id);
    if (!image) return reply.code(404).send({ error: 'not found' });
    return { image };
  });

  app.post<{ Params: { id: string }; Body: { reason?: string } }>(
    '/api/images/:id/reject',
    async (req, reply) => {
      const image = ingestService.reject(req.params.id, req.body?.reason);
      if (!image) return reply.code(404).send({ error: 'not found' });
      return { image };
    },
  );

  app.post<{ Params: { id: string }; Body: { reason?: string } }>(
    '/api/images/:id/exclude',
    async (req, reply) => {
      const image = ingestService.exclude(req.params.id, req.body?.reason);
      if (!image) return reply.code(404).send({ error: 'not found' });
      return { image };
    },
  );

  app.post<{ Params: { id: string } }>('/api/images/:id/include', async (req, reply) => {
    const image = ingestService.include(req.params.id);
    if (!image) return reply.code(404).send({ error: 'not found' });
    return { image };
  });

  app.put<{ Params: { id: string } }>('/api/images/:id/caption', async (req, reply) => {
    const parsed = captionSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const image = imageService.setCaption(req.params.id, parsed.data.text);
    if (!image) return reply.code(404).send({ error: 'not found' });
    wsService.broadcast('image.updated', { image });
    return { image };
  });

  app.put<{ Params: { eventId: string }; Body: { imageIds: string[] } }>(
    '/api/events/:eventId/queue',
    async (req, reply) => {
      const event = eventService.get(req.params.eventId);
      if (!event) return reply.code(404).send({ error: 'event not found' });
      if (!Array.isArray(req.body?.imageIds)) {
        return reply.code(400).send({ error: 'imageIds must be an array' });
      }
      imageService.reorderQueue(req.params.eventId, req.body.imageIds);
      return { ok: true };
    },
  );
}
