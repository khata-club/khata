# khata.club

Credit-card intelligence for India, powered by user-submitted and verified data.

This source-available repository contains the client applications and shared
design system.

## Workspace

```
apps/
  client      Web application
  extension   Browser extension
  storybook   Design-system documentation and browser tests
packages/
  design-tokens  Colour, type, spacing, and motion
  ui             Shared React components
  api-client     Backend API clients
```

## Design system

`packages/design-tokens` owns primitives, semantic roles, themes, and shared
utilities. `packages/ui` consumes semantic tokens only.

Contrast checks validate the token contract in both themes. Every story runs in
a browser with interaction tests and axe.

## Development

Node 24 and pnpm 11 are pinned by `.nvmrc` and `packageManager`.

```bash
pnpm install
pnpm storybook
```

| Command | Purpose |
| --- | --- |
| `pnpm build` | Build active packages and applications |
| `pnpm lint` | Run Biome |
| `pnpm typecheck` | Run TypeScript checks |
| `pnpm test` | Run unit and Storybook browser tests |
| `pnpm check-contrast` | Validate the contrast contract |
| `pnpm format` | Format with Biome |

The first browser-test run needs Chromium:

```bash
pnpm --filter @khata-club/storybook exec playwright install chromium
```

## Using the design system

```css
@import "tailwindcss";
@import "@khata-club/ui/styles.css";
```

```tsx
import { Amount, FormField, Input } from "@khata-club/ui";

<FormField label="Annual fee">
  <Input inputMode="decimal" />
</FormField>;

<Amount value={-129900} signed tone="auto" />;
```

See [CONTRIBUTING.md](./CONTRIBUTING.md) and the Contributing page in
Storybook.

## Licence

Licensed under [PolyForm Perimeter 1.0.0](./LICENSE).
