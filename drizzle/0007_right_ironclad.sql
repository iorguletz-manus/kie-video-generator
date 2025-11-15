CREATE TABLE `tams` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `tams_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `context_sessions` ADD `tamId` int NOT NULL;--> statement-breakpoint
ALTER TABLE `core_beliefs` ADD `tamId` int NOT NULL;