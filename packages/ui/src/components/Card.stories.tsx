import type { Meta, StoryObj } from "@storybook/react-vite";

import { Amount } from "./Amount";
import { Badge } from "./Badge";
import { Button } from "./Button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "./Card";
import { Separator } from "./Separator";

const meta = {
  title: "Content/Card",
  component: Card,
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component: [
          "A surface that groups related content.",
          "",
          "Compose with `CardHeader`, `CardTitle`, `CardDescription`,",
          "`CardContent` and `CardFooter` to keep",
          "spacing and type stay consistent across every card in the product.",
          "",
          "`CardTitle` defaults to `h3` but takes `as`: a card's right heading",
          "level depends on the page it is on, and skipping a level breaks",
          "heading navigation.",
        ].join("\n"),
      },
    },
  },
  args: { padding: "default" },
  argTypes: {
    variant: {
      control: "select",
      options: ["glass", "solid", "transaction"],
    },
    radius: { control: "select", options: ["md", "card"] },
    padding: {
      control: "select",
      options: ["none", "sm", "default", "lg"],
    },
  },
} satisfies Meta<typeof Card>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => (
    <Card {...args} className="max-w-sm">
      <CardHeader>
        <CardTitle>HDFC Millennia</CardTitle>
        <CardDescription>Verified 2 days ago</CardDescription>
      </CardHeader>
      <CardContent className="mt-4">
        <p className="text-sm">
          5% cashback on Amazon, Flipkart and Swiggy. 1% everywhere else.
        </p>
      </CardContent>
    </Card>
  ),
};

export const Variants: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <div className="grid gap-4 sm:grid-cols-2">
      {(["glass", "solid", "transaction"] as const).map((variant) => (
        <Card key={variant} variant={variant} padding="default">
          <CardHeader>
            <CardTitle>{variant}</CardTitle>
            <CardDescription>
              {variant === "glass" && "The signature frosted panel."}
              {variant === "solid" && "Opaque, for dense UI."}
              {variant === "transaction" && "Flat when repeated in a ledger."}
            </CardDescription>
          </CardHeader>
        </Card>
      ))}
    </div>
  ),
};

/** A realistic composition, with every part in use. */
export const FullComposition: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <Card padding="lg" className="max-w-md">
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <CardTitle as="h2">Axis Magnus</CardTitle>
            <CardDescription>Super-premium · Lifetime free</CardDescription>
          </div>
          <Badge variant="success">Verified</Badge>
        </div>
      </CardHeader>

      <CardContent className="mt-6 flex flex-col gap-4">
        <div className="flex items-baseline justify-between">
          <span className="text-sm text-content-muted">Annual fee</span>
          <Amount value={1_250_000} hideFraction />
        </div>
        <Separator />
        <div className="flex items-baseline justify-between">
          <span className="text-sm text-content-muted">Reward rate</span>
          <span className="text-base">4.8%</span>
        </div>
      </CardContent>

      <CardFooter className="mt-6">
        <Button>See the breakdown</Button>
        <Button variant="ghost">Compare</Button>
      </CardFooter>
    </Card>
  ),
};

/**
 * `transaction` is deliberately flat. A ledger of forty rows should read as a
 * list, not as forty floating cards.
 */
export const TransactionList: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <div className="flex max-w-md flex-col gap-2">
      {[
        ["Swiggy", -84900],
        ["Amazon Pay", -1_299_00],
        ["Salary credit", 8_500_000],
        ["Netflix", -64900],
      ].map(([label, value]) => (
        <Card
          key={label as string}
          variant="transaction"
          radius="md"
          padding="sm"
          className="flex items-center justify-between"
        >
          <span className="text-sm text-content-primary">{label}</span>
          <Amount value={value as number} signed tone="auto" size="sm" />
        </Card>
      ))}
    </div>
  ),
};
