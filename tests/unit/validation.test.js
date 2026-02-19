const { settingsSchema, photosPathSchema } = require('../../src/validation/schemas');

describe('settingsSchema', () => {
  test('accepts valid complete settings', () => {
    const input = {
      interval: 5000,
      transition: 'fade',
      transitionDuration: 1000,
      filter: 'sepia',
      showWatermark: true,
      watermarkText: 'Hello',
      watermarkType: 'text',
      watermarkImage: '/path/to/img.png',
      watermarkPosition: 'bottom-right',
      watermarkSize: 'medium',
      watermarkOpacity: 80,
      shuffleImages: true,
      repeatLatest: false,
      latestCount: 10,
      transparentBackground: true,
      excludedImages: ['a.jpg', 'b.jpg'],
      language: 'fr',
      recursiveSearch: false,
    };
    const result = settingsSchema.safeParse(input);
    expect(result.success).toBe(true);
    expect(result.data).toEqual(input);
  });

  test('accepts partial settings', () => {
    const result = settingsSchema.safeParse({ interval: 3000 });
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ interval: 3000 });
  });

  test('accepts empty object', () => {
    const result = settingsSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  test('rejects interval below minimum', () => {
    const result = settingsSchema.safeParse({ interval: 500 });
    expect(result.success).toBe(false);
  });

  test('rejects interval above maximum', () => {
    const result = settingsSchema.safeParse({ interval: 100000 });
    expect(result.success).toBe(false);
  });

  test('rejects non-number interval', () => {
    const result = settingsSchema.safeParse({ interval: 'fast' });
    expect(result.success).toBe(false);
  });

  test('rejects invalid language', () => {
    const result = settingsSchema.safeParse({ language: 'de' });
    expect(result.success).toBe(false);
  });

  test('rejects unknown properties (strict mode)', () => {
    const result = settingsSchema.safeParse({ hackField: true });
    expect(result.success).toBe(false);
  });

  test('rejects non-boolean for showWatermark', () => {
    const result = settingsSchema.safeParse({ showWatermark: 'yes' });
    expect(result.success).toBe(false);
  });

  test('rejects non-array excludedImages', () => {
    const result = settingsSchema.safeParse({ excludedImages: 'file.jpg' });
    expect(result.success).toBe(false);
  });

  test('rejects watermarkOpacity above 100', () => {
    const result = settingsSchema.safeParse({ watermarkOpacity: 150 });
    expect(result.success).toBe(false);
  });

  test('rejects watermarkOpacity below 0', () => {
    const result = settingsSchema.safeParse({ watermarkOpacity: -5 });
    expect(result.success).toBe(false);
  });
});

describe('photosPathSchema', () => {
  test('accepts valid path', () => {
    const result = photosPathSchema.safeParse({ photosPath: '/home/user/photos' });
    expect(result.success).toBe(true);
  });

  test('rejects empty path', () => {
    const result = photosPathSchema.safeParse({ photosPath: '' });
    expect(result.success).toBe(false);
  });

  test('rejects path traversal', () => {
    const result = photosPathSchema.safeParse({ photosPath: '../etc/passwd' });
    expect(result.success).toBe(false);
  });

  test('rejects missing photosPath', () => {
    const result = photosPathSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  test('rejects non-string', () => {
    const result = photosPathSchema.safeParse({ photosPath: 42 });
    expect(result.success).toBe(false);
  });
});
