import type { SlideshowState } from '@photolive/shared';
import { logger } from '../logger.js';
import { eventService } from './eventService.js';
import { imageService } from './imageService.js';
import { settingsService } from './settingsService.js';
import { wsService } from './wsService.js';

/**
 * Slideshow service. One-event-active-at-a-time state machine.
 *
 * - Holds the current/next image in memory; the persistent queue is in the DB.
 * - On image.ingested (auto / auto-skip-blurry modes), the new image is prioritised
 *   to be the next one shown.
 * - In approval mode, ingest writes pending rows but doesn't touch the queue;
 *   only operator approval moves an image into the queue.
 */
export class SlideshowService {
  private isPlaying = true;
  private currentImageId: string | null = null;
  private nextImageId: string | null = null;
  private rotationTimer: NodeJS.Timeout | null = null;
  private prioritizedQueue: string[] = []; // newly approved images jump to the front

  reload(): void {
    const active = eventService.getActive();
    if (!active) {
      this.currentImageId = null;
      this.nextImageId = null;
      this.broadcastState();
      return;
    }
    const queue = imageService.approvedQueue(active.id);
    this.currentImageId = queue[0]?.id ?? null;
    this.nextImageId = queue[1]?.id ?? null;
    this.scheduleNextRotation();
    this.broadcastState();
    this.broadcastAdvanced();
  }

  state(): SlideshowState {
    const active = eventService.getActive();
    const counts = active
      ? imageService.countByStatus(active.id)
      : { approved: 0, pending: 0, excluded: 0, 'auto-skipped': 0 };
    return {
      isPlaying: this.isPlaying,
      currentImageId: this.currentImageId,
      nextImageId: this.nextImageId,
      queueLength: counts.approved,
      pendingCount: counts.pending,
    };
  }

  pause(): void {
    if (!this.isPlaying) return;
    this.isPlaying = false;
    if (this.rotationTimer) {
      clearTimeout(this.rotationTimer);
      this.rotationTimer = null;
    }
    this.broadcastState();
  }

  resume(): void {
    if (this.isPlaying) return;
    this.isPlaying = true;
    this.scheduleNextRotation();
    this.broadcastState();
  }

  next(): void {
    this.advance();
    this.scheduleNextRotation();
  }

  prev(): void {
    const active = eventService.getActive();
    if (!active || !this.currentImageId) return;
    const queue = imageService.approvedQueue(active.id);
    const idx = queue.findIndex((img) => img.id === this.currentImageId);
    if (idx <= 0) return;
    this.currentImageId = queue[idx - 1]?.id ?? this.currentImageId;
    this.nextImageId = queue[idx]?.id ?? null;
    this.broadcastAdvanced();
    this.scheduleNextRotation();
  }

  jumpTo(imageId: string): void {
    const active = eventService.getActive();
    if (!active) return;
    const img = imageService.get(imageId);
    if (!img || img.status !== 'approved') return;
    this.currentImageId = imageId;
    const queue = imageService.approvedQueue(active.id);
    const idx = queue.findIndex((q) => q.id === imageId);
    this.nextImageId = idx >= 0 ? (queue[idx + 1]?.id ?? null) : null;
    this.broadcastAdvanced();
    this.scheduleNextRotation();
  }

  /** Called by ingest when a new image becomes approved (immediately or after manual approval). */
  notifyApproved(imageId: string): void {
    if (!this.prioritizedQueue.includes(imageId)) {
      this.prioritizedQueue.push(imageId);
    }
    if (!this.currentImageId) {
      this.advance();
      this.scheduleNextRotation();
    } else {
      // Make sure the upcoming "next" is the new image so the audience sees it soon.
      this.nextImageId = imageId;
      this.broadcastAdvanced();
    }
  }

  private advance(): void {
    const active = eventService.getActive();
    if (!active) {
      this.currentImageId = null;
      this.nextImageId = null;
      return;
    }
    if (this.currentImageId) imageService.incrementSeen(this.currentImageId);

    // Prefer prioritized (newly approved) images
    let nextId: string | null = null;
    while (this.prioritizedQueue.length > 0) {
      const candidate = this.prioritizedQueue.shift();
      if (!candidate) break;
      const img = imageService.get(candidate);
      if (img && img.status === 'approved' && img.id !== this.currentImageId) {
        nextId = candidate;
        break;
      }
    }

    const queue = imageService.approvedQueue(active.id);
    if (!nextId) {
      const idx = queue.findIndex((q) => q.id === this.currentImageId);
      nextId = queue[(idx + 1) % Math.max(queue.length, 1)]?.id ?? queue[0]?.id ?? null;
    }
    this.currentImageId = nextId;
    const idx = queue.findIndex((q) => q.id === this.currentImageId);
    this.nextImageId =
      idx >= 0 ? (queue[idx + 1]?.id ?? queue[0]?.id ?? null) : (queue[0]?.id ?? null);
    this.broadcastAdvanced();
  }

  private scheduleNextRotation(): void {
    if (this.rotationTimer) {
      clearTimeout(this.rotationTimer);
      this.rotationTimer = null;
    }
    if (!this.isPlaying) return;
    const active = eventService.getActive();
    if (!active) return;
    const settings = settingsService.getForEvent(active.id);
    this.rotationTimer = setTimeout(() => {
      this.advance();
      this.scheduleNextRotation();
    }, settings.intervalMs);
  }

  private broadcastState(): void {
    wsService.broadcast('slideshow.state', this.state());
  }

  private broadcastAdvanced(): void {
    wsService.broadcast('slideshow.advanced', {
      currentImageId: this.currentImageId,
      nextImageId: this.nextImageId,
    });
    this.broadcastState();
  }

  shutdown(): void {
    if (this.rotationTimer) {
      clearTimeout(this.rotationTimer);
      this.rotationTimer = null;
    }
    logger.info('slideshow service shut down');
  }
}

export const slideshowService = new SlideshowService();
