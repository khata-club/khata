# Khata.club

pnpm + Turborepo monorepo.

| Path | Package | Description |
| --- | --- | --- |
| `apps/web` | `@khata/web` | Vue 3 + Vite application |
| `packages/ui` | `@khata/ui` | Vue 3 component library, with Storybook |
| `apps/money` | `@khata/money` | Personal finance app with a Vue SPA, a Hono Worker backed by Cloudflare D1, Better Auth (Google), and GA4. See [its README](apps/money/README.md). |
| `apps/kaat` | `@khata/kaat` | Kaat browser-only video editor. All media stays on the device. See the [Kaat plan](docs/kaat/PLAN.md). |
| `packages/kaat-core` | `@khata/kaat-core` | Kaat's editing engine in pure TypeScript, covering the time model, commands, composition, and mixing |
| `apps/dak` | `@khata/dak-app` | Dak dashboard built with Vue 3 and `@khata/ui`, served by a Worker |
| `apps/dak-api` | `@khata/dak-api` | Dak API built with Hono on Cloudflare Workers, using D1, Queues, and R2 |
| `packages/dak-core` | `@khata/dak-core` | Dak shared schemas and domain logic |
| `packages/dak-sdk` | `@khata/dak` | Dak TypeScript SDK |
| `infra/dak-aws` | `@khata/dak-aws` | Dak AWS infrastructure for SES, SNS, and IAM, defined with CDK |

Requires Node `^22.18 || >=24.12` and pnpm (via `corepack enable`).

```bash
pnpm install
pnpm dev          # web app at http://localhost:5173
pnpm storybook    # Storybook at http://localhost:6006
pnpm dev:dak      # Dak dashboard at http://localhost:5174, API at http://localhost:8787
pnpm build        # production builds
pnpm typecheck
pnpm test
pnpm lint
pnpm format
```

Apps depend on `@khata/ui` through `workspace:*`. In development, Vite resolves
the package to source via the `development` export condition for HMR. Production
builds and type checking use the built `dist`.

## Calm Kit (`@khata/ui`)

The UI package implements the Calm Kit design system. It uses Tailwind v4 for
styling, [Reka UI](https://reka-ui.com) primitives for interactive behaviour, and
Storybook for documentation.

| Import | Use |
| --- | --- |
| `@khata/ui` | Vue components and helpers (`cn`) |
| `@khata/ui/fonts.css` | Self-hosted Quicksand + Geist Mono |
| `@khata/ui/theme.css` | Tailwind theme (colours, type scale, radii, shadows, motion) for apps that run Tailwind |
| `@khata/ui/styles.css` | Precompiled CSS for apps without Tailwind |

Apps that run Tailwind use these imports.

```css
@import 'tailwindcss';
@import '@khata/ui/theme.css';
@source '../node_modules/@khata/ui/src';
```

The `--motion-scale` multiplier controls motion across the kit. A value of `0`
disables motion and applies automatically for users who prefer reduced motion.
The `--depth-scale` multiplier controls shadow strength. Storybook exposes these
as the **Motion** and **Depth** toolbar controls.

## Dak

Dak is the khata.club email platform, hosted on Cloudflare. It provides an API
backed by SES, a dashboard, templates, analytics, and email APM. See the
[Dak plan](docs/dak/PLAN.md) for the architecture and stacked-PR delivery plan,
and the [product specification](docs/dak/product-spec.md) for product details.

```bash
pnpm --filter @khata/dak-api db:migrate   # apply D1 migrations locally
pnpm --filter @khata/dak-api types        # regenerate Worker env types after editing wrangler.jsonc
pnpm --filter @khata/dak-aws synth        # synthesize the AWS CDK stacks
```
