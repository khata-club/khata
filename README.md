# Khata.club

pnpm + Turborepo monorepo.

| Path          | Package        | Description                                                                                                                     |
| ------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `apps/web`    | `@khata/web`   | Vue 3 + Vite application                                                                                                        |
| `apps/money`  | `@khata/money` | Personal finance app: Vue SPA + Hono Worker on Cloudflare D1, Better Auth (Google), GA4. See [its README](apps/money/README.md) |
| `packages/ui` | `@khata/ui`    | Vue 3 component library, with Storybook                                                                                         |

Requires Node `^22.18 || >=24.12` and pnpm (via `corepack enable`).

```bash
pnpm install
pnpm dev          # web app at http://localhost:5173
pnpm storybook    # Storybook at http://localhost:6006
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
