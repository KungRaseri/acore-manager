CREATE TABLE `command_audit` (
	`id` varchar(36) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`actor_name` varchar(255) NOT NULL,
	`actor_level` tinyint unsigned NOT NULL,
	`command` varchar(64) NOT NULL,
	`arguments` varchar(1000),
	`target` varchar(64),
	`status` varchar(16) NOT NULL,
	`failure_reason` varchar(32),
	`message` varchar(512),
	`output` text,
	`duration_ms` int unsigned,
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`finished_at` timestamp(3),
	CONSTRAINT `command_audit_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `command_audit_created_at_idx` ON `command_audit` (`created_at`);--> statement-breakpoint
CREATE INDEX `command_audit_user_id_created_at_idx` ON `command_audit` (`user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `command_audit_command_idx` ON `command_audit` (`command`);