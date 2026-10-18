CREATE TABLE `research_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`checked_at` text NOT NULL,
	`status` text NOT NULL,
	`summary` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `updates` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`summary` text NOT NULL,
	`relevance` text NOT NULL,
	`limitations` text NOT NULL,
	`source_url` text NOT NULL,
	`organization` text NOT NULL,
	`type` text NOT NULL,
	`event_date` text,
	`publication_date` text NOT NULL,
	`checked_date` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`created_at` text NOT NULL,
	`published_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `updates_source_unique` ON `updates` (`source_url`);