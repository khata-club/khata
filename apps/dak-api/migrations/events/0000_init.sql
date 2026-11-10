CREATE TABLE `email` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`project_id` text NOT NULL,
	`environment_id` text NOT NULL,
	`stream` text NOT NULL,
	`status` text NOT NULL,
	`from_address` text NOT NULL,
	`subject` text NOT NULL,
	`template_version_id` text,
	`payload_key` text,
	`size_bytes` integer DEFAULT 0 NOT NULL,
	`idempotency_key` text,
	`reference` text,
	`tags` text DEFAULT '{}' NOT NULL,
	`metadata` text DEFAULT '{}' NOT NULL,
	`resend_of` text,
	`traceparent` text,
	`api_key_id` text,
	`scheduled_at` integer,
	`expires_at` integer,
	`cancelled_at` integer,
	`accepted_at` integer NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `email_env_time` ON `email` (`organization_id`,`environment_id`,`id`);--> statement-breakpoint
CREATE INDEX `email_reference` ON `email` (`environment_id`,`reference`);--> statement-breakpoint
CREATE INDEX `email_scheduled` ON `email` (`status`,`scheduled_at`);--> statement-breakpoint
CREATE TABLE `email_event` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`email_id` text NOT NULL,
	`recipient_id` text,
	`type` text NOT NULL,
	`source_id` text NOT NULL,
	`provider_at` integer,
	`ingested_at` integer NOT NULL,
	`data` text DEFAULT '{}' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `email_event_source` ON `email_event` (`source_id`,`recipient_id`);--> statement-breakpoint
CREATE INDEX `email_event_email` ON `email_event` (`email_id`,`provider_at`);--> statement-breakpoint
CREATE TABLE `email_recipient` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`email_id` text NOT NULL,
	`project_id` text NOT NULL,
	`address` text NOT NULL,
	`kind` text NOT NULL,
	`delivery_status` text NOT NULL,
	`status_at` integer,
	`provider_message_id` text,
	`bounce_type` text,
	`smtp_response` text,
	`submitted_at` integer,
	`delivered_at` integer,
	`first_opened_at` integer,
	`first_clicked_at` integer,
	`open_count` integer DEFAULT 0 NOT NULL,
	`click_count` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `recipient_email` ON `email_recipient` (`email_id`);--> statement-breakpoint
CREATE INDEX `recipient_provider` ON `email_recipient` (`provider_message_id`);--> statement-breakpoint
CREATE INDEX `recipient_address` ON `email_recipient` (`organization_id`,`project_id`,`address`);--> statement-breakpoint
CREATE TABLE `outbox` (
	`email_id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`stream` text NOT NULL,
	`available_at` integer NOT NULL,
	`published_at` integer,
	`attempts` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `outbox_pending` ON `outbox` (`published_at`,`available_at`);--> statement-breakpoint
CREATE TABLE `send_attempt` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`email_id` text NOT NULL,
	`attempt` integer NOT NULL,
	`outcome` text NOT NULL,
	`provider_message_id` text,
	`error_code` text,
	`error_message` text,
	`started_at` integer NOT NULL,
	`latency_ms` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `send_attempt_number` ON `send_attempt` (`email_id`,`attempt`);--> statement-breakpoint
CREATE TABLE `usage_entry` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`project_id` text NOT NULL,
	`environment_id` text NOT NULL,
	`kind` text NOT NULL,
	`quantity` integer NOT NULL,
	`dedupe_key` text NOT NULL,
	`email_id` text,
	`recipient_id` text,
	`period` text NOT NULL,
	`note` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `usage_entry_dedupe` ON `usage_entry` (`dedupe_key`);--> statement-breakpoint
CREATE INDEX `usage_entry_period` ON `usage_entry` (`organization_id`,`period`);--> statement-breakpoint
CREATE TABLE `webhook_delivery` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`endpoint_id` text NOT NULL,
	`event_id` text NOT NULL,
	`event_type` text NOT NULL,
	`email_id` text,
	`payload` text NOT NULL,
	`status` text NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`next_attempt_at` integer,
	`last_status_code` integer,
	`last_error` text,
	`last_latency_ms` integer,
	`delivered_at` integer,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `webhook_delivery_endpoint` ON `webhook_delivery` (`organization_id`,`endpoint_id`,`id`);--> statement-breakpoint
CREATE INDEX `webhook_delivery_email` ON `webhook_delivery` (`email_id`);