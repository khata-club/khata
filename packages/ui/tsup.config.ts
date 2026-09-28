import { defineConfig } from "tsup";

/**
 * JavaScript only.
 *
 * Declarations are emitted separately by `tsc -p tsconfig.build.json`, not by
 * tsup's `dts` option: that option is backed by rollup-plugin-dts, which
 * reads TypeScript 5.x compiler internals and throws against the TypeScript 7
 * this workspace is standardised on. Letting `tsc` emit its own types is the
 * fix, and is one fewer reimplementation of the type system in the pipeline.
 */
export default defineConfig({
  entry: ["src/index.ts"],
  /* ESM only. Every consumer Vite, Astro, WXT is an ESM bundler, so a CJS
   * build would double the output for no reader. */
  format: ["esm"],
  dts: false,
  sourcemap: true,
  clean: true,
  treeshake: true,
  /* Declared as peers in package.json, so they must resolve to the host app's
   * copy. Bundling either gives the consumer two Reacts and hooks that throw
   * at runtime. */
  external: ["react", "react-dom"],
  esbuildOptions(options) {
    options.jsx = "automatic";
  },
});
