import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { computeSharpness } from '../src/utils/sharpness.js';

let tmp: string;
let sharpPath: string;
let blurryPath: string;
let flatPath: string;

beforeAll(async () => {
  tmp = mkdtempSync(join(tmpdir(), 'photolive-test-'));

  // Sharp image: random noise. High variance-of-Laplacian.
  const noise = Buffer.alloc(256 * 256 * 3);
  for (let i = 0; i < noise.length; i++) noise[i] = Math.floor(Math.random() * 256);
  sharpPath = join(tmp, 'sharp.jpg');
  await sharp(noise, { raw: { width: 256, height: 256, channels: 3 } })
    .jpeg({ quality: 95 })
    .toFile(sharpPath);

  // Blurry image: same noise but heavily blurred. Lower variance.
  blurryPath = join(tmp, 'blurry.jpg');
  await sharp(noise, { raw: { width: 256, height: 256, channels: 3 } })
    .blur(15)
    .jpeg({ quality: 95 })
    .toFile(blurryPath);

  // Flat image: solid color. Variance ≈ 0.
  flatPath = join(tmp, 'flat.jpg');
  await sharp({
    create: { width: 256, height: 256, channels: 3, background: { r: 100, g: 100, b: 100 } },
  })
    .jpeg({ quality: 95 })
    .toFile(flatPath);
});

afterAll(() => {
  rmSync(tmp, { recursive: true, force: true });
});

describe('computeSharpness', () => {
  it('returns a number', async () => {
    const score = await computeSharpness(sharpPath);
    expect(typeof score).toBe('number');
    expect(Number.isFinite(score)).toBe(true);
  });

  it('scores a sharp image higher than a blurred one', async () => {
    const [sharpScore, blurryScore] = await Promise.all([
      computeSharpness(sharpPath),
      computeSharpness(blurryPath),
    ]);
    expect(sharpScore).toBeGreaterThan(blurryScore);
    expect(sharpScore).toBeGreaterThan(blurryScore * 2); // meaningfully higher
  });

  it('scores a flat image very low', async () => {
    const score = await computeSharpness(flatPath);
    expect(score).toBeLessThan(5);
  });
});
