import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { config } from '../config.js';

export function renditionPaths(
  eventId: string,
  imageId: string,
): {
  display: string;
  thumbnail: string;
  displayUrl: string;
  thumbnailUrl: string;
} {
  const dir = join(config.renditionsRoot, eventId);
  mkdirSync(dir, { recursive: true });
  const display = join(dir, `${imageId}.display.webp`);
  const thumbnail = join(dir, `${imageId}.thumb.webp`);
  return {
    display,
    thumbnail,
    displayUrl: `/renditions/${eventId}/${imageId}.display.webp`,
    thumbnailUrl: `/renditions/${eventId}/${imageId}.thumb.webp`,
  };
}

export function renditionUrlFromPath(absolutePath: string): string {
  const rel = absolutePath.startsWith(config.renditionsRoot)
    ? absolutePath.slice(config.renditionsRoot.length)
    : absolutePath;
  const normalized = rel.replace(/\\/g, '/').replace(/^\/+/, '');
  return `/renditions/${normalized}`;
}
