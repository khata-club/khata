# Product specification: AWS-powered email platform
Version 1.0 • 5 November 2026 • Proposed scope

## 1. Product definition
A developer-first email platform that makes AWS SES accessible through a simple API, SMTP relay, visual dashboard, reusable templates, delivery analytics, and email-specific application performance monitoring (APM).

Promise: “Send, design, and troubleshoot every email from one place.”

Target customers: SaaS teams sending transactional emails; agencies managing multiple clients and domains; product and marketing teams sending opted-in campaigns; businesses that want a polished interface over their own AWS infrastructure.

The full suite includes transactional sending, templates, contacts, broadcasts, automations, inbound email, analytics, deliverability tools, observability, billing, and team administration. Phase boundaries below define what actually ships first.

APM here means application performance monitoring for the email pipeline. If AMP for Email was intended, that is a separate advanced capability requiring its own compatibility and sender-registration scope.

## 2. Product principles
- One email ID connects the API request, rendered content, provider attempt, delivery events, and webhook history.
- Multiple sending domains per workspace and project are first-class.
- Transactional and marketing traffic have independent queues, quotas, reputation policies, and subscription rules.
- Customers can see exactly which stage failed and what action is available.
- Email content and recipient data are private by default.
- Reliability takes priority over engagement features.

## 3. Account and infrastructure model
Both modes are first-class product options. Infrastructure ownership must not determine access to templates, APM, analytics, contacts, or team features; plan entitlements may still vary.

| Concern | Our AWS | Customer’s AWS |
| --- | --- | --- |
| Onboarding | Domain verification and platform approval | Connect IAM role, choose region, verify domains, validate production access and permissions |
| AWS bill | Paid by us and incorporated into customer pricing | Paid directly by customer |
| SES quotas and approval | We request and operate them | Customer owns approval; platform guides and monitors |
| Reputation incidents | We operate controls and remediation | Customer retains account responsibility; platform can pause its own dispatch and guide remediation |
| Data location | Application data follows our declared hosting policy | SES lives in customer account; platform metadata/content may still live in our infrastructure |
| Disconnect | Disable sending and revoke project keys | Stop new sends, reconcile accepted work, then revoke role; explain that already submitted mail cannot be recalled |
| Support | End-to-end platform support | Platform support plus AWS/account issues requiring customer authorization |

BYO AWS is not self-hosting. The application remains hosted by us unless a separate self-hosted deployment product is commissioned. No silent fallback from customer AWS to ours: it changes billing, identity, reputation, and data location.
Hierarchy: organization → workspace → project → environment. Projects contain domains, API keys, templates, email streams, and webhooks. Environments have separate keys, routing, quotas, and data visibility.

| Mode | Customer experience | Responsibility |
| --- | --- | --- |
| Platform-owned AWS | Verify a domain, obtain an API key, send | Platform operates SES, quotas, monitoring, abuse response, and billing |
| Customer-owned AWS | Connect a supported account and region with a guided IAM role setup | Customer pays AWS; platform handles application features and monitors connection health |

Use temporary cross-account role credentials with an external ID for BYO AWS. Do not require root credentials or stored long-lived access keys. Display account, region, production access, quota, and permission health before enabling sending.

Within managed AWS, use SES tenant controls where supported, plus application-level access controls, quotas, queue fairness, and isolation. Tenant controls do not remove shared account, quota, or reputation risks. Higher-risk or enterprise customers may require separate AWS accounts or dedicated infrastructure.

## 4. Roles and permissions
Owner manages billing, deletion, and ownership. Admin manages teams, domains, and infrastructure. Developer manages keys, APIs, templates, logs, and webhooks. Marketer manages contacts, content, and campaigns. Analyst has scoped read access. Billing has financial access only.

Email-body access is a distinct permission. Support access is time-limited, audited, and disclosed. Enterprise scope adds custom roles, SSO, SCIM, and campaign approval workflows.

## 5. Core sending
Channels: REST API and TypeScript SDK at launch; SMTP relay and additional SDKs later.

