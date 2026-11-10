import base from './playwright.config'
import { defineConfig } from '@playwright/test'

export default defineConfig({
  ...base,
  testMatch: /.*\.bench\.ts/,
  timeout: 600_000,
})
