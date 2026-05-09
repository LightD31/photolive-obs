import { z } from 'zod';

// App-level settings persisted to <dataDir>/settings.json (Electron) or
// piped in via --settings <path> (server CLI). All fields except authToken
// are optional; nulls in `storage` mean "derive from dataDir".
export const appSettingsFileSchema = z.object({
  schemaVersion: z.literal(1).default(1),
  authToken: z.string().min(16),
  logLevel: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
  network: z
    .object({
      port: z.number().int().min(1).max(65_535).default(3001),
      host: z.string().default('0.0.0.0'),
      allowedOrigins: z.array(z.string()).default([]),
    })
    .default({}),
  storage: z
    .object({
      dataDir: z.string().nullable().default(null),
      databasePath: z.string().nullable().default(null),
      photosRoot: z.string().nullable().default(null),
      renditionsRoot: z.string().nullable().default(null),
    })
    .default({}),
  ftp: z
    .object({
      host: z.string().default('0.0.0.0'),
      port: z.number().int().min(1).max(65_535).default(2121),
      pasvUrl: z.string().default('127.0.0.1'),
      pasvMin: z.number().int().min(1).max(65_535).default(50_000),
      pasvMax: z.number().int().min(1).max(65_535).default(50_100),
    })
    .default({}),
  obs: z
    .object({
      url: z.string().default(''),
      password: z.string().default(''),
    })
    .default({}),
});

export type AppSettingsFile = z.infer<typeof appSettingsFileSchema>;

// Patch shape used by PUT /api/app-settings (deep partial of the file schema,
// with authToken still required to set explicitly — we have a separate
// rotate-token endpoint for that).
export const appSettingsPatchSchema = z.object({
  logLevel: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).optional(),
  network: z
    .object({
      port: z.number().int().min(1).max(65_535).optional(),
      host: z.string().optional(),
      allowedOrigins: z.array(z.string()).optional(),
    })
    .partial()
    .optional(),
  storage: z
    .object({
      dataDir: z.string().nullable().optional(),
      databasePath: z.string().nullable().optional(),
      photosRoot: z.string().nullable().optional(),
      renditionsRoot: z.string().nullable().optional(),
    })
    .partial()
    .optional(),
  ftp: z
    .object({
      host: z.string().optional(),
      port: z.number().int().min(1).max(65_535).optional(),
      pasvUrl: z.string().optional(),
      pasvMin: z.number().int().min(1).max(65_535).optional(),
      pasvMax: z.number().int().min(1).max(65_535).optional(),
    })
    .partial()
    .optional(),
  obs: z
    .object({
      url: z.string().optional(),
      password: z.string().optional(),
    })
    .partial()
    .optional(),
});

export type AppSettingsPatch = z.infer<typeof appSettingsPatchSchema>;

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
    transparentBackground: z.boolean(),
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
