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

/**
 * Operator accounts for the control panel. Distinct from `photographers`
 * (which authenticate against FTP only). `username` is stored lowercased and
 * unique; `passwordHash` is bcrypt. Today every user is role 'admin'.
 */
export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  username: text('username').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role: text('role', { enum: ['admin'] })
    .notNull()
    .default('admin'),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
});

/**
 * Server-side operator sessions. The primary key is the opaque high-entropy
 * token delivered to the browser as the `photolive_session` httpOnly cookie.
 * Rows are validated on each request and swept once expired.
 */
export const sessions = sqliteTable(
  'sessions',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
    expiresAt: text('expires_at').notNull(),
    lastSeenAt: text('last_seen_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (t) => ({
    userIdx: index('sessions_user_idx').on(t.userId),
    expiresIdx: index('sessions_expires_idx').on(t.expiresAt),
  }),
);

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

export type UserRow = typeof users.$inferSelect;
export type NewUserRow = typeof users.$inferInsert;
export type SessionRow = typeof sessions.$inferSelect;
export type NewSessionRow = typeof sessions.$inferInsert;
export type EventRow = typeof events.$inferSelect;
export type NewEventRow = typeof events.$inferInsert;
export type PhotographerRow = typeof photographers.$inferSelect;
export type NewPhotographerRow = typeof photographers.$inferInsert;
export type ImageRow = typeof images.$inferSelect;
export type NewImageRow = typeof images.$inferInsert;
export type AuditLogRow = typeof auditLog.$inferSelect;
