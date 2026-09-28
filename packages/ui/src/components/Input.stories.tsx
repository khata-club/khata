import type { Meta, StoryObj } from "@storybook/react-vite";
import { LuSearch } from "react-icons/lu";
import { expect, userEvent } from "storybook/test";

import { FormField } from "./FormField";
import { Input } from "./Input";

const meta = {
  title: "Forms/Input",
  component: Input,
  parameters: {
    docs: {
      description: {
        component: [
          "A single-line text field.",
          "",
          "Inside a `FormField` it needs no props to be accessible: the `id`,",
          "`aria-describedby`, `aria-invalid` and `aria-required` all come from",
          "context. See the FormField stories for that pairing.",
          "",
          "The border uses `edge-control`, not `edge`. A white field on a",
          "near-white canvas is 1.07:1 of self-evidence, so the border *is* the",
          "affordance and WCAG 1.4.11's 3:1 applies to it.",
        ].join("\n"),
      },
    },
  },
  args: { placeholder: "you@example.com" },
  argTypes: {
    inputSize: { control: "select", options: ["sm", "default", "lg"] },
    disabled: { control: "boolean" },
    leadingIcon: { table: { disable: true } },
    trailingAddon: { table: { disable: true } },
  },
} satisfies Meta<typeof Input>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Sizes: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <div className="flex max-w-sm flex-col gap-3">
      <Input inputSize="sm" placeholder="Small: 36px" />
      <Input placeholder="Default: 44px" />
      <Input inputSize="lg" placeholder="Large: 48px" />
    </div>
  ),
};

export const WithLeadingIcon: Story = {
  args: {
    placeholder: "Search 1,400 cards",
    leadingIcon: <LuSearch aria-hidden="true" className="size-4" />,
  },
};

export const WithTrailingAddon: Story = {
  args: {
    placeholder: "0",
    inputMode: "decimal",
    trailingAddon: "% cashback",
  },
};

export const Disabled: Story = { args: { disabled: true, value: "Locked" } };

export const Invalid: Story = {
  args: { "aria-invalid": true, defaultValue: "not-an-email" },
  parameters: {
    docs: {
      description: {
        story:
          "Driven by `aria-invalid`, so the visual state and the state announced to a screen reader cannot disagree.",
      },
    },
  },
};

export const TakesInput: Story = {
  name: "Test: accepts typing",
  tags: ["!autodocs"],
  play: async ({ canvas }) => {
    const input = canvas.getByRole("textbox");
    await userEvent.type(input, "victor@khata.club");
    await expect(input).toHaveValue("victor@khata.club");
  },
};

export const InheritsFieldWiring: Story = {
  name: "Test: inherits ids and ARIA from FormField",
  tags: ["!autodocs"],
  render: () => (
    <FormField
      label="Card number"
      description="16 digits, no spaces"
      error="That card number is not valid"
      required
    >
      <Input inputMode="numeric" defaultValue="4111" />
    </FormField>
  ),
  play: async ({ canvas }) => {
    const input = canvas.getByRole("textbox", { name: /Card number/ });

    /* The label is associated, so the accessible name comes from it and not
     * from a placeholder. */
    await expect(input).toHaveAccessibleName(/Card number/);
    await expect(input).toHaveAttribute("aria-invalid", "true");
    await expect(input).toHaveAttribute("aria-required", "true");

    /* Both the error and the description, in that order. Dropping the
     * description once an error appears is the usual bug: the user hears what
     * went wrong but not the format that would fix it. */
    await expect(input).toHaveAccessibleDescription(
      /That card number is not valid[\s\S]*16 digits, no spaces/,
    );
  },
};
