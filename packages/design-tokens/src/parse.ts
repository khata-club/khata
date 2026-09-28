/** Shared token parsing for CI and Storybook. */

export type Rgb = { r: number; g: number; b: number };
export type Theme = "light" | "dark";

/** OKLCH -> linear sRGB -> gamma-encoded sRGB, per the Oklab specification. */
export function oklchToRgb(L: number, C: number, hDeg: number): Rgb {
  const h = (hDeg * Math.PI) / 180;
  const a = C * Math.cos(h);
  const b = C * Math.sin(h);

  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;

  const linearR = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  const linearG = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  const linearB = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;

  /* Clamp out-of-gamut values to the displayed sRGB colour. */
  const encode = (u: number) => {
    const c = u <= 0.0031308 ? 12.92 * u : 1.055 * u ** (1 / 2.4) - 0.055;
    return Math.min(1, Math.max(0, c));
  };

  return { r: encode(linearR), g: encode(linearG), b: encode(linearB) };
}

/** WCAG 2.x relative luminance. Input is gamma-encoded sRGB in 0..1. */
export function luminance({ r, g, b }: Rgb): number {
  const lin = (u: number) =>
    u <= 0.04045 ? u / 12.92 : ((u + 0.055) / 1.055) ** 2.4;
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** WCAG 2.x contrast ratio, 1..21. Order of arguments does not matter. */
export function contrast(a: Rgb, b: Rgb): number {
  const x = luminance(a);
  const y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

export function toHex({ r, g, b }: Rgb): string {
  const channel = (u: number) =>
    Math.round(u * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${channel(r)}${channel(g)}${channel(b)}`;
}

/** Return normalised custom-property declarations. */
export function declarations(css: string): Array<[string, string]> {
  const decl = /^(--[\w-]+): (.+)$/;
  return css
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split(";")
    .flatMap((chunk) => {
      const line = chunk.trim().replace(/\s+/g, " ");
      /* Drop any selector or brace preceding the first custom property on
       * this chunk, e.g. `} :root { --canvas`. */
      const start = line.indexOf("--");
      const m = start < 0 ? null : decl.exec(line.slice(start));
      if (!m) return [];
      const [, name, value] = m;
      /* Narrow the regular-expression captures for TypeScript. */
      if (name === undefined || value === undefined) return [];
      return [[name, value.trim()] as [string, string]];
    });
}

/** `--color-brand-600: oklch(50.51% 0.2028 264)` */
export function parsePrimitives(css: string): Map<string, Rgb> {
  const out = new Map<string, Rgb>();
  const oklch = /^oklch\( ?([\d.]+)% ([\d.]+) ([\d.]+) ?\)$/;
  for (const [name, value] of declarations(css)) {
    if (!name.startsWith("--color-")) continue;
    const m = oklch.exec(value);
    if (!m) continue;
    const [, lightness, chroma, hue] = m;
    if (lightness === undefined || chroma === undefined || hue === undefined) {
      continue;
    }
    out.set(
      name,
      oklchToRgb(Number(lightness) / 100, Number(chroma), Number(hue)),
    );
  }
  return out;
}

/** Resolve direct aliases and `light-dark()` pairs recursively. */
export function parseSemantics(
  css: string,
  primitives: Map<string, Rgb>,
  knownPrimitives: Iterable<string> = primitives.keys(),
): Map<string, Record<Theme, Rgb>> {
  const definitions = new Map(declarations(css));
  const known = new Set([...primitives.keys(), ...knownPrimitives]);
  const out = new Map<string, Record<Theme, Rgb>>();
  const lightDark = /^light-dark\( ?var\((--[\w-]+)\), var\((--[\w-]+)\) ?\)$/;
  const direct = /^var\((--[\w-]+)\)$/;

  const references = new Map<string, string[]>();
  for (const [name, value] of definitions) {
    const refs = [...value.matchAll(/var\((--[\w-]+)\)/g)].flatMap((match) =>
      match[1] ? [match[1]] : [],
    );
    references.set(name, refs);
    for (const ref of refs) {
      if (!known.has(ref) && !definitions.has(ref)) {
        throw new Error(`${name} references an undefined token: ${ref}`);
      }
    }
  }

  const visited = new Set<string>();
  const visit = (name: string, path: string[]) => {
    if (path.includes(name)) {
      throw new Error(`Token cycle: ${[...path, name].join(" -> ")}`);
    }
    if (visited.has(name)) return;
    for (const ref of references.get(name) ?? []) {
      if (definitions.has(ref)) visit(ref, [...path, name]);
    }
    visited.add(name);
  };
  for (const name of definitions.keys()) visit(name, []);

  const resolve = (
    name: string,
    theme: Theme,
    path: string[] = [],
  ): Rgb | undefined => {
    const primitive = primitives.get(name);
    if (primitive) return primitive;

    const value = definitions.get(name);
    if (!value) return undefined;
    if (path.includes(name)) {
      throw new Error(`Token cycle: ${[...path, name].join(" -> ")}`);
    }

    const pair = lightDark.exec(value);
    if (pair) {
      const ref = theme === "light" ? pair[1] : pair[2];
      return ref ? resolve(ref, theme, [...path, name]) : undefined;
    }

    const one = direct.exec(value);
    if (one) {
      const ref = one[1];
      return ref ? resolve(ref, theme, [...path, name]) : undefined;
    }

    return undefined;
  };

  for (const name of definitions.keys()) {
    const light = resolve(name, "light");
    const dark = resolve(name, "dark");
    if (light && dark) out.set(name, { light, dark });
  }

  return out;
}

/** Raw semantic declarations, including values that depend on a backdrop. */
export function parseSemanticTokens(css: string): Map<string, string> {
  return new Map(declarations(css));
}

/**
 * Non-colour scale values, for the Typography / Spacing / Radii / Motion
 * documentation pages: `--radius-card: 1.5rem` -> `["--radius-card", "1.5rem"]`.
 */
export function parseScale(
  css: string,
  prefix: string,
): Array<[string, string]> {
  return declarations(css).filter(
    ([name, value]) => name.startsWith(prefix) && !value.startsWith("oklch("),
  );
}
