# Verification and review

CI runs formatting/inventory/style checks, strict types, logic and token tests,
Chromium/Firefox/WebKit stories in both themes, a narrow reduced-motion and
forced-colors project, builds, and an isolated package consumer. Gitleaks scans
committed history using a release binary pinned by SHA-256. Dependency and CI
updates are proposed weekly by Dependabot; action references are commit-pinned.

Storybook deployment invokes the same verification workflow and depends on its
success. Chromatic differences require acceptance; fork contributions need human
visual evidence because publication secrets are unavailable to forks. Review
responsive layouts, both themes, zoom/reflow, reading order, keyboard paths, and
screen-reader announcements where relevant. Automated axe checks alone do not
establish conformance. Contributors attach relevant screenshots and check results.

## Hosted enforcement audit

On 2026-10-03, authenticated GitHub API reads for `khata-club/khata` reported
`main` is not protected (404), and its active branch rules were empty. Therefore
passing checks are a review policy, not currently a hosted merge restriction.
A maintainer must configure a main-branch ruleset requiring the verification job,
review approval, resolved conversations, and restricting bypass/force pushes.
Re-audit actual required status names after the workflow has run; do not claim
protection based solely on this workflow file. No hosted settings were changed.

## Public boundary

Only client-required HTTP contracts, synthetic examples, and frontend code are
public. Server implementation, migrations, proprietary rules, internal thresholds,
privileged credentials, and production evidence remain private. Contract updates
must review the allowlisted snapshot and regenerated schema diff explicitly.
Frontend builds never resolve paths in the private repository.
