import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent } from "storybook/test";

import { Label } from "./Label";
import { RadioGroup, RadioGroupItem } from "./RadioGroup";

const meta = {
  title: "Forms/RadioGroup",
  component: RadioGroup,
  parameters: {
    docs: {
      description: {
        component: [
          "A set of mutually exclusive options.",
          "",
          "The group is one tab stop. Arrow keys move between options.",
          "",
          "Wrap it in a `fieldset`/`legend` when the group needs its own heading; a",
          "`label` cannot name a group.",
        ].join("\n"),
      },
    },
  },
} satisfies Meta<typeof RadioGroup>;

export default meta;
type Story = StoryObj<typeof meta>;

const options = [
  ["cashback", "Cashback"],
  ["points", "Reward points"],
  ["miles", "Air miles"],
] as const;

const renderDefault: NonNullable<Story["render"]> = (args) => (
  <fieldset className="border-0 p-0">
    <legend className="mb-3 text-sm font-semibold text-content-primary">
      Reward type
    </legend>
    <RadioGroup defaultValue="cashback" {...args}>
      {options.map(([value, label]) => (
        <div key={value} className="flex items-center gap-3">
          <RadioGroupItem value={value} id={`rg-${value}`} />
          <Label htmlFor={`rg-${value}`}>{label}</Label>
        </div>
      ))}
    </RadioGroup>
  </fieldset>
);

export const Default: Story = { render: renderDefault };

export const GroupIsNamedByLegend: Story = {
  name: "Test: the legend names the group",
  tags: ["!autodocs"],
  render: renderDefault,
  play: async ({ canvas }) => {
    await expect(
      canvas.getByRole("group", { name: "Reward type" }),
    ).toBeVisible();
  },
};

export const Disabled: Story = {
  render: (args) => (
    <fieldset className="border-0 p-0">
      <legend className="mb-3 text-sm font-semibold text-content-primary">
        Reward type
      </legend>
      <RadioGroup defaultValue="cashback" disabled {...args}>
        {options.map(([value, label]) => (
          <div key={value} className="flex items-center gap-3">
            <RadioGroupItem value={value} id={`rgd-${value}`} />
            <Label htmlFor={`rgd-${value}`}>{label}</Label>
          </div>
        ))}
      </RadioGroup>
    </fieldset>
  ),
};

export const IsASingleTabStop: Story = {
  name: "Test: the group is one tab stop, arrows move within it",
  tags: ["!autodocs"],
  render: renderDefault,
  play: async ({ canvas }) => {
    const [first, second, third] = canvas.getAllByRole("radio");
    const bounds = first?.getBoundingClientRect();
    await expect(bounds?.width).toBeGreaterThanOrEqual(44);
    await expect(bounds?.height).toBeGreaterThanOrEqual(44);

    await userEvent.tab();
    await expect(first).toHaveFocus();

    /* A radio group is one stop in the page's tab order. */
    await expect(first).toHaveAttribute("tabindex", "0");
    await expect(second).toHaveAttribute("tabindex", "-1");
    await expect(third).toHaveAttribute("tabindex", "-1");

    await userEvent.keyboard("{ArrowDown}");
    await expect(second).toHaveFocus();
  },
};

export const SelectingMovesTheChoice: Story = {
  name: "Test: selecting one option clears the others",
  tags: ["!autodocs"],
  render: renderDefault,
  play: async ({ canvas }) => {
    const [first, second] = canvas.getAllByRole("radio");
    await expect(first).toBeChecked();

    await userEvent.click(second!);
    await expect(second).toBeChecked();
    await expect(first).not.toBeChecked();
  },
};
