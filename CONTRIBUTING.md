# Contributing

Thanks for looking. This codebase is source-available keeping it aligned with our philosophy of being transparent. khata.club is a club open to all who are looking for transparent and reliable information to manage their finances. Your contributions are both welcome and needed to keep it running.

## Setup

Node and pnpm versions are pinned (`.nvmrc`, `packageManager`).

```bash
pnpm install
pnpm --filter @khata-club/storybook exec playwright install chromium
pnpm storybook
```

## Before you open a pull request

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

All four run in CI, plus various quality gates. A failed gate will not be merged.

## What the review will look for

**Every line of code has a cost.** Prefer deleting to adding, and reusing to
writing. If something already exists, use it.

**Comments explain why.** It is good to document the option you rejected and the reason. One sentence on a non-obvious decision could be valuable.

**Accessibility.** The axe gate catches some of this; it does not catch bad reading order or a label that is technically present and meaningless.

**Money is exact.** Amounts are integers in minor units i.e. paise, not rupees
Until the moment they are formatted. `0.1 + 0.2 !== 0.3` in code. This is to prevent floating related errors.

## Design system changes

`packages/design-tokens` and `packages/ui` have their own rules, documented in
Storybook under **Contributing**. Please refer those.

## Commits and pull requests

- Conventional commits (`feat:`, `fix:`, `docs:`, `refactor:`, `chore:`), with
  a scope where it helps: `feat(ui): add Combobox`.
- One concern per pull request. A formatting sweep and a behaviour change in
  the same diff means neither gets reviewed properly.
- Say what you decided and why in the description, not just what changed. The
  diff already shows what changed.

## Reporting a security issue

Do not open a public issue. Email **security@khata.club** with what you found
and how to reproduce it.

## Licence

Contributions are accepted under
[PolyForm Perimeter 1.0.0](./LICENSE). Opening a pull request means you accept these terms.
