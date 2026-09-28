import type { Meta, StoryObj } from "@storybook/react-vite";
import { LuInfo } from "react-icons/lu";
import { expect, userEvent, waitFor } from "storybook/test";

import { Button } from "./Button";
import { Tooltip, TooltipContent, TooltipTrigger } from "./Tooltip";

const meta = {
  title: "Overlays/Tooltip",
  component: Tooltip,
  parameters: {
    docs: {
      description: {
        component: [
          "A short hint attached to a control.",
          "",
          "Tooltips are supplementary by definition: they do not appear on touch,",
          "and they cannot be reached by a screen reader user who is not focusing",
          "the trigger. Anything a user *needs* in order to finish the task belongs",
          "in the page: a `FormField` description, or visible copy.",
          "",
          "`TooltipProvider` wraps the app once; it is what lets a second tooltip",
          "open instantly instead of re-serving the open delay. This Storybook",
          "mounts it globally in `preview.tsx`.",
        ].join("\n"),
      },
    },
  },
} satisfies Meta<typeof Tooltip>;

export default meta;
type Story = StoryObj<typeof meta>;

const renderDefault: NonNullable<Story["render"]> = () => (
  <Tooltip>
    <TooltipTrigger asChild>
      <Button variant="ghost" size="icon" aria-label="About reward rates">
        <LuInfo aria-hidden="true" className="size-4" />
      </Button>
    </TooltipTrigger>
    <TooltipContent>
      Calculated from the last 90 days of verified reports.
    </TooltipContent>
  </Tooltip>
);

export const Default: Story = { render: renderDefault };

export const OnText: Story = {
  render: () => (
    <p className="max-w-sm text-sm text-content-secondary">
      The effective rate is{" "}
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className="focus-ring underline decoration-dotted underline-offset-4"
          >
            4.8%
          </button>
        </TooltipTrigger>
        <TooltipContent>
          After the monthly cap and excluding fuel surcharge.
        </TooltipContent>
      </Tooltip>{" "}
      for this spending pattern.
    </p>
  ),
};

export const OpensOnFocus: Story = {
  name: "Test: opens on keyboard focus, not just hover",
  tags: ["!autodocs"],
  render: renderDefault,
  play: async ({ canvas }) => {
    const trigger = canvas.getByRole("button", { name: "About reward rates" });

    await userEvent.tab();
    await expect(trigger).toHaveFocus();

    /* A hover-only tooltip is unreachable by keyboard: WCAG 1.4.13. */
    await waitFor(async () => {
      await expect(
        document.body.querySelector('[role="tooltip"]'),
      ).not.toBeNull();
    });
  },
};

export const EscapeDismisses: Story = {
  name: "Test: Escape dismisses it",
  tags: ["!autodocs"],
  render: renderDefault,
  play: async () => {
    await userEvent.tab();
    await waitFor(() =>
      expect(document.body.querySelector('[role="tooltip"]')).not.toBeNull(),
    );

    /* WCAG 1.4.13 requires hoverable, dismissable content. */
    await userEvent.keyboard("{Escape}");
    await waitFor(() =>
      expect(document.body.querySelector('[role="tooltip"]')).toBeNull(),
    );
  },
};
