import { addons } from "storybook/manager-api";
import { create } from "storybook/theming";

/* The manager is a separate app from the preview and never loads the token
 * stylesheet, so this theme cannot reference `var(--…)`; it only swaps
 * Storybook's own logo for ours. The path is relative so a
 * STORYBOOK_BASE_PATH deploy still resolves it. */
addons.setConfig({
  theme: create({
    base: "light",
    brandTitle: "khata.club",
    brandUrl: "https://khata.club",
    brandImage: "logo-full.svg",
  }),
});
