import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'
import tailwindcss from '@tailwindcss/vite'

// In development the dashboard talks to `wrangler dev` for apps/dak-api on :8787. In
// production the dashboard Worker forwards the same paths over a service binding, so the
// browser only ever sees one origin (session cookies stay first-party).
const api = 'http://localhost:8787'

export default defineConfig({
  plugins: [vue(), vueDevTools(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5174,
    proxy: { '/api': api, '/auth': api, '/health': api },
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.ts'],
  },
})
