CREATE TABLE `pattern_scans` (
	`id` text PRIMARY KEY NOT NULL,
	`grokbot_id` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`objetivo_stage_id` text NOT NULL,
	`draft_json` text,
	`model_used` text,
	`models_tried_json` text,
	`sampled_json` text,
	`error` text,
	`created_at` text NOT NULL,
	`sent_at` text,
	FOREIGN KEY (`grokbot_id`) REFERENCES `grokbots`(`id`) ON UPDATE no action ON DELETE cascade
);
CREATE INDEX `pattern_scans_bot_created_idx` ON `pattern_scans` (`grokbot_id`,`created_at`);
