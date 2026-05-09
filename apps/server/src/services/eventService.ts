import { mkdirSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { DisplayMode, EventDto } from '@photolive/shared';
import { and, eq, ne, sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { config } from '../config.js';
import { db } from '../db/index.js';
import { events, auditLog, images, photographers, settings } from '../db/schema.js';
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

  unarchive(id: string): EventDto | null {
    const existing = db.select().from(events).where(eq(events.id, id)).get();
    if (!existing) return null;
    db.update(events).set({ archivedAt: null }).where(eq(events.id, id)).run();
    auditService.log({ eventId: id, actor: 'operator', action: 'event.unarchived' });
    return this.get(id);
  }

  delete(id: string): boolean {
    const existing = db.select().from(events).where(eq(events.id, id)).get();
    if (!existing) return false;

    // Audit BEFORE the cascade so the entry survives one transaction beat — but
    // we'll wipe its audit_log rows in the same tx, so log to stderr instead.
    logger.info(
      { eventId: id, name: existing.name, photosDir: existing.photosDir },
      'event hard-deleted',
    );

    db.transaction((tx) => {
      tx.delete(images).where(eq(images.eventId, id)).run();
      tx.delete(photographers).where(eq(photographers.eventId, id)).run();
      tx.delete(settings).where(eq(settings.eventId, id)).run();
      tx.delete(auditLog).where(eq(auditLog.eventId, id)).run();
      tx.delete(events).where(eq(events.id, id)).run();
    });

    // Filesystem cleanup. We only remove photosDir if no surviving event still
    // references it (operators sometimes share a single drop folder across events).
    const stillUsed = db
      .select({ id: events.id })
      .from(events)
      .where(and(eq(events.photosDir, existing.photosDir), ne(events.id, id)))
      .get();
    if (!stillUsed) {
      try {
        rmSync(existing.photosDir, { recursive: true, force: true });
      } catch (err) {
        logger.warn({ err, dir: existing.photosDir }, 'failed to remove photos dir');
      }
    }
    try {
      rmSync(join(config.renditionsRoot, id), { recursive: true, force: true });
    } catch (err) {
      logger.warn({ err, eventId: id }, 'failed to remove renditions dir');
    }

    return true;
  }
}

export const eventService = new EventService();
