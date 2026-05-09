import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import type { DisplayMode, EventDto } from '@photolive/shared';
import { eq, sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db } from '../db/index.js';
import { events } from '../db/schema.js';
import { logger } from '../logger.js';
import { auditService } from './auditService.js';

function rowToDto(row: typeof events.$inferSelect): EventDto {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    photosDir: row.photosDir,
    isActive: row.isActive,
    displayMode: row.displayMode as DisplayMode,
    brandingIntroImageId: row.brandingIntroImageId,
    brandingOutroImageId: row.brandingOutroImageId,
    createdAt: row.createdAt,
    archivedAt: row.archivedAt,
  };
}

export class EventService {
  list(): EventDto[] {
    return db.select().from(events).all().map(rowToDto);
  }

  get(id: string): EventDto | null {
    const row = db.select().from(events).where(eq(events.id, id)).get();
    return row ? rowToDto(row) : null;
  }

  getActive(): EventDto | null {
    const row = db.select().from(events).where(eq(events.isActive, true)).get();
    return row ? rowToDto(row) : null;
  }

  create(input: {
    name: string;
    slug: string;
    photosDir: string;
    displayMode?: DisplayMode;
  }): EventDto {
    const id = nanoid();
    const photosDir = resolve(input.photosDir);
    mkdirSync(photosDir, { recursive: true });

    db.insert(events)
      .values({
        id,
        name: input.name,
        slug: input.slug,
        photosDir,
        isActive: false,
        displayMode: input.displayMode ?? 'auto',
        createdAt: new Date().toISOString(),
      })
      .run();

    auditService.log({
      eventId: id,
      actor: 'system',
      action: 'event.created',
      payload: { name: input.name },
    });
    const row = db.select().from(events).where(eq(events.id, id)).get();
    if (!row) throw new Error('event vanished after insert');
    logger.info({ eventId: id, name: input.name }, 'event created');
    return rowToDto(row);
  }

  update(
    id: string,
    patch: Partial<{
      name: string;
      photosDir: string;
      displayMode: DisplayMode;
      brandingIntroImageId: string | null;
      brandingOutroImageId: string | null;
    }>,
  ): EventDto | null {
    const existing = db.select().from(events).where(eq(events.id, id)).get();
    if (!existing) return null;
    const update: Partial<typeof events.$inferInsert> = {};
    if (patch.name !== undefined) update.name = patch.name;
    if (patch.photosDir !== undefined) {
      const dir = resolve(patch.photosDir);
      mkdirSync(dir, { recursive: true });
      update.photosDir = dir;
    }
    if (patch.displayMode !== undefined) update.displayMode = patch.displayMode;
    if (patch.brandingIntroImageId !== undefined)
      update.brandingIntroImageId = patch.brandingIntroImageId;
    if (patch.brandingOutroImageId !== undefined)
      update.brandingOutroImageId = patch.brandingOutroImageId;

    db.update(events).set(update).where(eq(events.id, id)).run();
    auditService.log({ eventId: id, actor: 'operator', action: 'event.updated', payload: patch });
    return this.get(id);
  }

  setActive(id: string): EventDto | null {
    const existing = db.select().from(events).where(eq(events.id, id)).get();
    if (!existing) return null;
    // Atomic swap: deactivate all, activate one.
    db.transaction((tx) => {
      tx.update(events).set({ isActive: false }).where(sql`1=1`).run();
      tx.update(events).set({ isActive: true }).where(eq(events.id, id)).run();
    });
    auditService.log({ eventId: id, actor: 'operator', action: 'event.activated' });
    logger.info({ eventId: id }, 'event activated');
    return this.get(id);
  }

  archive(id: string): EventDto | null {
    db.update(events)
      .set({ archivedAt: new Date().toISOString(), isActive: false })
      .where(eq(events.id, id))
      .run();
    auditService.log({ eventId: id, actor: 'operator', action: 'event.archived' });
    return this.get(id);
  }
}

export const eventService = new EventService();
