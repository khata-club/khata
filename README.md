# Khata.club

pnpm + Turborepo monorepo.

| Path                | Package           | Description                                            |
| ------------------- | ----------------- | ------------------------------------------------------ |
| `apps/web`          | `@khata/web`      | Vue 3 + Vite application                               |
| `packages/ui`       | `@khata/ui`       | Vue 3 component library, with Storybook                |
| `apps/dak`          | `@khata/dak-app`  | Dak dashboard (Vue 3, `@khata/ui`), served by a Worker |
| `apps/dak-api`      | `@khata/dak-api`  | Dak API: Hono on Cloudflare Workers, D1, Queues, R2    |
| `packages/dak-core` | `@khata/dak-core` | Dak shared schemas and domain logic                    |
| `packages/dak-sdk`  | `@khata/dak`      | Dak TypeScript SDK                                     |
| `infra/dak-aws`     | `@khata/dak-aws`  | Dak AWS infrastructure (CDK): SES, SNS, IAM            |

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

`@khata/ui` is consumed through `workspace:*`. In development Vite resolves it to
source (`development` export condition) for HMR; production builds and type
checking use the built `dist`.

## Calm Kit (`@khata/ui`)

The UI package implements the Calm Kit design system: Tailwind v4 for styling, [Reka UI](https://reka-ui.com)
primitives for interactive behaviour, and Storybook for documentation.

| Import                 | Use                                                                                     |
| ---------------------- | --------------------------------------------------------------------------------------- |
| `@khata/ui`            | Vue components and helpers (`cn`)                                                       |
| `@khata/ui/fonts.css`  | Self-hosted Quicksand + Geist Mono                                                      |
| `@khata/ui/theme.css`  | Tailwind theme (colours, type scale, radii, shadows, motion) for apps that run Tailwind |
| `@khata/ui/styles.css` | Precompiled CSS for apps that do not run Tailwind                                       |

Apps that run Tailwind:

```css
@import 'tailwindcss';
@import '@khata/ui/theme.css';
@source '../node_modules/@khata/ui/src';
```

Two runtime multipliers tune the whole kit: `--motion-scale` (0 disables motion; reduced-motion users
get 0 automatically) and `--depth-scale` (shadow strength). In Storybook they are the **Motion** and
**Depth** toolbar controls.

## Dak

Dak is the khata.club email platform: SES behind an API, dashboard, templates, analytics and
email APM, hosted on Cloudflare. See [`docs/dak/PLAN.md`](docs/dak/PLAN.md) for the architecture
and the stacked-PR delivery plan, and [`docs/dak/product-spec.md`](docs/dak/product-spec.md) for
the product specification.

```bash
pnpm --filter @khata/dak-api db:migrate   # apply D1 migrations locally
pnpm --filter @khata/dak-api types        # regenerate Worker env types after editing wrangler.jsonc
pnpm --filter @khata/dak-aws synth        # synthesize the AWS CDK stacks
```
