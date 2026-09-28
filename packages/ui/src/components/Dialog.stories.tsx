import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor } from "storybook/test";

import { Button } from "./Button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./Dialog";
import { FormField } from "./FormField";
import { Input } from "./Input";

const meta = {
  title: "Overlays/Dialog",
  component: Dialog,
  parameters: {
    docs: {
      description: {
        component: [
          "A modal dialog.",
          "",
          "Radix handles what makes a modal actually modal, and what is nearly",
          "always missing from a hand-rolled one: focus moves in on open and returns",
          "to the trigger on close, Tab is trapped inside, Escape dismisses, the",
          "rest of the page is hidden from screen readers, and background scroll is",
          "locked without the layout shifting.",
          "",
          "`DialogTitle` is required: a dialog with no accessible name is announced",
          'as just "dialog". Wrap it in `VisuallyHidden` if the design has no',
          "visible title.",
          "",
          "Viewport insets keep long dialog content reachable on short screens.",
        ].join("\n"),
      },
    },
  },
} satisfies Meta<typeof Dialog>;

export default meta;
type Story = StoryObj<typeof meta>;

const renderDefault: NonNullable<Story["render"]> = () => (
  <Dialog>
    <DialogTrigger asChild>
      <Button>Report a charge</Button>
    </DialogTrigger>
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Report a charge</DialogTitle>
        <DialogDescription>
          Every report is verified by at least two other contributors before it
          appears publicly.
        </DialogDescription>
      </DialogHeader>

      <div className="mt-6 flex flex-col gap-4">
        <FormField
          label="Merchant"
          description="As it appears on your statement"
        >
          <Input placeholder="SWIGGY BANGALORE" />
        </FormField>
        <FormField label="Amount">
          <Input inputMode="decimal" placeholder="0.00" />
        </FormField>
      </div>

      <DialogFooter>
        <DialogClose asChild>
          <Button variant="ghost">Cancel</Button>
        </DialogClose>
        <Button>Submit report</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);

export const Default: Story = { render: renderDefault };

/** Long content stays reachable within the viewport. */
export const LongContent: Story = {
  render: () => (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline">Open long dialog</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Terms of contribution</DialogTitle>
          <DialogDescription>Please read before submitting.</DialogDescription>
        </DialogHeader>
        <div className="mt-4 flex flex-col gap-4 text-sm text-content-secondary">
          {Array.from({ length: 16 }, (_, i) => `clause-${i + 1}`).map(
            (id, i) => (
              <p key={id}>
                Clause {i + 1}. Submitted data is checked against at least two
                independent reports before publication, and contributors are
                never identified alongside the data they submit.
              </p>
            ),
          )}
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button>I understand</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ),
};

export const Destructive: Story = {
  render: () => (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="destructive">Delete report</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete this report?</DialogTitle>
          <DialogDescription>
            This cannot be undone. The verification history attached to it is
            removed too.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost">Keep it</Button>
          </DialogClose>
          <Button variant="destructive">Delete</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ),
};

export const OpensAndTrapsFocus: Story = {
  name: "Test: opens, names itself, and traps focus",
  tags: ["!autodocs"],
  render: renderDefault,
  play: async ({ canvas }) => {
    await userEvent.click(
      canvas.getByRole("button", { name: "Report a charge" }),
    );

    const dialog = await waitFor(() =>
      document.body.querySelector<HTMLElement>('[role="dialog"]'),
    );
    await expect(dialog).not.toBeNull();

    /* A dialog with no accessible name is announced as just "dialog". */
    await expect(dialog).toHaveAccessibleName("Report a charge");

    /* Focus moved inside. Without this a keyboard user is still on the page
     * behind, tabbing through content that is visually obscured. */
    await waitFor(() => {
      expect(dialog?.contains(document.activeElement)).toBe(true);
    });
  },
};

export const EscapeClosesAndRestoresFocus: Story = {
  name: "Test: Escape closes and focus returns to the trigger",
  tags: ["!autodocs"],
  render: renderDefault,
  play: async ({ canvas }) => {
    const trigger = canvas.getByRole("button", { name: "Report a charge" });
    await userEvent.click(trigger);
    await waitFor(() =>
      expect(document.body.querySelector('[role="dialog"]')).not.toBeNull(),
    );

    await userEvent.keyboard("{Escape}");

    await waitFor(() =>
      expect(document.body.querySelector('[role="dialog"]')).toBeNull(),
    );

    await expect(trigger).toHaveFocus();
  },
};

export const CloseButtonIsNamed: Story = {
  name: "Test: the icon-only close button has a name",
  tags: ["!autodocs"],
  render: renderDefault,
  play: async ({ canvas }) => {
    await userEvent.click(
      canvas.getByRole("button", { name: "Report a charge" }),
    );
    await waitFor(() =>
      expect(document.body.querySelector('[role="dialog"]')).not.toBeNull(),
    );

    const dialog = document.body.querySelector('[role="dialog"]')!;
    const close = [...dialog.querySelectorAll("button")].find(
      (b) => b.textContent?.trim() === "Close",
    );
    await expect(close).toBeDefined();
    const size = getComputedStyle(close!);
    await expect(Number.parseFloat(size.width)).toBeGreaterThanOrEqual(44);
    await expect(Number.parseFloat(size.height)).toBeGreaterThanOrEqual(44);
  },
};
