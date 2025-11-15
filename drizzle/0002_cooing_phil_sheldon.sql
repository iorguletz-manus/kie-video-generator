CREATE TABLE `user_images` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`characterName` varchar(100) NOT NULL DEFAULT 'Unnamed',
	`imageName` varchar(255) NOT NULL,
	`imageUrl` text NOT NULL,
	`imageKey` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `user_images_id` PRIMARY KEY(`id`)
);
