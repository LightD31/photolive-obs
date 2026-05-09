import { EventEmitter } from 'node:events';
import type { EventDto, ImageDto, PhotographerDto } from '@photolive/shared';

export type IngestEventMap = {
  'image.received': {
    path: string;
    eventId: string;
    photographerId: string | null;
    uploadedAt: string;
  };
  'image.ingested': { image: ImageDto };
  'image.duplicate': { hash: string; path: string };
  'image.failed': { path: string; error: string };
  'photographer.added': { photographer: PhotographerDto };
  'photographer.removed': { photographerId: string };
  'event.activated': { event: EventDto };
};

export class TypedBus extends EventEmitter {
  override emit<K extends keyof IngestEventMap>(event: K, payload: IngestEventMap[K]): boolean {
    return super.emit(event, payload);
  }

  override on<K extends keyof IngestEventMap>(
    event: K,
    listener: (payload: IngestEventMap[K]) => void,
  ): this {
    return super.on(event, listener);
  }

  override off<K extends keyof IngestEventMap>(
    event: K,
    listener: (payload: IngestEventMap[K]) => void,
  ): this {
    return super.off(event, listener);
  }
}

export const bus = new TypedBus();
bus.setMaxListeners(50);
