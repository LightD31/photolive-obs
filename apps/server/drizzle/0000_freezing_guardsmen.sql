CREATE TABLE `audit_log` (
	`id` text PRIMARY KEY NOT NULL,
	`event_id` text,
	`actor` text NOT NULL,
	`action` text NOT NULL,
	`payload` text,
	`ts` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `audit_log_event_ts_idx` ON `audit_log` (`event_id`,`ts`);--> statement-breakpoint
CREATE TABLE `events` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`photos_dir` text NOT NULL,
	`is_active` integer DEFAULT false NOT NULL,
	`display_mode` text DEFAULT 'auto' NOT NULL,
	`branding_intro_image_id` text,
	`branding_outro_image_id` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`archived_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `events_slug_unique` ON `events` (`slug`);--> statement-breakpoint
CREATE TABLE `images` (
	`id` text PRIMARY KEY NOT NULL,
	`event_id` text NOT NULL,
	`photographer_id` text,
	`path` text NOT NULL,
	`hash` text NOT NULL,
	`width` integer NOT NULL,
	`height` integer NOT NULL,
	`orientation` integer DEFAULT 1 NOT NULL,
	`exif` text,
	`taken_at` text,
	`uploaded_at` text NOT NULL,
	`ingested_at` text NOT NULL,
	`display_path` text NOT NULL,
	`thumbnail_path` text NOT NULL,
	`sharpness_score` real,
	`status` text DEFAULT 'approved' NOT NULL,
	`exclusion_reason` text,
	`caption` text,
	`seen_count` integer DEFAULT 0 NOT NULL,
	`queue_position` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `images_event_hash_unique` ON `images` (`event_id`,`hash`);--> statement-breakpoint
CREATE INDEX `images_event_status_idx` ON `images` (`event_id`,`status`);--> statement-breakpoint
CREATE INDEX `images_event_uploaded_idx` ON `images` (`event_id`,`uploaded_at`);--> statement-breakpoint
CREATE TABLE `photographers` (
	`id` text PRIMARY KEY NOT NULL,
	`event_id` text NOT NULL,
	`display_name` text NOT NULL,
	`color` text NOT NULL,
	`ftp_username` text NOT NULL,
	`ftp_password_hash` text NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `photographers_ftp_username_unique` ON `photographers` (`ftp_username`);--> statement-breakpoint
CREATE INDEX `photographers_event_idx` ON `photographers` (`event_id`);--> statement-breakpoint
CREATE TABLE `settings` (
	`event_id` text NOT NULL,
	`key` text NOT NULL,
	`value` text NOT NULL,
	PRIMARY KEY(`event_id`, `key`)
);
