import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";

import { Typography } from "./Typography";

const meta = {
  title: "Content/Typography",
  component: Typography,
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component: [
          "Every piece of text in the product.",
          "",
          "Presentation and semantics are separate on purpose: `displayXl` is a",
          "size, not a rank. A card title might want `h3` styling under an `h2`,",
          "and a second section might want display type at `h2`. Each variant has",
          "a sensible default element and `as` overrides it.",
          "",
          "Getting that wrong produces a heading outline that reads as nonsense to",
          "anyone navigating by headings: and is invisible to everyone else.",
        ].join("\n"),
      },
    },
  },
  args: { children: "Verified data for every credit card in India" },
  argTypes: {
    variant: {
      control: "select",
      options: [
        "displayXl",
        "displayLg",
        "displayMd",
        "h1",
        "h2",
        "h3",
        "h4",
        "h5",
        "h6",
        "eyebrow",
        "lead",
        "body",
        "small",
        "caption",
        "label",
        "legal",
      ],
    },
    as: { control: "text" },
  },
} satisfies Meta<typeof Typography>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** The full ramp, with the element each variant renders by default. */
export const Scale: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <div className="flex max-w-3xl flex-col gap-6">
      {(
        [
          ["displayXl", "h1", "Hero headline"],
          ["displayLg", "h2", "Section headline"],
          ["displayMd", "h2", "Subsection headline"],
          ["h1", "h1", "Page title"],
          ["h2", "h2", "Section title"],
          ["h3", "h3", "Card title"],
          ["h4", "h4", "Group title"],
          ["h5", "h5", "Minor heading"],
          ["h6", "h6", "Smallest heading"],
          ["eyebrow", "span", "Verified data"],
          ["lead", "p", "Introductory paragraph, one step up from body."],
          ["body", "p", "Body copy: the default."],
          ["small", "p", "Supporting detail."],
          ["caption", "p", "Caption under a figure."],
          ["label", "span", "Form label"],
          ["legal", "p", "Data is user-submitted and independently verified."],
        ] as const
      ).map(([variant, element, sample]) => (
        <div key={variant} className="flex flex-col gap-1">
          <span className="text-2xs text-content-muted">
            {variant} · &lt;{element}&gt;
          </span>
          <Typography variant={variant}>{sample}</Typography>
        </div>
      ))}
    </div>
  ),
};

/**
 * Display sizes are fluid: they interpolate with the viewport via `clamp()`,
 * so a hero headline does not need a breakpoint per size. Resize the preview
 * to see it.
 */
export const FluidDisplay: Story = {
  args: { variant: "displayXl", children: "Know what your card is worth" },
  parameters: { layout: "padded" },
};

export const VariantPicksItsElement: Story = {
  name: "Test: variant maps to a default element",
  tags: ["!autodocs"],
  args: { variant: "displayLg", children: "Section headline" },
  play: async ({ canvas }) => {
    /* `displayLg` is a size; its default rank is h2. */
    await expect(
      canvas.getByRole("heading", { level: 2, name: "Section headline" }),
    ).toBeVisible();
  },
};

export const AsOverridesTheElement: Story = {
  name: "Test: `as` overrides the element without changing the styling",
  tags: ["!autodocs"],
  args: { variant: "displayXl", as: "h3", children: "Styled big, ranked h3" },
  play: async ({ canvas }) => {
    /* The point of separating presentation from rank: display styling under
     * a heading level that keeps the document outline correct. */
    const heading = canvas.getByRole("heading", { level: 3 });
    await expect(heading).toBeVisible();
    await expect(heading).toHaveClass("text-display-xl");
  },
};
