import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";

import { Amount } from "./Amount";

const meta = {
  title: "Data/Amount",
  component: Amount,
  parameters: {
    docs: {
      description: {
        component: [
          "A currency amount.",
          "",
          "Formats integer minor units with locale-aware grouping, precision,",
          "visible signs, and machine-readable values.",
          "",
          "**`value` is in minor units**: paise for INR, cents for USD. Integers,",
          "because `0.1 + 0.2 !== 0.3` in IEEE 754 and money that is a paise out",
          "after three additions is a bug that reaches a statement.",
        ].join("\n"),
      },
    },
  },
  args: { value: 125000 },
  argTypes: {
    size: { control: "select", options: ["sm", "default", "lg", "display"] },
    tone: {
      control: "select",
      options: ["auto", "neutral", "positive", "negative", "muted"],
    },
    signed: { control: "boolean" },
    compact: { control: "boolean" },
    hideFraction: { control: "boolean" },
  },
} satisfies Meta<typeof Amount>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Sizes: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <div className="flex flex-col items-start gap-2">
      <Amount value={125000} size="sm" />
      <Amount value={125000} />
      <Amount value={125000} size="lg" />
      <Amount value={125000} size="display" />
    </div>
  ),
};

/** Indian grouping is the default through the `en-IN` locale. */
export const IndianGrouping: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <table className="text-sm">
      <tbody>
        {Array.of(
          125000,
          1_200_000,
          12_000_000,
          120_000_000,
          1_200_000_000,
        ).map((v) => (
          <tr key={v} className="border-b border-edge-subtle">
            <td className="py-2 pr-6 text-content-muted">{v} paise</td>
            <td className="py-2 pr-6 text-right">
              <Amount value={v} />
            </td>
            <td className="py-2 text-right">
              <Amount value={v} compact tone="muted" />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  ),
};

/**
 * `tone="auto"` colours by sign, for a transaction list where credit versus
 * debit is the point. The sign is always rendered too: colour alone never
 * carries the meaning (WCAG 1.4.1).
 */
export const CreditAndDebit: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <div className="flex flex-col items-start gap-2">
      <Amount value={450000} signed tone="auto" />
      <Amount value={-129900} signed tone="auto" />
      <Amount value={0} signed tone="auto" />
    </div>
  ),
};

/** Balances use a neutral tone regardless of sign. */
export const NeutralBalance: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <div className="flex flex-col items-start gap-2">
      <Amount value={-4_512_300} size="lg" />
      <Amount value={4_512_300} size="lg" />
    </div>
  ),
};

/** Amounts in a column are right-aligned so their minor units share an edge. */
export const ColumnAlignment: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <div className="flex w-48 flex-col items-end gap-1 rounded-md border border-edge p-4">
      {Array.of(111100, 9_999_999, 5000, 12_345_678, 100).map((v) => (
        <Amount key={v} value={v} />
      ))}
    </div>
  ),
};

export const OtherCurrencies: Story = {
  parameters: {
    docs: {
      description: {
        story:
          "Not every currency divides by 100. JPY has no subunit and KWD has three decimal places, so a hard-coded divisor would render a ¥500 charge as ¥5.",
      },
    },
  },
  render: () => (
    <div className="flex flex-col items-start gap-2">
      <Amount value={125000} currency="INR" locale="en-IN" />
      <Amount value={125000} currency="USD" locale="en-US" />
      <Amount value={500} currency="JPY" locale="ja-JP" />
      <Amount value={1500} currency="KWD" locale="en-US" />
    </div>
  ),
};

export const ExposesMachineValue: Story = {
  name: "Test: keeps the exact value when compacted",
  tags: ["!autodocs"],
  args: { value: 12_345_678, compact: true },
  play: async ({ canvas }) => {
    const el = canvas.getByText(/L$/);
    await expect(el).toHaveAttribute("value", "123456.78");
  },
};

export const SignIsSpokenNotJustDrawn: Story = {
  name: "Test: the minus sign is announced",
  tags: ["!autodocs"],
  args: { value: -125000, signed: true, tone: "auto" },
  play: async ({ canvasElement }) => {
    const data = canvasElement.querySelector("data");

    /* U+2212 aligns with digits and has clearer speech output. */
    await expect(data?.textContent).toContain("−");
    await expect(data?.textContent).not.toContain("-");

    await expect(data?.textContent).toContain("minus");
  },
};

export const ZeroIsNeutralAndUnsigned: Story = {
  name: "Test: zero is neutral and unsigned",
  tags: ["!autodocs"],
  args: { value: 0, signed: true, tone: "auto" },
  play: async ({ canvasElement }) => {
    const amount = canvasElement.querySelector("data");
    await expect(amount).toHaveClass("text-amount-neutral");
    await expect(amount?.textContent).not.toContain("+");
    await expect(amount?.textContent).not.toContain("plus");
  },
};

export const ExactBoundary: Story = {
  name: "Test: every paise survives at the integer boundary",
  args: { value: Number.MAX_SAFE_INTEGER },
  play: async ({ canvasElement }) => {
    const amount = canvasElement.querySelector("data");
    await expect(amount).toHaveAttribute("value", "90071992547409.91");
    await expect(amount).toHaveAttribute(
      "data-minor-units",
      "9007199254740991",
    );
    await expect(amount).toHaveAttribute("data-currency", "INR");
    await expect(amount?.textContent).toMatch(/409\.91$/);
  },
};
