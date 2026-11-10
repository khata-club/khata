/**
 * Control-plane database (binding `DB`): tenancy, connections, domains, keys, templates,
 * suppressions, webhooks and audit. Low write volume, read by the dashboard.
 *
 * Better Auth owns organization / member / team / user tables (Dak 5/22); spec workspaces are
 * Better Auth teams, so `workspace_id` here is a team ID.
 */
import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'

import { createdAt, json, ms, organizationId } from './columns'

export const workspaceSettings = sqliteTable('workspace_settings', {
  workspaceId: text('workspace_id').primaryKey(),
  organizationId: organizationId(),
  /** Default region for new projects, e.g. `eu-west-1`. */
  defaultRegion: text('default_region'),
  /** Opt-out per topic scope for marketing (Phase 2). */
  settings: json<Record<string, unknown>>('settings').notNull().default({}),
  updatedAt: ms('updated_at')
    .notNull()
    .$defaultFn(() => Date.now()),
})

export const project = sqliteTable(
  'project',
  {
    id: text('id').primaryKey(),
    organizationId: organizationId(),
    workspaceId: text('workspace_id').notNull(),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    /** `platform` (our AWS) or `byo` (customer AWS). Never silently switched. */
    infrastructureMode: text('infrastructure_mode', { enum: ['platform', 'byo'] }).notNull(),
    awsConnectionId: text('aws_connection_id'),
    region: text('region').notNull(),
    /** Zero-body-retention: never store rendered bodies or attachments. */
    retainBodies: integer('retain_bodies', { mode: 'boolean' }).notNull().default(true),
    createdAt: createdAt(),
    archivedAt: ms('archived_at'),
  },
  (t) => [
    uniqueIndex('project_org_slug').on(t.organizationId, t.slug),
    index('project_workspace').on(t.organizationId, t.workspaceId),
  ],
)

export const environment = sqliteTable(
  'environment',
  {
    id: text('id').primaryKey(),
    organizationId: organizationId(),
    projectId: text('project_id').notNull(),
    name: text('name').notNull(),
    kind: text('kind', { enum: ['production', 'staging', 'sandbox'] }).notNull(),
    /** Production sending requires an explicit enable step (spec §12 first-run flow). */
    sendingEnabled: integer('sending_enabled', { mode: 'boolean' }).notNull().default(false),
    /** Admin/abuse pause: stops dispatch without deleting anything. */
    pausedAt: ms('paused_at'),
    pauseReason: text('pause_reason'),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('environment_project_name').on(t.projectId, t.name)],
)

export const awsConnection = sqliteTable(
  'aws_connection',
  {
    id: text('id').primaryKey(),
    organizationId: organizationId(),
    mode: text('mode', { enum: ['platform', 'byo'] }).notNull(),
    accountId: text('account_id'),
    region: text('region').notNull(),
    roleArn: text('role_arn'),
    /** AES-GCM envelope (see src/lib/crypto) of the STS ExternalId. */
    externalIdEnc: text('external_id_enc'),
    configurationSetPrefix: text('configuration_set_prefix'),
    status: text('status', {
      enum: ['pending', 'healthy', 'degraded', 'failed', 'disconnecting', 'disconnected'],
    }).notNull(),
    health: json<Record<string, unknown>>('health'),
    checkedAt: ms('checked_at'),
    createdAt: createdAt(),
    disconnectedAt: ms('disconnected_at'),
  },
  (t) => [index('aws_connection_org').on(t.organizationId)],
)

export const domain = sqliteTable(
  'domain',
  {
    id: text('id').primaryKey(),
    organizationId: organizationId(),
    projectId: text('project_id').notNull(),
    name: text('name').notNull(),
    region: text('region').notNull(),
    status: text('status', {
      enum: ['pending', 'verified', 'failed', 'temporary_failure'],
    }).notNull(),
    dkimStatus: text('dkim_status').notNull().default('pending'),
    mailFromDomain: text('mail_from_domain'),
    mailFromStatus: text('mail_from_status'),
    spfStatus: text('spf_status'),
    dmarcStatus: text('dmarc_status'),
    trackingDomain: text('tracking_domain'),
    /** DNS records the customer must publish, as shown in the wizard. */
    records: json<unknown[]>('records').notNull().default([]),
    lastError: text('last_error'),
    verifiedAt: ms('verified_at'),
    lastCheckedAt: ms('last_checked_at'),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex('domain_project_name').on(t.projectId, t.name),
    index('domain_org').on(t.organizationId),
    index('domain_checked').on(t.lastCheckedAt),
  ],
)

export const sender = sqliteTable(
  'sender',
  {
    id: text('id').primaryKey(),
    organizationId: organizationId(),
    projectId: text('project_id').notNull(),
    domainId: text('domain_id').notNull(),
    email: text('email').notNull(),
    displayName: text('display_name'),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('sender_project_email').on(t.projectId, t.email)],
)

