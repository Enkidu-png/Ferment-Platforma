// tests/smoke/rls-isolation.spec.ts
// RLS isolation test — validates tenant isolation at runtime (Phase 4 core goal)
// Requires: seed data from Phase 3 (ceramics-by-ana and woodworks-jan tenants with products)
import { test, expect } from '@playwright/test'

test('ceramics-by-ana storefront loads its own products', async ({ page }) => {
  await page.goto('http://ceramics-by-ana.localhost:3000')
  await page.waitForLoadState('domcontentloaded')

  // Wait for at least one ceramics-by-ana product to render
  // This ensures products have loaded before we assert absence of other tenant's products
  // Using actual seeded product names from scripts/seed.ts
  await expect(
    page.getByText(/Handmade Stoneware Mug|Ceramic Salad Bowl|Flower Vase|Espresso Cup Set|Ceramic Side Plate|Ramen Bowl/i).first()
  ).toBeVisible({ timeout: 15_000 })
})

test('ceramics-by-ana storefront never shows woodworks-jan products (RLS enforcement)', async ({ page }) => {
  await page.goto('http://ceramics-by-ana.localhost:3000')
  await page.waitForLoadState('domcontentloaded')

  // Gate: wait for the storefront product area to render with ceramics-by-ana products
  // (prevents vacuous pass before products load)
  await expect(page.getByText(/curated for you/i)).toBeVisible({ timeout: 15_000 })

  // Wait for products to actually load — use a ceramics-by-ana product as the load gate
  await expect(
    page.getByText(/Handmade Stoneware Mug|Ceramic Salad Bowl|Ramen Bowl/i).first()
  ).toBeVisible({ timeout: 15_000 })

  // Assert woodworks-jan product names are not present
  // These exact names come from the woodworks-jan seed data in scripts/seed.ts
  await expect(page.getByText('Oak Serving Board')).not.toBeVisible()
  await expect(page.getByText('Walnut Key Tray')).not.toBeVisible()
  await expect(page.getByText('Pine Floating Shelf')).not.toBeVisible()
  await expect(page.getByText('Maple Jewelry Box')).not.toBeVisible()
})
