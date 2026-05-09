import type { EventDto, ImageDto, PhotographerDto, SettingsDto, SlideshowState } from './types.js';

export type ServerEventMap = {
  'event.activated': { event: EventDto };
  'event.updated': { event: EventDto };
  'event.deleted': { eventId: string };
  'photographer.added': { photographer: PhotographerDto };
  'photographer.updated': { photographer: PhotographerDto };
  'photographer.removed': { photographerId: string };
  'image.added': { image: ImageDto; queuePosition: number };
  'image.updated': { image: ImageDto };
  'image.removed': { imageId: string };
  'image.approved': { imageId: string };
  'image.rejected': { imageId: string };
  'slideshow.state': SlideshowState;
  'slideshow.advanced': { currentImageId: string | null; nextImageId: string | null };
  'settings.updated': { settings: SettingsDto };
  'ftp.status': { running: boolean; activeConnections: number; totalUploads: number };
  'ingest.progress': { eventId: string; processed: number; total: number };
  'ingest.latency': { imageId: string; latencyMs: number };
};

export type ServerEvent<K extends keyof ServerEventMap = keyof ServerEventMap> = {
  [E in K]: { type: E; payload: ServerEventMap[E] };
}[K];

export type ClientCommandMap = {
  'slideshow.next': Record<string, never>;
  'slideshow.prev': Record<string, never>;
  'slideshow.pause': Record<string, never>;
  'slideshow.resume': Record<string, never>;
  'slideshow.jumpTo': { imageId: string };
  'image.exclude': { imageId: string; reason?: string };
  'image.include': { imageId: string };
  'image.approve': { imageId: string };
  'image.reject': { imageId: string; reason?: string };
  'image.caption': { imageId: string; text: string };
  'queue.reorder': { imageIds: string[] };
};

export type ClientCommand<K extends keyof ClientCommandMap = keyof ClientCommandMap> = {
  [C in K]: { type: C; payload: ClientCommandMap[C] };
}[K];
