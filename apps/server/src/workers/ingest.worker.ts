import { stat } from 'node:fs/promises';
import exifr from 'exifr';
import sharp from 'sharp';
import { sha256OfFile } from '../utils/hash.js';
import { computeSharpness } from '../utils/sharpness.js';

export interface IngestInput {
  path: string;
  imageId: string;
  displayPath: string;
  thumbnailPath: string;
}

export interface IngestOutput {
  hash: string;
  width: number;
  height: number;
  orientation: number;
  exif: Record<string, unknown> | null;
  takenAt: string | null;
  displayPath: string;
  thumbnailPath: string;
  sharpnessScore: number;
  sizeBytes: number;
}

export interface IngestError {
  error: string;
}

const DISPLAY_MAX_WIDTH = 2048;
const THUMB_MAX_WIDTH = 320;

function parseExifDate(exif: Record<string, unknown> | null): string | null {
  if (!exif) return null;
  const candidates: unknown[] = [
    exif.DateTimeOriginal,
    exif.CreateDate,
    exif.DateTimeDigitized,
    exif.DateTime,
    exif.ModifyDate,
  ];
  for (const candidate of candidates) {
    if (candidate instanceof Date && !Number.isNaN(candidate.getTime())) {
      return candidate.toISOString();
    }
    if (typeof candidate === 'string' && candidate.length > 0) {
      const d = new Date(candidate);
      if (!Number.isNaN(d.getTime())) return d.toISOString();
    }
  }
  return null;
}

export default async function ingest(input: IngestInput): Promise<IngestOutput | IngestError> {
  try {
    const [hash, fileStat, exif] = await Promise.all([
      sha256OfFile(input.path),
      stat(input.path),
      exifr.parse(input.path).catch(() => null),
    ]);

    const sourceMeta = await sharp(input.path).metadata();
    const width = sourceMeta.width ?? 0;
    const height = sourceMeta.height ?? 0;
    const orientation = sourceMeta.orientation ?? 1;

    // Display + thumb: rotate based on EXIF, encode webp.
    await sharp(input.path)
      .rotate()
      .resize({ width: DISPLAY_MAX_WIDTH, withoutEnlargement: true })
      .webp({ quality: 82 })
      .toFile(input.displayPath);

    await sharp(input.path)
      .rotate()
      .resize({ width: THUMB_MAX_WIDTH, withoutEnlargement: true })
      .webp({ quality: 70 })
      .toFile(input.thumbnailPath);

    const sharpnessScore = await computeSharpness(input.path);

    return {
      hash,
      width,
      height,
      orientation,
      exif: exif ? (exif as Record<string, unknown>) : null,
      takenAt: parseExifDate(exif),
      displayPath: input.displayPath,
      thumbnailPath: input.thumbnailPath,
      sharpnessScore,
      sizeBytes: fileStat.size,
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}