Requirements:
- Send raw HTML and plain text, or a published template with variables.
- Support From, Reply-To, To, CC, BCC, attachments, inline images, custom headers, tags, and metadata.
- Separate product streams: authentication, transactional, notifications, and marketing.
- Immediate, scheduled, batch, and bulk sends, with explicit batch partial-failure results.
- Per-stream priority and per-tenant rate limits; authentication traffic must retain capacity during campaigns.
- Explicit expiry for time-sensitive messages such as OTPs.
- Cancellation for queued/scheduled work; cancellation after provider handoff is unavailable.
- A resend is an explicit new send linked to its original, with renewed suppression checks.
- Validate identity ownership, size, recipients, variables, permissions, quota, and suppression before dispatch.
- Never expose BCC recipients to other recipients or across tenants.

API contract: POST /v1/emails returns HTTP 202 and a platform email ID only after durable acceptance. This does not mean SES accepted the email or that it was delivered.

Support Idempotency-Key scoped to project and environment, with a proposed 24-hour retention window. Same key and same payload return the original result; a changed payload produces a conflict. Reserve quota and create the idempotency record atomically.

If a provider request times out after possible acceptance, record “submission uncertain.” Reconcile through subsequent events and provider IDs where available; never blindly retry an uncertain send and promise exactly-once delivery. Worker redelivery and webhook delivery are at least once.

For campaigns, create one delivery record per recipient. For transactional To/CC/BCC messages, track outcomes per recipient while preserving intended message semantics.

## 6. Templates and design system
“Normal templates” includes a drag-and-drop visual editor, a code editor for HTML/plain text, and reusable code templates rendered through the SDK.

Editor capabilities:
- Text, image, button, divider, columns, spacer, header, footer, social links, and reusable brand blocks.
- Brand presets for logo, colors, typography, spacing, and sender details.
- Typed variables with required fields, defaults, examples, loops, and safe conditionals.
- Automatic escaping; no arbitrary server-side code in user templates.
- Desktop/mobile previews, sample-data preview, test sends, and plain-text alternatives.
- Accessibility checks, missing-variable checks, image alt-text checks, and unsafe-link checks.
- Draft, review, publish, archive, and rollback; immutable published versions.
- Optional locale variants with explicit fallback rules.
- Asset library with project-scoped access and controlled public delivery.
- Starter templates: OTP, verification, password reset, welcome, invoice, payment failure, invitation, notification, digest, and newsletter.

Visual and code modes can share a rendering model, but arbitrary imported HTML does not need lossless conversion back to blocks. Explain that limitation before conversion.

Queued sends pin a published version and rendered payload. Later edits do not silently change queued messages. Updating an existing campaign requires an explicit action. Avoid retaining OTPs or reset tokens in stored previews or debug logs.

## 7. Domains and deliverability
Provide a guided domain wizard with exact DNS records, copy buttons, verification polling, actionable errors, and readiness states.

Include DKIM, custom MAIL FROM/SPF alignment guidance, DMARC guidance, branded tracking domains, multiple senders, and periodic DNS health checks. Do not generate a second SPF record for a hostname that already has one.

Dashboard covers verified identities, sending region, available quota, throttle events, bounce and complaint trends, suppression activity, and provider health.

Handle hard bounces and complaints with immediate suppression. Use configurable policy for repeated temporary failures. Marketing opt-outs are scoped by topic and workspace; safety suppression takes precedence over subscription preferences. Transactional classification must not bypass hard-bounce or complaint suppression.

Advanced scope: dedicated IP management, warm-up controls, provider-level breakdowns, and SES Virtual Deliverability Manager integration where supported. Warm-up is a throttling policy, not an inbox-placement guarantee.

## 8. Email APM and troubleshooting
Every email exposes an asynchronous trace:
API acceptance → validation → template rendering → queue wait → SES submission → recipient-server outcome → customer webhook delivery.

Show API, rendering, queue, provider-request, event-ingestion, and webhook latency separately. Delivery timing comes from provider events and is distinct from API latency.

