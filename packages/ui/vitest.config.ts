import { defineConfig } from "vitest/config";

/**
 * Unit tests for the package's pure logic. Class merging, currency
 * formatting run in Node, with no browser.
 *
 * The components themselves are tested where they are documented: each
 * story in `src/**\/*.stories.tsx` runs as a real browser test, driven by
 * `@storybook/addon-vitest` from `apps/storybook`.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
