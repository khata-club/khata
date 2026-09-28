import { defineConfig } from "tsup";

/* TypeScript emits declarations because tsup's declaration plugin is not
 * compatible with this workspace's TypeScript version. */
export default defineConfig({
  entry: ["src/index.ts"],
  /* Current consumers use ESM. */
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
