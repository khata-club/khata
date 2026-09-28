import {
  AA_TEXT,
  contrastPairs,
  getContrastPair,
} from "@khata-club/design-tokens/contrast";
import {
  contrast,
  declarations,
  parsePrimitives,
  parseScale,
  parseSemanticTokens,
  parseSemantics,
  toHex,
} from "@khata-club/design-tokens/parse";
import primitivesCss from "@khata-club/design-tokens/primitives.css?raw";
import semanticCss from "@khata-club/design-tokens/semantic.css?raw";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@khata-club/ui";
import type { ReactNode } from "react";

const primitives = parsePrimitives(primitivesCss);
const semantics = parseSemantics(
  semanticCss,
  primitives,
  declarations(primitivesCss).map(([name]) => name),
);
const semanticTokens = parseSemanticTokens(semanticCss);

function TokenTable({
  caption,
  head,
  children,
}: {
  caption: string;
  head: string[];
  children: ReactNode;
}) {
  return (
    <div className="my-6 w-full">
      <Table caption={caption} hideCaption>
        <TableHeader>
          <TableRow>
            {head.map((label) => (
              <TableHead key={label}>{label}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>{children}</TableBody>
      </Table>
    </div>
  );
}

function Name({ children }: { children: ReactNode }) {
  return (
    <code className="rounded-xs bg-surface-sunken px-2 py-1 text-xs text-content-primary">
      {children}
    </code>
  );
}

function Swatch({ token }: { token: string }) {
  return (
    <span
      className="inline-block size-8 shrink-0 rounded-sm border border-edge"
      style={{ background: `var(${token})` }}
    />
  );
}

export function ReferenceTable({
  caption,
  head,
  rows,
}: {
  caption: string;
  head: string[];
  rows: Array<[name: string, ...cells: ReactNode[]]>;
}) {
  return (
    <TokenTable caption={caption} head={head}>
      {rows.map((row) => (
        <TableRow key={row[0]}>
          {row.map((cell, cellIndex) => (
            <TableCell key={String(head[cellIndex])}>
              {cellIndex === 0 ? <code>{cell}</code> : cell}
            </TableCell>
          ))}
        </TableRow>
      ))}
    </TokenTable>
  );
}

export function Ramp({ family }: { family: string }) {
  const steps = [...primitives.entries()]
    .filter(([name]) => name.startsWith(`--color-${family}-`))
    .sort(
      (a, b) => Number(a[0].split("-").pop()) - Number(b[0].split("-").pop()),
    );

  return (
    <div className="my-6 flex w-full flex-wrap gap-1">
      {steps.map(([name, rgb]) => (
        <div key={name} className="flex min-w-16 flex-1 flex-col gap-1">
          <div
            className="h-16 rounded-sm border border-edge"
            style={{ background: `var(${name})` }}
          />
          <span className="text-2xs text-content-muted">
            {name.split("-").pop()}
          </span>
          <span className="text-2xs text-content-subtle">{toHex(rgb)}</span>
        </div>
      ))}
    </div>
  );
}

export function SemanticTable({ prefix }: { prefix: string }) {
  const rows = [...semanticTokens.entries()].filter(([name]) =>
    name.startsWith(prefix),
  );

  return (
    <TokenTable
      caption={`${prefix} semantic tokens`}
      head={["Token", "Preview", "Light", "Dark", "Definition"]}
    >
      {rows.map(([name, raw]) => {
        const resolved = semantics.get(name);
        return (
          <TableRow key={name}>
            <TableCell>
              <Name>{name}</Name>
            </TableCell>
            <TableCell>
              <Swatch token={name} />
            </TableCell>
            <TableCell>
              {resolved ? toHex(resolved.light) : "dynamic"}
            </TableCell>
            <TableCell>{resolved ? toHex(resolved.dark) : "dynamic"}</TableCell>
            <TableCell className="text-xs">{raw}</TableCell>
          </TableRow>
        );
      })}
    </TokenTable>
  );
}

function Verdict({ ratio, min }: { ratio: number; min: number }) {
  const pass = ratio >= min;
  const label = ratio >= 7 && min === AA_TEXT ? "AAA" : pass ? "AA" : "fail";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-2xs font-semibold ${
        pass ? "bg-success-bg text-success-fg" : "bg-danger-bg text-danger-fg"
      }`}
    >
      {ratio.toFixed(2)} · {label}
    </span>
  );
}

export function ContrastTable() {
  return (
    <TokenTable
      caption="Contrast contract"
      head={["Foreground", "Background", "Light", "Dark", "Requirement"]}
    >
      {contrastPairs.map(({ fg, bg, min = AA_TEXT, note }) => {
        const [foreground, background] = getContrastPair(semantics, fg, bg);

        return (
          <TableRow key={`${fg}-${bg}`}>
            <TableCell>
              <Name>{fg}</Name>
            </TableCell>
            <TableCell>
              <Name>{bg}</Name>
            </TableCell>
            <TableCell>
              <Verdict
                ratio={contrast(foreground.light, background.light)}
                min={min}
              />
            </TableCell>
            <TableCell>
              <Verdict
                ratio={contrast(foreground.dark, background.dark)}
                min={min}
              />
            </TableCell>
            <TableCell className="text-xs">{note}</TableCell>
          </TableRow>
        );
      })}
    </TokenTable>
  );
}

export function BothThemes({ children }: { children: ReactNode }) {
  return (
    <div className="my-6 grid gap-4 sm:grid-cols-2">
      {(["light", "dark"] as const).map((theme) => (
        <div
          key={theme}
          data-theme={theme}
          className="flex flex-col gap-3 rounded-card border border-edge bg-canvas p-6"
        >
          <span className="text-xs font-semibold tracking-eyebrow text-content-muted uppercase">
            {theme}
          </span>
          {children}
        </div>
      ))}
    </div>
  );
}

export function ScaleTable({
  prefix,
  sample,
  head = "Preview",
  source = "primitives",
}: {
  prefix: string;
  sample: (token: string, value: string) => ReactNode;
  head?: string;
  source?: "primitives" | "semantic";
}) {
  const css = source === "semantic" ? semanticCss : primitivesCss;
  const rows = parseScale(css, prefix);

  return (
    <TokenTable caption={`${prefix} scale`} head={["Token", "Value", head]}>
      {rows.map(([name, value]) => (
        <TableRow key={name}>
          <TableCell>
            <Name>{name.replace(prefix, "").replace(/^-/, "") || "base"}</Name>
          </TableCell>
          <TableCell className="text-xs">{value}</TableCell>
          <TableCell>{sample(name, value)}</TableCell>
        </TableRow>
      ))}
    </TokenTable>
  );
}

export function SpacingSample(token: string) {
  return (
    <span
      className="block h-4 rounded-xs bg-brand"
      style={{ width: `var(${token})` }}
    />
  );
}

export function RadiusSample(token: string) {
  return (
    <span
      className="block size-16 border border-edge bg-brand-subtle"
      style={{ borderRadius: `var(${token})` }}
    />
  );
}

export function ElevationSample(token: string) {
  return (
    <span
      className="block size-16 rounded-md bg-surface"
      style={{ boxShadow: `var(${token})` }}
    />
  );
}

export function TypeScale() {
  const rows = parseScale(primitivesCss, "--text-").filter(
    ([name]) => !name.includes("--line-height"),
  );
  return (
    <TokenTable caption="Type scale" head={["Token", "Value", "Sample"]}>
      {rows.map(([name, value]) => (
        <TableRow key={name}>
          <TableCell>
            <Name>{name}</Name>
          </TableCell>
          <TableCell className="text-xs">{value}</TableCell>
          <TableCell>
            <span style={{ fontSize: `var(${name})` }}>
              Verified data, every card
            </span>
          </TableCell>
        </TableRow>
      ))}
    </TokenTable>
  );
}

export function MotionScale() {
  const rows = parseScale(primitivesCss, "--duration-");
  return (
    <TokenTable
      caption="Motion durations"
      head={["Token", "Value", "Sample on hover"]}
    >
      {rows.map(([name, value]) => (
        <TableRow key={name}>
          <TableCell>
            <Name>{name}</Name>
          </TableCell>
          <TableCell className="text-xs">{value}</TableCell>
          <TableCell>
            <span
              className="block h-4 w-8 rounded-xs bg-brand transition-all ease-out-quart hover:w-48"
              style={{ transitionDuration: `var(${name})` }}
            />
          </TableCell>
        </TableRow>
      ))}
    </TokenTable>
  );
}
