import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, userEvent } from "storybook/test";

import { Checkbox } from "./Checkbox";
import { Label } from "./Label";

const meta = {
  title: "Forms/Checkbox",
  component: Checkbox,
  parameters: {
    docs: {
      description: {
        component: [
          "A checkbox, including the indeterminate state.",
          "",
          "Use a checkbox when the change applies on form submission.",
          "A switch that needs a Save button is a checkbox wearing a costume, and",
          "users will assume their change is already live.",
          "",
          "Pair it with a `Label` whose `htmlFor` matches the id, so clicking the",
          "text toggles the box.",
        ].join("\n"),
      },
    },
  },
  argTypes: { disabled: { control: "boolean" } },
} satisfies Meta<typeof Checkbox>;

export default meta;
type Story = StoryObj<typeof meta>;

const renderDefault: NonNullable<Story["render"]> = (args) => (
  <div className="flex items-center gap-3">
    <Checkbox id="cb" {...args} />
    <Label htmlFor="cb">Submit this data for verification</Label>
  </div>
);

export const Default: Story = { render: renderDefault };

export const States: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <div className="flex flex-col gap-4">
      {(
        [
          ["unchecked", false],
          ["checked", true],
          ["indeterminate", "indeterminate"],
        ] as const
      ).map(([name, checked]) => (
        <div key={name} className="flex items-center gap-3">
          <Checkbox id={`cb-${name}`} checked={checked} />
          <Label htmlFor={`cb-${name}`}>{name}</Label>
        </div>
      ))}
      <div className="flex items-center gap-3">
        <Checkbox id="cb-disabled" disabled />
        <Label htmlFor="cb-disabled">disabled</Label>
      </div>
      <div className="flex items-center gap-3">
        <Checkbox id="cb-disabled-checked" disabled checked />
        <Label htmlFor="cb-disabled-checked">disabled, checked</Label>
      </div>
    </div>
  ),
};

/**
 * "Some selected" and "all selected" use different glyphs, not just a
 * different fill, so the two are distinguishable without colour.
 */
export const IndeterminateGroup: Story = {
  parameters: { controls: { disable: true } },
  render: () => {
    const Group = () => {
      const options = ["Cashback", "Travel", "Fuel"];
      const [selected, setSelected] = useState<string[]>(["Cashback"]);
      const all = selected.length === options.length;
      const some = selected.length > 0 && !all;

      return (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <Checkbox
              id="cb-all"
              checked={all ? true : some ? "indeterminate" : false}
              onCheckedChange={() => setSelected(all ? [] : options)}
            />
            <Label htmlFor="cb-all">All categories</Label>
          </div>
          <div className="ml-7 flex flex-col gap-3">
            {options.map((option) => (
              <div key={option} className="flex items-center gap-3">
                <Checkbox
                  id={`cb-${option}`}
                  checked={selected.includes(option)}
                  onCheckedChange={(next) =>
                    setSelected((prev) =>
                      next
                        ? [...prev, option]
                        : prev.filter((p) => p !== option),
                    )
                  }
                />
                <Label htmlFor={`cb-${option}`}>{option}</Label>
              </div>
            ))}
          </div>
        </div>
      );
    };
    return <Group />;
  },
};

export const LabelTogglesIt: Story = {
  name: "Test: clicking the label toggles the box",
  tags: ["!autodocs"],
  render: renderDefault,
  play: async ({ canvas }) => {
    const box = canvas.getByRole("checkbox");
    await expect(box).not.toBeChecked();
    await userEvent.click(canvas.getByText(/Submit this data/));
    await expect(box).toBeChecked();
  },
};

export const SpaceToggles: Story = {
  name: "Test: Space toggles it",
  tags: ["!autodocs"],
  render: renderDefault,
  play: async ({ canvas }) => {
    const box = canvas.getByRole("checkbox");
    const bounds = box.getBoundingClientRect();
    await expect(bounds.width).toBeGreaterThanOrEqual(44);
    await expect(bounds.height).toBeGreaterThanOrEqual(44);
    await userEvent.tab();
    await expect(box).toHaveFocus();
    await userEvent.keyboard(" ");
    await expect(box).toBeChecked();
  },
};

export const IndeterminateIsExposed: Story = {
  name: "Test: indeterminate is announced as mixed",
  tags: ["!autodocs"],
  render: () => (
    <div className="flex items-center gap-3">
      <Checkbox id="cb-mixed" checked="indeterminate" />
      <Label htmlFor="cb-mixed">Some selected</Label>
    </div>
  ),
  play: async ({ canvas }) => {
    /* `aria-checked="mixed"` is the state, not a third visual style: it has
     * to reach assistive technology, not just the eye. */
    await expect(canvas.getByRole("checkbox")).toHaveAttribute(
      "aria-checked",
      "mixed",
    );
  },
};
