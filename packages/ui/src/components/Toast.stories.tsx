import type { Meta, StoryObj } from "@storybook/react-vite";
import type { ReactNode } from "react";
import { useState } from "react";
import { expect, userEvent, waitFor } from "storybook/test";

import { Button } from "./Button";
import {
  Toast,
  ToastAction,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "./Toast";

const meta = {
  title: "Overlays/Toast",
  component: Toast,
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component: [
          "A transient notification.",
          "",
          "Radix gives this the behaviour that is hard to get right: the viewport is",
          "an ARIA live region so a toast is announced without moving focus,",
          "hovering or focusing pauses the dismiss timer, swipe dismisses on touch,",
          "and F6 jumps to the toast list: the escape hatch for a keyboard user who",
          "needs to reach an action before it disappears.",
          "",
          "A `ToastViewport` is required because Radix portals toasts into it.",
          "",
          "Never put something the user must act on in a toast alone. It will be",
          "gone in five seconds, and anyone reading elsewhere will miss it.",
        ].join("\n"),
      },
    },
  },
  argTypes: {
    variant: {
      control: "select",
      options: ["neutral", "success", "warning", "danger", "info"],
    },
  },
} satisfies Meta<typeof Toast>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Renders toasts inline instead of pinned to the corner, so a documentation
 * page can show several at once. Real usage takes the default viewport.
 */
function InlineToasts({ children }: { children: ReactNode }) {
  return (
    /* `setTimeout` coerces an infinite duration to immediate dismissal. */
    <ToastProvider duration={86_400_000}>
      {children}
      <ToastViewport className="static w-full max-w-96 flex-col p-0 sm:static sm:max-w-96" />
    </ToastProvider>
  );
}

const renderDefault: NonNullable<Story["render"]> = (args) => {
  const Harness = () => {
    const [open, setOpen] = useState(false);
    return (
      <ToastProvider>
        <Button onClick={() => setOpen(true)}>Submit report</Button>
        <Toast {...args} open={open} onOpenChange={setOpen}>
          <ToastTitle>Report submitted</ToastTitle>
          <ToastDescription>
            It will appear once two contributors verify it.
          </ToastDescription>
        </Toast>
        <ToastViewport />
      </ToastProvider>
    );
  };
  return <Harness />;
};

export const Default: Story = {
  args: { variant: "success" },
  render: renderDefault,
  parameters: {
    docs: {
      description: {
        story:
          "The real thing: bottom-right on desktop, full width along the bottom on mobile where a floating corner card competes with the thumb.",
      },
    },
  },
};

/**
 * Each variant leads with its own icon. Colour never carries the meaning on
 * its own: WCAG 1.4.1, and the reason these are still tellable apart in
 * greyscale.
 */
export const Variants: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <InlineToasts>
      {(
        [
          ["neutral", "Draft saved", "You can finish this later."],
          ["success", "Report verified", "Two contributors confirmed it."],
          ["warning", "Verification pending", "One more report needed."],
          ["danger", "Submission failed", "Check the amount and try again."],
          ["info", "New data available", "Rates were updated this morning."],
        ] as const
      ).map(([variant, title, description]) => (
        <Toast key={variant} variant={variant} open>
          <ToastTitle>{title}</ToastTitle>
          <ToastDescription>{description}</ToastDescription>
        </Toast>
      ))}
    </InlineToasts>
  ),
  /* Asserted, because the failure mode here is silence: a `Toast` with no
   * `ToastViewport`, or with a non-finite `duration`, renders nothing at all
   * and the story looks like an empty canvas that still passes. */
  play: async ({ canvas }) => {
    for (const title of [
      "Draft saved",
      "Report verified",
      "Verification pending",
      "Submission failed",
      "New data available",
    ]) {
      await expect(await canvas.findByText(title)).toBeInTheDocument();
    }
  },
};

/**
 * `altText` is required on an action and is not decoration: it is what a
 * screen reader user is offered when the toast is announced, since the button
 * itself will be gone before they could reach it.
 */
export const WithAction: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <InlineToasts>
      <Toast variant="neutral" open>
        <ToastTitle>Report deleted</ToastTitle>
        <ToastDescription>
          The verification history went with it.
        </ToastDescription>
        <ToastAction altText="Undo deleting the report" asChild>
          <Button variant="outline" size="sm" className="mt-2 self-start">
            Undo
          </Button>
        </ToastAction>
      </Toast>
    </InlineToasts>
  ),
};

export const AnnouncedWithoutStealingFocus: Story = {
  name: "Test: announced without moving focus",
  tags: ["!autodocs"],
  args: { variant: "success" },
  render: renderDefault,
  play: async ({ canvas }) => {
    const trigger = canvas.getByRole("button", { name: "Submit report" });
    await userEvent.click(trigger);

    await waitFor(async () => {
      await expect(canvas.getByText("Report submitted")).toBeVisible();
    });

    /* A toast that takes focus interrupts whatever the user was doing. The
     * live region is how it gets announced instead. */
    await expect(trigger).toHaveFocus();
  },
};

export const DismissButtonIsNamed: Story = {
  name: "Test: the icon-only dismiss button has a name",
  tags: ["!autodocs"],
  parameters: { controls: { disable: true } },
  render: () => (
    <InlineToasts>
      <Toast open>
        <ToastTitle>Draft saved</ToastTitle>
      </Toast>
    </InlineToasts>
  ),
  play: async ({ canvas }) => {
    const close = await canvas.findByRole("button", { name: "Dismiss" });

    /* The assertion goes *inside* `waitFor` so it retries. The toast enters
     * with `animate-slide-in-right`, whose first keyframe is `opacity: 0`;
     * `findBy` resolves on the frame the button mounts, which is exactly the
     * frame where its ancestor's computed opacity is still zero, and
     * `toBeVisible` reads that as hidden. */
    await waitFor(async () => {
      await expect(close).toBeVisible();
    });
    const bounds = close.getBoundingClientRect();
    await expect(bounds.width).toBeGreaterThanOrEqual(44);
    await expect(bounds.height).toBeGreaterThanOrEqual(44);
  },
};
