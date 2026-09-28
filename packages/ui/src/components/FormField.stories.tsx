import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, userEvent, waitFor } from "storybook/test";

import { Button } from "./Button";
import { Checkbox } from "./Checkbox";
import { FormField } from "./FormField";
import { Input } from "./Input";
import { Label } from "./Label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./Select";

const meta = {
  title: "Forms/FormField",
  component: FormField,
  parameters: {
    docs: {
      description: {
        component: [
          "Label, control, description and error as one accessible unit.",
          "",
          "This exists because the wiring is easy to get subtly wrong by hand and",
          "impossible to notice visually. The ids must be unique per instance, the",
          "label must point at the control, `aria-describedby` must list *both* the",
          "description and the error, `aria-invalid` must track the error, and the",
          "error must be announced when it appears without stealing focus.",
          "",
          "The control inside needs no `id`, no `htmlFor` and no `aria-*`.",
        ].join("\n"),
      },
    },
  },
  args: {
    label: "Email address",
    /* The default child keeps render-only stories type-safe. */
    children: <Input type="email" placeholder="you@example.com" />,
  },
} satisfies Meta<typeof FormField>;

export default meta;
type Story = StoryObj<typeof meta>;

const renderDefault: NonNullable<Story["render"]> = (args) => (
  <div className="max-w-sm">
    <FormField {...args} />
  </div>
);

export const Default: Story = { render: renderDefault };

export const WithDescription: Story = {
  args: { description: "We only use this to send your verification link." },
  render: renderDefault,
};

export const Required: Story = {
  args: { required: true, description: "Required to submit a report." },
  render: renderDefault,
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("textbox")).toBeRequired();
  },
};

export const WithError: Story = {
  args: {
    error: "That address is already registered.",
    description: "We only use this to send your verification link.",
  },
  render: renderDefault,
};

export const Disabled: Story = {
  args: {
    disabled: true,
    description: "Locked while your report is in review.",
  },
  render: renderDefault,
};

/**
 * The label can be hidden where the surrounding layout already names the
 * field: a search box under a "Search" heading, say. It stays in the
 * accessibility tree, so the control still has a name.
 */
export const HiddenLabel: Story = {
  args: { hideLabel: true, label: "Search cards" },
  render: (args) => (
    <div className="max-w-sm">
      <FormField {...args}>
        <Input placeholder="Search 1,400 cards" />
      </FormField>
    </div>
  ),
};

/** The same wiring across every control type. */
export const AcrossControls: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <div className="flex max-w-sm flex-col gap-6">
      <FormField label="Card name" description="As printed on the card">
        <Input placeholder="HDFC Millennia" />
      </FormField>

      <FormField label="Issuer" error="Pick an issuer to continue">
        <Select>
          <SelectTrigger>
            <SelectValue placeholder="Select an issuer" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="hdfc">HDFC Bank</SelectItem>
            <SelectItem value="icici">ICICI Bank</SelectItem>
            <SelectItem value="axis">Axis Bank</SelectItem>
          </SelectContent>
        </Select>
      </FormField>

      <div className="flex items-center gap-3">
        <Checkbox id="consent" />
        <Label htmlFor="consent">Submit this data for verification</Label>
      </div>

      <Button>Submit report</Button>
    </div>
  ),
};

export const LabelFocusesControl: Story = {
  name: "Test: clicking the label focuses the control",
  tags: ["!autodocs"],
  render: renderDefault,
  play: async ({ canvas }) => {
    await userEvent.click(canvas.getByText("Email address"));
    await expect(canvas.getByRole("textbox")).toHaveFocus();
  },
};

export const IdsAreUniquePerInstance: Story = {
  name: "Test: ids are unique across instances",
  tags: ["!autodocs"],
  render: () => (
    <div className="flex flex-col gap-4">
      <FormField label="Primary email" description="Your main address">
        <Input />
      </FormField>
      <FormField label="Backup email" description="Optional">
        <Input />
      </FormField>
    </div>
  ),
  play: async ({ canvas }) => {
    const [first, second] = canvas.getAllByRole("textbox");
    await expect(first).toHaveAccessibleName("Primary email");
    await expect(second).toHaveAccessibleName("Backup email");
    await expect(first?.id).not.toBe(second?.id);
  },
};

export const ErrorIsAnnounced: Story = {
  name: "Test: an error appearing is announced",
  tags: ["!autodocs"],
  render: () => {
    const Harness = () => {
      const [error, setError] = useState<string | undefined>(undefined);
      return (
        <div className="max-w-sm">
          <FormField label="Email address" error={error}>
            <Input defaultValue="not-an-email" />
          </FormField>
          <Button onClick={() => setError("Enter a valid email address")}>
            Validate
          </Button>
        </div>
      );
    };
    return <Harness />;
  },
  play: async ({ canvas }) => {
    const input = canvas.getByRole("textbox");
    await expect(input).not.toHaveAttribute("aria-invalid");

    await userEvent.click(canvas.getByRole("button", { name: "Validate" }));

    await waitFor(async () => {
      await expect(input).toHaveAttribute("aria-invalid", "true");
      await expect(input).toHaveAccessibleDescription(
        /Enter a valid email address/,
      );
    });

    /* Focus must not move. Yanking focus to the first error on validate loses
     * the user's place and, in a long form, their scroll position too. */
    await expect(input).not.toHaveFocus();
  },
};
