import { unlink } from 'node:fs/promises';
import { cpus } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ImageDto, ImageStatus } from '@photolive/shared';
import { and, eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
// piscina ships CJS `export = Piscina`. See ftpService.ts for the same
// dance — default + .default fallback, cast through `any`.
import PiscinaImport from 'piscina';
// biome-ignore lint/suspicious/noExplicitAny: see ftpService.ts.
const Piscina: any = (PiscinaImport as any).default ?? PiscinaImport;
import { bus } from '../bus.js';
import { db } from '../db/index.js';
import { images, photographers as photographersTbl } from '../db/schema.js';
import { logger } from '../logger.js';
import { renditionPaths } from '../utils/paths.js';
import type { IngestError, IngestInput, IngestOutput } from '../workers/ingest.worker.js';
import { auditService } from './auditService.js';
import { eventService } from './eventService.js';
import { imageService } from './imageService.js';
import { settingsService } from './settingsService.js';
import { slideshowService } from './slideshowService.js';
import { wsService } from './wsService.js';

type PiscinaPool = {
  run(input: unknown): Promise<unknown>;
  destroy(): Promise<void>;
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function isError(x: IngestOutput | IngestError): x is IngestError {
  return (x as IngestError).error !== undefined;
}

export class IngestService {
  private pool: PiscinaPool;

  constructor() {
    // Sibling layout: services/<self> and workers/<worker> live alongside under
    // src/ (dev) or dist/ (tsc prod). In Electron builds the dir is unpacked
    // outside app.asar so Worker can fs.read the .js file.
    const workerExt = __filename.endsWith('.ts') ? '.ts' : '.js';
    const workerPath = join(__dirname, '..', 'workers', `ingest.worker${workerExt}`);
    const cpuCount = cpus().length;
    this.pool = new Piscina({
      filename: workerPath,
      maxThreads: Math.max(1, Math.min(4, Math.floor(cpuCount / 2))),
    });
  }

  /** Called when a file lands (from FTP or file watcher). */
  async handle(args: {
    path: string;
    eventId: string;
    photographerId: string | null;
    uploadedAt: string;
  }): Promise<ImageDto | null> {
    const { path, eventId, photographerId, uploadedAt } = args;
    const event = eventService.get(eventId);
    if (!event) {
      logger.warn({ path, eventId }, 'ingest: event not found');
      return null;
    }

    const imageId = nanoid();
    const renditions = renditionPaths(eventId, imageId);
    const input: IngestInput = {
      path,
      imageId,
      displayPath: renditions.display,
      thumbnailPath: renditions.thumbnail,
    };
    const result = (await this.pool.run(input)) as IngestOutput | IngestError;

    if (isError(result)) {
      logger.error({ path, error: result.error }, 'ingest worker failed');
      bus.emit('image.failed', { path, error: result.error });
      return null;
    }

    // Dedup by (eventId, hash). If a duplicate, drop renditions and skip.
    if (imageService.hasHash(eventId, result.hash)) {
      logger.info({ path, hash: result.hash }, 'duplicate image, skipping');
      await Promise.all([
        unlink(result.displayPath).catch(() => {}),
        unlink(result.thumbnailPath).catch(() => {}),
      ]);
      bus.emit('image.duplicate', { hash: result.hash, path });
      return null;
    }

    const settings = settingsService.getForEvent(eventId);
    let status: ImageStatus = 'approved';
    let exclusionReason: string | null = null;
    if (event.displayMode === 'approval') {
      status = 'pending';
    } else if (
      event.displayMode === 'auto-skip-blurry' &&
      result.sharpnessScore < settings.blurThreshold
    ) {
      status = 'auto-skipped';
      exclusionReason = `sharpness ${result.sharpnessScore.toFixed(1)} < ${settings.blurThreshold}`;
    }

    const ingestedAt = new Date().toISOString();
    db.insert(images)
      .values({
        id: imageId,
        eventId,
        photographerId,
        path,
        hash: result.hash,
        width: result.width,
        height: result.height,
        orientation: result.orientation,
        exif: result.exif ? JSON.stringify(result.exif) : null,
        takenAt: result.takenAt,
        uploadedAt,
        ingestedAt,
        displayPath: result.displayPath,
        thumbnailPath: result.thumbnailPath,
        sharpnessScore: result.sharpnessScore,
        status,
        exclusionReason,
      })
      .run();

    auditService.log({
      eventId,
      actor: 'system',
      action: 'image.ingested',
      payload: {
        imageId,
        path,
        photographerId,
        status,
        sharpness: result.sharpnessScore,
      },
    });

    const dto = imageService.get(imageId);
    if (!dto) return null;

    const latencyMs = Date.parse(ingestedAt) - Date.parse(uploadedAt);
    bus.emit('image.ingested', { image: dto });
    wsService.broadcast('image.added', { image: dto, queuePosition: 0 });
    if (Number.isFinite(latencyMs)) {
      wsService.broadcast('ingest.latency', { imageId, latencyMs });
    }

    if (status === 'approved') {
      slideshowService.notifyApproved(imageId);
    }

    return dto;
  }

  /** Approve a pending image. Used by operator UI. */
  approve(imageId: string): ImageDto | null {
    const dto = imageService.setStatus(imageId, 'approved', { actor: 'operator' });
    if (!dto) return null;
    wsService.broadcast('image.approved', { imageId });
    wsService.broadcast('image.updated', { image: dto });
    slideshowService.notifyApproved(imageId);
    return dto;
  }

  reject(imageId: string, reason?: string): ImageDto | null {
    const dto = imageService.setStatus(imageId, 'excluded', { actor: 'operator', reason });
    if (!dto) return null;
    wsService.broadcast('image.rejected', { imageId });
    wsService.broadcast('image.updated', { image: dto });
    return dto;
  }

  exclude(imageId: string, reason?: string): ImageDto | null {
    const dto = imageService.setStatus(imageId, 'excluded', { actor: 'operator', reason });
    if (!dto) return null;
    wsService.broadcast('image.updated', { image: dto });
    return dto;
  }

  include(imageId: string): ImageDto | null {
    const dto = imageService.setStatus(imageId, 'approved', { actor: 'operator' });
    if (!dto) return null;
    wsService.broadcast('image.updated', { image: dto });
    slideshowService.notifyApproved(imageId);
    return dto;
  }

  async shutdown(): Promise<void> {
    await this.pool.destroy();
    logger.info('ingest pool destroyed');
  }
}

export const ingestService = new IngestService();

// Wire ingest into bus so file watcher / FTP can just emit and forget.
bus.on('image.received', async (payload) => {
  try {
    await ingestService.handle(payload);
  } catch (err) {
    logger.error({ err, path: payload.path }, 'ingest handler error');
  }
});

// Re-fetch slideshow state when an event becomes active.
bus.on('event.activated', () => {
  slideshowService.reload();
});

// Helper for use elsewhere: photographerId from FTP username
export function photographerIdByFtpUsername(username: string): string | null {
  const row = db
    .select({ id: photographersTbl.id })
    .from(photographersTbl)
    .where(and(eq(photographersTbl.ftpUsername, username), eq(photographersTbl.isActive, true)))
    .get();
  return row?.id ?? null;
}
