import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FormField } from "./FormField";
import { Input } from "./Input";

describe("canonical field identity", () => {
  it("rejects child IDs that would detach the visible label", () => {
    expect(() =>
      renderToStaticMarkup(
        <FormField label="Name" controlId="name">
          <Input id="different" />
        </FormField>,
      ),
    ).toThrow(/conflicts with FormField/);
  });
  it("keeps matching IDs and generated descriptions", () => {
    const markup = renderToStaticMarkup(
      <FormField label="Name" controlId="name" description="Help" error="Error">
        <Input id="name" aria-describedby="external" />
      </FormField>,
    );
    expect(markup).toContain('for="name"');
    expect(markup).toMatch(
      /aria-describedby="[^"]*-error [^"]*-description external"/,
    );
  });
});
