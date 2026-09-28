import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent } from "storybook/test";

import { Label } from "./Label";
import { Switch } from "./Switch";

const meta = {
  title: "Forms/Switch",
  component: Switch,
  parameters: {
    docs: {
      description: {
        component: [
          "An on/off toggle that takes effect immediately.",
          "",
          "Use a `Checkbox` when a change waits for form submission.",
          "",
          "Unchecked uses `edge-control` to clear WCAG 1.4.11's 3:1 boundary",
          "requirement.",
        ].join("\n"),
      },
    },
  },
  argTypes: { disabled: { control: "boolean" } },
} satisfies Meta<typeof Switch>;

export default meta;
type Story = StoryObj<typeof meta>;

const renderDefault: NonNullable<Story["render"]> = (args) => (
  <div className="flex items-center gap-3">
    <Switch id="sw" {...args} />
    <Label htmlFor="sw">Email me when data changes</Label>
  </div>
);

export const Default: Story = { render: renderDefault };

export const States: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <div className="flex flex-col gap-4">
      {(
        [
          ["off", {}],
          ["on", { defaultChecked: true }],
          ["disabled, off", { disabled: true }],
          ["disabled, on", { disabled: true, defaultChecked: true }],
        ] as const
      ).map(([name, props]) => (
        <div key={name} className="flex items-center gap-3">
          <Switch id={`sw-${name}`} {...props} />
          <Label htmlFor={`sw-${name}`}>{name}</Label>
        </div>
      ))}
    </div>
  ),
};

export const TogglesByKeyboard: Story = {
  name: "Test: Space toggles it",
  tags: ["!autodocs"],
  render: renderDefault,
  play: async ({ canvas }) => {
    const sw = canvas.getByRole("switch");
    await expect(sw).not.toBeChecked();
    const bounds = sw.getBoundingClientRect();
    await expect(bounds.width).toBeGreaterThanOrEqual(44);
    await expect(bounds.height).toBeGreaterThanOrEqual(44);
    await userEvent.tab();
    await expect(sw).toHaveFocus();
    await userEvent.keyboard(" ");
    await expect(sw).toBeChecked();
  },
};

export const HasSwitchRole: Story = {
  name: "Test: announced as a switch, not a checkbox",
  tags: ["!autodocs"],
  render: renderDefault,
  play: async ({ canvas }) => {
    /* The role is what tells a screen reader this takes effect now rather
     * than on submit. */
    await expect(
      canvas.getByRole("switch", { name: /Email me when data changes/ }),
    ).toBeVisible();
  },
};
