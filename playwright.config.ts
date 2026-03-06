// playwright.config.ts
import { defineConfig, devices } from '@playwright/test'
import { config } from 'dotenv'

// Load .env.local first (takes priority), then .env for fallback vars
config({ path: '.env.local', override: false })
config({ path: '.env', override: false })

export default defineConfig({
  testDir: './tests/smoke',
  timeout: 30_000,
  retries: 0,
  fullyParallel: false, // run tests sequentially to avoid port conflicts
  use: {
    baseURL: 'http://localhost:3000',
    headless: true,
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
  },
  projects: [
    // Chromium only — Firefox does not resolve *.localhost subdomains
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI, // reuse a running dev server locally; always start fresh in CI
    timeout: 120_000,
  },
})
