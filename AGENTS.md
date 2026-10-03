# khata: source-available frontend

Read `workspace-status.json` for implemented versus scaffolded work. Active packages
are design-tokens, ui, and Storybook; client, extension, and api-client are scaffolds.
The repository is PolyForm Perimeter licensed. Packages remain private until explicit
package-distribution work is authorized. Builds must not require khata-core access.

## Engineering

Prefer small reusable modules; remove unused code. Comments explain stable reasons.
Use strict TypeScript. Runtime-validate HTTP responses; do not trust types as validation.
Use synthetic data only in public stories, tests, fixtures, and documentation. Keep
server logic, internal schemas, credentials, and production evidence in private core.

Money is integer minor units within the safe-integer range until display. Use `Amount`
and `formatAmount` from `@khata-club/ui`. `exactMajor` is authoritative for formatted
machine values; deprecated `major` is approximate and must never drive arithmetic.

## Design system

- Tokens flow primitives → semantics → base. Raw design values belong in primitives.
  Semantic colors use `light-dark()` or aliases and are exported in `@theme inline`.
- UI consumes semantic tokens only. No primitive colors, arbitrary literal utilities,
  component font overrides, or component reduced-motion rules. Quicksand is the font.
- Spacing follows the 4px grid. Border/focus widths, typography, approved SVG artwork
  coordinates, percentages, and accessibility dimensions are documented exceptions.
- WCAG 2.2 AA is the baseline. Default controls use at least 44px targets, the stronger
  WCAG 2.5.5 AAA policy. Small density variants are explicit, never the default.
- Compose `focus-ring`; use Radix for keyboard/focus contracts. Enabled click targets
  have pointer cursors. Icon-only controls need meaningful accessible names.
- Every new foreground is checked or has a written exemption in `src/contrast.ts`.
  Exempt inactive-text tokens may not label active content. Extend tailwind-merge for
  custom scales so `className` remains overridable.
- Components ship with colocated stories. Stories cover keyboard, labels, native form
  behavior, state, and both themes. Pure logic also needs unit tests. Storybook owns
  configuration/documentation only; shared previews read the shipped CSS and registry.
- `FormField.controlId` owns the control ID. Disabled `asChild` behavior belongs to
  the child; the Button API deliberately does not promise disabled links.

## Checks and review

Run `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build` before finishing.
Browser tests run Chromium, Firefox, and WebKit in both themes, plus accessibility
scenarios. Install browsers with `pnpm --filter @khata-club/storybook exec playwright
install --with-deps`. Packaged consumption is checked with `pnpm test:package`.
Do not bypass a failing gate; report environmental blockers accurately.

Visual changes need human review of both themes and responsive states. Axe does not
replace screen-reader, reading-order, zoom/reflow, or visual review. Money, authorization,
and contract changes require explicit review evidence. See SECURITY.md for disclosure.
