import { describe, expect, it } from 'vitest';
import {
  colorSchema,
  eventCreateSchema,
  photographerCreateSchema,
  settingsUpdateSchema,
  slugSchema,
  wsCommandSchema,
} from '../src/schemas.js';

describe('slugSchema', () => {
  it('accepts lowercase alphanumeric with hyphens', () => {
    expect(slugSchema.safeParse('sophie-marc-2026').success).toBe(true);
    expect(slugSchema.safeParse('a').success).toBe(true);
  });
  it('rejects uppercase, leading hyphen, spaces', () => {
    expect(slugSchema.safeParse('Sophie-Marc').success).toBe(false);
    expect(slugSchema.safeParse('-sophie').success).toBe(false);
    expect(slugSchema.safeParse('sophie marc').success).toBe(false);
  });
});

describe('colorSchema', () => {
  it('accepts #RRGGBB', () => {
    expect(colorSchema.safeParse('#3b82f6').success).toBe(true);
    expect(colorSchema.safeParse('#FFFFFF').success).toBe(true);
  });
  it('rejects shorthand and missing hash', () => {
    expect(colorSchema.safeParse('#fff').success).toBe(false);
    expect(colorSchema.safeParse('3b82f6').success).toBe(false);
  });
});

describe('eventCreateSchema', () => {
  it('defaults displayMode to auto', () => {
    const result = eventCreateSchema.parse({
      name: 'Smoke',
      slug: 'smoke',
      photosDir: './data/photos/smoke',
    });
    expect(result.displayMode).toBe('auto');
  });
  it('rejects invalid display mode', () => {
    expect(
      eventCreateSchema.safeParse({
        name: 'x',
        slug: 'x',
        photosDir: '/x',
        displayMode: 'whatever',
      }).success,
    ).toBe(false);
  });
});

describe('photographerCreateSchema', () => {
  it('requires displayName', () => {
    expect(photographerCreateSchema.safeParse({ color: '#3b82f6' }).success).toBe(false);
  });
});

describe('settingsUpdateSchema', () => {
  it('clamps interval bounds', () => {
    expect(settingsUpdateSchema.safeParse({ intervalMs: 500 }).success).toBe(false);
    expect(settingsUpdateSchema.safeParse({ intervalMs: 100_000 }).success).toBe(false);
    expect(settingsUpdateSchema.safeParse({ intervalMs: 5_000 }).success).toBe(true);
  });
});

describe('wsCommandSchema', () => {
  it('parses slideshow.next without payload', () => {
    const r = wsCommandSchema.parse({ type: 'slideshow.next', payload: {} });
    expect(r.type).toBe('slideshow.next');
  });
  it('parses image.caption with text', () => {
    const r = wsCommandSchema.parse({
      type: 'image.caption',
      payload: { imageId: 'abc', text: 'First dance' },
    });
    if (r.type === 'image.caption') {
      expect(r.payload.text).toBe('First dance');
    } else {
      throw new Error('wrong type');
    }
  });
  it('rejects unknown command types', () => {
    expect(wsCommandSchema.safeParse({ type: 'wat', payload: {} }).success).toBe(false);
  });
});