export const apiKey = sqliteTable(
  'api_key',
  {
    id: text('id').primaryKey(),
    organizationId: organizationId(),
    projectId: text('project_id').notNull(),
    environmentId: text('environment_id').notNull(),
    name: text('name').notNull(),
    /** First characters of the key, shown in the UI to identify it. */
    prefix: text('prefix').notNull(),
    /** SHA-256 of the full key, hex. The key itself is never stored. */
    hash: text('hash').notNull(),
    scopes: json<string[]>('scopes').notNull(),
    /** Restrict sending to these domains; empty means any verified domain in the project. */
    allowedDomains: json<string[]>('allowed_domains').notNull().default([]),
    createdBy: text('created_by'),
    lastUsedAt: ms('last_used_at'),
    expiresAt: ms('expires_at'),
    revokedAt: ms('revoked_at'),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex('api_key_hash').on(t.hash),
    index('api_key_project').on(t.organizationId, t.projectId),
  ],
)

export const template = sqliteTable(
  'template',
  {
    id: text('id').primaryKey(),
    organizationId: organizationId(),
    projectId: text('project_id').notNull(),
    /** Stable handle used by the API, e.g. `password-reset`. */
    alias: text('alias').notNull(),
    name: text('name').notNull(),
    editor: text('editor', { enum: ['code', 'visual'] }).notNull(),
    publishedVersionId: text('published_version_id'),
    createdAt: createdAt(),
    archivedAt: ms('archived_at'),
  },
  (t) => [uniqueIndex('template_project_alias').on(t.projectId, t.alias)],
)

export const templateVersion = sqliteTable(
  'template_version',
  {
    id: text('id').primaryKey(),
    organizationId: organizationId(),
    templateId: text('template_id').notNull(),
    version: integer('version').notNull(),
    status: text('status', { enum: ['draft', 'published', 'archived'] }).notNull(),
    subject: text('subject').notNull(),
    html: text('html').notNull(),
    text: text('text'),
    /** Visual editor block document; `html` is its rendering. */
    blocks: json<unknown>('blocks'),
    /** Typed variable schema: required, defaults, examples. */
    variables: json<unknown[]>('variables').notNull().default([]),
    createdBy: text('created_by'),
    publishedAt: ms('published_at'),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('template_version_number').on(t.templateId, t.version)],
)

export const suppression = sqliteTable(
  'suppression',
  {
    id: text('id').primaryKey(),
    organizationId: organizationId(),
    projectId: text('project_id').notNull(),
    /** Lower-cased address. */
    email: text('email').notNull(),
    reason: text('reason', {
      enum: ['hard_bounce', 'complaint', 'soft_bounce_policy', 'manual', 'unsubscribe'],
    }).notNull(),
    /** Stream-specific suppression (unsubscribe), or `*` for all streams (safety). */
    stream: text('stream').notNull().default('*'),
    sourceEmailId: text('source_email_id'),
    expiresAt: ms('expires_at'),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex('suppression_project_email_stream').on(t.projectId, t.email, t.stream),
    index('suppression_org').on(t.organizationId),
  ],
)

export const webhookEndpoint = sqliteTable(
  'webhook_endpoint',
  {
    id: text('id').primaryKey(),
    organizationId: organizationId(),
    projectId: text('project_id').notNull(),
    environmentId: text('environment_id').notNull(),
    url: text('url').notNull(),
    description: text('description'),
    eventTypes: json<string[]>('event_types').notNull(),
    /** AES-GCM envelopes of the active and (during rotation) previous signing secrets. */
    secretEnc: text('secret_enc').notNull(),
    previousSecretEnc: text('previous_secret_enc'),
    previousSecretExpiresAt: ms('previous_secret_expires_at'),
    disabledAt: ms('disabled_at'),
    createdAt: createdAt(),
  },
  (t) => [index('webhook_endpoint_env').on(t.organizationId, t.environmentId)],
)

export const auditEvent = sqliteTable(
  'audit_event',
  {
    id: text('id').primaryKey(),
    organizationId: organizationId(),
    /** User ID, `apikey:<id>`, `support:<id>` or `system`. */
    actor: text('actor').notNull(),
    action: text('action').notNull(),
    targetType: text('target_type'),
    targetId: text('target_id'),
    data: json<Record<string, unknown>>('data'),
    ip: text('ip'),
    createdAt: createdAt(),
  },
  (t) => [index('audit_event_org_time').on(t.organizationId, t.createdAt)],
)

export const supportGrant = sqliteTable(
  'support_grant',
  {
    id: text('id').primaryKey(),
    organizationId: organizationId(),
    grantedBy: text('granted_by').notNull(),
    supportUserId: text('support_user_id').notNull(),
    reason: text('reason').notNull(),
    includeBodies: integer('include_bodies', { mode: 'boolean' }).notNull().default(false),
    expiresAt: ms('expires_at').notNull(),
    revokedAt: ms('revoked_at'),
    createdAt: createdAt(),
  },
  (t) => [index('support_grant_org').on(t.organizationId, t.expiresAt)],
)
