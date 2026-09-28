import type { StorybookConfig } from "@storybook/react-vite";
import tailwindcss from "@tailwindcss/vite";

const config: StorybookConfig = {
  stories: [
    /* Hand-written documentation first, so Introduction and Foundations sort
     * above the component pages. */
    "../docs/**/*.mdx",
    "../../../packages/ui/src/**/*.stories.@(ts|tsx)",
  ],

  addons: [
    "@storybook/addon-docs",
    "@storybook/addon-a11y",
    "@storybook/addon-vitest",
    "@chromatic-com/storybook",
    "@storybook/addon-mcp",
  ],

  framework: "@storybook/react-vite",

  /* Serves the favicon and the sidebar wordmark that `manager.ts` points at. */
  staticDirs: ["../public"],

  core: { disableTelemetry: true },

  viteFinal(viteConfig) {
    viteConfig.plugins = [...(viteConfig.plugins ?? []), tailwindcss()];

    if (process.env.STORYBOOK_BASE_PATH) {
      viteConfig.base = process.env.STORYBOOK_BASE_PATH;
    }

    return viteConfig;
  },

  typescript: {
    reactDocgen: "react-docgen",
  },
};

export default config;
