CREATE TABLE `api_key` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`project_id` text NOT NULL,
	`environment_id` text NOT NULL,
	`name` text NOT NULL,
	`prefix` text NOT NULL,
	`hash` text NOT NULL,
	`scopes` text NOT NULL,
	`allowed_domains` text DEFAULT '[]' NOT NULL,
	`created_by` text,
	`last_used_at` integer,
	`expires_at` integer,
	`revoked_at` integer,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `api_key_hash` ON `api_key` (`hash`);--> statement-breakpoint
CREATE INDEX `api_key_project` ON `api_key` (`organization_id`,`project_id`);--> statement-breakpoint
CREATE TABLE `audit_event` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`actor` text NOT NULL,
	`action` text NOT NULL,
	`target_type` text,
	`target_id` text,
	`data` text,
	`ip` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `audit_event_org_time` ON `audit_event` (`organization_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `aws_connection` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`mode` text NOT NULL,
	`account_id` text,
	`region` text NOT NULL,
	`role_arn` text,
	`external_id_enc` text,
	`configuration_set_prefix` text,
	`status` text NOT NULL,
	`health` text,
	`checked_at` integer,
	`created_at` integer NOT NULL,
	`disconnected_at` integer
);
--> statement-breakpoint
CREATE INDEX `aws_connection_org` ON `aws_connection` (`organization_id`);--> statement-breakpoint
CREATE TABLE `domain` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`project_id` text NOT NULL,
	`name` text NOT NULL,
	`region` text NOT NULL,
	`status` text NOT NULL,
	`dkim_status` text DEFAULT 'pending' NOT NULL,
	`mail_from_domain` text,
	`mail_from_status` text,
	`spf_status` text,
	`dmarc_status` text,
	`tracking_domain` text,
	`records` text DEFAULT '[]' NOT NULL,
	`last_error` text,
	`verified_at` integer,
	`last_checked_at` integer,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `domain_project_name` ON `domain` (`project_id`,`name`);--> statement-breakpoint
CREATE INDEX `domain_org` ON `domain` (`organization_id`);--> statement-breakpoint
CREATE INDEX `domain_checked` ON `domain` (`last_checked_at`);--> statement-breakpoint
CREATE TABLE `environment` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`project_id` text NOT NULL,
	`name` text NOT NULL,
	`kind` text NOT NULL,
	`sending_enabled` integer DEFAULT false NOT NULL,
	`paused_at` integer,
	`pause_reason` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `environment_project_name` ON `environment` (`project_id`,`name`);--> statement-breakpoint
CREATE TABLE `project` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`workspace_id` text NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`infrastructure_mode` text NOT NULL,
	`aws_connection_id` text,
	`region` text NOT NULL,
	`retain_bodies` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`archived_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `project_org_slug` ON `project` (`organization_id`,`slug`);--> statement-breakpoint
CREATE INDEX `project_workspace` ON `project` (`organization_id`,`workspace_id`);--> statement-breakpoint
CREATE TABLE `sender` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`project_id` text NOT NULL,
	`domain_id` text NOT NULL,
	`email` text NOT NULL,
	`display_name` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sender_project_email` ON `sender` (`project_id`,`email`);--> statement-breakpoint
CREATE TABLE `support_grant` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`granted_by` text NOT NULL,
	`support_user_id` text NOT NULL,
	`reason` text NOT NULL,
	`include_bodies` integer DEFAULT false NOT NULL,
	`expires_at` integer NOT NULL,
	`revoked_at` integer,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `support_grant_org` ON `support_grant` (`organization_id`,`expires_at`);--> statement-breakpoint
CREATE TABLE `suppression` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`project_id` text NOT NULL,
	`email` text NOT NULL,
	`reason` text NOT NULL,
	`stream` text DEFAULT '*' NOT NULL,
	`source_email_id` text,
	`expires_at` integer,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `suppression_project_email_stream` ON `suppression` (`project_id`,`email`,`stream`);--> statement-breakpoint
CREATE INDEX `suppression_org` ON `suppression` (`organization_id`);--> statement-breakpoint
CREATE TABLE `template` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`project_id` text NOT NULL,
	`alias` text NOT NULL,
	`name` text NOT NULL,
	`editor` text NOT NULL,
	`published_version_id` text,
	`created_at` integer NOT NULL,
	`archived_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `template_project_alias` ON `template` (`project_id`,`alias`);--> statement-breakpoint
CREATE TABLE `template_version` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`template_id` text NOT NULL,
	`version` integer NOT NULL,
	`status` text NOT NULL,
	`subject` text NOT NULL,
	`html` text NOT NULL,
	`text` text,
	`blocks` text,
	`variables` text DEFAULT '[]' NOT NULL,
	`created_by` text,
	`published_at` integer,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `template_version_number` ON `template_version` (`template_id`,`version`);--> statement-breakpoint
CREATE TABLE `webhook_endpoint` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`project_id` text NOT NULL,
	`environment_id` text NOT NULL,
	`url` text NOT NULL,
	`description` text,
	`event_types` text NOT NULL,
	`secret_enc` text NOT NULL,
	`previous_secret_enc` text,
	`previous_secret_expires_at` integer,
	`disabled_at` integer,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `webhook_endpoint_env` ON `webhook_endpoint` (`organization_id`,`environment_id`);--> statement-breakpoint
CREATE TABLE `workspace_settings` (
	`workspace_id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`default_region` text,
	`settings` text DEFAULT '{}' NOT NULL,
	`updated_at` integer NOT NULL
);
