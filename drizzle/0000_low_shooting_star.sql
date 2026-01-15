CREATE TABLE `catalog_books` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`language` text,
	`creator` text,
	`publisher` text,
	`date` text,
	`size` integer,
	`url` text,
	`favicon` text,
	`tags` text,
	`category` text,
	`has_ft_index` integer,
	`has_pictures` integer,
	`has_videos` integer,
	`has_details` integer,
	`media_count` integer,
	`article_count` integer,
	`synced_at` integer
);
--> statement-breakpoint
CREATE TABLE `downloads` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`book_id` text,
	`status` text NOT NULL,
	`file_path` text,
	`bytes_downloaded` integer DEFAULT 0,
	`total_bytes` integer,
	`pid` integer,
	`started_at` integer,
	`completed_at` integer,
	`error` text,
	FOREIGN KEY (`book_id`) REFERENCES `catalog_books`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `local_zims` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`file_path` text NOT NULL,
	`file_name` text NOT NULL,
	`file_size` integer,
	`book_id` text,
	`catalog_date` text,
	`has_update` integer DEFAULT false,
	`discovered_at` integer,
	`last_checked` integer,
	FOREIGN KEY (`book_id`) REFERENCES `catalog_books`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `local_zims_file_path_unique` ON `local_zims` (`file_path`);--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text
);
