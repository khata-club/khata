import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  dialect: 'sqlite',
  schema: ['./src/db/control.ts', './src/db/auth.ts'],
  out: './migrations/control',
})
