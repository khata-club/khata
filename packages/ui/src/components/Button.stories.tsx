import type { Meta, StoryObj } from "@storybook/react-vite";
import { LuArrowRight, LuMail, LuTrash2 } from "react-icons/lu";
import { expect, fn, userEvent, within } from "storybook/test";

import { Button } from "./Button";

const formSubmit = fn((event: React.FormEvent) => event.preventDefault());

const meta = {
  title: "Actions/Button",
  component: Button,
  parameters: {
    docs: {
      description: {
        component: [
          "The primary action control.",
          "",
          'Defaults to `type="button"` to prevent accidental form submission.',
          "",
          "Use `asChild` for links to retain middle-click, open-in-new-tab, and",
          "the browser's status-bar preview working.",
        ].join("\n"),
      },
    },
  },
  args: { children: "Continue", onClick: fn() },
  argTypes: {
    variant: {
      control: "select",
      options: ["primary", "secondary", "outline", "ghost", "destructive"],
    },
    size: {
      control: "select",
      options: ["sm", "default", "lg", "icon", "icon-sm"],
    },
    loading: { control: "boolean" },
    disabled: { control: "boolean" },
    asChild: { table: { disable: true } },
    leftIcon: { table: { disable: true } },
    rightIcon: { table: { disable: true } },
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = {};

export const Secondary: Story = { args: { variant: "secondary" } };
export const Outline: Story = { args: { variant: "outline" } };
export const Ghost: Story = { args: { variant: "ghost" } };

export const Destructive: Story = {
  args: { variant: "destructive", children: "Delete report" },
  parameters: {
    docs: {
      description: {
        story:
          "Reserved for actions that lose data. Pair it with a confirmation: colour alone is not a safeguard.",
      },
    },
  },
};

/** Every variant and size at once, for reviewing the set as a system. */
export const AllVariants: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <div className="flex flex-col gap-6">
      {(
        ["primary", "secondary", "outline", "ghost", "destructive"] as const
      ).map((variant) => (
        <div key={variant} className="flex flex-wrap items-center gap-3">
          <span className="w-24 text-xs text-content-muted">{variant}</span>
          <Button variant={variant} size="sm">
            Small
          </Button>
          <Button variant={variant}>Default</Button>
          <Button variant={variant} size="lg">
            Large
          </Button>
          <Button variant={variant} disabled>
            Disabled
          </Button>
          <Button variant={variant} loading loadingLabel="Saving">
            Loading
          </Button>
        </div>
      ))}
    </div>
  ),
};

export const WithIcons: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      <Button leftIcon={<LuMail aria-hidden="true" className="size-4" />}>
        Email me a link
      </Button>
      <Button
        variant="outline"
        rightIcon={<LuArrowRight aria-hidden="true" className="size-4" />}
      >
        Browse cards
      </Button>
      <Button
        variant="destructive"
        leftIcon={<LuTrash2 aria-hidden="true" className="size-4" />}
      >
        Delete
      </Button>
    </div>
  ),
};

export const IconOnly: Story = {
  parameters: {
    docs: {
      description: {
        story:
          "An icon-only button has no visible text, so it needs an explicit `aria-label`. Storybook's accessibility run fails the story without one.",
      },
    },
  },
  args: {
    size: "icon",
    "aria-label": "Compose message",
    children: <LuMail aria-hidden="true" className="size-4" />,
  },
};

/**
 * `asChild` hands the button's styling to the child element, so a link is a
 * real `<a>` with an `href`.
 */
export const AsLink: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <Button asChild>
      <a href="#cards">Browse cards</a>
    </Button>
  ),
};

export const DefaultsToTypeButton: Story = {
  name: "Test: defaults to type=button",
  tags: ["!autodocs"],
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("button")).toHaveAttribute("type", "button");
  },
};

export const DoesNotSubmitItsForm: Story = {
  name: "Test: does not submit its form",
  tags: ["!autodocs"],
  render: (args) => (
    <form onSubmit={formSubmit} data-testid="form">
      <Button {...args}>Add another</Button>
    </form>
  ),
  play: async ({ canvasElement }) => {
    formSubmit.mockClear();
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Add another" }));
    await expect(formSubmit).not.toHaveBeenCalled();
  },
};