Customer dashboard:
- Throughput, p50/p95/p99 stage latency, failure rates, queue age, throttling, and provider errors.
- Filters for project, environment, domain, stream, template version, campaign, provider region, and tag.
- Search by email ID, provider message ID, customer reference, and authorized recipient lookup.
- Timeline with redacted errors, retries, SMTP response, suppression reason, and webhook attempts.
- Correlation with customer traces using W3C trace context and optional OpenTelemetry integration.
- Alerts for delivery failures, queue age, complaint spikes, event lag, quota exhaustion, domain failures, and webhook failures.
- Customer-visible service status and incident history; administrator tools for tenant-level pauses.

Never put full email bodies, tokens, or recipient addresses into unrestricted tracing attributes. Export a safe subset to external APM systems.

## 9. Analytics and measurement
Separate delivery reliability from marketing engagement.

| Metric | Proposed definition |
| --- | --- |
| API accepted | Requests durably accepted by the platform |
| Submitted | Recipient deliveries accepted by SES |
| Delivered | Recipient mail server accepted the message; inbox placement unknown |
| Delivery rate | Delivered recipient records / submitted recipient records in a send cohort |
| Hard-bounce rate | Hard-bounced recipient records / submitted recipient records in the cohort |
| Complaint rate | Reported complaints / delivered recipient records; label separately from AWS reputation metrics |
| Unique open rate | Delivered recipient records with an observed open / delivered recipient records |
| Unique click rate | Delivered recipient records with an observed click / delivered recipient records |
| Conversion rate | Attributed conversion recipients / delivered recipients, with a stated attribution window |
| Cost | Estimated and reconciled costs displayed separately |

Use send-time cohorts, display the reporting window, and allow late events to update past cohorts. Show pending/unknown outcomes rather than treating missing events as success or failure.

Include timeseries, comparison periods, template/version reports, campaign reports, recipient-provider breakdowns, CSV export, and an analytics API. Label opens and clicks as observed signals: image proxies, privacy controls, link scanners, and bots distort engagement. Preserve raw counts and separately label any filtered counts.

Tracking is configurable per project, stream, and message. Disable click rewriting for sensitive authentication links by default. Conversion events are customer-supplied, idempotent, and use a defined attribution model; they are not inferred revenue.

## 10. Contacts, broadcasts, and automations
Contacts: custom fields, tags, lists, topics, consent source/time, CSV import/export, duplicate handling, and deletion/export workflows. Store subscription state per topic; contact deletion must not accidentally erase the minimal suppression needed to prevent prohibited resends.

Broadcasts: segment builder, estimated audience, personalization preview, test sends, scheduling/timezone, throttling, pause/cancel, approval, and recipient-level results. Snapshot the intended segment at scheduling; re-check eligibility, consent, and suppression immediately before every send.

Marketing emails require an unsubscribe footer, preference center, and one-click unsubscribe support. Unsubscribe processing must be public, signed, idempotent, and login-free.

Automations: event triggers, delays, conditions, sequences, entry/exit rules, frequency caps, and per-step analytics. Example: signup → welcome → wait two days → send onboarding if incomplete. Pin workflow versions for running enrollments; prevent loops and duplicate enrollment. Launch simple sequences before a general-purpose visual journey builder.

## 11. Webhooks and inbound email
Outbound webhooks include accepted, submitted, delayed, delivered, bounced, complained, suppressed, expired, cancelled, submission-uncertain, opened, clicked, and unsubscribed events.

Provide stable event IDs, schema version, signed payloads, timestamp/replay protection, secret rotation, retry with backoff, dead-letter storage, delivery logs, and manual replay. Consumers must tolerate duplicates and out-of-order events. Replaying a webhook must never resend an email.

Inbound email, in a later phase: verified receiving domain, raw MIME and attachment storage, parsed content, spam/malware handling, size limits, and an inbound.received webhook. Support reply correlation and forwarding rules. Region support and receiving setup must be validated separately from outbound sending.

Do not position inbound parsing as a complete shared inbox; assignment, agents, and helpdesk workflows are separate product scope.

