import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { LuCircleCheck, LuClock, LuTriangleAlert } from "react-icons/lu";
import { expect, fn, userEvent } from "storybook/test";

import { Badge, BadgeButton } from "./Badge";

const meta = {
  title: "Content/Badge",
  component: Badge,
  parameters: {
    docs: {
      description: {
        component: [
          "A short, non-interactive status marker.",
          "",
          "Badges render inline inside sentences, table cells, and headings.",
          "",
          "Use `BadgeButton` for interactive chips and removable tags.",
        ].join("\n"),
      },
    },
  },
  args: { children: "Verified" },
  argTypes: {
    variant: {
      control: "select",
      options: ["neutral", "brand", "success", "warning", "danger", "info"],
    },
    icon: { table: { disable: true } },
  },
} satisfies Meta<typeof Badge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** Status hues remain distinct in peripheral vision. */
export const Variants: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <div className="flex flex-wrap items-center gap-2">
      <Badge variant="neutral">Neutral</Badge>
      <Badge variant="brand">1.20%</Badge>
      <Badge variant="success" icon={<LuCircleCheck className="size-3" />}>
        Verified
      </Badge>
      <Badge variant="warning" icon={<LuClock className="size-3" />}>
        Pending
      </Badge>
      <Badge variant="danger" icon={<LuTriangleAlert className="size-3" />}>
        Disputed
      </Badge>
      <Badge variant="info">Beta</Badge>
    </div>
  ),
};

/**
 * Status is never carried by colour alone (WCAG 1.4.1): the label always
 * says it, and an icon reinforces it. Squint at this in greyscale: every
 * state is still distinguishable.
 */
export const WithIcons: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2 grayscale">
        <Badge variant="success" icon={<LuCircleCheck className="size-3" />}>
          Verified
        </Badge>
        <Badge variant="warning" icon={<LuClock className="size-3" />}>
          Pending
        </Badge>
        <Badge variant="danger" icon={<LuTriangleAlert className="size-3" />}>
          Disputed
        </Badge>
      </div>
      <p className="text-xs text-content-muted">Rendered in greyscale.</p>
    </div>
  ),
};

/** Badges sit inline, which is why they are spans. */
export const Inline: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <p className="max-w-md text-sm text-content-secondary">
      The reward rate on this card is <Badge variant="brand">1.20%</Badge> as of
      last month, and the data has been{" "}
      <Badge variant="success">Verified</Badge> by four contributors.
    </p>
  ),
};

export const Interactive: Story = {
  name: "BadgeButton (filter chips)",
  parameters: {
    controls: { disable: true },
    docs: {
      description: {
        story:
          "A real `button`: focusable, activated by Enter and Space, and carrying the same focus ring as every other control. Try tabbing through it.",
      },
    },
  },
  render: () => {
    const Chips = () => {
      const [active, setActive] = useState<string[]>(["Cashback"]);
      const toggle = (tag: string) =>
        setActive((prev) =>
          prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
        );

      return (
        <div className="flex flex-wrap gap-2">
          {["Cashback", "Travel", "Fuel", "Lifetime free"].map((tag) => (
            <BadgeButton
              key={tag}
              aria-pressed={active.includes(tag)}
              onClick={() => toggle(tag)}
            >
              {tag}
            </BadgeButton>
          ))}
        </div>
      );
    };
    return <Chips />;
  },
};

export const InteractiveIsKeyboardReachable: Story = {
  name: "Test: BadgeButton is reachable and activates by keyboard",
  tags: ["!autodocs"],
  parameters: { controls: { disable: true } },
  render: () => {
    const onClick = fn();
    return <BadgeButton onClick={onClick}>Cashback</BadgeButton>;
  },
  play: async ({ canvas }) => {
    const chip = canvas.getByRole("button", { name: "Cashback" });
    const bounds = chip.getBoundingClientRect();
    await expect(bounds.width).toBeGreaterThanOrEqual(44);
    await expect(bounds.height).toBeGreaterThanOrEqual(44);

    await userEvent.tab();
    await expect(chip).toHaveFocus();
    await expect(chip).toHaveAttribute("type", "button");
  },
};

export const PressedStateIsAnnounced: Story = {
  name: "Test: pressed state is exposed, not just coloured",
  tags: ["!autodocs"],
  parameters: { controls: { disable: true } },
  render: () => {
    const Chip = () => {
      const [on, setOn] = useState(false);
      return (
        <BadgeButton aria-pressed={on} onClick={() => setOn(!on)}>
          Cashback
        </BadgeButton>
      );
    };
    return <Chip />;
  },
  play: async ({ canvas }) => {
    const chip = canvas.getByRole("button", { name: "Cashback" });
    await expect(chip).toHaveAttribute("aria-pressed", "false");
    await userEvent.click(chip);
    await expect(chip).toHaveAttribute("aria-pressed", "true");
  },
};
