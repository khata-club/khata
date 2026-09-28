import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { storybookTest } from "@storybook/addon-vitest/vitest-plugin";
import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";

const configDir = join(dirname(fileURLToPath(import.meta.url)), ".storybook");

async function storybookProject(name: string, theme: "light" | "dark") {
  return {
    extends: true as const,
    plugins: await storybookTest({
      configDir,
      initialGlobals: { theme },
    }),
    test: {
      name,
      browser: {
        enabled: true,
        headless: true,
        provider: playwright(),
        instances: [{ browser: "chromium" as const }],
      },
    },
  };
}

export default defineConfig(async () => ({
  test: {
    projects: [
      await storybookProject("storybook-light", "light"),
      await storybookProject("storybook-dark", "dark"),
    ],
  },
}));
