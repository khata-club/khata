import { TooltipProvider } from "@khata-club/ui";
import type { Decorator, Preview } from "@storybook/react-vite";
import { useEffect } from "react";
import { create } from "storybook/theming";

import "./preview.css";

/** Apply the theme at the root so portalled content inherits it. */
const withTheme: Decorator = (Story, context) => {
  const theme = context.globals.theme ?? "light";

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = theme;
    return () => {
      delete root.dataset.theme;
    };
  }, [theme]);

  return <Story />;
};

/** One provider for the whole canvas, as an app would mount it. */
const withProviders: Decorator = (Story) => (
  <TooltipProvider>
    <Story />
  </TooltipProvider>
);

const preview: Preview = {
  decorators: [withProviders, withTheme],

  /* Interaction-only stories opt out with `!autodocs`. */
  tags: ["autodocs"],

  initialGlobals: { theme: "light" },

  globalTypes: {
    theme: {
      description: "Design system theme",
      toolbar: {
        title: "Theme",
        icon: "circlehollow",
        items: [
          { value: "light", icon: "sun", title: "Light" },
          { value: "dark", icon: "moon", title: "Dark" },
        ],
        dynamicTitle: true,
      },
    },
  },

  parameters: {
    layout: "centered",

    controls: {
      matchers: { color: /(background|color)$/i, date: /Date$/i },
      expanded: true,
    },

    a11y: {
      /* Make accessibility violations fail browser tests. */
      test: "error",
    },

    /* Backgrounds resolve from the active semantic theme. */
    backgrounds: {
      options: {
        canvas: { name: "Canvas", value: "var(--canvas)" },
        surface: { name: "Surface", value: "var(--surface)" },
        sunken: { name: "Sunken", value: "var(--surface-sunken)" },
        inverse: { name: "Inverse", value: "var(--surface-inverse)" },
      },
    },

    docs: {
      codePanel: true,
      toc: true,
      /* Storybook's docs shell does not inherit canvas typography. */
      theme: create({ base: "light", fontBase: "var(--font-sans)" }),
    },

    options: {
      /* Keep foundations together before component stories. */
      storySort: {
        order: [
          "Introduction",
          "Foundations",
          ["Colour", "Typography", "Spacing", "Radii", "Elevation", "Motion"],
          "Actions",
          "Forms",
          "Content",
          "Data",
          "Overlays",
          "Navigation",
          "Primitives",
          "Contributing",
        ],
      },
    },
  },
};

export default preview;
