CREATE TABLE `game_account` (
	`id` varchar(36) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`username` varchar(32) NOT NULL,
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	CONSTRAINT `game_account_id` PRIMARY KEY(`id`),
	CONSTRAINT `game_account_username_unique` UNIQUE(`username`)
);
--> statement-breakpoint
ALTER TABLE `game_account` ADD CONSTRAINT `game_account_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `game_account_userId_idx` ON `game_account` (`user_id`);