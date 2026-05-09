import { sql } from 'drizzle-orm';
import {
  index,
  integer,
  primaryKey,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';

export const events = sqliteTable('events', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  photosDir: text('photos_dir').notNull(),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(false),
  displayMode: text('display_mode', { enum: ['auto', 'auto-skip-blurry', 'approval'] })
    .notNull()
    .default('auto'),
  brandingIntroImageId: text('branding_intro_image_id'),
  brandingOutroImageId: text('branding_outro_image_id'),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  archivedAt: text('archived_at'),
});

export const settings = sqliteTable(
  'settings',
  {
    eventId: text('event_id').notNull(),
    key: text('key').notNull(),
    value: text('value').notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.eventId, t.key] }),
  }),
);

export const photographers = sqliteTable(
  'photographers',
  {
    id: text('id').primaryKey(),
    eventId: text('event_id').notNull(),
    displayName: text('display_name').notNull(),
    color: text('color').notNull(),
    ftpUsername: text('ftp_username').notNull(),
    ftpPasswordHash: text('ftp_password_hash').notNull(),
    isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
    createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (t) => ({
    ftpUsernameUnique: uniqueIndex('photographers_ftp_username_unique').on(t.ftpUsername),
    eventIdx: index('photographers_event_idx').on(t.eventId),
  }),
);

export const images = sqliteTable(
  'images',
  {
    id: text('id').primaryKey(),
    eventId: text('event_id').notNull(),
    photographerId: text('photographer_id'),
    path: text('path').notNull(),
    hash: text('hash').notNull(),
    width: integer('width').notNull(),
    height: integer('height').notNull(),
    orientation: integer('orientation').notNull().default(1),
    exif: text('exif'),
    takenAt: text('taken_at'),
    uploadedAt: text('uploaded_at').notNull(),
    ingestedAt: text('ingested_at').notNull(),
    displayPath: text('display_path').notNull(),
    thumbnailPath: text('thumbnail_path').notNull(),
    sharpnessScore: real('sharpness_score'),
    status: text('status', {
      enum: ['pending', 'approved', 'excluded', 'auto-skipped'],
    })
      .notNull()
      .default('approved'),
    exclusionReason: text('exclusion_reason'),
    caption: text('caption'),
    seenCount: integer('seen_count').notNull().default(0),
    queuePosition: integer('queue_position'),
  },
  (t) => ({
    eventHashUnique: uniqueIndex('images_event_hash_unique').on(t.eventId, t.hash),
    eventStatusIdx: index('images_event_status_idx').on(t.eventId, t.status),
    eventUploadedIdx: index('images_event_uploaded_idx').on(t.eventId, t.uploadedAt),
  }),
);

export const auditLog = sqliteTable(
  'audit_log',
  {
    id: text('id').primaryKey(),
    eventId: text('event_id'),
    actor: text('actor').notNull(),
    action: text('action').notNull(),
    payload: text('payload'),
    ts: text('ts').notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (t) => ({
    eventTsIdx: index('audit_log_event_ts_idx').on(t.eventId, t.ts),
  }),
);

export type EventRow = typeof events.$inferSelect;
export type NewEventRow = typeof events.$inferInsert;
export type PhotographerRow = typeof photographers.$inferSelect;
export type NewPhotographerRow = typeof photographers.$inferInsert;
export type ImageRow = typeof images.$inferSelect;
export type NewImageRow = typeof images.$inferInsert;
export type AuditLogRow = typeof auditLog.$inferSelect;
