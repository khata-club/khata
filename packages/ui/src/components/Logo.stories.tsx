import type { Meta, StoryObj } from "@storybook/react-vite";

import { Logo } from "./Logo";

const meta = {
  title: "Content/Logo",
  component: Logo,
  parameters: {
    docs: {
      description: {
        component: [
          "The approved khata.club artwork. Colours come from `content-primary`",
          "and `brand`, so it follows the theme: switch the toolbar to dark to",
          "see the ink lighten.",
        ].join("\n"),
      },
    },
  },
  argTypes: { variant: { control: "select", options: ["wordmark", "mark"] } },
} satisfies Meta<typeof Logo>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Wordmark: Story = {};

export const Mark: Story = { args: { variant: "mark" } };

/** Size is set by height alone; width follows the artwork's aspect ratio. */
export const CustomSize: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <div className="flex items-end gap-6">
      <Logo className="h-8" />
      <Logo variant="mark" className="h-12" />
    </div>
  ),
};
