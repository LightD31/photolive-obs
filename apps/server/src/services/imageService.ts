import type { ImageDto, ImageStatus } from '@photolive/shared';
import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { images, photographers } from '../db/schema.js';
import { renditionUrlFromPath } from '../utils/paths.js';
import { auditService } from './auditService.js';

type ImageJoin = {
  image: typeof images.$inferSelect;
  photographer: typeof photographers.$inferSelect | null;
};

function rowToDto(row: ImageJoin): ImageDto {
  const img = row.image;
  return {
    id: img.id,
    eventId: img.eventId,
    photographerId: img.photographerId,
    photographerName: row.photographer?.displayName ?? null,
    photographerColor: row.photographer?.color ?? null,
    hash: img.hash,
    width: img.width,
    height: img.height,
    orientation: img.orientation,
    takenAt: img.takenAt,
    uploadedAt: img.uploadedAt,
    ingestedAt: img.ingestedAt,
    displayUrl: renditionUrlFromPath(img.displayPath),
    thumbnailUrl: renditionUrlFromPath(img.thumbnailPath),
    sharpnessScore: img.sharpnessScore,
    status: img.status,
    exclusionReason: img.exclusionReason,
    caption: img.caption,
    seenCount: img.seenCount,
  };
}

export class ImageService {
  get(id: string): ImageDto | null {
    const row = db
      .select({ image: images, photographer: photographers })
      .from(images)
      .leftJoin(photographers, eq(images.photographerId, photographers.id))
      .where(eq(images.id, id))
      .get();
    return row ? rowToDto(row) : null;
  }

  /** All images for an event, newest first, optionally filtered by status. */
  listForEvent(eventId: string, opts?: { status?: ImageStatus[]; limit?: number }): ImageDto[] {
    const filters = [eq(images.eventId, eventId)];
    if (opts?.status && opts.status.length > 0) {
      filters.push(inArray(images.status, opts.status));
    }
    let q = db
      .select({ image: images, photographer: photographers })
      .from(images)
      .leftJoin(photographers, eq(images.photographerId, photographers.id))
      .where(and(...filters))
      .orderBy(desc(images.uploadedAt))
      .$dynamic();
    if (opts?.limit) q = q.limit(opts.limit);
    return q.all().map(rowToDto);
  }

  /** Approved images in their queue order (oldest position first → next up). */
  approvedQueue(eventId: string): ImageDto[] {
    return db
      .select({ image: images, photographer: photographers })
      .from(images)
      .leftJoin(photographers, eq(images.photographerId, photographers.id))
      .where(and(eq(images.eventId, eventId), eq(images.status, 'approved')))
      .orderBy(
        sql`CASE WHEN ${images.queuePosition} IS NULL THEN 1 ELSE 0 END`,
        asc(images.queuePosition),
        asc(images.uploadedAt),
      )
      .all()
      .map(rowToDto);
  }

  pendingTray(eventId: string): ImageDto[] {
    return db
      .select({ image: images, photographer: photographers })
      .from(images)
      .leftJoin(photographers, eq(images.photographerId, photographers.id))
      .where(and(eq(images.eventId, eventId), eq(images.status, 'pending')))
      .orderBy(asc(images.uploadedAt))
      .all()
      .map(rowToDto);
  }

  countByStatus(eventId: string): Record<ImageStatus, number> {
    const rows = db
      .select({ status: images.status, count: sql<number>`count(*)` })
      .from(images)
      .where(eq(images.eventId, eventId))
      .groupBy(images.status)
      .all();
    const out: Record<ImageStatus, number> = {
      pending: 0,
      approved: 0,
      excluded: 0,
      'auto-skipped': 0,
    };
    for (const row of rows) out[row.status] = row.count;
    return out;
  }

  hasHash(eventId: string, hash: string): boolean {
    const row = db
      .select({ id: images.id })
      .from(images)
      .where(and(eq(images.eventId, eventId), eq(images.hash, hash)))
      .get();
    return Boolean(row);
  }

  setStatus(
    id: string,
    status: ImageStatus,
    opts?: { reason?: string; actor?: string },
  ): ImageDto | null {
    const existing = db.select().from(images).where(eq(images.id, id)).get();
    if (!existing) return null;
    db.update(images)
      .set({ status, exclusionReason: opts?.reason ?? null })
      .where(eq(images.id, id))
      .run();
    auditService.log({
      eventId: existing.eventId,
      actor: opts?.actor ?? 'operator',
      action: `image.status.${status}`,
      payload: { id, reason: opts?.reason },
    });
    return this.get(id);
  }

  setCaption(id: string, text: string): ImageDto | null {
    const existing = db.select().from(images).where(eq(images.id, id)).get();
    if (!existing) return null;
    db.update(images)
      .set({ caption: text || null })
      .where(eq(images.id, id))
      .run();
    auditService.log({
      eventId: existing.eventId,
      actor: 'operator',
      action: 'image.caption.set',
      payload: { id, text },
    });
    return this.get(id);
  }

  incrementSeen(id: string): void {
    db.update(images)
      .set({ seenCount: sql`${images.seenCount} + 1` })
      .where(eq(images.id, id))
      .run();
  }

  reorderQueue(eventId: string, imageIds: string[]): void {
    db.transaction((tx) => {
      // Reset all positions for this event's approved images
      tx.update(images)
        .set({ queuePosition: null })
        .where(and(eq(images.eventId, eventId), eq(images.status, 'approved')))
        .run();
      imageIds.forEach((id, index) => {
        tx.update(images)
          .set({ queuePosition: index })
          .where(and(eq(images.id, id), eq(images.eventId, eventId)))
          .run();
      });
    });
    auditService.log({
      eventId,
      actor: 'operator',
      action: 'queue.reordered',
      payload: { count: imageIds.length },
    });
  }

  averageIngestLatencyMs(eventId: string, lastN = 10): number | null {
    const rows = db
      .select({ uploaded: images.uploadedAt, ingested: images.ingestedAt })
      .from(images)
      .where(eq(images.eventId, eventId))
      .orderBy(desc(images.ingestedAt))
      .limit(lastN)
      .all();
    if (rows.length === 0) return null;
    let total = 0;
    for (const r of rows) {
      const u = Date.parse(r.uploaded);
      const i = Date.parse(r.ingested);
      if (!Number.isFinite(u) || !Number.isFinite(i)) continue;
      total += i - u;
    }
    return total / rows.length;
  }
}

export const imageService = new ImageService();
