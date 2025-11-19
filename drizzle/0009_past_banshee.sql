ALTER TABLE `context_sessions` MODIFY COLUMN `tamId` int;--> statement-breakpoint
ALTER TABLE `user_images` ADD `displayOrder` int DEFAULT 0 NOT NULL;