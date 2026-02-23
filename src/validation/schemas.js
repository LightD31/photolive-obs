const { z } = require('zod');

/**
 * Zod schema for slideshow settings update.
 * All fields are optional — only provided fields are validated and applied.
 */
const settingsSchema = z.object({
  interval: z.number().int().min(1000).max(60000).optional(),
  transition: z.string().max(50).optional(),
  transitionDuration: z.number().int().min(100).max(3000).optional(),
  filter: z.string().max(50).optional(),
  showWatermark: z.boolean().optional(),
  watermarkText: z.string().max(200).optional(),
  watermarkType: z.string().max(50).optional(),
  watermarkImage: z.string().max(500).optional(),
  watermarkPosition: z.string().max(50).optional(),
  watermarkSize: z.string().max(50).optional(),
  watermarkOpacity: z.number().min(0).max(100).optional(),
  shuffleImages: z.boolean().optional(),
  repeatLatest: z.boolean().optional(),
  latestCount: z.number().int().min(1).max(50).optional(),
  transparentBackground: z.boolean().optional(),
  excludedImages: z.array(z.string()).optional(),
  language: z.enum(['en', 'fr']).optional(),
  recursiveSearch: z.boolean().optional(),
}).strict();

/**
 * Zod schema for photos-path change.
 */
const photosPathSchema = z.object({
  photosPath: z.string().min(1).max(500).refine(
    (val) => !val.includes('..'),
    { message: 'Path traversal not allowed' }
  ),
});

/**
 * Zod schema for FTP settings update.
 */
const ftpSettingsSchema = z.object({
  enabled: z.boolean().optional(),
  port: z.number().int().min(1).max(65535).optional(),
  username: z.string().min(1).max(100).optional(),
  password: z.string().min(1).max(100).optional(),
  pasv_min: z.number().int().min(1024).max(65535).optional(),
  pasv_max: z.number().int().min(1024).max(65535).optional(),
}).strict();

module.exports = {
  settingsSchema,
  photosPathSchema,
  ftpSettingsSchema,
};