## 12. Dashboard information architecture
Overview; Emails and individual email timeline; Templates and Assets; Contacts and Topics; Broadcasts; Automations; Analytics; Monitoring and Alerts; Domains; API Keys and Webhooks; Inbound; Usage and Billing; Team and Settings.

First-run flow: create project → choose region/mode → verify domain → create restricted key → send test → inspect timeline → configure webhook → enable production.

Provide a development sink that renders messages and simulates outcomes without delivering to real recipients or consuming production send quota.

## 13. Reference AWS architecture
- API/control plane: API Gateway with Lambda or ECS; choose after workload evaluation.
- Authoritative data: PostgreSQL/RDS for tenancy, permissions, templates, delivery records, and usage ledger.
- Durable dispatch: transactional outbox into SQS; workers submit through SES.
- Assets/raw events/optional message payloads: S3 with encryption and lifecycle policies.
- Event ingestion: SES configuration sets → SNS → SQS → idempotent consumers.
- Analytics: aggregate tables initially; later evaluate ClickHouse or an AWS analytics path based on actual query volume.
- Operational telemetry: OpenTelemetry, CloudWatch, and a selected APM backend.
- Scheduling: database-backed schedules plus workers; evaluate EventBridge Scheduler for appropriate workloads.
- Secrets: Secrets Manager/KMS; isolation policies across all stores and queues.

Never rely on an in-memory queue as the only record of an accepted email. Reserve capacity for high-priority streams and apply per-tenant fairness. Event processing must retain provider timestamps and ingestion timestamps.

Regional failover is a later capability requiring pre-verified identities, quotas, data-residency rules, and duplicate-risk handling. It is not a transparent retry toggle.

## 14. Core entities
Organization, Workspace, Membership, Project, Environment, AWSConnection, Domain, Sender, Stream, APIKey, Template, TemplateVersion, Asset, Email, EmailRecipient, SendAttempt, EmailEvent, Contact, ConsentRecord, Subscription, Suppression, Segment, Campaign, CampaignRecipient, AutomationVersion, Enrollment, WebhookEndpoint, WebhookDelivery, UsageEntry, Invoice, AlertRule, AuditEvent, InboundMessage.

Tenant scope must be mandatory for every lookup and mutation. Provider message IDs are secondary references, not the public primary key. Keep engagement events separate from delivery status: a later click must not overwrite a complaint or bounce.

## 15. Security, privacy, and abuse controls
Scoped and revocable keys; hash platform-issued API keys at rest; encryption in transit and at rest; least-privilege AWS roles; audited administrative actions; attachment/content limits; safe HTML preview sandbox; and SSRF-resistant remote asset handling.

Proposed retention defaults: message bodies and attachments seven days, searchable event metadata 30 days, aggregate analytics 13 months, audit records one year. All are product defaults pending jurisdiction and customer requirements. Provide zero-body-retention mode and redact before logging.

State whether regional selection covers payloads, metadata, backups, analytics, and subprocessors. Do not advertise compliance certification before independent verification.

Managed sending requires account verification, initial limits, abuse detection, gradual limit increases, emergency suspension, and an appeal path. Rate limits and spending limits apply independently at tenant and AWS account levels.

## 16. Billing and business model
Managed: subscription including a recipient-send allowance, then transparent overage. BYO AWS: platform subscription and optional processing usage; AWS costs are separate.

Define one billable send as one recipient accepted by SES. Suppressed, rejected-before-submission, test-sink, and idempotency-replayed requests are not billable sends. A later bounce does not reverse that submission unit. Explicit resends are new units. Reconcile uncertain submissions before charging.

Keep an immutable usage ledger with deduplication by recipient submission, reservation/release logic, and correction entries. Show estimated spend, hard-cap behavior, alerts, retention/storage charges, dedicated infrastructure, and premium support separately.

Candidate packaging: Developer, Team, Business, Enterprise. Set monetary prices only after validating SES, data processing, storage, monitoring, support, and abuse-related costs.

