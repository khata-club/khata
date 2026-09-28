## What and why

<!-- State the change and its reason. -->

## How it was verified

<!-- Include relevant manual checks such as keyboard use and both themes. -->

- [ ] `pnpm lint`
- [ ] `pnpm typecheck`
- [ ] `pnpm test`
- [ ] `pnpm build`

## Design system

<!-- Delete this section if the change does not touch packages/ui or
     packages/design-tokens. -->

- [ ] Components use semantic tokens (`bg-surface`), not primitives (`bg-neutral-0`)
- [ ] No arbitrary Tailwind values; sizes are multiples of 4
- [ ] New foreground tokens are in `check-contrast.ts`: as a checked pair, or as an exemption with a written reason
- [ ] Stories updated in the same commit, with `play` functions for new behaviour
- [ ] Checked in both light and dark
- [ ] Reachable and operable by keyboard alone

## Anything a reviewer should push back on

<!-- Record shortcuts, deferred work, and uncertain decisions. -->
