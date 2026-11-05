# Khata.club

pnpm + Turborepo monorepo.

| Path             | Package        | Description                                    |
| ---------------- | -------------- | ---------------------------------------------- |
| `apps/web`       | `@khata/web`   | Vue 3 + Vite application                       |
| `packages/ui`    | `@khata/ui`    | Vue 3 component library, with Storybook        |
| `packages/glass` | `@khata/glass` | Liquid Glass component library, with Storybook |

Requires Node `^22.18 || >=24.12` and pnpm (via `corepack enable`).

```bash
pnpm install
pnpm dev          # web app at http://localhost:5173
pnpm storybook    # Storybook at http://localhost:6006
pnpm storybook:glass  # Glass Kit Storybook at http://localhost:6007
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

## Glass Kit (`@khata/glass`)

A second kit that re-creates the Calm Kit surface in Apple's Liquid Glass language, on the same
stack: Tailwind v4, [Reka UI](https://reka-ui.com) and Storybook. Components are `G`-prefixed;
pure helpers (chart scales, colour maths, motion composables) are shared from `@khata/ui`.

| Import                    | Use                                                                  |
| ------------------------- | -------------------------------------------------------------------- |
| `@khata/glass`            | Vue components and helpers (`cn`, `useTheme`, `useSlidingIndicator`) |
| `@khata/glass/fonts.css`  | Self-hosted Inter (San Francisco is used where the system has it)    |
| `@khata/glass/theme.css`  | Tailwind theme: colour roles, text styles, radii, springs, glass     |
| `@khata/glass/styles.css` | Precompiled CSS for apps that do not run Tailwind                    |

Principles:

- **Glass is for the control layer** — bars, controls, menus, sheets. Content sits on plain
  `surface` cards. Materials: `glass-thin`, `glass-regular`, `glass-thick`, `glass-tinted`.
- **Light and dark** follow the system; `data-theme="light" | "dark"` pins any subtree.
- **Springs** (`ease-smooth`, `ease-snappy`, `ease-bouncy`) drive motion; `--motion-scale` scales
  every duration and reduced-motion viewers get 0.
- Reduce Transparency, Increase Contrast and browsers without `backdrop-filter` get an opaque
  material automatically.

In Storybook the toolbar has **Theme**, **Backdrop** (plain, wallpaper, busy content) and
**Motion** controls.
