# Khata.club

pnpm + Turborepo monorepo.

| Path          | Package      | Description                                 |
| ------------- | ------------ | ------------------------------------------- |
| `apps/web`    | `@khata/web` | Vue 3 + Vite application                    |
| `packages/ui` | `@khata/ui`  | Vue 3 component library, with Storybook     |

Requires Node `^22.18 || >=24.12` and pnpm (via `corepack enable`).

```bash
pnpm install
pnpm dev          # web app at http://localhost:5173
pnpm storybook    # Storybook at http://localhost:6006
pnpm build        # production builds
pnpm typecheck
pnpm lint
pnpm format
```

`@khata/ui` is consumed through `workspace:*`. In development Vite resolves it to
source (`development` export condition) for HMR; production builds and type
checking use the built `dist`.
