import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

// Library build: ESM only, Vue and other runtime deps external, one output module per source
// module so consumers can tree-shake individual components. CSS is built separately
// (`build` script) into dist/styles.css.
const external = [
  /^vue$/,
  /^reka-ui/,
  /^@lucide\/vue/,
  /^class-variance-authority/,
  /^clsx/,
  /^tailwind-merge/,
  /^@khata\/ui/,
]

export default defineConfig({
  plugins: [vue(), tailwindcss()],
  build: {
    lib: {
      entry: fileURLToPath(new URL('./src/index.ts', import.meta.url)),
      formats: ['es'],
    },
    rollupOptions: {
      external,
      output: {
        preserveModules: true,
        preserveModulesRoot: 'src',
        entryFileNames: '[name].js',
      },
    },
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.ts'],
  },
})
