import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor } from "storybook/test";

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "./Select";

const meta = {
  title: "Forms/Select",
  component: Select,
  parameters: {
    docs: {
      description: {
        component: [
          "A single-choice dropdown.",
          "",
          "Use this select when options need rich content such as issuer logos or",
          "verification badges. Radix supplies the listbox keyboard contract.",
          "",
          "Use a native `<select>` for a long, plain list: on mobile it gets the",
          "platform picker, which beats anything rendered in the page.",
          "",
          "The listbox is portalled, so it is never clipped by an ancestor's",
          "`overflow: hidden`: the usual reason a dropdown renders as a 2px sliver",
          "inside a card.",
          "",
          "Note the `label` prop. ARIA requires a name on both the trigger and",
          "the listbox, and neither may take one from its own content: for the",
          "combobox that content is the selected value, for the listbox it is the",
          "options. `label` names both from one place; inside a `FormField` the",
          "visible label does it instead.",
        ].join("\n"),
      },
    },
  },
} satisfies Meta<typeof Select>;

export default meta;
type Story = StoryObj<typeof meta>;

const renderDefault: NonNullable<Story["render"]> = (args) => (
  <div className="w-64">
    <Select label="Issuer" {...args}>
      <SelectTrigger>
        <SelectValue placeholder="Select an issuer" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="hdfc">HDFC Bank</SelectItem>
        <SelectItem value="icici">ICICI Bank</SelectItem>
        <SelectItem value="axis">Axis Bank</SelectItem>
        <SelectItem value="sbi">SBI Card</SelectItem>
      </SelectContent>
    </Select>
  </div>
);

export const Default: Story = { render: renderDefault };

export const Grouped: Story = {
  render: () => (
    <div className="w-64">
      <Select label="Card">
        <SelectTrigger>
          <SelectValue placeholder="Select a card" />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectLabel>HDFC Bank</SelectLabel>
            <SelectItem value="millennia">Millennia</SelectItem>
            <SelectItem value="regalia">Regalia Gold</SelectItem>
          </SelectGroup>
          <SelectSeparator />
          <SelectGroup>
            <SelectLabel>Axis Bank</SelectLabel>
            <SelectItem value="magnus">Magnus</SelectItem>
            <SelectItem value="ace">ACE</SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  ),
};

export const Disabled: Story = {
  render: () => (
    <div className="w-64">
      <Select label="Issuer" disabled>
        <SelectTrigger>
          <SelectValue placeholder="Select an issuer" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="hdfc">HDFC Bank</SelectItem>
        </SelectContent>
      </Select>
    </div>
  ),
};

export const OpensAndSelects: Story = {
  name: "Test: opens and selects with the pointer",
  tags: ["!autodocs"],
  render: renderDefault,
  play: async ({ canvas }) => {
    const trigger = canvas.getByRole("combobox");
    await userEvent.click(trigger);

    /* Portalled, so the listbox is outside the story's DOM subtree. */
    const option = await waitFor(() =>
      document.body.querySelector<HTMLElement>('[role="option"]'),
    );
    await expect(option).not.toBeNull();
    await expect(
      Number.parseFloat(getComputedStyle(option!).minHeight),
    ).toBeGreaterThanOrEqual(44);

    await userEvent.click(
      document.body.querySelectorAll<HTMLElement>('[role="option"]').item(1),
    );
    await expect(trigger).toHaveTextContent("ICICI Bank");

    /* Wait for Radix to finish tearing down before the story ends.
     *
     * While the listbox is open Radix marks the rest of the page
     * `aria-hidden`, and it removes that a tick after the close. The a11y run
     * fires as soon as `play` resolves, so without this it inspects the DOM
     * mid-teardown and reports focusable content inside an `aria-hidden`
     * wrapper: a real rule, caught in a state no user is ever in. */
    await waitFor(() =>
      expect(document.querySelector("[data-aria-hidden]")).toBeNull(),
    );
  },
};

export const KeyboardSelects: Story = {
  name: "Test: opens and selects by keyboard",
  tags: ["!autodocs"],
  render: renderDefault,
  play: async ({ canvas }) => {
    const trigger = canvas.getByRole("combobox");
    await userEvent.tab();
    await expect(trigger).toHaveFocus();

    await userEvent.keyboard("{Enter}");
    await waitFor(async () => {
      await expect(trigger).toHaveAttribute("aria-expanded", "true");
    });

    await userEvent.keyboard("{ArrowDown}{Enter}");
    await waitFor(async () => {
      await expect(trigger).toHaveAttribute("aria-expanded", "false");
    });

    /* Closing must restore the keyboard sequence. */
    await expect(trigger).toHaveFocus();
  },
};

export const EscapeCloses: Story = {
  name: "Test: Escape closes without selecting",
  tags: ["!autodocs"],
  render: renderDefault,
  play: async ({ canvas }) => {
    const trigger = canvas.getByRole("combobox");
    await userEvent.click(trigger);
    await waitFor(async () => {
      await expect(trigger).toHaveAttribute("aria-expanded", "true");
    });

    await userEvent.keyboard("{Escape}");
    await waitFor(async () => {
      await expect(trigger).toHaveAttribute("aria-expanded", "false");
    });
    await expect(trigger).toHaveTextContent("Select an issuer");

    /* As in the pointer test: let Radix finish removing the `aria-hidden` it
     * put on the rest of the page, so the a11y run does not inspect the DOM
     * mid-teardown. */
    await waitFor(() =>
      expect(document.querySelector("[data-aria-hidden]")).toBeNull(),
    );
  },
};
