import { type ClassValue, clsx } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/* Keep custom class groups aligned with design-token scales so caller classes
 * override component defaults deterministically. */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [
        {
          text: ["2xs", "display-sm", "display-md", "display-lg", "display-xl"],
        },
      ],
      rounded: [{ rounded: ["card"] }],
      shadow: [{ shadow: ["glass", "raised", "overlay", "hairline"] }],
      blur: [{ blur: ["glass"] }],
      "backdrop-blur": [{ "backdrop-blur": ["glass"] }],
      duration: [
        { duration: ["instant", "fast", "base", "slow", "deliberate"] },
      ],
      ease: [{ ease: ["out-quart", "in-out-quart", "spring"] }],
      tracking: [{ tracking: ["display", "heading", "eyebrow"] }],
      z: [
        {
          z: [
            "base",
            "raised",
            "sticky",
            "overlay",
            "modal",
            "popover",
            "toast",
          ],
        },
      ],
      "max-w": [{ "max-w": ["layout"] }],
    },
  },
});

/** Compose class names with last-value-wins Tailwind conflict resolution. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
