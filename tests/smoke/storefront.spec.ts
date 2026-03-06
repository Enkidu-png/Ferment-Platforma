// tests/smoke/storefront.spec.ts
// Storefront smoke tests — verifies subdomain routing and page structure
// Depends on seed data from Plan 01: ceramics-by-ana tenant with pottery products
//
// NOTE: Product listing tests are Phase 4 concerns. The tRPC procedures for
// products/categories are still Payload-backed and will be migrated in Phase 4.
// These tests verify what Phase 3 delivers: subdomain routing works and the
// storefront shell renders without a hard error.
import { test, expect } from '@playwright/test'

test('ceramics-by-ana storefront loads via subdomain', async ({ page }) => {
  // Chromium resolves *.localhost natively — no /etc/hosts change needed
  await page.goto('http://ceramics-by-ana.localhost:3000')
  await page.waitForLoadState('domcontentloaded')
  // Middleware should route this to the ceramics-by-ana storefront
  // The page should not be a 404 or error page — it should render the shop shell
  const response = await page.goto('http://ceramics-by-ana.localhost:3000')
  expect(response?.status()).not.toBe(404)
  await expect(page.locator('body')).not.toBeEmpty()
})

test('ceramics-by-ana storefront renders shop shell (Curated for you)', async ({ page }) => {
  await page.goto('http://ceramics-by-ana.localhost:3000')
  await page.waitForLoadState('domcontentloaded')
  // The storefront shell renders with the product area heading
  // (Products load from tRPC which is migrated in Phase 4)
  await expect(page.getByText(/curated for you/i)).toBeVisible({ timeout: 15_000 })
})

test('ceramics-by-ana storefront does not show woodworks-jan products', async ({ page }) => {
  await page.goto('http://ceramics-by-ana.localhost:3000')
  await page.waitForLoadState('domcontentloaded')
  // Cross-tenant product names must not appear on this storefront
  await expect(page.getByText(/oak serving board|walnut key tray/i)).not.toBeVisible()
})

test('storefront filters sidebar renders', async ({ page }) => {
  await page.goto('http://ceramics-by-ana.localhost:3000')
  await page.waitForLoadState('domcontentloaded')
  // The filters sidebar should render regardless of product loading state
  await expect(page.getByText(/filters/i)).toBeVisible({ timeout: 15_000 })
})
