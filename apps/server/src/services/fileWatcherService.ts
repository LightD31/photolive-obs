import { stat } from 'node:fs/promises';
import { extname, relative, sep } from 'node:path';
import chokidar, { type FSWatcher } from 'chokidar';
import { bus } from '../bus.js';
import { logger } from '../logger.js';
import { eventService } from './eventService.js';
import { photographerService } from './photographerService.js';

const ALLOWED_EXTENSIONS = new Set(['.jpg', '.jpeg', '.heic']);
const SKIP_PATTERN = /\.(arw|raf|cr3|nef|dng|mp4|mov|xml|tmp)$/i;

/**
 * Watches the active event's photos directory for newly-arrived JPEGs from any
 * source: FTP uploads (each photographer is chroot-ed to a subdir named after
 * their ftpUsername) and manual drops at the root.
 *
 * Photographer attribution: we look at the first path segment under photosDir.
 * If it matches an active photographer's ftpUsername, we attribute the upload
 * to them; otherwise photographerId stays null.
 */
export class FileWatcherService {
  private watcher: FSWatcher | null = null;
  private currentDir: string | null = null;

  async watchActiveEvent(): Promise<void> {
    const event = eventService.getActive();
    if (!event) {
      await this.stop();
      return;
    }
    if (event.photosDir === this.currentDir) return;
    await this.stop();

    this.currentDir = event.photosDir;
    this.watcher = chokidar.watch(event.photosDir, {
      persistent: true,
      ignoreInitial: true,
      depth: 8,
      awaitWriteFinish: { stabilityThreshold: 600, pollInterval: 100 },
      ignored: (path) => SKIP_PATTERN.test(path),
    });

    this.watcher.on('add', (path) => {
      void this.handleAdd(path);
    });

    this.watcher.on('error', (err) => {
      logger.error({ err }, 'file watcher error');
    });

    logger.info({ dir: event.photosDir }, 'file watcher started');
  }

  private async handleAdd(absolutePath: string): Promise<void> {
    const ext = extname(absolutePath).toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(ext)) return;
    try {
      const s = await stat(absolutePath);
      if (!s.isFile() || s.size === 0) return;
    } catch {
      return;
    }

    const event = eventService.getActive();
    if (!event) return;

    // Attribute to a photographer if the file is under <photosDir>/<ftpUsername>/...
    const rel = relative(event.photosDir, absolutePath);
    const firstSegment = rel.split(sep)[0];
    let photographerId: string | null = null;
    if (firstSegment && firstSegment !== '.' && firstSegment !== '..') {
      const photographers = photographerService.listActiveForEvent(event.id);
      const match = photographers.find((p) => p.ftpUsername === firstSegment);
      if (match) photographerId = match.id;
    }

    bus.emit('image.received', {
      path: absolutePath,
      eventId: event.id,
      photographerId,
      uploadedAt: new Date().toISOString(),
    });
  }

  async stop(): Promise<void> {
    if (this.watcher) {
      await this.watcher.close();
      this.watcher = null;
    }
    this.currentDir = null;
  }
}

export const fileWatcherService = new FileWatcherService();
