import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { storybookTest } from "@storybook/addon-vitest/vitest-plugin";
import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";

const configDir = join(dirname(fileURLToPath(import.meta.url)), ".storybook");

async function storybookProject(
  name: string,
  theme: "light" | "dark",
  accessible = false,
) {
  return {
    extends: true as const,
    plugins: [
      ...(await storybookTest({
        configDir,
        initialGlobals: {
          theme,
          viewport: {
            value: accessible ? "mobile1" : "desktop",
            isRotated: false,
          },
        },
      })),
      {
        name: "khata-isolated-story-cache",
        enforce: "post" as const,
        // Storybook keys its optimizer cache only by configDir; themes must not race.
        config: () => ({
          cacheDir: join(configDir, "../node_modules/.cache/vitest", name),
        }),
      },
    ],
    test: {
      name,
      browser: {
        enabled: true,
        headless: true,
        provider: playwright(
          accessible
            ? {
                contextOptions: {
                  reducedMotion: "reduce",
                  forcedColors: "active",
                },
              }
            : {},
        ),
        instances: accessible
          ? [{ browser: "chromium" as const }]
          : [
              { browser: "chromium" as const },
              { browser: "firefox" as const },
              { browser: "webkit" as const },
            ],
      },
    },
  };
}

export default defineConfig(async () => ({
  test: {
    projects: [
      await storybookProject("storybook-light", "light"),
      await storybookProject("storybook-dark", "dark"),
      await storybookProject("storybook-accessibility", "light", true),
    ],
  },
}));
