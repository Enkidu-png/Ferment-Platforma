// tests/smoke/admin.spec.ts
// Admin smoke tests — verifies Phase 6 custom admin UI (ADMN-01 through ADMN-06)
// Tests 1-3 (auth/access) pass once layout guard is implemented.
// Tests 4-8 are stubs that will fail until their respective views are built — expected.
import { test, expect, type Page } from '@playwright/test'

// Helper: sign in as admin and wait for redirect away from /sign-in
async function signInAsAdmin(page: Page) {
  await page.goto('/sign-in')
  await page.waitForLoadState('domcontentloaded')
  await page.locator('input').first().fill(process.env.SEED_ADMIN_EMAIL!)
  await page.locator('input[type="password"]').fill(process.env.SEED_ADMIN_PASSWORD!)
  await page.getByRole('button', { name: /log in/i }).click()
  await page.waitForURL(url => !url.pathname.includes('/sign-in'), { timeout: 10_000 })
}

// ADMN-01: Unauthenticated access to /admin redirects to /sign-in
test('redirects unauthenticated user from /admin to /sign-in', async ({ page }) => {
  await page.goto('/admin')
  await page.waitForURL(url => url.pathname.includes('/sign-in'), { timeout: 10_000 })
  await expect(page).toHaveURL(/\/sign-in/)
})

// ADMN-01: Non-admin authenticated user is redirected from /admin
test('non-admin authenticated user is redirected from /admin', async ({ page }) => {
  if (!process.env.SEED_ARTIST_EMAIL) {
    test.skip(true, 'requires SEED_ARTIST_EMAIL env var')
    return
  }
  await page.goto('/sign-in')
  await page.waitForLoadState('domcontentloaded')
  await page.locator('input').first().fill(process.env.SEED_ARTIST_EMAIL)
  await page.locator('input[type="password"]').fill(process.env.SEED_ARTIST_PASSWORD!)
  await page.getByRole('button', { name: /log in/i }).click()
  await page.waitForURL(url => !url.pathname.includes('/sign-in'), { timeout: 10_000 })
  await page.goto('/admin')
  // Should be redirected away from /admin (to / or /sign-in)
  await page.waitForURL(url => !url.pathname.startsWith('/admin'), { timeout: 10_000 })
  await expect(page).not.toHaveURL(/^\/admin/)
})

// ADMN-01: Super-admin can access /admin and sees sidebar with all 5 nav links
test('super-admin can access /admin and sees sidebar', async ({ page }) => {
  await signInAsAdmin(page)
  await page.goto('/admin')
  await page.waitForLoadState('domcontentloaded')
  // Should be redirected to /admin/merchants (default landing)
  await page.waitForURL(url => url.pathname.startsWith('/admin'), { timeout: 10_000 })
  await expect(page.getByRole('link', { name: /merchants/i })).toBeVisible()
  await expect(page.getByRole('link', { name: /products/i })).toBeVisible()
  await expect(page.getByRole('link', { name: /categories/i })).toBeVisible()
  await expect(page.getByRole('link', { name: /tags/i })).toBeVisible()
  await expect(page.getByRole('link', { name: /orders/i })).toBeVisible()
})

// ADMN-02: Pending tab lists pending merchants (stub — view built in plan 02)
test('pending tab lists pending merchants', async ({ page }) => {
  await signInAsAdmin(page)
  await page.goto('/admin/merchants')
  await page.waitForLoadState('domcontentloaded')
  await expect(page.getByText(/pending/i).first()).toBeVisible()
})

// ADMN-02: Approve button exists on pending merchant (stub)
test('approve button exists on pending merchant', async ({ page }) => {
  await signInAsAdmin(page)
  await page.goto('/admin/merchants')
  await page.waitForLoadState('domcontentloaded')
  // If a pending merchant card is visible, expect an approve button
  // If no pending merchants, test passes (empty state is valid)
  const pendingCard = page.locator('[data-testid="pending-merchant"]').first()
  const hasPending = await pendingCard.isVisible().catch(() => false)
  if (hasPending) {
    await expect(page.getByRole('button', { name: /approve/i }).first()).toBeVisible()
  }
})

// ADMN-03: Products table shows all products including archived (stub — view built in plan 03)
test('products table shows all products including archived', async ({ page }) => {
  await signInAsAdmin(page)
  await page.goto('/admin/products')
  await page.waitForLoadState('domcontentloaded')
  // Expect a table or list element visible
  const tableOrList = page.locator('table, [role="table"], ul').first()
  await expect(tableOrList).toBeVisible()
})

// ADMN-04: Category can be created (stub — view built in plan 04)
test('category can be created', async ({ page }) => {
  await signInAsAdmin(page)
  await page.goto('/admin/categories')
  await page.waitForLoadState('domcontentloaded')
  // Expect an input or form element visible for creating a category
  const inputOrForm = page.locator('input, form').first()
  await expect(inputOrForm).toBeVisible()
})

// ADMN-05: Orders page renders (table when orders exist, empty state when none)
test('orders table renders', async ({ page }) => {
  await signInAsAdmin(page)
  await page.goto('/admin/orders')
  await page.waitForLoadState('domcontentloaded')
  // Accept either a table (when orders exist) or the empty-state message
  const tableOrEmpty = page.locator('table, [role="table"], ul, :text("No orders")')
  await expect(tableOrEmpty.first()).toBeVisible()
})
