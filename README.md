# khata.club

Credit-card intelligence for India, powered by user-submitted and verified data.
This source-available frontend is licensed under [PolyForm Perimeter](LICENSE).
The private API implementation, migrations, and proprietary rules live in khata-core.

`workspace-status.json` is the checked inventory: design-tokens, UI, API client, and
Storybook are active; client and extension are scaffolds. Product apps are deferred.

## Development

Node 24 and pnpm 11 are pinned by `.nvmrc` and `packageManager`.

```sh
pnpm install --frozen-lockfile
pnpm --filter @khata-club/storybook exec playwright install --with-deps chromium firefox webkit
pnpm storybook
```

| Command | Assurance |
| --- | --- |
| `pnpm lint` | Root formatting, inventory, design-system rules, package lint |
| `pnpm typecheck` | Strict types for active packages and stories |
| `pnpm test` | Gate tests, pure logic, token/contrast checks, browser stories |
| `pnpm build` | UI declarations, API client/validators, static Storybook |
| `pnpm test:package` | Isolated tarball consumer, runtime dependencies and stylesheet |
| `pnpm check-secrets` | Reviewed current files, with a checksum-pinned Gitleaks binary |
| `pnpm check-secrets --history` | Committed history, as checked in CI |

Stories run in Chromium, Firefox, and WebKit in both themes. A separate narrow
Chromium project exercises reduced motion and forced colors. WCAG 2.2 AA is the
baseline; default controls use the stronger 44px target policy. Automated checks
complement human accessibility and visual review.

## Consuming the workspace packages

```css
@import "tailwindcss";
@import "@khata-club/ui/styles.css";
```

```tsx
import { Amount, FormField, Input } from "@khata-club/ui";

<FormField label="Annual fee" controlId="annual-fee">
  <Input inputMode="decimal" />
</FormField>;
<Amount value={-129900} signed tone="auto" />;
```

Amounts are safe integers in minor units until display. `formatAmount` accepts an
options object and exposes `exactMajor` for exact machine values. Its deprecated
`major` property is approximate. API builds use a reviewed public OpenAPI snapshot;
they never import private server code. See [API client](packages/api-client/README.md).

Read [AGENTS.md](AGENTS.md), [CONTRIBUTING.md](CONTRIBUTING.md), and
[verification and review](docs/verification.md) before changing shared contracts.