export const LoadingBlocksClicks: Story = {
  name: "Test: loading blocks clicks",
  tags: ["!autodocs"],
  args: { loading: true, loadingLabel: "Verifying" },
  play: async ({ args, canvas }) => {
    const button = canvas.getByRole("button");
    await expect(button).toBeDisabled();
    await expect(button).toHaveAttribute("aria-busy", "true");
    /* The label stays, so the accessible name does not change mid-action and
     * the button does not collapse and move everything beside it. */
    await expect(button).toHaveAccessibleName(/Continue/);
    await userEvent.click(button, { pointerEventsCheck: 0 });
    await expect(args.onClick).not.toHaveBeenCalled();
  },
};

export const DisabledBlocksClicks: Story = {
  name: "Test: disabled blocks clicks",
  tags: ["!autodocs"],
  args: { disabled: true },
  play: async ({ args, canvas }) => {
    await userEvent.click(canvas.getByRole("button"), {
      pointerEventsCheck: 0,
    });
    await expect(args.onClick).not.toHaveBeenCalled();
  },
};

export const ForwardsClicks: Story = {
  name: "Test: forwards clicks",
  tags: ["!autodocs"],
  play: async ({ args, canvas }) => {
    await userEvent.click(canvas.getByRole("button"));
    await expect(args.onClick).toHaveBeenCalledOnce();
  },
};

export const KeyboardActivates: Story = {
  name: "Test: activates on Enter and Space",
  tags: ["!autodocs"],
  play: async ({ args, canvas }) => {
    const button = canvas.getByRole("button");
    await userEvent.tab();
    await expect(button).toHaveFocus();
    await userEvent.keyboard("{Enter}");
    await userEvent.keyboard(" ");
    await expect(args.onClick).toHaveBeenCalledTimes(2);
  },
};

export const ClassNameOverridesVariant: Story = {
  name: "Test: className wins over the variant",
  tags: ["!autodocs"],
  args: { className: "rounded-none" },
  play: async ({ canvas }) => {
    /* The contract `cn`'s tailwind-merge config exists to uphold: without
     * `rounded` declared as a custom class group, both `rounded-full` and
     * `rounded-none` would survive and CSS order would decide. */
    const button = canvas.getByRole("button");
    await expect(button).toHaveClass("rounded-none");
    await expect(button).not.toHaveClass("rounded-full");
  },
};

export const LoadingOverridesFalseDisabled: Story = {
  args: { loading: true, disabled: false },
  play: async ({ args, canvas }) => {
    const button = canvas.getByRole("button");
    await expect(button).toBeDisabled();
    await userEvent.click(button, { pointerEventsCheck: 0 });
    await expect(args.onClick).not.toHaveBeenCalled();
  },
};

export const AriaDisabledBlocksSubmission: Story = {
  render: (args) => (
    <form onSubmit={formSubmit}>
      <Button {...args} asChild={false} type="submit" aria-disabled="true">
        Continue
      </Button>
    </form>
  ),
  play: async ({ args, canvas }) => {
    formSubmit.mockClear();
    const button = canvas.getByRole("button");
    await userEvent.tab();
    await expect(button).toHaveFocus();
    await userEvent.keyboard("{Enter} ");
    await userEvent.click(button, { pointerEventsCheck: 0 });
    await expect(args.onClick).not.toHaveBeenCalled();
    await expect(formSubmit).not.toHaveBeenCalled();
  },
};

export const ReducedMotion: Story = {
  parameters: { chromatic: { disableSnapshot: true } },
  play: async ({ canvas }) => {
    if (!matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    await expect(matchMedia("(forced-colors: active)").matches).toBe(true);
    await expect(innerWidth).toBeLessThanOrEqual(320);
    const duration = getComputedStyle(
      canvas.getByRole("button"),
    ).transitionDuration;
    await expect(Number.parseFloat(duration)).toBeLessThan(0.001);
  },
};
