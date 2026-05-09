import { z } from 'zod';

export const displayModeSchema = z.enum(['auto', 'auto-skip-blurry', 'approval']);
export const imageStatusSchema = z.enum(['pending', 'approved', 'excluded', 'auto-skipped']);
export const transitionSchema = z.enum(['none', 'fade', 'slide-blur']);

export const slugSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-z0-9][a-z0-9-]*$/, 'lowercase letters, digits, and hyphens only');

export const colorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'must be #RRGGBB');

export const eventCreateSchema = z.object({
  name: z.string().min(1).max(120),
  slug: slugSchema,
  photosDir: z.string().min(1),
  displayMode: displayModeSchema.default('auto'),
});

export const eventUpdateSchema = z
  .object({
    name: z.string().min(1).max(120),
    photosDir: z.string().min(1),
    displayMode: displayModeSchema,
    brandingIntroImageId: z.string().nullable(),
    brandingOutroImageId: z.string().nullable(),
  })
  .partial();

export const photographerCreateSchema = z.object({
  displayName: z.string().min(1).max(80),
  color: colorSchema.default('#3b82f6'),
});

export const photographerUpdateSchema = z
  .object({
    displayName: z.string().min(1).max(80),
    color: colorSchema,
    isActive: z.boolean(),
  })
  .partial();

export const settingsUpdateSchema = z
  .object({
    intervalMs: z.number().int().min(1000).max(60_000),
    transition: transitionSchema,
    transitionDurationMs: z.number().int().min(0).max(5000),
    showCaption: z.boolean(),
    showPhotographer: z.boolean(),
    showTimeAgo: z.boolean(),
    showBranding: z.boolean(),
    blurThreshold: z.number().min(0).max(10_000),
  })
  .partial();

export const captionSchema = z.object({
  text: z.string().max(280),
});

export const wsCommandSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('slideshow.next'), payload: z.object({}).default({}) }),
  z.object({ type: z.literal('slideshow.prev'), payload: z.object({}).default({}) }),
  z.object({ type: z.literal('slideshow.pause'), payload: z.object({}).default({}) }),
  z.object({ type: z.literal('slideshow.resume'), payload: z.object({}).default({}) }),
  z.object({
    type: z.literal('slideshow.jumpTo'),
    payload: z.object({ imageId: z.string() }),
  }),
  z.object({
    type: z.literal('image.exclude'),
    payload: z.object({ imageId: z.string(), reason: z.string().optional() }),
  }),
  z.object({ type: z.literal('image.include'), payload: z.object({ imageId: z.string() }) }),
  z.object({ type: z.literal('image.approve'), payload: z.object({ imageId: z.string() }) }),
  z.object({
    type: z.literal('image.reject'),
    payload: z.object({ imageId: z.string(), reason: z.string().optional() }),
  }),
  z.object({
    type: z.literal('image.caption'),
    payload: z.object({ imageId: z.string(), text: z.string().max(280) }),
  }),
  z.object({
    type: z.literal('queue.reorder'),
    payload: z.object({ imageIds: z.array(z.string()) }),
  }),
]);

export type WsCommand = z.infer<typeof wsCommandSchema>;
