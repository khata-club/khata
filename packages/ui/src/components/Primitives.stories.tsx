import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";

import { Separator } from "./Separator";
import { Skeleton } from "./Skeleton";
import { Spinner } from "./Spinner";
import { VisuallyHidden } from "./VisuallyHidden";

/**
 * The small pieces the rest of the library composes from. Grouped into one
 * page because each is a handful of lines, and seeing them together is more
 * useful than four pages that each show one shape.
 */
const meta = {
  title: "Primitives/Spinner, Skeleton, Separator",
  component: Spinner,
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Loading, spacing and screen-reader primitives. Each is used inside other components: Spinner by Button's loading state, VisuallyHidden by every icon-only control.",
      },
    },
  },
} satisfies Meta<typeof Spinner>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Spinners: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <div className="flex items-center gap-6 text-content-brand">
      <Spinner size="sm" />
      <Spinner />
      <Spinner size="lg" />
    </div>
  ),
};

/**
 * Skeletons are hidden from assistive technology. A screen reader user gains
 * nothing from "image, image, image" while a table loads: the wait is
 * announced once, on the region that is loading.
 */
export const Skeletons: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <div className="flex w-80 flex-col gap-4" aria-busy="true">
      <div className="flex items-center gap-3">
        <Skeleton shape="circle" className="size-10" />
        <div className="flex flex-1 flex-col gap-2">
          <Skeleton className="w-32" />
          <Skeleton className="w-20" />
        </div>
      </div>
      <Skeleton shape="heading" className="w-48" />
      <Skeleton shape="block" className="h-24 w-full" />
    </div>
  ),
};

export const Separators: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <div className="flex flex-col gap-6">
      <div className="flex w-64 flex-col gap-3">
        <span className="text-sm">Above</span>
        <Separator />
        <span className="text-sm">Below</span>
      </div>
      <div className="flex h-12 items-center gap-3">
        <span className="text-sm">Left</span>
        <Separator orientation="vertical" />
        <span className="text-sm">Right</span>
      </div>
    </div>
  ),
};

export const SkeletonIsHiddenFromScreenReaders: Story = {
  name: "Test: skeletons are hidden from assistive technology",
  tags: ["!autodocs"],
  render: () => <Skeleton data-testid="sk" className="w-32" />,
  play: async ({ canvas }) => {
    await expect(canvas.getByTestId("sk")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
  },
};

export const DecorativeSeparatorIsNotAnnounced: Story = {
  name: "Test: a decorative separator has no role",
  tags: ["!autodocs"],
  render: () => (
    <div className="w-64">
      <Separator />
      <Separator decorative={false} />
    </div>
  ),
  play: async ({ canvas }) => {
    /* Default is decorative, so only the explicit one is announced: a page
     * of rules should not read as "separator" forty times. */
    await expect(canvas.getAllByRole("separator")).toHaveLength(1);
  },
};

export const VisuallyHiddenIsStillAnnounced: Story = {
  name: "Test: VisuallyHidden stays in the accessibility tree",
  tags: ["!autodocs"],
  render: () => (
    <button
      type="button"
      className="focus-ring rounded-full border border-edge p-2"
    >
      <span aria-hidden="true">×</span>
      <VisuallyHidden>Close panel</VisuallyHidden>
    </button>
  ),
  play: async ({ canvas }) => {
    /* Not `display: none` or `visibility: hidden`: both remove the element
     * from the accessibility tree, which defeats the point. */
    await expect(
      canvas.getByRole("button", { name: "Close panel" }),
    ).toBeVisible();
  },
};
