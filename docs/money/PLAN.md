# khata money — feature & technical plan

## Context

`origin/develop` holds the `@khata/ui` Calm Kit and the `khata.club` marketing page (`apps/web`). The kit has Vue 3, Tailwind v4, Reka UI, 30 finance charts, `KCreditCard` and the form kit. The local `develop` is still at the license commit, so first step is `git pull origin develop` (fast-forward).

The user wants a new personal-finance app for Indian individuals built on that UI. Constraints:

- Manual entry and CSV only, with no bank or aggregator integrations.
- Cloudflare D1 with Better Auth.
- GA4 events.

The stack follows the conventions in `docs/dak/PLAN.md`: Workers + Hono + D1 + Drizzle + Better Auth, vitest-pool-workers, and green `lint`/`format:check`/`typecheck`/`test`/`build`.

Decisions confirmed with the user:

- v1 = core + Bills/SIPs/EMIs + Goals & net worth + Tax-saving tracker. Udhaar is out.
- Sign-in is **Google only**.
- One Worker in **`apps/money`** (`@khata/money`).
- GA4 behind a **consent banner + Consent Mode v2**.

## Part 1 — Feature plan

India defaults apply everywhere:

- Money is ₹ stored as integer **paise**.
- Amounts display in Indian grouping via `Intl.NumberFormat('en-IN')`, with a compact form (₹1.2L, ₹3.4Cr).
- The **financial year runs Apr–Mar**.
- Dates show as DD MMM YYYY.
- Timezone is Asia/Kolkata.

| Area               | What the user can do                                                                                                                                                                                                                                                                                                                                                               | UI building blocks                                                          |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Onboarding         | Google sign-in. A first-run wizard asks for name, monthly income (optional) and accounts to create. Default categories are seeded                                                                                                                                                                                                                                                  | `KFormProgress`, `KChoiceCards`, `KTextField`                               |
| Accounts           | Bank (savings/current), Cash, UPI wallet, Credit card (limit, statement/due day), Loan. Each has an opening balance and an archive option. Balance = opening + entries                                                                                                                                                                                                             | `KCreditCard`, `KSparklineGrid`, `KDialog`                                  |
| Entries            | Expense / Income / Transfer. Fields: amount, date, account, category, payment mode (UPI, Cash, Debit card, Credit card, Net banking, Cheque), payee, note, and a "tax section" tag (80C/80D/none). Search, filter by month/account/category/mode, edit, delete. Quick-add sheet from the bottom nav                                                                                | `KSearchInput`, `KSelect`, `KSegmentedControl`, `KBottomNav`                |
| Categories         | Seeded Indian set that the user can edit: Groceries & kirana, Rent, Electricity, Mobile & DTH recharge, Fuel, Domestic help, School/tuition fees, Medical, Insurance premium, EMI, Dining & Swiggy/Zomato, Shopping, Travel, Festivals & gifts, Donations, Investments; plus Salary, Freelance, Interest, Dividend, Rent received, Refund/cashback. Each gets an icon and a colour | `KIcon`, `KBadge`                                                           |
| Budgets            | A monthly limit per category, optionally copied from last month. Progress shows with over/near states                                                                                                                                                                                                                                                                              | `KBudgetBars`, `KProgress`, `KAlert`                                        |
| Bills, SIPs & EMIs | Recurring items, each with amount, frequency (monthly/quarterly/yearly), next due date and linked account/category. A "Due in 7 days" list sits on the dashboard. **Mark paid** creates the entry and advances the due date. Loans store principal, rate and tenure; the EMI and amortization are computed                                                                         | `KNotificationPanel`, `KAmortizationChart`, `KCalendarHeatmap`              |
| Goals              | Name, target, target date and linked account. Contributions are logged, and the app suggests the monthly amount needed                                                                                                                                                                                                                                                             | `KProgressRings`, `KGauge`                                                  |
| Net worth          | Manual holdings: FD, RD, PPF, EPF, NPS, Mutual fund/SIP, Stocks, Gold/SGB, Real estate, Other. Each holds invested amount, current value and an "as-of" date. Net worth = account balances + holdings − card dues − loan outstanding. A monthly snapshot is taken on first visit each month to build the trend                                                                     | `KStackedAreaChart`, `KTreemap`, `KStat`                                    |
| Tax saver          | Per FY: 80C progress toward ₹1,50,000 (tagged entries plus EPF/PPF/ELSS holdings contributions), 80D toward ₹25,000/₹50,000 (self/parents toggle), and NPS 80CCD(1B) toward ₹50,000. Informational only, with a disclaimer                                                                                                                                                         | `KProgress`, `KBanner`                                                      |
| Dashboard          | This month's income, expense and savings rate; spend by category; 6-month income vs expense; upcoming dues; budget health; net worth                                                                                                                                                                                                                                               | `KStat`, `KDonutChart`, `KGroupedColumnChart`, `KSankeyChart`, `KChartCard` |
| Reports            | Month/FY picker: category breakdown, trend, cash-flow sankey, daily spend heatmap                                                                                                                                                                                                                                                                                                  | charts above + `KSegmentedTabs`                                             |
| Import / Export    | CSV export of entries (all or filtered). CSV import with a column-mapping step and a preview of up to 1000 rows; duplicates are detected by date+amount+payee                                                                                                                                                                                                                      | `KErrorSummary`, file input                                                 |
| Settings           | Profile, analytics consent toggle, delete all data / delete account                                                                                                                                                                                                                                                                                                                | `KSwitchCard`, `KAlertDialog`                                               |

