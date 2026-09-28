import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";

import { Amount } from "./Amount";
import { Badge } from "./Badge";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "./Table";

const rows = [
  {
    merchant: "Swiggy",
    date: "12 Sep",
    category: "Food",
    amount: -84900,
    status: "Verified",
  },
  {
    merchant: "Amazon Pay",
    date: "11 Sep",
    category: "Shopping",
    amount: -129900,
    status: "Verified",
  },
  {
    merchant: "Indian Oil",
    date: "9 Sep",
    category: "Fuel",
    amount: -250000,
    status: "Pending",
  },
  {
    merchant: "Salary credit",
    date: "1 Sep",
    category: "Income",
    amount: 8_500_000,
    status: "Verified",
  },
] as const;

const meta = {
  title: "Data/Table",
  component: Table,
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component: [
          "A data table.",
          "",
          "`caption` is required. A screen reader user navigating by table needs to",
          'know what this one holds before deciding to enter it, and "table with 6',
          'columns, 40 rows" does not tell them. Pass `hideCaption` when the design',
          "has a visible heading elsewhere: the caption still exists, it is just",
          "not painted.",
          "",
          "The horizontal scroller is built in and keyboard-reachable. A table is",
          "the one element that legitimately exceeds the viewport, and an",
          "`overflow-x-auto` div that only a mouse can pan is a WCAG 2.1.1",
          "failure.",
        ].join("\n"),
      },
    },
  },
  args: { caption: "Recent transactions" },
} satisfies Meta<typeof Table>;

export default meta;
type Story = StoryObj<typeof meta>;

const renderDefault: NonNullable<Story["render"]> = (args) => (
  <Table {...args}>
    <TableHeader>
      <TableRow>
        <TableHead>Merchant</TableHead>
        <TableHead>Date</TableHead>
        <TableHead>Category</TableHead>
        <TableHead>Status</TableHead>
        <TableHead numeric>Amount</TableHead>
      </TableRow>
    </TableHeader>
    <TableBody>
      {rows.map((row) => (
        <TableRow key={row.merchant}>
          <TableCell className="font-medium text-content-primary">
            {row.merchant}
          </TableCell>
          <TableCell>{row.date}</TableCell>
          <TableCell>{row.category}</TableCell>
          <TableCell>
            <Badge variant={row.status === "Verified" ? "success" : "warning"}>
              {row.status}
            </Badge>
          </TableCell>
          <TableCell numeric>
            <Amount value={row.amount} signed tone="auto" size="sm" />
          </TableCell>
        </TableRow>
      ))}
    </TableBody>
    <TableFooter>
      <TableRow>
        <TableCell colSpan={4}>Net</TableCell>
        <TableCell numeric>
          <Amount
            value={rows.reduce((sum, r) => sum + r.amount, 0)}
            signed
            tone="auto"
            size="sm"
          />
        </TableCell>
      </TableRow>
    </TableFooter>
  </Table>
);

export const Default: Story = { render: renderDefault };

/**
 * `numeric` on a head and its cells right-aligns them, so the minor units
 * share an edge and the column can be compared by eye instead of read.
 */
export const NumericAlignment: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <div className="grid gap-8 sm:grid-cols-2">
      <Table caption="With `numeric`">
        <TableHeader>
          <TableRow>
            <TableHead>Card</TableHead>
            <TableHead numeric>Fee</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.of(1_250_000, 50000, 99900, 12_500).map((v) => (
            <TableRow key={v}>
              <TableCell>Card</TableCell>
              <TableCell numeric>
                <Amount value={v} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Table caption="Without: left aligned">
        <TableHeader>
          <TableRow>
            <TableHead>Card</TableHead>
            <TableHead>Fee</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.of(1_250_000, 50000, 99900, 12_500).map((v) => (
            <TableRow key={v}>
              <TableCell>Card</TableCell>
              <TableCell>{(v / 100).toFixed(2)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  ),
};

export const HiddenCaption: Story = {
  args: { caption: "Recent transactions", hideCaption: true },
  render: renderDefault,
  parameters: {
    docs: {
      description: {
        story:
          "The caption stays in the accessibility tree and still names the scroll region: it is only hidden visually.",
      },
    },
  },
};

export const ScrollerIsKeyboardReachable: Story = {
  name: "Test: the scroll container is focusable and named",
  tags: ["!autodocs"],
  render: renderDefault,
  play: async ({ canvas }) => {
    /* WCAG 2.1.1: a scrollable region has to be pannable without a mouse. */
    const region = canvas.getByRole("region", { name: "Recent transactions" });
    await expect(region).toHaveAttribute("tabindex", "0");
  },
};

export const HeadersAreScoped: Story = {
  name: "Test: column headers carry scope",
  tags: ["!autodocs"],
  render: renderDefault,
  play: async ({ canvas }) => {
    /* Without `scope`, a screen reader announces bare cell values with no
     * column context: a grid of numbers with nothing to anchor them. */
    for (const name of ["Merchant", "Date", "Category", "Status", "Amount"]) {
      await expect(canvas.getByRole("columnheader", { name })).toHaveAttribute(
        "scope",
        "col",
      );
    }
  },
};

export const CaptionNamesTheTable: Story = {
  name: "Test: the caption is the table's accessible name",
  tags: ["!autodocs"],
  render: renderDefault,
  play: async ({ canvas }) => {
    await expect(
      canvas.getByRole("table", { name: /Recent transactions/ }),
    ).toBeVisible();
  },
};
