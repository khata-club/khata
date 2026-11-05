# Dak — email platform on Cloudflare + AWS SES: stacked-PR plan

## Context

The spec ([`product-spec.md`](./product-spec.md), v1.0) describes a developer-first email platform: SES behind an API, dashboard, templates, analytics and email APM. It ships in 4 phases.

The product is built inside the `khata-club/khata` monorepo, which uses pnpm + Turbo, Vue 3 + Vite, and `@khata/ui` (the Calm Kit: Tailwind v4, Reka UI, Storybook). It is one app among several. It must use the same UI, so the dashboard consumes `@khata/ui` exactly as `apps/web` does.

Hosting is Cloudflare: Workers + **Hono** + **D1** + **Better Auth**. AWS supplies only SES, SNS and IAM, defined with **CDK (TypeScript)**.

**Name: Dak** (डाक, "post"). It is short and sits well with _khata_.

| Path                | Package           | Role                                                                                                                                  |
| ------------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/dak`          | `@khata/dak-app`  | Vue 3 dashboard. Same Tailwind and `@khata/ui` setup as `apps/web`. Served via Workers static assets                                  |
| `apps/dak-api`      | `@khata/dak-api`  | Hono Worker: public `/v1` API, dashboard API, auth, SNS ingest, queue consumers, crons, Durable Objects                               |
| `packages/dak-core` | `@khata/dak-core` | Shared zod schemas, API types, template engine, block renderer, status state machine. Pure TS that runs in the browser and in Workers |
| `packages/dak-sdk`  | `@khata/dak`      | Public TypeScript SDK                                                                                                                 |
| `infra/dak-aws`     | `@khata/dak-aws`  | CDK app: SES config sets, SNS, IAM broker, and the BYO-account CloudFormation template                                                |

New Calm Kit components go into `packages/ui` with stories and tests, never inside `apps/dak`. That keeps the UI shared across the other Khata apps.

## Conventions (mirroring the Calm Kit stack, PRs #2–#9)

- Branches are `dak/NN-slug`. Each one is based on the previous branch, and the first is based on `develop`. PR titles are `Dak N/M: …`, and they merge in order.
- Every PR must be green on `pnpm lint`, `format:check`, `typecheck`, `test` and `build`. Worker tests use `@cloudflare/vitest-pool-workers` (Miniflare D1, Queues and DOs). UI tests use vitest + `@vue/test-utils`.
- Every phase ends with a PR that turns that phase's spec exit criteria into automated tests.

## Cloudflare mapping of the spec's §13 architecture (locked)

| Spec (AWS ref)                         | Dak on Cloudflare                                                                                                                                                                                                                                                                    |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| API Gateway + Lambda/ECS               | Hono on Workers. `@hono/zod-openapi` generates the OpenAPI spec, which drives the SDK and docs                                                                                                                                                                                       |
| PostgreSQL/RDS                         | **D1** via **Drizzle** (`drizzle-kit` migrations, `wrangler d1 migrations apply`)                                                                                                                                                                                                    |
| Atomic idempotency + quota reservation | **Durable Object per project×environment** (`SendGate`, SQLite storage). It handles the idempotency record, quota reservation, hard cap and token-bucket rate limits in one serialized step. D1 has no interactive transactions, so this coordination lives in the DO                |
| Transactional outbox → SQS             | A D1 `batch()` (atomic) writes Email + EmailRecipient + Outbox rows, then sends to **Cloudflare Queues**. A cron sweeper re-publishes outbox rows that were never published                                                                                                          |
| Per-stream priority                    | Separate queues `dak-auth`, `dak-tx`, `dak-notify` and `dak-marketing`, each with its own consumer concurrency, so the authentication queue keeps reserved capacity                                                                                                                  |
| SES submission                         | `aws4fetch` (SigV4 over fetch) → SES v2 `SendEmail`. Raw MIME for attachments and inline images                                                                                                                                                                                      |
| BYO AWS role                           | STS `AssumeRole` with an ExternalId, called from a platform **broker** principal. Temporary credentials are cached in a DO                                                                                                                                                           |
| SES events → SNS → SQS                 | Config set → SNS **HTTPS subscription** → `POST /ingest/ses` on the Worker. It verifies the SNS signature with WebCrypto, stores the raw event in **R2** and enqueues it on `dak-events` for an idempotent consumer                                                                  |
| S3                                     | **R2**: assets, raw events, optional payloads. Lifecycle rules enforce retention                                                                                                                                                                                                     |
| Scheduling                             | DO alarms for scheduled sends. Cron Triggers for sweeps, DNS health checks and retention purges. **Workflows** for campaigns and automations                                                                                                                                         |
| Analytics                              | D1 rollup tables for cohort metrics. **Workers Analytics Engine** for stage latencies and throughput (p50/p95/p99)                                                                                                                                                                   |
| Telemetry                              | Workers Observability with OTel export. Only a safe attribute subset (no bodies, tokens or addresses)                                                                                                                                                                                |
| Secrets/KMS                            | Workers Secrets. Webhook secrets and BYO external IDs are envelope-encrypted in D1 with a WebCrypto AES-GCM key from secrets                                                                                                                                                         |
| Auth                                   | **Better Auth** on D1 (Drizzle adapter), using the `organization` plugin (members, invitations, teams) and the access-control plugin with spec roles: Owner, Admin, Developer, Marketer, Analyst, Billing. `twoFactor` and `passkey` are included. The `sso` plugin comes in Phase 4 |
| API keys                               | Our own `api_key` table: `dak_live_…`/`dak_test_…` keys, SHA-256 hashed at rest, scoped to project×environment with permission scopes. The key check is on the hot path, so it is kept out of the session machinery                                                                  |

## Phase 1 — Transactional foundation (stack `dak/01` → `dak/22`)

1. **workspace-scaffold**: create the 5 packages above, plus `wrangler.jsonc` (D1, Queues, R2, DO, AE bindings, with `dev` and `prod` envs), turbo tasks (`deploy`, `db:migrate`), and a `.github/workflows/ci.yml`. `apps/dak` reuses the `apps/web` setup: `main.css` (`@import '@khata/ui/theme.css'` + `@source`) and the `fonts.css` import. Add Vue Router and `@tanstack/vue-query`.
2. **ui-app-shell** (`packages/ui`): `KAppShell`, `KSidebar`/`KSidebarItem`, `KTopbar`, `KBreadcrumbs`, `KTabs`, `KTooltip` and `KToast`/`useToast`, each with stories and tests.
3. **ui-data-display** (`packages/ui`): `KDataTable` (sorting, cursor pagination, row link), `KEmptyState`, `KCodeBlock`, `KCopyField`, `KTimeline`, `KStatusPill`, `KKeyValue` and `KDateRangePicker`.
4. **db-schema**: Drizzle schema for the §14 entities needed in Phase 1, with indexes. A `scoped(db, tenant)` repository layer makes the tenant scope a required argument, and a lint rule bans raw `db` use outside the repository layer. Includes the ID scheme (`em_…` ULIDs; provider IDs stored only as secondary references).
5. **auth**: Better Auth mounted at `/auth/*`. Org = spec Organization. Workspaces are Better Auth teams, with Project and Environment as our own tables. Adds sign-in, sign-up, invitation and 2FA screens in `apps/dak` built from `@khata/ui` forms. Auth emails are sent through platform SES directly at first, with no dependency on Dak itself.
6. **tenancy-rbac**: CRUD for workspaces, projects and environments. A permission middleware covers the role matrix and the separate `email_body:read` permission. `AuditEvent` writes. Team & Settings UI. Time-limited support access grants, audited and disclosed.
7. **aws-cdk**: `infra/dak-aws` stacks. Platform: SES config sets per stream, an SNS topic with an HTTPS subscription, and a least-privilege broker principal (permissions only to `sts:AssumeRole` and to send through the platform account's SES). BYO: a published CloudFormation template for the customer's role, with an ExternalId, minimal SES and config-set permissions, and SNS → Dak. Tested with CDK `Template` assertions.
8. **aws-connections**: the `AWSConnection` model, platform or BYO, chosen per project. STS assume-role with cached credentials. A health check covers account, region, production access (`GetAccount`), quota and a permission probe. The guided wizard UI is gated by readiness, and there is **no fallback** from BYO to the platform account. Disconnect stops new sends, reconciles in-flight work, then revokes.
9. **domains**: SES v2 `CreateEmailIdentity` (Easy DKIM), custom MAIL FROM, a DMARC guide and a tracking-domain stub. DNS is checked over DoH (1.1.1.1). The SPF rule merges into an existing record instead of adding a second one. Verification is polled, a cron runs DNS health checks, and a Domain wizard UI shows copyable records. Includes Senders.
10. **api-keys**: issue, list, revoke and roll keys with scopes and an environment binding. Bearer middleware. API Keys page with the key shown once.
11. **send-accept**: `POST /v1/emails` and `/v1/emails/batch`, where batch returns explicit partial-failure results. Validation covers identity ownership, size, recipients, variables, permissions and suppression pre-checks. `SendGate` DO handles the idempotency key (24 h; a changed payload returns 409), quota reservation and rate limits. A D1 batch persists the outbox. Returns `202 {id}`. Supports `expires_at`, `scheduled_at`, streams, tags, metadata and W3C `traceparent` capture.
12. **dispatch**: per-stream queue consumers. A MIME builder covers CC/BCC isolation, attachments, inline images and headers. Each message is checked against suppression, expiry and cancellation immediately before submission. An SES call with an unknown outcome (timeout or 5xx after the request was sent) becomes `submission_uncertain`, with no blind retry. Also: DO-alarm scheduled sends, cancellation, an outbox sweeper, explicit resend linked to the original, and SES throttle handling with backoff.
13. **event-ingest**: SNS signature verification and subscription confirmation. Raw events go to R2, then a normalizer turns them into `EmailEvent`. A `dak-core` status state machine keeps engagement separate from delivery: the latest provider timestamp wins, events dedupe on event ID, and a click can never overwrite a bounce. Uncertain submissions are reconciled. Hard bounces and complaints are suppressed immediately. Soft-bounce policy is configurable.
14. **test-sink**: sandbox environments route to a sink that writes rendered mail to R2 and simulates delivered, bounce, complaint and delay events. It consumes no production quota and bills nothing. An e2e helper uses the SES mailbox simulator.
15. **templates-core**: in `dak-core`, LiquidJS in a restricted profile (whitelisted tags and filters, `strictVariables`, `outputEscape: 'escape'`, no includes or file system). A typed variable schema covers required fields, defaults and examples. Versions move through draft → publish (immutable) → archive, with rollback, and queued sends pin the version plus the rendered payload. Adds a code editor (CodeMirror 6), a sandboxed `iframe srcdoc` preview with desktop and mobile views, plain-text generation, checks (missing variables, alt text, unsafe links, basic accessibility), test sends, and OTP/token redaction in stored previews.
16. **templates-visual-basic**: a block JSON model and a block-to-table-HTML renderer in `dak-core`. Blocks: text, image, button, divider, columns, spacer, header and footer. Adds a basic visual editor built from `@khata/ui`, brand presets and the starter templates. Importing HTML into blocks is one-way, with a warning shown before conversion.
17. **webhooks**: endpoints, an event catalog and schema versions. Signing follows the Standard Webhooks scheme (HMAC, timestamp, replay window) and supports secret rotation. Delivery runs through the `dak-webhooks` queue with backoff, a DLQ, delivery logs and manual replay; replay never re-sends email. Webhooks UI.
18. **emails-apm**: Emails list with filters and search (by email ID, provider ID, reference, and recipient lookup for authorized users). Each email gets a timeline of every pipeline stage, from acceptance to webhook delivery, with redacted errors and the SMTP response. Stage latencies are written to Analytics Engine, and a Monitoring page shows throughput, p50/p95/p99, queue age and throttles.
19. **analytics-core**: send-time cohort rollups that late events update, using the §9 metric definitions. Pending outcomes are shown explicitly. Overview and Analytics pages use the `@khata/ui` charts, with CSV export and `GET /v1/analytics`.
20. **sdk**: `@khata/dak` built from the OpenAPI spec. Covers emails, batch, idempotency helpers, a webhook signature verifier, and typed errors. Also a docs page in `apps/dak`.
21. **billing-usage**: an immutable `UsageEntry` ledger. One billable unit is one recipient accepted by SES, deduplicated per recipient submission, with correction entries and uncertain submissions reconciled before charging. Stripe handles subscriptions and overage, and DO-enforced hard caps and spend alerts apply. Usage & Billing UI. BYO projects do not count AWS cost.
22. **phase-1-gate**: first-run onboarding flow (§12), retention purge crons (7 d bodies, 30 d metadata), zero-body-retention mode and a logging redaction pass. Adds the **acceptance suite**: scenarios 1–4 and 6–10 from §18 as Worker integration tests, plus a tenant-isolation fuzz test over every route. Scenario 5 (unsubscribe) is Phase 2.

## Phase 2 — Team & campaign suite (stack `dak2/NN`, based on the merged Phase 1)

1. Full visual editor: drag and drop, social and reusable brand blocks, locale variants with fallback.
2. Asset library: R2, project-scoped, with public delivery through a signed Worker route and SSRF-safe remote fetch.
3. Contacts: custom fields, tags, lists, CSV import/export with dedupe, and deletion/export workflows that keep the minimal suppression record.
4. Topics, consent records and per-topic subscriptions. Unsubscribe is signed and login-free, with RFC 8058 one-click (`List-Unsubscribe-Post`) and a preference center.
5. Segments: builder, audience estimate, snapshot at scheduling time.
6. Broadcasts on **Workflows**: scheduling with timezones, throttling, pause/cancel, one CampaignRecipient per recipient, and eligibility re-checked before each send.
7. Approvals and campaign reports. Advanced reports: template/version, recipient-provider breakdowns, raw versus filtered engagement.
8. Alerts: cron rule evaluation, notification via email or webhook, a service status and incident history page, and admin tenant pause.
9. SMTP relay on ECS Fargate (`infra/dak-aws`), posting to `/v1/emails`.
10. Phase-2 gate: scenario 5, campaign pause, transactional capacity protection under load, and metrics checked against replayed event fixtures.

## Phase 3 — Advanced platform (stack `dak3/NN`)

1. Automations on Workflows: triggers, delays (`step.sleep`), conditions, frequency caps, version pinning for running enrollments, and loop and duplicate-enrollment guards.
2. Inbound: SES receiving → S3 → SNS → Worker → R2. Includes MIME parsing (`postal-mime`), malware and spam verdicts, size limits, the `inbound.received` webhook, reply correlation and forwarding rules.
3. Additional SDKs (Python, Go) generated from the OpenAPI spec.
4. Conversion events (idempotent, with an attribution window).
5. OTel trace export to customer backends.
6. Phase-3 gate tests.

## Phase 4 — Enterprise (stack `dak4/NN`)

1. Better Auth `sso` (SAML/OIDC) and SCIM, plus custom roles.
2. Custom retention per organization.
3. Dedicated IP pools and warm-up throttle policies, plus Virtual Deliverability Manager (VDM).
4. Dedicated infrastructure: a separate SES account per tenant, plus per-tenant D1 (see D1).
5. Regional recovery: pre-verified identities in a second region and a documented RPO/RTO with restore drills.
6. Gate: published isolation and recovery model.

## Decisions locked with the user (5 Nov 2026)

- **Branches:** pushing `dak/*` stacked branches and opening the PRs is approved.
- **D6:** workspaces are Better Auth **teams**, with a `workspace_settings` side table.
- **D5:** templates use **restricted LiquidJS**.
- **D2/D3:** a scoped broker **access key** in Workers secrets for now, with IAM Roles Anywhere before GA. The **SMTP relay runs on ECS Fargate**, defined in `infra/dak-aws`.

## Open decisions — to finalize together (these could change the plan)

- **D1 — D1 scale.** D1 is SQLite with a 10 GB cap per database and a single writer. The plan is a control-plane DB plus a separate `dak-events` DB for high-volume Email, Recipient and Event rows, with aggregates in rollups and Analytics Engine. The repository layer takes a shard key (workspace) so that per-tenant DBs can come later. To confirm: expected sends per day at launch, and whether event search beyond 30 days is needed.
- **D4 — Inbound path.** SES receiving works for any domain but only in a few regions. Cloudflare Email Workers require the domain's DNS to be on Cloudflare. Recommendation: SES, with Email Workers as an option for domains on Cloudflare.
- **D7 — First SES region, launch throughput tiers, attachment and recipient limits, pricing** (spec §20). These set the defaults in PRs 11, 12 and 21. Placeholders stay in config until then.
- **D8 — Webhook signature scheme.** Standard Webhooks is proposed; a custom `Dak-Signature` header is the alternative.

## Verification

- Every PR: `pnpm lint && pnpm format:check && pnpm typecheck && pnpm test && pnpm build`.
- UI PRs: Storybook stories, a11y addon clean. Run `apps/dak` with `pnpm dev`, take Playwright screenshots of new screens, and compare them visually with `apps/web` to confirm the same theme.
- API PRs: `wrangler dev` with local D1, Queues and R2. Integration tests in `vitest-pool-workers`. SES is mocked with a fetch interceptor in unit tests and hits the real SES mailbox simulator in a nightly e2e against the dev AWS account.
- CDK PRs: `cdk synth` and assertion tests.
- Phase gates: the acceptance suite in PR 22 (and later gates) must pass before the next stack starts.
