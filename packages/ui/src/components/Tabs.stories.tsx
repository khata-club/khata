import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent } from "storybook/test";

import { Amount } from "./Amount";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./Tabs";

const meta = {
  title: "Navigation/Tabs",
  component: Tabs,
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component: [
          "Tabbed panels.",
          "",
          "Radix implements the ARIA tabs pattern: one tab stop for the whole list,",
          "arrow keys to move between tabs, Home and End to jump, and each panel",
          "wired to its tab with `aria-controls` and `aria-labelledby`.",
          "",
          "The active tab is marked by fill *and* by weight, not by colour alone.",
        ].join("\n"),
      },
    },
  },
} satisfies Meta<typeof Tabs>;

export default meta;
type Story = StoryObj<typeof meta>;

const renderDefault: NonNullable<Story["render"]> = (args) => (
  <Tabs defaultValue="rewards" className="max-w-lg" {...args}>
    <TabsList>
      <TabsTrigger value="rewards">Rewards</TabsTrigger>
      <TabsTrigger value="fees">Fees</TabsTrigger>
      <TabsTrigger value="lounge">Lounge</TabsTrigger>
    </TabsList>

    <TabsContent value="rewards">
      <p className="text-sm text-content-secondary">
        5% on Amazon, Flipkart and Swiggy. 1% everywhere else, capped at
        <Amount value={100000} className="mx-1" hideFraction /> per month.
      </p>
    </TabsContent>
    <TabsContent value="fees">
      <p className="text-sm text-content-secondary">
        Joining fee <Amount value={100000} hideFraction />, waived on
        <Amount value={10_000_000} className="mx-1" compact /> annual spend.
      </p>
    </TabsContent>
    <TabsContent value="lounge">
      <p className="text-sm text-content-secondary">
        Four domestic visits per quarter. No international access.
      </p>
    </TabsContent>
  </Tabs>
);

export const Default: Story = { render: renderDefault };

export const ArrowKeysMoveBetweenTabs: Story = {
  name: "Test: one tab stop, arrow keys move between tabs",
  tags: ["!autodocs"],
  render: renderDefault,
  play: async ({ canvas }) => {
    const [rewards, fees] = canvas.getAllByRole("tab");
    await expect(
      rewards?.getBoundingClientRect().height,
    ).toBeGreaterThanOrEqual(44);

    await userEvent.tab();
    await expect(rewards).toHaveFocus();
    await expect(rewards).toHaveAttribute("aria-selected", "true");

    /* Arrow keys, not Tab. Three tab stops for three tabs would be the
     * hand-rolled behaviour and is not the ARIA pattern. */
    await userEvent.keyboard("{ArrowRight}");
    await expect(fees).toHaveFocus();
    await expect(fees).toHaveAttribute("aria-selected", "true");
    await expect(rewards).toHaveAttribute("aria-selected", "false");
  },
};

export const PanelIsLabelledByItsTab: Story = {
  name: "Test: the panel is associated with its tab",
  tags: ["!autodocs"],
  render: renderDefault,
  play: async ({ canvas }) => {
    const panel = canvas.getByRole("tabpanel");
    await expect(panel).toHaveAccessibleName("Rewards");
    await userEvent.tab();
    await userEvent.tab();
    await expect(panel).toHaveFocus();
    await expect(getComputedStyle(panel).outlineStyle).toBe("solid");
  },
};