## 17. Proposed service targets
These are engineering targets requiring load tests and operational evidence, not contractual promises.
- API monthly availability: 99.9%.
- API acceptance p95 under 300 ms in the selected region, excluding large attachment upload.
- Immediate high-priority queue wait p95 under two seconds at contracted sustained throughput and available SES quota.
- Event-to-dashboard lag p95 under 30 seconds after event receipt.
- Initial webhook attempt p95 under ten seconds after normalized event persistence.
- No loss of durably accepted work within the declared regional failure model; document backup recovery objectives before general availability.
- No delivery-time or inbox-placement guarantee.

Dashboards must identify provider outages, insufficient quota, scheduled work, and tenant throttles separately from platform latency.

## 18. Delivery phases and acceptance gates
| Phase | Deliverables | Exit criteria |
| --- | --- | --- |
| 1: Transactional foundation | Platform-owned SES and customer-owned SES connections, multiple domains, API/TS SDK, HTML/plain-text and basic visual templates, immutable versions, logs, core delivery analytics, APM stages, suppressions, webhooks, billing, RBAC, test sink | End-to-end sends and bounce/complaint simulation; durable recovery; idempotency; tenant isolation; audited usage reconciliation |
| 2: Team and campaign suite | Full visual editor, reusable assets, contacts/topics, segments, broadcasts, approvals, scheduling, advanced reports, alerts, SMTP | Marketing opt-outs enforced at dispatch; campaign pause works; transactional capacity protected; metrics match replayed event fixtures |
| 3: Advanced platform | Automations, inbound parsing, additional SDKs, conversion analytics, external trace exports | Cross-account permissions verified; workflow versioning and duplicate prevention proven; inbound security gates pass |
| 4: Enterprise scale | SSO/SCIM, custom retention, dedicated infrastructure/IPs, regional recovery, premium support | Published isolation and recovery model; tested restore/failover; contractual targets backed by production evidence |

Critical acceptance scenarios:
1. Same idempotency key creates one platform operation under concurrent requests.
2. Worker restart after provider handoff does not trigger a blind duplicate send.
3. Duplicate and out-of-order provider events do not corrupt status or counters.
4. A complaint immediately blocks later sends according to safety policy.
5. An unsubscribe between scheduling and dispatch prevents marketing delivery.
6. Editing a template does not mutate an already queued send.
7. Replaying a webhook does not resend the original message.
8. One tenant cannot inspect another tenant’s domains, payloads, logs, or contacts.
9. Concurrent reservations cannot exceed an enforced hard usage cap.
10. A failed campaign cannot exhaust capacity reserved for authentication messages.

## 19. Product success measures
Activation: time to verified domain and first real send; onboarding completion.
Adoption: active production projects, recurring template use, retained sending organizations.
Reliability: queue age, submission failures, event completeness, webhook recovery.
Customer value: median time to diagnose a failed email; support tickets per million sends.
Business: paid conversion, retention, gross margin per million recipient submissions, abuse-related cost.

## 20. Recommended positioning and open decisions
Position the product as “AWS email with a complete developer and operations experience.” The differentiators are traceability, trustworthy metrics, multi-domain/team controls, and an optional own-AWS model.

Resolve before implementation: initial customer segment; first AWS region; launch throughput tiers; exact data-retention contracts; managed-account isolation strategy; attachment and recipient limits; approval policies; and pricing.

Ship transactional sending with observability first. Contacts and broadcasts form the next coherent expansion; journeys and inbound follow once the sending/event foundation is dependable.

## Source notes
This document proposes product behavior; it does not claim feature parity with Resend.
- AWS SES tenant management: https://docs.aws.amazon.com/ses/latest/dg/tenants.html
- AWS SES event destinations and event types: https://docs.aws.amazon.com/ses/latest/dg/event-destinations-manage.html
- AWS SES event payloads and delivery semantics: https://docs.aws.amazon.com/ses/latest/dg/event-publishing-retrieving-sns-contents.html
- AWS SES measurement and tracking caveats: https://docs.aws.amazon.com/ses/latest/dg/faqs-metrics.html
- Resend broadcasts as a product reference: https://www.resend.com/features/broadcasts

