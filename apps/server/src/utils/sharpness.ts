import sharp from 'sharp';

/**
 * Variance-of-Laplacian sharpness score.
 *
 * Higher = sharper. Typical values:
 *   < 50    : likely motion blur or out-of-focus
 *   50-100  : marginal
 *   100-300 : in-focus consumer photo
 *   300+    : crisp, well-lit professional shot
 *
 * The threshold for `auto-skip-blurry` mode is configurable in settings.
 */
export async function computeSharpness(imagePath: string): Promise<number> {
  // Downsample to 512px wide for speed; sharpness is scale-invariant enough
  // for our heuristic purposes.
  const { data, info } = await sharp(imagePath)
    .greyscale()
    .resize({ width: 512, fit: 'inside' })
    .raw()
    .toBuffer({ resolveWithObject: true });

  const width = info.width;
  const height = info.height;
  if (width < 3 || height < 3) return 0;

  let sum = 0;
  let sumSq = 0;
  let n = 0;

  // Discrete Laplacian: 4*center - up - down - left - right
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x;
      const c = data[i] ?? 0;
      const u = data[i - width] ?? 0;
      const d = data[i + width] ?? 0;
      const l = data[i - 1] ?? 0;
      const r = data[i + 1] ?? 0;
      const lap = 4 * c - u - d - l - r;
      sum += lap;
      sumSq += lap * lap;
      n++;
    }
  }

  if (n === 0) return 0;
  const mean = sum / n;
  const variance = sumSq / n - mean * mean;
  return variance;
}
