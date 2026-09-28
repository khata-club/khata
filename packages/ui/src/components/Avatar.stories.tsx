import type { Meta, StoryObj } from "@storybook/react-vite";

import { Avatar, AvatarFallback, AvatarImage } from "./Avatar";

const meta = {
  title: "Primitives/Avatar",
  component: Avatar,
  parameters: {
    docs: {
      description: {
        component: [
          "A user or issuer image with a text fallback.",
          "",
          "Radix handles the part that is tedious by hand: the fallback renders only",
          "after the image has actually failed or is still loading, so there is no",
          "flash of initials on a fast connection and no empty circle on a slow one.",
        ].join("\n"),
      },
    },
  },
  argTypes: { size: { control: "select", options: ["sm", "default", "lg"] } },
} satisfies Meta<typeof Avatar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Fallback: Story = {
  render: (args) => (
    <Avatar {...args}>
      <AvatarFallback>VF</AvatarFallback>
    </Avatar>
  ),
};

export const Sizes: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <div className="flex items-center gap-3">
      {(["sm", "default", "lg"] as const).map((size) => (
        <Avatar key={size} size={size}>
          <AvatarFallback>VF</AvatarFallback>
        </Avatar>
      ))}
    </div>
  ),
};

/**
 * A broken image source renders the text fallback.
 */
export const BrokenImageFallsBack: Story = {
  render: () => (
    <Avatar>
      <AvatarImage src="/does-not-exist.png" />
      <AvatarFallback>HD</AvatarFallback>
    </Avatar>
  ),
};