Out of scope for v1: udhaar, shared ledgers, bank SMS parsing, email reminders, live market prices, multi-currency.

## Part 2 — Technical plan

### Layout (`apps/money`)

```
apps/money/
  index.html, vite.config.ts (vue + tailwind + @cloudflare/vite-plugin), wrangler.jsonc
  src/            Vue SPA: main.ts, router.ts, pages/*, components/*, composables/*, lib/analytics.ts
  worker/         index.ts (Hono), auth.ts, db/schema.ts, db/auth-schema.ts, routes/*, lib/*
  shared/         zod schemas + types + money/FY/EMI/tax helpers (used by SPA and Worker)
  migrations/     drizzle-kit generated SQL for `wrangler d1 migrations apply`
  test/           worker tests (vitest-pool-workers), unit tests for shared/
```

- **`wrangler.jsonc`** sets `assets` with `not_found_handling: "single-page-application"` and `run_worker_first: ["/api/*"]`, plus a `DB` D1 binding (`khata-money`), `compatibility_flags: ["nodejs_compat"]` and `dev`/`production` envs. Secrets: `BETTER_AUTH_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `BETTER_AUTH_URL`.
- **Front end:** copy the CSS and fonts setup from `apps/web/src/main.ts` and `apps/web/src/assets/main.css`, and the tsconfig split from `apps/web`. Add `vue-router` and `@tanstack/vue-query`. A `fetch` wrapper sends `credentials: 'include'`.
- **Root changes:** README table, `turbo.json` (`deploy`, `db:migrate` tasks), `.gitignore` (`.wrangler`, `.dev.vars`), and the ESLint ignore for `worker-configuration.d.ts`.

### Data (Drizzle, SQLite/D1)

- Better Auth tables (`user`, `session`, `account`, `verification`) are generated with `@better-auth/cli generate` into `worker/db/auth-schema.ts`.
- App tables each carry `user_id` (FK, cascade delete), `created_at` and `updated_at`. IDs are ULID text.
  - `accounts` (type, name, institution, opening_balance_paise, credit_limit_paise, statement_day, due_day, archived)
  - `categories` (kind expense/income, name, icon, color, is_default)
  - `transactions` (type, amount_paise, occurred_on, account_id, to_account_id, category_id, payment_mode, payee, note, tax_section, recurring_id). Indexes on (user_id, occurred_on) and (user_id, category_id)
  - `budgets` (month `YYYY-MM`, category_id, limit_paise; unique per user/month/category)
  - `recurring` (kind bill/sip/emi, name, amount_paise, frequency, next_due_on, account_id, category_id, loan_principal_paise, loan_rate_bps, loan_tenure_months, active)
  - `goals` and `goal_contributions`
  - `holdings` (kind, name, invested_paise, current_paise, as_of, tax_section)
  - `networth_snapshots` (month, assets_paise, liabilities_paise)
  - `user_prefs` (onboarded, analytics_consent, tax_parent_senior)
- **Tenant safety:** every route uses a `repo(db, userId)` helper (`worker/lib/repo.ts`) that always applies `eq(table.userId, userId)`. Route handlers never use raw `db`.
- Multi-row writes (mark-paid, import, onboarding seed) use `db.batch()` so they are atomic.

### Auth (Better Auth on D1)

- `worker/auth.ts` exports `createAuth(env)`, built per request because D1 bindings live on `env`. It uses `drizzleAdapter(drizzle(env.DB), { provider: 'sqlite', schema })`, `socialProviders.google`, `session.cookieCache` and `trustedOrigins`.
- Mounted with `app.on(['GET','POST'], '/api/auth/*', c => createAuth(c.env).handler(c.req.raw))`.
- A Hono middleware `requireUser` calls `auth.api.getSession({ headers })` for `/api/*` and sets `c.var.user`.
- The `databaseHooks.user.create.after` hook seeds the default categories and `user_prefs`.
- The client uses `better-auth/vue` `createAuthClient()` with `signIn.social({ provider: 'google', callbackURL: '/app' })`. A router guard sends signed-out users to `/login`.

### API (Hono, zod-validated via `@hono/zod-validator`, schemas in `shared/`)

- `/api/me`, `/api/prefs`
- `/api/accounts` CRUD, which returns computed balances
- `/api/categories` CRUD
- `/api/transactions` (filters plus cursor pagination; CRUD)
- `/api/budgets?month=` (PUT upsert; POST `/copy`)
- `/api/recurring` CRUD and `POST /:id/pay`
- `/api/goals` CRUD and `POST /:id/contributions`
- `/api/holdings` CRUD
- `/api/reports/summary?month=`, `/api/reports/trend?months=6`, `/api/reports/networth`, `/api/reports/tax?fy=2026-27`
- `/api/export.csv`, `POST /api/import` (JSON rows after client-side CSV parse with `papaparse`)
- `DELETE /api/me/data`

Aggregations run as SQL `SUM … GROUP BY`. The pure math lives in `shared/`: EMI formula, amortization, FY bounds, tax limits and the goal monthly need.

### GA4 (`src/lib/analytics.ts`)

- `gtag.js` loads only when `VITE_GA_MEASUREMENT_ID` is set. The Consent Mode v2 default is `denied` for analytics/ad storage. `ad_storage`, `ad_user_data` and `ad_personalization` always stay denied.
- The banner (built from `KBanner`) calls `gtag('consent','update',{analytics_storage:'granted'})`. The choice persists in `localStorage` and `user_prefs.analytics_consent`, and the Settings toggle mirrors it.
- `send_page_view: false`. A router `afterEach` sends `page_view` with the route name; the path never carries IDs.
- A typed `track<E extends keyof Events>(name, params)` sends events. Its map:
  - `login` / `sign_up` {method:'google'} and `logout`
  - `onboarding_step` {step} and `onboarding_complete`
  - `account_create` {account_type}
  - `transaction_add` {txn_type, category, payment_mode, source:'quick_add'|'form'|'recurring'}, `transaction_edit`, `transaction_delete`
  - `budget_set` {category}, `budget_copy`
  - `recurring_create` {kind}, `recurring_mark_paid` {kind}
  - `goal_create`, `goal_contribute`
  - `holding_add` {kind}
  - `tax_view` {fy}, `report_view` {report}
  - `export_csv` {rows_bucket}, `import_csv_start`, `import_csv_complete` {rows_bucket, duplicates_skipped}
  - `consent_update` {granted}, `data_delete`
- **No PII and no amounts are sent.** Counts are bucketed (1–10, 11–100, …). `user_id` is never set.
- In dev, events log to the console when the ID is missing.

### Implementation order (commits on `develop`)

1. Fast-forward `develop`; scaffold `apps/money` (Vite + Cloudflare plugin, wrangler, Tailwind/kit wiring, router, layout shell with `KBottomNav` and a desktop sidebar).
2. Drizzle schema, Better Auth, migrations, `requireUser`, login page, onboarding.
3. `shared/` helpers with unit tests (money format, FY, EMI, tax).
4. Accounts, categories, transactions (API + pages + quick-add).
5. Budgets, dashboard and reports.
6. Recurring bills/SIPs/EMIs.
7. Goals, holdings, net worth and the tax saver.
8. CSV import/export and settings.
9. GA4 layer + consent banner + event calls wired across the steps above (the module lands early in step 1, and events are added as features land).
10. Root README and turbo scripts; `apps/money/README.md` with setup steps: `wrangler d1 create`, secrets, Google OAuth redirect URI `…/api/auth/callback/google`, GA ID.

## Verification

- `pnpm lint && pnpm format:check && pnpm typecheck && pnpm test && pnpm build` all pass at the root.
- Worker tests (`@cloudflare/vitest-pool-workers`, Miniflare D1 with migrations applied):
  - Every route returns 401 without a session.
  - Tenant isolation: user A cannot read or update user B's rows.
  - Balance, budget, summary and tax aggregation are correct.
  - Mark-paid advances the due date atomically.
  - Import dedupe works.
  - Sessions are created in tests through Better Auth's test utilities or by inserting a session row.
- Unit tests in `shared/`: lakh/crore formatting, FY boundaries (31 Mar / 1 Apr), EMI against a known value (₹10L at 9% for 240 months ≈ ₹8,997), and 80C capping.
- Manual run: `pnpm --filter @khata/money dev` with local D1 (`wrangler d1 migrations apply --local`).
  - Google OAuth needs real client secrets in `.dev.vars`. Without them, a dev-only seeded session path (`/api/dev/login`, enabled only when `ENVIRONMENT=dev`) lets Playwright run through screens.
  - Playwright screenshots of the dashboard, entries, budgets, bills, net worth and tax pages at phone and desktop widths.
  - Check that GA `gtag` calls only fire after consent, using `window.dataLayer` inspection.
- Commit and push to `origin develop`.
